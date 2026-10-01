import os
import glob
import math
import tempfile
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd

from core.models import EXCEL_HEADERS, TradeAllocation
from core.reader import CsvTradeReader
from core.validator import SchemaValidator
from core.strategies import get_price_strategy
from core.allocator import TradeTransferAllocator
from core.exporter import InstitutionalExcelExporter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sanitize_json_val(val: Any) -> Any:
    """Replaces NaN, pd.NA, and Infinity with None so JSON serialization adheres to RFC 8259."""
    if val is None or pd.isna(val):
        return None
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return None
    return val


def sanitize_for_json(data: Any) -> Any:
    """Recursively converts all NaNs, Infs, and NA values into None for valid JSON serialization."""
    if isinstance(data, dict):
        return {k: sanitize_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_for_json(item) for item in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
        return data
    elif data is None or pd.isna(data):
        return None
    return data


class TradeService:
    """
    Application Service layer orchestrating data caching, queries, and business workflows (S.O.L.I.D DIP).
    """

    def __init__(self):
        self.file_path: Optional[str] = None
        self.df: Optional[pd.DataFrame] = None
        self.metadata: Dict[str, Any] = {}
        self.row_id_map: Dict[str, Dict[str, Any]] = {}

    def scan_workspace_csvs(self) -> List[Dict[str, Any]]:
        csv_files = []
        patterns = [
            os.path.join(BASE_DIR, "*.csv"),
            os.path.join(BASE_DIR, "*", "*.csv")
        ]
        for p in patterns:
            for f in glob.glob(p):
                rel = os.path.relpath(f, BASE_DIR)
                try:
                    sz_mb = round(os.path.getsize(f) / (1024 * 1024), 2)
                    mtime = os.path.getmtime(f)
                except OSError:
                    sz_mb = 0
                    mtime = 0
                csv_files.append({
                    "path": f,
                    "rel_path": rel,
                    "name": os.path.basename(f),
                    "size_mb": sz_mb,
                    "mtime": mtime
                })
        csv_files.sort(key=lambda x: x["mtime"], reverse=True)
        return csv_files

    def load_file(self, filepath: str) -> Dict[str, Any]:
        """
        Safely loads a CSV file. If validation fails, raises ValueError and preserves current state.
        """
        new_df, new_meta = CsvTradeReader.read_and_validate(filepath)

        # Build row_id map for rapid O(1) trade lookup
        new_map = {str(r["__row_id__"]): {k: sanitize_json_val(v) for k, v in r.to_dict().items()} for _, r in new_df.iterrows()}

        self.df = new_df
        self.metadata = new_meta
        self.file_path = filepath
        self.row_id_map = new_map

        return sanitize_for_json({
            "success": True,
            "filename": new_meta["filename"],
            "total_rows": new_meta["total_rows"],
            "total_accounts": len(new_meta["accounts_summary"]),
            "client_group": new_meta["client_group"],
            "default_date": new_meta["default_date"],
            "products": new_meta["products"]
        })

    def get_status(self) -> Dict[str, Any]:
        avail_files = self.scan_workspace_csvs()
        is_loaded = self.df is not None

        return sanitize_for_json({
            "loaded": is_loaded,
            "current_file": self.file_path,
            "filename": self.metadata.get("filename"),
            "total_rows": self.metadata.get("total_rows", 0),
            "total_accounts": len(self.metadata.get("accounts_summary", [])),
            "client_group": self.metadata.get("client_group", "SYM"),
            "default_date": self.metadata.get("default_date"),
            "products": self.metadata.get("products", []),
            "available_files": avail_files
        })

    def search_accounts(self, query: str = "") -> List[Dict[str, Any]]:
        accounts = self.metadata.get("accounts_summary", [])
        if not query:
            return accounts[:100]
        q = query.strip().upper()
        matched = [a for a in accounts if q in a["account"].upper()]
        return matched[:100]

    def filter_contracts(
        self,
        accounts: List[str],
        product: str = "ALL",
        query: str = ""
    ) -> Dict[str, Any]:
        if self.df is None:
            return {"contracts": [], "total_contracts": 0, "total_lots": 0}

        mask = pd.Series(True, index=self.df.index)

        if accounts:
            acc_list = [a.strip().upper() for a in accounts if a.strip()]
            if acc_list:
                mask &= self.df["__account__"].str.upper().isin(acc_list)

        if product and product.upper() != "ALL":
            if "sectyp" in self.df.columns:
                mask &= (self.df["sectyp"].fillna("").str.strip().str.upper() == product.upper())

        sub_df = self.df[mask]
        if sub_df.empty:
            return {"contracts": [], "total_contracts": 0, "total_lots": 0}

        group_cols = ["contractcode"]
        for opt_col in ("contractfullname", "contractdescription", "sectyp", "contractexpiry", "expirydate", "strike", "cp"):
            if opt_col in sub_df.columns:
                group_cols.append(opt_col)

        def sum_qty(series):
            tot = 0.0
            for v in series:
                try:
                    if pd.notna(v) and str(v).strip():
                        tot += float(v)
                except ValueError:
                    pass
            return int(tot) if tot.is_integer() else round(tot, 2)

        grouped = sub_df.groupby(group_cols, dropna=False).agg(
            trade_count=("__row_id__", "count"),
            total_lots=("qtybalance", sum_qty),
            accounts=("__account__", lambda x: sorted(list(set(x))))
        ).reset_index()

        if query:
            q_clean = query.strip().upper()
            match_mask = pd.Series(False, index=grouped.index)
            for col in ("contractcode", "contractfullname", "contractdescription"):
                if col in grouped.columns:
                    match_mask |= grouped[col].fillna("").astype(str).str.upper().str.contains(q_clean, regex=False)
            grouped = grouped[match_mask]

        records = []
        total_lots = 0
        for _, row in grouped.iterrows():
            lots = row["total_lots"]
            if isinstance(lots, float) and (math.isnan(lots) or math.isinf(lots)):
                lots = 0
            total_lots += lots
            records.append({
                "contractcode": sanitize_json_val(row.get("contractcode")),
                "contractfullname": sanitize_json_val(row.get("contractfullname")),
                "contractdescription": sanitize_json_val(row.get("contractdescription")),
                "sectyp": sanitize_json_val(row.get("sectyp")),
                "contractexpiry": sanitize_json_val(row.get("contractexpiry")),
                "expirydate": sanitize_json_val(row.get("expirydate")),
                "strike": sanitize_json_val(row.get("strike")),
                "cp": sanitize_json_val(row.get("cp")),
                "trade_count": int(row["trade_count"]) if pd.notna(row["trade_count"]) else 0,
                "available_lots": lots,
                "accounts": row["accounts"]
            })

        records.sort(key=lambda x: x["available_lots"], reverse=True)
        return sanitize_for_json({
            "contracts": records[:150],
            "total_contracts": len(records),
            "total_lots": total_lots
        })

    def get_trades(
        self,
        accounts: List[str],
        contract_codes: List[str],
        product: str = "ALL"
    ) -> List[Dict[str, Any]]:
        if self.df is None:
            return []

        mask = pd.Series(True, index=self.df.index)

        if accounts:
            acc_list = [a.strip().upper() for a in accounts if a.strip()]
            mask &= self.df["__account__"].str.upper().isin(acc_list)

        if product and product.upper() != "ALL":
            if "sectyp" in self.df.columns:
                mask &= (self.df["sectyp"].fillna("").str.strip().str.upper() == product.upper())

        if contract_codes:
            c_list = [c.strip().upper() for c in contract_codes if c.strip()]
            mask &= self.df["contractcode"].fillna("").str.strip().str.upper().isin(c_list)

        sub_df = self.df[mask]
        trades = []
        for _, row in sub_df.iterrows():
            qty_raw = row.get("qtybalance")
            try:
                q_num = float(qty_raw) if qty_raw is not None and pd.notna(qty_raw) else 0.0
                if math.isnan(q_num) or math.isinf(q_num):
                    q_val = 0
                else:
                    q_val = int(q_num) if q_num.is_integer() else q_num
            except (ValueError, TypeError):
                q_val = sanitize_json_val(qty_raw)

            trades.append({
                "row_id": str(row["__row_id__"]),
                "account": sanitize_json_val(row.get("__account__")),
                "sectyp": sanitize_json_val(row.get("sectyp")),
                "contractcode": sanitize_json_val(row.get("contractcode")),
                "contractfullname": sanitize_json_val(row.get("contractfullname")),
                "contractdescription": sanitize_json_val(row.get("contractdescription")),
                "contractexpiry": sanitize_json_val(row.get("contractexpiry")),
                "expirydate": sanitize_json_val(row.get("expirydate")),
                "strike": sanitize_json_val(row.get("strike")),
                "cp": sanitize_json_val(row.get("cp")),
                "transactiontype": sanitize_json_val(row.get("transactiontype")),
                "qtybalance": q_val,
                "price": sanitize_json_val(row.get("price")),
                "settle": sanitize_json_val(row.get("settle")),
                "currency": sanitize_json_val(row.get("currency")),
                "datestr": sanitize_json_val(row.get("datestr"))
            })

        return sanitize_for_json(trades)

    def build_preview(
        self,
        allocations_data: List[Dict[str, Any]],
        price_mode: str = "price",
        global_manual_price: Optional[float] = None,
        custom_date: Optional[str] = None
    ) -> Dict[str, Any]:
        if self.df is None:
            raise ValueError("No data file loaded.")

        # Convert dict payload to TradeAllocation DTOs
        allocations = [
            TradeAllocation(
                row_id=str(a["row_id"]),
                from_account=str(a["from_account"]),
                to_account=str(a["to_account"]),
                transfer_qty=float(a["transfer_qty"]),
                custom_price=float(a["custom_price"]) if a.get("custom_price") is not None else None,
                custom_date=a.get("custom_date")
            )
            for a in allocations_data
            if float(a.get("transfer_qty", 0)) > 0
        ]

        if not allocations:
            raise ValueError("No positive trade allocations selected.")

        price_strategy = get_price_strategy(mode=price_mode, global_manual_price=global_manual_price)

        all_rows, separator_indices, summary = TradeTransferAllocator.allocate(
            allocations=allocations,
            row_id_map=self.row_id_map,
            price_strategy=price_strategy,
            custom_date=custom_date
        )

        formatted_rows = []
        for r in all_rows:
            is_sep = all(c is None for c in r)
            row_cells = []
            for cell_val in r:
                if hasattr(cell_val, "strftime"):
                    row_cells.append(cell_val.strftime("%Y-%m-%d"))
                else:
                    row_cells.append(sanitize_json_val(cell_val))
            formatted_rows.append({
                "is_separator": is_sep,
                "cells": row_cells
            })

        return sanitize_for_json({
            "headers": EXCEL_HEADERS,
            "rows": formatted_rows,
            "summary": summary
        })

    def export_excel(self, raw_rows: List[List[Any]], filename: str) -> str:
        if not raw_rows:
            raise ValueError("No rows provided for Excel export.")

        is_valid, err = SchemaValidator.validate_export_filename(filename)
        if not is_valid:
            raise ValueError(err)

        if not filename.endswith(".xlsx"):
            filename += ".xlsx"

        parsed_rows = []
        separator_indices = set()

        for idx, r in enumerate(raw_rows, start=1):
            if r is None or not r or all(c is None or str(c).strip() == "" for c in r):
                parsed_rows.append([None] * len(EXCEL_HEADERS))
                separator_indices.add(idx)
                continue
            parsed_rows.append(r)

        temp_fd, temp_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(temp_fd)

        InstitutionalExcelExporter.export(
            rows=parsed_rows,
            output_xlsx_path=temp_path,
            separator_row_indices=separator_indices
        )

        return temp_path


# Global Singleton Service Instance
trade_service = TradeService()
