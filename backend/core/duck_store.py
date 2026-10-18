"""
duck_store.py — High-performance DuckDB analytical data store for large institutional trade CSVs.

Key Advantages:
- Direct zero-copy scanning of multi-gigabyte CSV files (250k–1M+ rows) via DuckDB C++ SIMD parser.
- Pure in-memory (:memory:) execution; zero sidecar files (*_cache.db) or Windows file locks.
- Columnar projection pushdown: only queried columns are scanned from disk.
- Bounded memory footprint (2GB ceiling) with optional disk-spill support.
- Sub-second aggregations replacing legacy Pandas itertuples loops.
"""

import os
import math
import logging
from typing import Any, Dict, List, Optional, Tuple, Set

import duckdb
from core.validator import SchemaValidator

logger = logging.getLogger(__name__)

# Standard columns referenced across the TTX workflow
_NEEDED_COLUMNS = [
    "posdatestr", "datestr", "clientgroup", "clientsubgroup",
    "clientnumber", "clientaccountnumber",
    "sectyp", "trdtyp", "trdsubtyp",
    "exchangecode",
    "contractcode", "contractfullname", "contractdescription",
    "contractexpiry", "expirydate", "strike", "cp",
    "transactiontype", "qtybalance",
    "price", "settle", "currency"
]


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (ValueError, TypeError):
        return None


