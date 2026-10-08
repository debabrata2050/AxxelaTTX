"""
db_store.py — SQLite-backed trade data store for large CSV files.

Strategy
--------
* CSV is read in streaming chunks (never fully in RAM) and bulk-inserted into a
  temporary SQLite database file via executemany (fastest SQLite write path).
* Indexes on __account__ and __contract_id__ make account/contract queries O(log n).
* All filtering/grouping is done with SQL; Python only post-processes the small
  result sets returned by SQLite.
* The DB file lives next to the CSV so it can be reused across Flask reloads.
  It is invalidated when the CSV mtime or size changes.
"""

import os
import math
import sqlite3
import hashlib
import logging
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from core.validator import SchemaValidator

logger = logging.getLogger(__name__)

# Columns the app actually needs (mirrors reader.py _NEEDED_COLUMNS)
_NEEDED_COLUMNS = {
    "posdatestr", "datestr", "clientgroup", "clientsubgroup",
    "clientnumber", "clientaccountnumber",
    "sectyp", "trdtyp", "trdsubtyp",
    "exchangecode",
    "contractcode", "contractfullname", "contractdescription",
    "contractexpiry", "expirydate", "strike", "cp",
    "transactiontype", "qtybalance",
    "price", "settle", "currency",
}

_CHUNK_SIZE = 50_000        # rows per CSV read / SQLite insert batch
_TABLE = "trades"


def _db_path_for(csv_path: str) -> str:
    """Derive a sidecar .db path next to the CSV."""
    base, _ = os.path.splitext(csv_path)
    return base + "_cache.db"


def _csv_fingerprint(csv_path: str) -> str:
    """A cheap fingerprint: mtime + size (no full-file hash needed)."""
    st = os.stat(csv_path)
    raw = f"{csv_path}|{st.st_mtime}|{st.st_size}"
    return hashlib.md5(raw.encode()).hexdigest()


def _is_db_valid(db_path: str, expected_fp: str) -> bool:
    if not os.path.exists(db_path):
        return False
    try:
        con = sqlite3.connect(db_path, timeout=10)
        cur = con.execute("SELECT value FROM _meta WHERE key='fingerprint'")
        row = cur.fetchone()
        con.close()
        return row is not None and row[0] == expected_fp
    except Exception:
        return False


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (ValueError, TypeError):
        return None


