import os
import glob
import math
import uuid
import tempfile
import logging
from typing import List, Dict, Any, Optional

from core.models import EXCEL_HEADERS, TradeAllocation
from core.reader import CsvTradeReader
from core.duck_store import DuckStore
from core.validator import SchemaValidator
from core.strategies import get_price_strategy
from core.allocator import TradeTransferAllocator
from core.exporter import InstitutionalExcelExporter

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def cleanup_partial_uploads():
    """Removes 0-byte or corrupted temporary CSV uploads."""
    upload_dir = os.path.join(BASE_DIR, "uploads")
    if not os.path.isdir(upload_dir):
        return
    for f in glob.glob(os.path.join(upload_dir, "*.csv")):
        try:
            if os.path.getsize(f) == 0:
                os.remove(f)
        except OSError:
            pass


def sanitize_for_json(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: sanitize_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_for_json(v) for v in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
        return data
    elif hasattr(data, "strftime"):
        return data.strftime("%Y-%m-%d")
    return data


def sanitize_json_val(data: Any) -> Any:
    if isinstance(data, float) and (math.isnan(data) or math.isinf(data)):
        return None
    return data


class TradeService:
    """
    Session-scoped Application Service orchestrating queries, allocations, and export.
    Powered by in-process DuckDB engine for zero-ETL analytical execution.
    """

    def __init__(self, session_id: Optional[str] = None):
        self.session_id: Optional[str] = session_id
        self.file_path: Optional[str] = None
        self._store: Optional[DuckStore] = None
        self.metadata: Dict[str, Any] = {}
        self._contract_cache: Dict[str, Any] = {}
        self._trades_cache: Dict[str, Any] = {}

    def reset(self):
        self.close()
        self.session_id = None
        self.file_path = None
        self._store = None
        self.metadata = {}
        self._contract_cache = {}
        self._trades_cache = {}

    def close(self):
        if self._store:
            try:
                self._store.close()
            except Exception:
                pass
            self._store = None

    def _assert_loaded(self):
        if self._store is None:
            raise ValueError("No data file loaded.")
        if self.file_path and not os.path.exists(self.file_path):
            raise FileNotFoundError(f"Source file {self.file_path} no longer exists on disk.")

    # ------------------------------------------------------------------
    # Workspace scanning & file management
    # ------------------------------------------------------------------

    @staticmethod
    def scan_workspace_csvs() -> List[Dict[str, Any]]:
        csv_files = []
        seen_paths = set()
        workspace_dir = os.path.dirname(BASE_DIR)

        patterns = [
            os.path.join(workspace_dir, "*.csv"),
            os.path.join(workspace_dir, "data", "*.csv"),
            os.path.join(workspace_dir, "uploads", "*.csv"),
            os.path.join(BASE_DIR, "*.csv"),
            os.path.join(BASE_DIR, "data", "*.csv"),
            os.path.join(BASE_DIR, "uploads", "*.csv"),
        ]

        for p in patterns:
            for f in glob.glob(p):
                norm_p = os.path.normcase(os.path.abspath(f))
                if norm_p in seen_paths:
                    continue
                seen_paths.add(norm_p)

                rel = os.path.relpath(f, workspace_dir)
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

    def delete_file(self, filepath: str) -> bool:
        if not filepath:
            raise ValueError("File path cannot be empty.")

        abs_path = os.path.abspath(filepath)
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"File not found: {filepath}")

        workspace_dir = os.path.dirname(BASE_DIR)
        common_prefix = os.path.commonpath([abs_path, workspace_dir])
        if os.path.abspath(common_prefix) != os.path.abspath(workspace_dir):
            raise PermissionError("Cannot delete files outside workspace directory.")

        if self.file_path and os.path.abspath(self.file_path) == abs_path:
            self.reset()

        os.remove(abs_path)
        return True

    # ------------------------------------------------------------------
    # Load File
    # ------------------------------------------------------------------

    def load_file(self, filepath: str) -> Dict[str, Any]:
        """
        Loads CSV using in-process DuckDB engine.
        Sub-second scan time for 250k–1M+ rows.
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")

        self.close()

        store, meta = CsvTradeReader.read_and_validate(filepath)

        if not self.session_id:
            self.session_id = uuid.uuid4().hex[:12]

        self._store = store
        self.metadata = meta
        self.file_path = filepath
        self._contract_cache = {}
        self._trades_cache = {}

        return sanitize_for_json({
            "success": True,
            "session_id": self.session_id,
            "filename": meta["filename"],
            "total_rows": meta["total_rows"],
            "total_records": meta["total_rows"],
            "total_accounts": len(meta["accounts_summary"]),
            "client_group": meta["client_group"],
            "default_date": meta["default_date"],
            "products": meta["products"],
            "accounts": meta["accounts_summary"],
            "backend": "duckdb",
        })

    # ------------------------------------------------------------------
    # Status & Search
    # ------------------------------------------------------------------

    def get_status(self) -> Dict[str, Any]:
        avail_files = self.scan_workspace_csvs()
        is_loaded = self._store is not None

        return sanitize_for_json({
            "loaded": is_loaded,
            "session_id": self.session_id,
            "current_file": self.file_path,
            "filename": self.metadata.get("filename"),
            "total_rows": self.metadata.get("total_rows", 0),
            "total_records": self.metadata.get("total_rows", 0),
            "total_accounts": len(self.metadata.get("accounts_summary", [])),
            "client_group": self.metadata.get("client_group", "SYM"),
            "default_date": self.metadata.get("default_date"),
            "products": self.metadata.get("products", []),
            "accounts": self.metadata.get("accounts_summary", []),
            "available_files": avail_files,
            "backend": "duckdb" if self._store is not None else "none",
        })

    def search_accounts(self, query: str = "") -> List[Dict[str, Any]]:
        accounts = self.metadata.get("accounts_summary", [])
        if not query:
            return accounts
        q = query.strip().upper()
        return [a for a in accounts if q in str(a.get("account", "")).upper()]

    # ------------------------------------------------------------------
    # Contract & Trade Queries
    # ------------------------------------------------------------------

    def filter_contracts(
        self,
        accounts: List[str],
        product: str = "ALL",
        query: str = ""
    ) -> Dict[str, Any]:
        self._assert_loaded()
        cache_key = f"{','.join(sorted([a.strip().upper() for a in accounts if a.strip()]))}:{product.strip().upper()}:{query.strip().upper()}"
        if cache_key in self._contract_cache:
            return self._contract_cache[cache_key]

        res = sanitize_for_json(
            self._store.filter_contracts(accounts, product, query)
        )
        self._contract_cache[cache_key] = res
        return res

    def get_trades(
        self,
        accounts: List[str],
        contract_ids: Optional[List[str]] = None,
        contract_codes: Optional[List[str]] = None,
        product: str = "ALL",
        limit: Optional[int] = None,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        self._assert_loaded()
        cache_key = f"{','.join(sorted([a.strip().upper() for a in accounts if a.strip()]))}:{','.join(sorted([str(c).strip().upper() for c in (contract_ids or [])]))}:{product.strip().upper()}:{limit}:{offset}"
        if cache_key in self._trades_cache:
            return self._trades_cache[cache_key]

        res = sanitize_for_json(
            self._store.get_trades(accounts, contract_ids, contract_codes, product, limit=limit, offset=offset)
        )
        self._trades_cache[cache_key] = res
        return res

    # ------------------------------------------------------------------
    # Build Preview (Allocation engine)
    # ------------------------------------------------------------------

    def build_preview(
        self,
        allocations_data: List[Dict[str, Any]],
        price_mode: str = "price",
        global_manual_price: Optional[float] = None,
        custom_date: Optional[str] = None,
        output_mode: str = "batched"
    ) -> Dict[str, Any]:
        self._assert_loaded()

        allocations = [
            TradeAllocation(
                row_id=str(a["row_id"]),
                from_account=str(a["from_account"]),
                to_account=str(a["to_account"]),
                transfer_qty=float(a["transfer_qty"]),
                custom_price=float(a["custom_price"]) if a.get("custom_price") is not None else None,
                custom_date=a.get("custom_date"),
                price_mode=a.get("price_mode") or None,
            )
            for a in allocations_data
            if float(a.get("transfer_qty", 0)) > 0
        ]

        if not allocations:
            raise ValueError("No positive trade allocations selected.")

        price_strategy = get_price_strategy(mode=price_mode, global_manual_price=global_manual_price)

        row_ids = [str(a.row_id) for a in allocations]
        active_row_map = self._store.get_rows_by_ids(row_ids)
        active_row_map = {
            rid: {k: sanitize_json_val(v) for k, v in row.items()}
            for rid, row in active_row_map.items()
        }

        all_rows, separator_indices, summary = TradeTransferAllocator.allocate(
            allocations=allocations,
            row_id_map=active_row_map,
            price_strategy=price_strategy,
            custom_date=custom_date,
            output_mode=output_mode,
            global_price_mode=price_mode,
            global_manual_price=global_manual_price,
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

    # ------------------------------------------------------------------
    # Excel Export
    # ------------------------------------------------------------------

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
                separator_indices.add(idx + 1)
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


# Global Fallback Service Instance
trade_service = TradeService()

# Run startup scan for partial/empty uploads
cleanup_partial_uploads()
