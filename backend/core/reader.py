import os
from typing import Dict, Any, Tuple
from core.duck_store import DuckStore


class CsvTradeReader:
    """
    Parses, cleans, and normalizes trade data from arbitrary CSV files using DuckDB (S.O.L.I.D SRP).
    Provides instant zero-copy analytical execution over both small and multi-gigabyte files.
    """

    @classmethod
    def read_and_validate(cls, filepath: str) -> Tuple[DuckStore, Dict[str, Any]]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")

        store = DuckStore(filepath)
        return store, store.metadata
