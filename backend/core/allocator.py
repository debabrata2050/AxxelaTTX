from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
import pandas as pd

from core.models import EXCEL_HEADERS, TradeAllocation
from core.strategies import PriceStrategy, clean_num, get_price_strategy


def parse_trade_date(val: Any) -> Optional[datetime]:
    if pd.isna(val) or val is None or str(val).strip() == "":
        return None
    if isinstance(val, datetime):
        return val
    val_str = str(val).strip()
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d-%m-%y", "%Y%m%d"):
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            pass
    try:
        dt = pd.to_datetime(val_str, dayfirst=True)
        return dt.to_pydatetime()
    except Exception:
        return None


def clean_str(val: Any) -> Optional[str]:
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    return s if s != "" else None


def flip_side(side: Any) -> str:
    s = str(side).strip().upper() if side else ""
    if s == "B":
        return "S"
    elif s == "S":
        return "B"
    return s


class TradeTransferAllocator:
    """
    Constructs the 2-leg transfer structure:
    - Leg 1: Destination Account (Receives trades with original side B/S)
    - Separator: Blank row
    - Leg 2: Source Account (Surrenders trades with flipped side S/B)
    """

    @classmethod
    def build_transfer_row(
        cls,
        row_dict: Dict[str, Any],
        account: str,
        side: str,
        qty: float,
        price: Optional[float],
        custom_date: Optional[str] = None
    ) -> List[Any]:
        sectyp = clean_str(row_dict.get("sectyp", ""))
        is_opt = (sectyp or "").upper() in ("OPT", "OPTION", "OPTIONS")

        cp_val = clean_str(row_dict.get("cp", "")) if is_opt else None

        strike_val = None
        if is_opt:
            s_raw = clean_str(row_dict.get("strike", ""))
            strike_val = clean_num(s_raw) if s_raw else None

        contract_expiry = parse_trade_date(row_dict.get("contractexpiry", ""))
        exp_date = parse_trade_date(row_dict.get("expirydate", ""))

        market_id = clean_str(row_dict.get("exchangecode", ""))

        # Date
        trade_dt = parse_trade_date(custom_date) if custom_date else None
        if not trade_dt:
            trade_dt = parse_trade_date(row_dict.get("datestr", ""))
        if not trade_dt:
            trade_dt = datetime.now()

        currency = clean_str(row_dict.get("currency", ""))

        return [
            "INTERNAL",                                  # TradeType
            clean_str(row_dict.get("trdtyp", "T")),      # TrdTyp
            clean_str(row_dict.get("trdsubtyp", "TRF")),  # TrdSubtyp
            market_id,                                   # Market ID
            clean_str(row_dict.get("contractcode", "")), # Symbol
            contract_expiry,                             # Contract Expiry
            side,                                        # TransactionTyp
            qty,                                         # Qty
            price,                                       # TradePrice
            sectyp,                                      # Product Type
            cp_val,                                      # C/P
            strike_val,                                  # Strike
            account,                                     # Account
            trade_dt,                                    # Date
            exp_date,                                    # Expdate
            currency,                                    # Currency
            "Transfer",                                  # Comment
            "Charge"                                     # Fees
        ]

    @classmethod
    def allocate(
        cls,
        allocations: List[TradeAllocation],
        row_id_map: Dict[str, Dict[str, Any]],
        price_strategy: PriceStrategy,
        custom_date: Optional[str] = None,
        output_mode: str = "paired",
        global_price_mode: str = "price",
        global_manual_price: Optional[float] = None,
    ) -> Tuple[List[List[Any]], List[int], Dict[str, Any]]:
        def _resolve_price(alloc: TradeAllocation, row_dict: Dict[str, Any]) -> Optional[float]:
            """Use per-row price_mode when set; fall back to global strategy."""
            if alloc.price_mode and alloc.price_mode != global_price_mode:
                row_strategy = get_price_strategy(
                    mode=alloc.price_mode,
                    global_manual_price=alloc.custom_price
                )
                return row_strategy.resolve_price(row_dict, custom_price=alloc.custom_price)
            return price_strategy.resolve_price(row_dict, custom_price=alloc.custom_price)

        # Group allocations by (from_account, to_account)
        routes_map: Dict[Tuple[str, str], List[TradeAllocation]] = {}
        for alloc in allocations:
            key = (alloc.from_account.strip().upper(), alloc.to_account.strip().upper())
            if key not in routes_map:
                routes_map[key] = []
            routes_map[key].append(alloc)

        all_rows: List[List[Any]] = []
        separator_indices: List[int] = []
        total_dest_lots = 0.0
        total_src_lots = 0.0

        if output_mode == "batched":
            # Mode B: All Destination transfers first across ALL accounts
            for (src_acc, dst_acc), alloc_list in routes_map.items():
                for alloc in alloc_list:
                    row_dict = row_id_map.get(alloc.row_id)
                    if not row_dict:
                        continue
                    orig_side = clean_str(row_dict.get("transactiontype", ""))
                    price = _resolve_price(alloc, row_dict)
                    qty = alloc.transfer_qty

                    dest_row = cls.build_transfer_row(
                        row_dict=row_dict,
                        account=dst_acc,
                        side=orig_side,
                        qty=qty,
                        price=price,
                        custom_date=alloc.custom_date or custom_date
                    )
                    all_rows.append(dest_row)
                    total_dest_lots += qty

            # Single blank separator row between all destination transfers and all source reversals
            all_rows.append([None] * len(EXCEL_HEADERS))
            separator_indices.append(len(all_rows))

            # Mode B: All Source reversals second across ALL accounts
            for (src_acc, dst_acc), alloc_list in routes_map.items():
                for alloc in alloc_list:
                    row_dict = row_id_map.get(alloc.row_id)
                    if not row_dict:
                        continue
                    orig_side = clean_str(row_dict.get("transactiontype", ""))
                    rev_side = flip_side(orig_side)
                    price = _resolve_price(alloc, row_dict)
                    qty = alloc.transfer_qty

                    src_row = cls.build_transfer_row(
                        row_dict=row_dict,
                        account=src_acc,
                        side=rev_side,
                        qty=qty,
                        price=price,
                        custom_date=alloc.custom_date or custom_date
                    )
                    all_rows.append(src_row)
                    total_src_lots += qty
        else:
            # Mode A (Default): Paired sequentially by route
            route_idx = 0
            for (src_acc, dst_acc), alloc_list in routes_map.items():
                if route_idx > 0:
                    # Divider between distinct routes
                    all_rows.append([None] * len(EXCEL_HEADERS))
                    separator_indices.append(len(all_rows))

                # Leg 1: Destination Account
                for alloc in alloc_list:
                    row_dict = row_id_map.get(alloc.row_id)
                    if not row_dict:
                        continue
                    orig_side = clean_str(row_dict.get("transactiontype", ""))
                    price = _resolve_price(alloc, row_dict)
                    qty = alloc.transfer_qty

                    dest_row = cls.build_transfer_row(
                        row_dict=row_dict,
                        account=dst_acc,
                        side=orig_side,
                        qty=qty,
                        price=price,
                        custom_date=alloc.custom_date or custom_date
                    )
                    all_rows.append(dest_row)
                    total_dest_lots += qty

                # Separator row between Leg 1 and Leg 2
                all_rows.append([None] * len(EXCEL_HEADERS))
                separator_indices.append(len(all_rows))

                # Leg 2: Source Account (Reversed side)
                for alloc in alloc_list:
                    row_dict = row_id_map.get(alloc.row_id)
                    if not row_dict:
                        continue
                    orig_side = clean_str(row_dict.get("transactiontype", ""))
                    rev_side = flip_side(orig_side)
                    price = _resolve_price(alloc, row_dict)
                    qty = alloc.transfer_qty

                    src_row = cls.build_transfer_row(
                        row_dict=row_dict,
                        account=src_acc,
                        side=rev_side,
                        qty=qty,
                        price=price,
                        custom_date=alloc.custom_date or custom_date
                    )
                    all_rows.append(src_row)
                    total_src_lots += qty

                route_idx += 1

        summary = {
            "total_records": len(all_rows) - len(separator_indices),
            "total_dest_lots": total_dest_lots,
            "total_src_lots": total_src_lots,
            "routes_count": len(routes_map),
            "output_mode": output_mode
        }

        return all_rows, separator_indices, summary
