import os
from datetime import datetime
from typing import Dict, Any, Tuple
import pandas as pd

from core.validator import SchemaValidator


class CsvTradeReader:
    """
    Parses, cleans, and normalizes trade data from arbitrary CSV files (S.O.L.I.D SRP).
    Does not assume file has 'OPD' in its name.
    """

    @classmethod
    def read_and_validate(cls, filepath: str) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")

        # Quick header peek
        df_peek = pd.read_csv(filepath, nrows=2, dtype=str)
        detected_headers = [c.strip() for c in df_peek.columns]

        is_valid, missing_headers = SchemaValidator.validate_headers(detected_headers)
        if not is_valid:
            missing_str = ", ".join(missing_headers)
            raise ValueError(
                f"Invalid Trade File: Missing mandatory header(s): [{missing_str}]. "
                f"Expected trade export columns ('contractcode', 'transactiontype', 'qtybalance', and account number)."
            )

        # Full read
        df = pd.read_csv(filepath, dtype=str)
        df.columns = [c.strip() for c in df.columns]

        # Drop invalid rows where mandatory values are all null
        req_subset = [c for c in SchemaValidator.MANDATORY_COLUMNS if c in df.columns]
        df = df.dropna(subset=req_subset, how="all")
        if "contractcode" in df.columns:
            df = df[df["contractcode"].str.strip().fillna("") != ""]

        if df.empty:
            raise ValueError(f"No valid trade rows found in {os.path.basename(filepath)}")

        # Normalize account column
        acc_col = "clientaccountnumber" if "clientaccountnumber" in df.columns else "clientnumber"
        df["__account__"] = df[acc_col].fillna("").astype(str).str.strip()
        df = df[df["__account__"] != ""]
        df["__row_id__"] = df.index.astype(str)

        # Client group extraction
        client_group = "SYM"
        if "clientgroup" in df.columns:
            grp = df["clientgroup"].dropna().str.strip()
            grp = grp[grp != ""]
            if not grp.empty:
                client_group = grp.iloc[0]

        # Date extraction
        default_date = None
        if "datestr" in df.columns:
            d_val = df["datestr"].dropna().str.strip()
            d_val = d_val[d_val != ""]
            if not d_val.empty:
                default_date = d_val.iloc[0]

        # Products
        products = []
        if "sectyp" in df.columns:
            products = sorted([p for p in df["sectyp"].dropna().str.strip().str.upper().unique() if p])

        # Accounts summary
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