class DuckStore:
    """
    Wraps an in-process DuckDB analytical connection over a trade CSV file.
    Replaces both pd.DataFrame and SQLite DbStore with a single unified, thread-safe engine.
    """

    def __init__(self, filepath: str):
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")

        # Check for empty file
        if os.path.getsize(filepath) == 0:
            raise ValueError(f"Empty trade file: {os.path.basename(filepath)} has 0 bytes.")

        self.filepath = os.path.abspath(filepath)
        self.filename = os.path.basename(filepath)

        # Thread-tuned in-memory DuckDB connection
        self.con = duckdb.connect(database=":memory:")
        self.con.execute("PRAGMA threads = 4;")
        self.con.execute("PRAGMA max_memory = '2GB';")

        self._available_cols: Set[str] = set()
        self._init_views()
        self.metadata = self._extract_metadata()

    def _init_views(self):
        # 1. Peek first row to detect columns and validate schema
        escaped_path = self.filepath.replace("\\", "/")
        try:
            peek_df = self.con.execute(
                f"SELECT * FROM read_csv('{escaped_path}', header=true, all_varchar=true) LIMIT 2"
            ).fetchdf()
        except Exception as e:
            raise ValueError(f"Unable to parse trade CSV headers: {e}")

        raw_columns = [c.strip() for c in peek_df.columns if c]
        if not raw_columns:
            raise ValueError(f"No valid columns detected in {self.filename}")

        is_valid, missing_headers = SchemaValidator.validate_headers(raw_columns)
        if not is_valid:
            raise ValueError(
                f"Invalid Trade File: Missing mandatory header(s): [{', '.join(missing_headers)}]. "
                "Expected trade export columns ('contractcode', 'transactiontype', 'qtybalance', and account number)."
            )

        col_map = {c.strip().lower(): c for c in raw_columns}
        self._available_cols = set(col_map.keys())

        # Resolve account source column
        can_orig = col_map.get("clientaccountnumber")
        cn_orig = col_map.get("clientnumber")
        if can_orig and cn_orig:
            acc_expr = f'COALESCE(NULLIF(TRIM("{can_orig}"), \'\'), NULLIF(TRIM("{cn_orig}"), \'\'))'
        elif can_orig:
            acc_expr = f'NULLIF(TRIM("{can_orig}"), \'\')'
        elif cn_orig:
            acc_expr = f'NULLIF(TRIM("{cn_orig}"), \'\')'
        else:
            raise ValueError("No account column found (expected clientaccountnumber or clientnumber)")

        # Build projected column expressions (defaults to NULL if optional column missing)
        select_exprs = []
        for col in _NEEDED_COLUMNS:
            orig = col_map.get(col)
            if orig:
                select_exprs.append(f'TRIM(CAST("{orig}" AS VARCHAR)) AS {col}')
            else:
                select_exprs.append(f"CAST(NULL AS VARCHAR) AS {col}")

        # Construct contract_id expression
        id_parts = []
        for c in ["contractcode", "sectyp", "contractexpiry", "expirydate", "strike", "cp", "contractdescription"]:
            orig = col_map.get(c)
            if orig:
                id_parts.append(f'COALESCE(TRIM("{orig}"), \'\')')
            else:
                id_parts.append("''")
        contract_id_expr = "UPPER(CONCAT_WS('|', " + ", ".join(id_parts) + "))"

        # Create raw view
        self.con.execute(f"""
            CREATE VIEW raw_input AS 
            SELECT * FROM read_csv('{escaped_path}', header=true, all_varchar=true, auto_detect=true, sample_size=100000);
        """)

        # Create cleaned, normalized in-memory table
        select_body = ", ".join(select_exprs)
        cc_orig = col_map.get("contractcode")
        cc_check = f'"{cc_orig}" IS NOT NULL AND TRIM("{cc_orig}") != \'\'' if cc_orig else "1=1"

        self.con.execute(f"""
            CREATE TABLE trades AS
            SELECT 
                row_number() OVER () AS __row_id__,
                {acc_expr} AS __account__,
                {contract_id_expr} AS __contract_id__,
                {select_body}
            FROM raw_input
            WHERE {acc_expr} IS NOT NULL AND TRIM({acc_expr}) != ''
              AND {cc_check};
        """)

        # Drop raw view to release CSV parser
        self.con.execute("DROP VIEW raw_input;")

        # Pre-aggregate contracts table for instant sub-millisecond filtering
        self.con.execute("""
            CREATE TABLE contracts_summary AS
            SELECT 
                __account__,
                __contract_id__,
                contractcode,
                ANY_VALUE(contractfullname) AS contractfullname,
                ANY_VALUE(contractdescription) AS contractdescription,
                ANY_VALUE(sectyp) AS sectyp,
                ANY_VALUE(contractexpiry) AS contractexpiry,
                ANY_VALUE(expirydate) AS expirydate,
                ANY_VALUE(strike) AS strike,
                ANY_VALUE(cp) AS cp,
                COUNT(*) AS trade_count,
                SUM(TRY_CAST(COALESCE(qtybalance, '0') AS DOUBLE)) AS total_lots
            FROM trades
            GROUP BY __account__, __contract_id__, contractcode;
        """)

    def _extract_metadata(self) -> Dict[str, Any]:
        count_res = self.con.execute("SELECT COUNT(*) FROM trades").fetchone()
        total_rows = count_res[0] if count_res else 0

        acc_rows = self.con.execute("""
            SELECT __account__, COUNT(*) AS trade_count 
            FROM trades 
            GROUP BY __account__ 
            ORDER BY __account__
        """).fetchall()

        accounts_summary = [{"account": r[0], "trade_count": r[1]} for r in acc_rows]
        unique_accs = {a["account"] for a in accounts_summary}

        # Client Group
        cg_res = self.con.execute("""
            SELECT clientgroup FROM trades 
            WHERE clientgroup IS NOT NULL AND TRIM(CAST(clientgroup AS VARCHAR)) != '' 
            LIMIT 1
        """).fetchone()
        client_group = cg_res[0] if cg_res and cg_res[0] else "SYM"

        # Default Date
        d_res = self.con.execute("""
            SELECT datestr FROM trades 
            WHERE datestr IS NOT NULL AND TRIM(CAST(datestr AS VARCHAR)) != '' 
            LIMIT 1
        """).fetchone()
        default_date = d_res[0] if d_res and d_res[0] else None

        # Products
        prod_rows = self.con.execute("""
            SELECT DISTINCT UPPER(TRIM(CAST(sectyp AS VARCHAR))) FROM trades 
            WHERE sectyp IS NOT NULL AND TRIM(CAST(sectyp AS VARCHAR)) != '' 
            ORDER BY 1
        """).fetchall()
        products = [r[0] for r in prod_rows if r[0]]

        return {
            "filepath": self.filepath,
            "filename": self.filename,
            "total_rows": total_rows,
            "client_group": client_group,
            "default_date": default_date,
            "products": products,
            "unique_accounts": unique_accs,
            "accounts_summary": accounts_summary,
        }

    def close(self):
        if self.con:
            try:
                self.con.close()
            except Exception:
                pass
            self.con = None

    # ------------------------------------------------------------------
    # Query API (Mirrors legacy DbStore for zero-friction service integration)
    # ------------------------------------------------------------------

    def get_accounts_summary(self) -> List[Dict[str, Any]]:
        return self.metadata.get("accounts_summary", [])

    def filter_contracts(
        self,
        accounts: List[str],
        product: str = "ALL",
        query: str = "",
    ) -> Dict[str, Any]:
        clauses = []
        params = []

        if accounts:
            clean_accs = [a.strip().upper() for a in accounts if a.strip()]
            if clean_accs:
                placeholders = ",".join(["?"] * len(clean_accs))
                clauses.append(f"UPPER(__account__) IN ({placeholders})")
                params.extend(clean_accs)

        if product and product.upper() != "ALL":
            clauses.append("UPPER(COALESCE(sectyp, '')) = ?")
            params.append(product.strip().upper())

        if query:
            q_clean = f"%{query.strip().upper()}%"
            clauses.append("""(
                UPPER(COALESCE(contractcode, '')) LIKE ? OR 
                UPPER(COALESCE(contractfullname, '')) LIKE ? OR 
                UPPER(COALESCE(contractdescription, '')) LIKE ?
            )""")
            params.extend([q_clean, q_clean, q_clean])

        where_sql = ("WHERE " + " AND ".join(clauses)) if clauses else ""

        sql = f"""
            SELECT 
                __account__,
                __contract_id__,
                contractcode,
                contractfullname,
                contractdescription,
                sectyp,
                contractexpiry,
                expirydate,
                strike,
                cp,
                trade_count,
                total_lots
            FROM contracts_summary
            {where_sql}
            ORDER BY total_lots DESC
        """

        rows = self.con.execute(sql, params).fetchall()

        records = []
        total_lots = 0.0

        for r in rows:
            lots = _safe_float(r[11]) or 0.0
            total_lots += lots
            acc_val = r[0]
            raw_cid = r[1]
            contract_key = f"{acc_val}::{raw_cid}"

            records.append({
                "contract_id": raw_cid,
                "contract_key": contract_key,
                "account": acc_val,
                "accounts": [acc_val],
                "contractcode": r[2],
                "contractfullname": r[3],
                "contractdescription": r[4],
                "sectyp": r[5],
                "contractexpiry": r[6],
                "expirydate": r[7],
                "strike": r[8],
                "cp": r[9],
                "trade_count": r[10],
                "available_lots": int(lots) if lots == int(lots) else round(lots, 2),
            })

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
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        clauses = []
        params = []

        if accounts:
            clean_accs = [a.strip().upper() for a in accounts if a.strip()]
            if clean_accs:
                placeholders = ",".join(["?"] * len(clean_accs))
                clauses.append(f"UPPER(__account__) IN ({placeholders})")
                params.extend(clean_accs)

        if contract_ids:
            has_composite = any("::" in str(c) for c in contract_ids)
            if has_composite:
                pair_clauses = []
                for item in contract_ids:
                    s = str(item).strip()
                    if "::" in s:
                        acc_p, cid_p = s.split("::", 1)
                        pair_clauses.append("(UPPER(__account__) = ? AND UPPER(__contract_id__) = ?)")
                        params.extend([acc_p.strip().upper(), cid_p.strip().upper()])
                    else:
                        pair_clauses.append("UPPER(__contract_id__) = ?")
                        params.append(s.upper())
                if pair_clauses:
                    clauses.append("(" + " OR ".join(pair_clauses) + ")")
            else:
                placeholders = ",".join(["?"] * len(contract_ids))
                clauses.append(f"UPPER(__contract_id__) IN ({placeholders})")
                params.extend([c.strip().upper() for c in contract_ids if c.strip()])

        elif contract_codes:
            placeholders = ",".join(["?"] * len(contract_codes))
            clauses.append(f"UPPER(contractcode) IN ({placeholders})")
            params.extend([c.strip().upper() for c in contract_codes if c.strip()])

        elif product and product.upper() != "ALL":
            clauses.append("UPPER(COALESCE(sectyp, '')) = ?")
            params.append(product.strip().upper())

        where_sql = ("WHERE " + " AND ".join(clauses)) if clauses else ""

        limit_sql = ""
        if limit is not None:
            limit_sql = f"LIMIT {int(limit)} OFFSET {int(offset)}"

        sql = f"""
            SELECT 
                CAST(__row_id__ AS VARCHAR) AS row_id,
                __contract_id__,
                __account__,
                sectyp,
                contractcode,
                contractfullname,
                contractdescription,
                contractexpiry,
                expirydate,
                strike,
                cp,
                transactiontype,
                qtybalance,
                price,
                settle,
                currency,
                datestr
            FROM trades
            {where_sql}
            ORDER BY __row_id__
            {limit_sql}
        """

        rows = self.con.execute(sql, params).fetchall()

        trades = []
        for r in rows:
            qty_raw = r[12]
            try:
                q_num = float(qty_raw) if qty_raw is not None else 0.0
                q_val = int(q_num) if q_num == int(q_num) else q_num
            except (ValueError, TypeError):
                q_val = qty_raw

            trades.append({
                "row_id": str(r[0]),
                "contract_id": r[1],
                "account": r[2],
                "sectyp": r[3],
                "contractcode": r[4],
                "contractfullname": r[5],
                "contractdescription": r[6],
                "contractexpiry": r[7],
                "expirydate": r[8],
                "strike": r[9],
                "cp": r[10],
                "transactiontype": r[11],
                "qtybalance": q_val,
                "price": _safe_float(r[13]),
                "settle": _safe_float(r[14]),
                "currency": r[15],
                "datestr": r[16],
            })

        return trades

    def get_row_by_id(self, row_id: str) -> Optional[Dict[str, Any]]:
        rows = self.get_rows_by_ids([row_id])
        return rows.get(str(row_id))

    def get_rows_by_ids(self, row_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        if not row_ids:
            return {}

        clean_ids = [int(rid) for rid in row_ids if str(rid).isdigit()]
        if not clean_ids:
            return {}

        placeholders = ",".join(["?"] * len(clean_ids))
        sql = f"SELECT * FROM trades WHERE __row_id__ IN ({placeholders})"
        cur = self.con.execute(sql, clean_ids)
        cols = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

        result = {}
        for r in rows:
            row_dict = dict(zip(cols, r))
            rid_str = str(row_dict["__row_id__"])
            result[rid_str] = row_dict

        return result
