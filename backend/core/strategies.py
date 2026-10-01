from abc import ABC, abstractmethod
from typing import Optional, Dict, Any


def clean_num(val) -> Optional[float]:
    if val is None:
        return None
    val_str = str(val).strip()
    if val_str == "":
        return None
    try:
        f = float(val_str)
        return int(f) if f.is_integer() else f
    except ValueError:
        return None


class PriceStrategy(ABC):
    """Abstract Strategy for resolving trade price (S.O.L.I.D OCP/LSP)."""

    @abstractmethod
    def resolve_price(
        self,
        row_dict: Dict[str, Any],
        custom_price: Optional[float] = None
    ) -> Optional[float]:
        pass


class MarketPriceStrategy(PriceStrategy):
    """Uses original market price from trade CSV."""

    def resolve_price(
        self,
        row_dict: Dict[str, Any],
        custom_price: Optional[float] = None
    ) -> Optional[float]:
        if custom_price is not None:
            return clean_num(custom_price)
        return clean_num(row_dict.get("price"))


class SettlePriceStrategy(PriceStrategy):
    """Uses exchange settle price from CSV; falls back to market price if null."""

    def resolve_price(
        self,
        row_dict: Dict[str, Any],
        custom_price: Optional[float] = None
    ) -> Optional[float]:
        if custom_price is not None:
            return clean_num(custom_price)
        settle = clean_num(row_dict.get("settle"))
        if settle is not None:
            return settle
        return clean_num(row_dict.get("price"))


class ManualPriceStrategy(PriceStrategy):
    """Uses user-defined static price or per-row override."""

    def __init__(self, global_price: Optional[float] = None):
        self.global_price = global_price

    def resolve_price(
        self,
        row_dict: Dict[str, Any],
        custom_price: Optional[float] = None
    ) -> Optional[float]:
        if custom_price is not None:
            return clean_num(custom_price)
        if self.global_price is not None:
            return clean_num(self.global_price)
        return clean_num(row_dict.get("price"))


def get_price_strategy(mode: str, global_manual_price: Optional[float] = None) -> PriceStrategy:
    mode_lower = (mode or "").strip().lower()
    if mode_lower == "settle":
        return SettlePriceStrategy()
    elif mode_lower == "manual":
        return ManualPriceStrategy(global_price=global_manual_price)
    return MarketPriceStrategy()
