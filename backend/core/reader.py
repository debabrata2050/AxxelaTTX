import os
from typing import Dict, Any, Tuple, Union
import pandas as pd

from core.validator import SchemaValidator

# Only the columns the application actually uses.
# Dropping unused analytics fields cuts memory ~60-65% on large OPD files.
_NEEDED_COLUMNS = {
    "posdatestr", "datestr", "clientgroup", "clientsubgroup",
    "clientnumber", "clientaccountnumber",
    "sectyp", "trdtyp", "trdsubtyp",
    "exchangecode",                          # → Market ID
    "contractcode", "contractfullname", "contractdescription",
    "contractexpiry", "expirydate", "strike", "cp",
    "transactiontype", "qtybalance",
    "price", "settle", "currency",
}

# Files above this row count are loaded into SQLite instead of RAM.
# 50 k rows ≈ ~40-60 MB CSV — tune downward if memory is still tight.
_SQLITE_THRESHOLD = 50_000


class CsvTradeReader:
    """
    Parses, cleans, and normalizes trade data from arbitrary CSV files (S.O.L.I.D SRP).

    Return type of read_and_validate:
      - small files  → (pd.DataFrame, metadata)
      - large files  → (DbStore,      metadata)   ← avoids loading GBs into RAM
    """

    @classmethod
    def read_and_validate(
        cls, filepath: str
    ) -> Tuple[Union[pd.DataFrame, "DbStore"], Dict[str, Any]]:  # noqa: F821
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")

        # ── Quick header peek ────────────────────────────────────────────────
        df_peek = pd.read_csv(filepath, nrows=2, dtype=str)
        detected_headers = [c.strip() for c in df_peek.columns]

        is_valid, missing_headers = SchemaValidator.validate_headers(detected_headers)
        if not is_valid:
            missing_str = ", ".join(missing_headers)
            raise ValueError(
                f"Invalid Trade File: Missing mandatory header(s): [{missing_str}]. "
                f"Expected trade export columns ('contractcode', 'transactiontype', 'qtybalance', and account number)."
            )

        # ── Row count probe (cheap: count newlines) ──────────────────────────
        with open(filepath, "rb") as f:
            row_estimate = sum(1 for _ in f) - 1   # subtract header line

        # ── Route: large → SQLite, small → pandas ───────────────────────────
        if row_estimate > _SQLITE_THRESHOLD:
            from core.db_store import build_db_store
            store, metadata = build_db_store(filepath)
            return store, metadata

        # ── Small-file pandas path (unchanged) ───────────────────────────────
        all_cols_lower = {c.strip().lower(): c.strip() for c in detected_headers}
        usecols = [
            all_cols_lower[c] for c in all_cols_lower if c in _NEEDED_COLUMNS
        ]
        for acc_candidate in ("clientaccountnumber", "clientnumber"):
            orig = all_cols_lower.get(acc_candidate)
            if orig and orig not in usecols:
                usecols.append(orig)

        df = pd.read_csv(filepath, dtype=str, usecols=usecols, low_memory=False)
        df.columns = [c.strip() for c in df.columns]

        # ── Drop fully-empty mandatory rows ──────────────────────────────────
        req_subset = [c for c in SchemaValidator.MANDATORY_COLUMNS if c in df.columns]
        df = df.dropna(subset=req_subset, how="all")
        if "contractcode" in df.columns:
            df = df[df["contractcode"].str.strip().fillna("") != ""]

        if df.empty:
            raise ValueError(f"No valid trade rows found in {os.path.basename(filepath)}")

        # ── Normalize account column ──────────────────────────────────────────
        can_col = "clientaccountnumber" if "clientaccountnumber" in df.columns else None
        cn_col  = "clientnumber"        if "clientnumber"        in df.columns else None

        if can_col and cn_col:
            can_vals = df[can_col].fillna("").astype(str).str.strip()
            cn_vals  = df[cn_col].fillna("").astype(str).str.strip()
            df["__account__"] = can_vals.where(can_vals != "", cn_vals)
        elif can_col:
            df["__account__"] = df[can_col].fillna("").astype(str).str.strip()
        elif cn_col:
            df["__account__"] = df[cn_col].fillna("").astype(str).str.strip()
        else:
            df["__account__"] = ""

        df = df[df["__account__"] != ""]
        df["__row_id__"] = df.index.astype(str)

        # ── Unique contract identifier ────────────────────────────────────────
        id_cols = ["contractcode", "sectyp", "contractexpiry", "expirydate", "strike", "cp", "contractdescription"]
        parts = [
            df[c].fillna("").astype(str).str.strip().str.upper() if c in df.columns
            else pd.Series("", index=df.index)
            for c in id_cols
        ]
        contract_id_series = parts[0]
        for p in parts[1:]:
            contract_id_series = contract_id_series + "|" + p
        df["__contract_id__"] = contract_id_series

        # ── Metadata extraction ───────────────────────────────────────────────
        client_group = "SYM"
        if "clientgroup" in df.columns:
            grp = df["clientgroup"].dropna().str.strip()
            grp = grp[grp != ""]
            if not grp.empty:
                client_group = grp.iloc[0]

        default_date = None
        if "datestr" in df.columns:
            d_val = df["datestr"].dropna().str.strip()
            d_val = d_val[d_val != ""]
            if not d_val.empty:
                default_date = d_val.iloc[0]

        products = []
        if "sectyp" in df.columns:
            products = sorted([p for p in df["sectyp"].dropna().str.strip().str.upper().unique() if p])

        acc_counts = df["__account__"].value_counts().to_dict()
        unique_accs = sorted(list(acc_counts.keys()))
        accounts_summary = [
            {"account": acc, "trade_count": int(acc_counts[acc])}
            for acc in unique_accs
        ]

        metadata = {
            "filepath": filepath,
            "filename": os.path.basename(filepath),
            "total_rows": len(df),
            "client_group": client_group,
            "default_date": default_date,
            "products": products,
            "unique_accounts": set(unique_accs),
            "accounts_summary": accounts_summary
        }

        return df, metadata