class DbStore:
    """
    Wraps a SQLite connection that holds all trade rows for one CSV file.
    Public interface mirrors what TradeService used from pd.DataFrame so the
    service layer needs minimal changes.
    """

    def __init__(self, db_path: str, metadata: Dict[str, Any], columns: List[str]):
        self._db_path = db_path
        self.metadata = metadata
        self._columns = columns          # actual column names in the DB table
        self._con: Optional[sqlite3.Connection] = None

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    def _connect(self) -> sqlite3.Connection:
        if self._con is None:
            self._con = sqlite3.connect(self._db_path, check_same_thread=False, timeout=30)
            self._con.row_factory = sqlite3.Row
        return self._con

    def close(self):
        if self._con:
            self._con.close()
            self._con = None

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------

    def _execute(self, sql: str, params: tuple = ()) -> List[sqlite3.Row]:
        con = self._connect()
        cur = con.execute(sql, params)
        return cur.fetchall()

    def _col(self, name: str) -> bool:
        """Check if a column exists."""
        return name in self._columns

    # ------------------------------------------------------------------
    # Public API (mirrors what TradeService previously read from df)
    # ------------------------------------------------------------------

    def get_accounts_summary(self) -> List[Dict[str, Any]]:
        rows = self._execute(
            f"SELECT __account__, COUNT(*) AS trade_count "
            f"FROM {_TABLE} GROUP BY __account__ ORDER BY __account__"
        )
        return [{"account": r["__account__"], "trade_count": r["trade_count"]} for r in rows]

    def filter_contracts(
        self,
        accounts: List[str],
        product: str = "ALL",
        query: str = "",
    ) -> Dict[str, Any]:
        clauses: List[str] = []
        params: List[Any] = []

        if accounts:
            placeholders = ",".join("?" * len(accounts))
            clauses.append(f"UPPER(__account__) IN ({placeholders})")
            params.extend([a.strip().upper() for a in accounts if a.strip()])

        if product and product.upper() != "ALL":
            clauses.append("UPPER(COALESCE(sectyp,'')) = ?")
            params.append(product.upper())

        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

        # Build GROUP BY from available columns
        group_cols = ["__account__", "__contract_id__", "contractcode"]
        opt_cols = ["contractfullname", "contractdescription", "sectyp",
                    "contractexpiry", "expirydate", "strike", "cp"]
        for c in opt_cols:
            if self._col(c):
                group_cols.append(c)

        select_cols = ", ".join(group_cols)
        sql = (
            f"SELECT {select_cols}, COUNT(*) AS trade_count, "
            f"SUM(CAST(COALESCE(qtybalance,'0') AS REAL)) AS total_lots "
            f"FROM {_TABLE} {where} GROUP BY {select_cols}"
        )
        rows = self._execute(sql, tuple(params))

        if query:
            q_up = query.strip().upper()
            rows = [
                r for r in rows
                if q_up in (r["contractcode"] or "").upper()
                or q_up in (r["contractfullname"] if self._col("contractfullname") else "" or "").upper()
                or q_up in (r["contractdescription"] if self._col("contractdescription") else "" or "").upper()
            ]

        records = []
        total_lots = 0.0
        for r in rows:
            lots = _safe_float(r["total_lots"]) or 0.0
            total_lots += lots
            acc_val = r["__account__"]
            raw_cid = r["__contract_id__"]
            contract_key = f"{acc_val}::{raw_cid}"
            records.append({
                "contract_id": raw_cid,
                "contract_key": contract_key,
                "account": acc_val,
                "accounts": [acc_val],
                "contractcode": r["contractcode"],
                "contractfullname": r["contractfullname"] if self._col("contractfullname") else None,
                "contractdescription": r["contractdescription"] if self._col("contractdescription") else None,
                "sectyp": r["sectyp"] if self._col("sectyp") else None,
                "contractexpiry": r["contractexpiry"] if self._col("contractexpiry") else None,
                "expirydate": r["expirydate"] if self._col("expirydate") else None,
                "strike": r["strike"] if self._col("strike") else None,
                "cp": r["cp"] if self._col("cp") else None,
                "trade_count": r["trade_count"],
                "available_lots": int(lots) if lots == int(lots) else round(lots, 2),
            })

        records.sort(key=lambda x: x["available_lots"], reverse=True)
        return {
            "contracts": records[:250],
            "total_contracts": len(records),
            "total_lots": int(total_lots) if total_lots == int(total_lots) else round(total_lots, 2),
        }

    def get_trades(
        self,
        accounts: List[str],
        contract_ids: Optional[List[str]] = None,
        contract_codes: Optional[List[str]] = None,
        product: str = "ALL",
    ) -> List[Dict[str, Any]]:
        clauses: List[str] = []
        params: List[Any] = []

        if accounts:
            placeholders = ",".join("?" * len(accounts))
            clauses.append(f"UPPER(__account__) IN ({placeholders})")
            params.extend([a.strip().upper() for a in accounts if a.strip()])

        if contract_ids:
            has_composite = any("::" in str(c) for c in contract_ids)
            if has_composite:
                pair_clauses = []
                for item in contract_ids:
                    s = str(item).strip()
                    if "::" in s:
                        acc_p, cid_p = s.split("::", 1)
                        pair_clauses.append(
                            "(UPPER(__account__)=? AND UPPER(__contract_id__)=?)"
                        )
                        params.extend([acc_p.strip().upper(), cid_p.strip().upper()])
                    else:
                        pair_clauses.append("UPPER(__contract_id__)=?")
                        params.append(s.upper())
                if pair_clauses:
                    clauses.append("(" + " OR ".join(pair_clauses) + ")")
            else:
                placeholders = ",".join("?" * len(contract_ids))
                clauses.append(f"UPPER(__contract_id__) IN ({placeholders})")
                params.extend([c.strip().upper() for c in contract_ids if c.strip()])
        elif contract_codes:
            placeholders = ",".join("?" * len(contract_codes))
            clauses.append(f"UPPER(contractcode) IN ({placeholders})")
            params.extend([c.strip().upper() for c in contract_codes if c.strip()])
        elif product and product.upper() != "ALL":
            if self._col("sectyp"):
                clauses.append("UPPER(COALESCE(sectyp,'')) = ?")
                params.append(product.upper())

        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        sql = f"SELECT * FROM {_TABLE} {where}"
        rows = self._execute(sql, tuple(params))

        trades = []
        for r in rows:
            qty_raw = r["qtybalance"]
            try:
                q_num = float(qty_raw) if qty_raw is not None else 0.0
                q_val: Any = int(q_num) if q_num == int(q_num) else q_num
            except (ValueError, TypeError):
                q_val = qty_raw

            trades.append({
                "row_id": r["__row_id__"],
                "contract_id": r["__contract_id__"],
                "account": r["__account__"],
                "sectyp": r["sectyp"] if self._col("sectyp") else None,
                "contractcode": r["contractcode"],
                "contractfullname": r["contractfullname"] if self._col("contractfullname") else None,
                "contractdescription": r["contractdescription"] if self._col("contractdescription") else None,
                "contractexpiry": r["contractexpiry"] if self._col("contractexpiry") else None,
                "expirydate": r["expirydate"] if self._col("expirydate") else None,
                "strike": r["strike"] if self._col("strike") else None,
                "cp": r["cp"] if self._col("cp") else None,
                "transactiontype": r["transactiontype"] if self._col("transactiontype") else None,
                "qtybalance": q_val,
                "price": _safe_float(r["price"]) if self._col("price") else None,
                "settle": _safe_float(r["settle"]) if self._col("settle") else None,
                "currency": r["currency"] if self._col("currency") else None,
                "datestr": r["datestr"] if self._col("datestr") else None,
            })
        return trades

    def get_row_by_id(self, row_id: str) -> Optional[Dict[str, Any]]:
        rows = self._execute(
            f"SELECT * FROM {_TABLE} WHERE __row_id__ = ?", (row_id,)
        )
        if not rows:
            return None
        r = rows[0]
        return {k: r[k] for k in r.keys()}

    def get_rows_by_ids(self, row_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        if not row_ids:
            return {}
        placeholders = ",".join("?" * len(row_ids))
        rows = self._execute(
            f"SELECT * FROM {_TABLE} WHERE __row_id__ IN ({placeholders})",
            tuple(row_ids),
        )
        return {r["__row_id__"]: {k: r[k] for k in r.keys()} for r in rows}


# ---------------------------------------------------------------------------
# Builder — streams CSV → SQLite
# ---------------------------------------------------------------------------

def build_db_store(filepath: str) -> Tuple[DbStore, Dict[str, Any]]:
    """
    Stream-parse a (potentially huge) CSV file into a SQLite sidecar DB and
    return a (DbStore, metadata) tuple.  If a valid cached DB already exists
    for this CSV, the build step is skipped entirely.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    db_path = _db_path_for(filepath)
    fp = _csv_fingerprint(filepath)

    # ── Quick header peek (schema validation) ───────────────────────────────
    df_peek = pd.read_csv(filepath, nrows=2, dtype=str)
    detected_headers = [c.strip() for c in df_peek.columns]

    is_valid, missing_headers = SchemaValidator.validate_headers(detected_headers)
    if not is_valid:
        raise ValueError(
            f"Invalid Trade File: Missing mandatory header(s): [{', '.join(missing_headers)}]. "
            "Expected trade export columns ('contractcode', 'transactiontype', 'qtybalance', and account number)."
        )

    all_cols_lower = {c.strip().lower(): c.strip() for c in detected_headers}

    # Decide which original column names to load
    usecols: List[str] = [
        all_cols_lower[c] for c in all_cols_lower if c in _NEEDED_COLUMNS
    ]
    for acc_candidate in ("clientaccountnumber", "clientnumber"):
        orig = all_cols_lower.get(acc_candidate)
        if orig and orig not in usecols:
            usecols.append(orig)

    # Normalised column names (lowercase, stripped) used inside the DB
    norm_cols = [c.strip().lower() for c in usecols]

    # ── Cache hit: skip rebuild ──────────────────────────────────────────────
    if _is_db_valid(db_path, fp):
        logger.info("DbStore cache hit — reusing %s", db_path)
        con = sqlite3.connect(db_path, check_same_thread=False, timeout=30)
        con.row_factory = sqlite3.Row
        cur = con.execute(f"PRAGMA table_info({_TABLE})")
        db_cols = [row[1] for row in cur.fetchall()]
        con.close()

        meta = _read_metadata_from_db(db_path)
        store = DbStore(db_path, meta, db_cols)
        return store, meta

    # ── Build: stream CSV → SQLite ───────────────────────────────────────────
    logger.info("Building DbStore for %s → %s", filepath, db_path)

    # Remove stale DB if present
    if os.path.exists(db_path):
        os.remove(db_path)

    con = sqlite3.connect(db_path, timeout=60)

    # Pragma tuning for fast bulk inserts
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    con.execute("PRAGMA cache_size=-131072")   # 128 MB page cache
    con.execute("PRAGMA temp_store=MEMORY")

    # Meta table
    con.execute("CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT)")

    # Derive virtual computed columns we add ourselves
    extra_cols = ["__account__", "__contract_id__", "__row_id__"]
    all_db_cols = norm_cols + extra_cols

    col_defs = ", ".join(f'"{c}" TEXT' for c in all_db_cols)
    con.execute(f"CREATE TABLE {_TABLE} ({col_defs})")

    insert_sql = (
        f"INSERT INTO {_TABLE} VALUES ({','.join(['?'] * len(all_db_cols))})"
    )

    # Metadata accumulators
    client_group = "SYM"
    default_date: Optional[str] = None
    products_set: set = set()
    acc_counts: Dict[str, int] = {}
    total_rows = 0
    row_counter = 0

    # Identify account column indices in usecols
    can_idx = norm_cols.index("clientaccountnumber") if "clientaccountnumber" in norm_cols else None
    cn_idx  = norm_cols.index("clientnumber")        if "clientnumber"        in norm_cols else None
    cg_idx  = norm_cols.index("clientgroup")         if "clientgroup"         in norm_cols else None
    ds_idx  = norm_cols.index("datestr")             if "datestr"             in norm_cols else None
    st_idx  = norm_cols.index("sectyp")              if "sectyp"              in norm_cols else None
    cc_idx  = norm_cols.index("contractcode")        if "contractcode"        in norm_cols else None
    ce_idx  = norm_cols.index("contractexpiry")      if "contractexpiry"      in norm_cols else None
    ed_idx  = norm_cols.index("expirydate")          if "expirydate"          in norm_cols else None
    sk_idx  = norm_cols.index("strike")              if "strike"              in norm_cols else None
    cp_idx  = norm_cols.index("cp")                  if "cp"                  in norm_cols else None
    cd_idx  = norm_cols.index("contractdescription") if "contractdescription" in norm_cols else None

    contract_id_idxs = [cc_idx, st_idx, ce_idx, ed_idx, sk_idx, cp_idx, cd_idx]

    def _get(vals: List[Any], idx: Optional[int]) -> str:
        if idx is None or idx >= len(vals):
            return ""
        v = vals[idx]
        return str(v).strip() if v is not None else ""

    con.execute("BEGIN")

    for chunk in pd.read_csv(
        filepath,
        dtype=str,
        usecols=usecols,
        chunksize=_CHUNK_SIZE,
        low_memory=False,
    ):
        chunk.columns = [c.strip().lower() for c in chunk.columns]

        # Re-order to match norm_cols (read_csv may reorder usecols)
        chunk = chunk.reindex(columns=norm_cols)

        batch = []
        for vals in chunk.itertuples(index=False, name=None):
            vals = list(vals)

            # Resolve account
            can_v = _get(vals, can_idx)
            cn_v  = _get(vals, cn_idx)
            account = can_v if can_v else cn_v
            if not account:
                continue  # skip rows without an account

            # Build contract_id
            parts = [_get(vals, i).upper() for i in contract_id_idxs]
            contract_id = "|".join(parts)

            # Skip rows with empty contractcode
            if cc_idx is not None and not _get(vals, cc_idx):
                continue

            row_id = str(row_counter)
            row_counter += 1

            batch.append(tuple(vals) + (account, contract_id, row_id))

            # Accumulate metadata
            acc_counts[account] = acc_counts.get(account, 0) + 1
            if cg_idx is not None and client_group == "SYM":
                cg_v = _get(vals, cg_idx)
                if cg_v:
                    client_group = cg_v
            if ds_idx is not None and default_date is None:
                ds_v = _get(vals, ds_idx)
                if ds_v:
                    default_date = ds_v
            if st_idx is not None:
                st_v = _get(vals, st_idx)
                if st_v:
                    products_set.add(st_v.upper())

        if batch:
            con.executemany(insert_sql, batch)
            total_rows += len(batch)

        # Commit every chunk to keep memory/WAL manageable
        con.execute("COMMIT")
        con.execute("BEGIN")

    con.execute("COMMIT")

    # ── Indexes ──────────────────────────────────────────────────────────────
    con.execute(f'CREATE INDEX idx_account     ON {_TABLE}("__account__")')
    con.execute(f'CREATE INDEX idx_contract_id ON {_TABLE}("__contract_id__")')
    con.execute(f'CREATE INDEX idx_row_id      ON {_TABLE}("__row_id__")')
    con.execute(f'CREATE INDEX idx_acc_cid     ON {_TABLE}("__account__","__contract_id__")')
    if "contractcode" in norm_cols:
        con.execute(f'CREATE INDEX idx_contractcode ON {_TABLE}("contractcode")')

    # ── Persist metadata ─────────────────────────────────────────────────────
    unique_accs = sorted(acc_counts.keys())
    accounts_summary = [
        {"account": acc, "trade_count": acc_counts[acc]}
        for acc in unique_accs
    ]
    import json
    meta = {
        "filepath": filepath,
        "filename": os.path.basename(filepath),
        "total_rows": total_rows,
        "client_group": client_group,
        "default_date": default_date,
        "products": sorted(products_set),
        "unique_accounts": set(unique_accs),
        "accounts_summary": accounts_summary,
    }

    con.execute("INSERT INTO _meta VALUES ('fingerprint', ?)", (fp,))
    con.execute("INSERT INTO _meta VALUES ('metadata_json', ?)", (json.dumps({
        **meta,
        "unique_accounts": list(meta["unique_accounts"]),  # JSON-serialisable
    }),))
    con.commit()
    con.close()

    logger.info("DbStore built: %d rows, %d accounts", total_rows, len(unique_accs))

    store = DbStore(db_path, meta, all_db_cols)
    return store, meta


def _read_metadata_from_db(db_path: str) -> Dict[str, Any]:
    import json
    con = sqlite3.connect(db_path, timeout=10)
    cur = con.execute("SELECT value FROM _meta WHERE key='metadata_json'")
    row = cur.fetchone()
    con.close()
    if not row:
        raise RuntimeError(f"metadata_json missing from {db_path}")
    meta = json.loads(row[0])
    meta["unique_accounts"] = set(meta.get("unique_accounts", []))
    return meta
