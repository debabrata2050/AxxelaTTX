"""
stonex_netting_engine.py
Core parsing, netting evaluation, and single-worksheet Excel generation for StoneX Net Positions.
"""

import os
import math
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import duckdb
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

logger = logging.getLogger(__name__)

# Required columns in StoneX NetPositions export
MANDATORY_STONEX_COLUMNS = [
    "grouping",
    "business date",
    "account id",
    "reporting symbol",
    "instrument description",
    "quantity",
    "delivery period",
    "market price",
]

DEFAULT_TO_ACCOUNT = "LCE30553"

EXCEL_HEADERS = [
    "Sl.No.",
    "FROM",
    "TO",
    "Instr.",
    "Instr.Desp",
    "Buy/Sell",
    "Lots",
    "Contract Month",
    "C/P",
    "Strike",
    "Price",
    "Date",
    "Comments",
]


def clean_number(val: Any) -> float:
    if val is None:
        return 0.0
    s = str(val).replace(",", "").strip()
    try:
        f = float(s)
        return 0.0 if (math.isnan(f) or math.isinf(f)) else f
    except (ValueError, TypeError):
        return 0.0


def parse_date_safe(val: Any) -> Optional[datetime]:
    if val is None or str(val).strip() == "":
        return None
    if isinstance(val, datetime):
        return val
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%b-%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    try:
        from dateutil import parser as date_parser
        return date_parser.parse(s, dayfirst=False)
    except Exception:
        return None


class StoneXNettingEngine:
    """
    Parses StoneX CSV with DuckDB, validates headers, aggregates contracts,
    evaluates The Netting Rule (Buy == Sell), and exports consolidated single-sheet Excel.
    """

    def __init__(self, filepath: str):
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"StoneX CSV file not found: {filepath}")
        if os.path.getsize(filepath) == 0:
            raise ValueError("File is empty (0 bytes).")

        self.filepath = os.path.abspath(filepath)
        self.filename = os.path.basename(filepath)
        self.con = duckdb.connect(database=":memory:")
        self.con.execute("PRAGMA threads = 4;")
        self.con.execute("PRAGMA max_memory = '2GB';")

        self.col_map: Dict[str, str] = {}
        self.raw_columns: List[str] = []
        self._inspect_headers()

    def _inspect_headers(self) -> None:
        escaped_path = self.filepath.replace("\\", "/")
        try:
            res = self.con.execute(
                f"SELECT * FROM read_csv('{escaped_path}', header=true, all_varchar=true) LIMIT 1"
            )
            self.raw_columns = [desc[0].strip() for desc in res.description if desc and desc[0]]
        except Exception as e:
            raise ValueError(f"Invalid CSV encoding or delimiter: {e}")

        if not self.raw_columns:
            raise ValueError("No valid columns detected in CSV.")

        col_lower = {c.strip().lower(): c for c in self.raw_columns}
        missing = [c for c in MANDATORY_STONEX_COLUMNS if c not in col_lower]
        if missing:
            raise ValueError(f"Missing required column(s): [{', '.join(missing)}].")

        self.col_map = col_lower

    def parse_summary_and_contracts(self) -> Dict[str, Any]:
        """
        Groups all positions by (Reporting Symbol, Delivery Period, Instrument Description).
        Evaluates The Netting Rule: buy_lots + sell_lots == 0.
        """
        escaped_path = self.filepath.replace("\\", "/")

        col_grouping = f'"{self.col_map["grouping"]}"'
        col_date = f'"{self.col_map["business date"]}"'
        col_acc = f'"{self.col_map["account id"]}"'
        col_sym = f'"{self.col_map["reporting symbol"]}"'
        col_desc = f'"{self.col_map["instrument description"]}"'
        col_qty = f'"{self.col_map["quantity"]}"'
        col_period = f'"{self.col_map["delivery period"]}"'
        col_price = f'"{self.col_map["market price"]}"'
        col_trade_type = f'"{self.col_map["trade type"]}"' if "trade type" in self.col_map else "''"
        col_strike = f'"{self.col_map["strike price"]}"' if "strike price" in self.col_map else "''"

        query = f"""
            SELECT
                TRIM({col_sym}) AS symbol,
                TRIM({col_desc}) AS description,
                TRIM({col_period}) AS period,
                TRIM({col_grouping}) AS grouping,
                TRIM({col_acc}) AS account_id,
                CAST(REPLACE(COALESCE({col_qty}, '0'), ',', '') AS DOUBLE) AS qty,
                CAST(REPLACE(COALESCE({col_price}, '0'), ',', '') AS DOUBLE) AS price,
                TRIM({col_date}) AS business_date,
                TRIM(COALESCE({col_trade_type}, '')) AS trade_type,
                TRIM(COALESCE({col_strike}, '')) AS strike_price
            FROM read_csv('{escaped_path}', header=true, all_varchar=true)
            WHERE NULLIF(TRIM({col_acc}), '') IS NOT NULL
        """
        rel = self.con.execute(query)
        rows = rel.fetchall()

        total_rows = len(rows)
        products_map: Dict[str, Dict[str, Any]] = {}
        contracts_map: Dict[Tuple[str, str, str, str, Optional[float]], Dict[str, Any]] = {}

        for sym, desc, period, grouping, acc, qty, price, bdate, trade_type, strike_price in rows:
            if abs(qty) < 1e-6:
                continue

            is_option = trade_type in ("Call", "Put")
            cp = ("C" if trade_type.upper().startswith("C") else "P") if is_option else ""
            strike_val = clean_number(strike_price) if is_option else None

            contract_key = (sym, period, desc, cp, strike_val)
            if contract_key not in contracts_map:
                contracts_map[contract_key] = {
                    "symbol": sym,
                    "description": desc,
                    "period": period,
                    "trade_type": trade_type,
                    "cp": cp,
                    "strike": strike_val,
                    "is_option": is_option,
                    "grouping": grouping,
                    "price": price,
                    "business_date": bdate,
                    "buy_lots": 0.0,
                    "sell_lots": 0.0,
                    "rows": [],
                }

            c_info = contracts_map[contract_key]
            if qty > 0:
                c_info["buy_lots"] += qty
            else:
                c_info["sell_lots"] += abs(qty)

            c_info["rows"].append({
                "account_id": acc,
                "qty": qty,
                "price": price,
                "business_date": bdate,
                "grouping": grouping,
                "trade_type": trade_type,
                "cp": cp,
                "strike": strike_val,
            })

            # Products catalog
            if sym not in products_map:
                products_map[sym] = {
                    "symbol": sym,
                    "description": desc,
                    "periods": set(),
                }
            products_map[sym]["periods"].add(period)

        # Evaluate Netting Rule per contract
        contracts_list = []
        eligible_count = 0
        total_eligible_lots = 0.0

        for (sym, period, desc, cp, strike_val), c in contracts_map.items():
            buy_lots = c["buy_lots"]
            sell_lots = c["sell_lots"]
            net_delta = buy_lots - sell_lots
            is_eligible = (abs(net_delta) < 1e-5) and (buy_lots > 0) and (sell_lots > 0)

            if is_eligible:
                eligible_count += 1
                total_eligible_lots += buy_lots

            contract_id = f"{sym}|{period}|{desc}|{cp}|{strike_val if strike_val is not None else ''}"
            contracts_list.append({
                "contract_id": contract_id,
                "symbol": sym,
                "description": desc,
                "period": period,
                "trade_type": c["trade_type"],
                "cp": c["cp"],
                "strike": c["strike"],
                "is_option": c["is_option"],
                "grouping": c["grouping"],
                "price": c["price"],
                "business_date": c["business_date"],
                "row_count": len(c["rows"]),
                "buy_lots": buy_lots,
                "sell_lots": sell_lots,
                "net_delta": net_delta,
                "is_eligible": is_eligible,
                "status_badge": "NET ZERO (BALANCED)" if is_eligible else f"UNBALANCED ({net_delta:+0.0f} LOTS)",
                "status_message": (
                    f"Buy Lots (+{buy_lots:g}) + Sell Lots (-{sell_lots:g}) = 0 Net Delta. Eligible for transfer to {DEFAULT_TO_ACCOUNT}."
                    if is_eligible else
                    f"Buy Lots (+{buy_lots:g}) vs Sell Lots (-{sell_lots:g}) = Net {net_delta:+g} lots. Ineligible (open market risk)."
                ),
                "rows": c["rows"],
            })

        # Sort contracts: eligible first, then by symbol and period
        contracts_list.sort(key=lambda x: (not x["is_eligible"], x["symbol"], x["period"]))

        # Convert products_map periods set to sorted list
        products_list = []
        for sym, p in sorted(products_map.items()):
            products_list.append({
                "symbol": sym,
                "description": p["description"],
                "contract_count": len(p["periods"]),
                "periods": sorted(list(p["periods"])),
            })

        return {
            "filename": self.filename,
            "total_positions": total_rows,
            "total_products": len(products_list),
            "total_contracts": len(contracts_list),
            "eligible_contracts_count": eligible_count,
            "total_eligible_lots": total_eligible_lots,
            "products": products_list,
            "contracts": contracts_list,
        }

    def get_preview_rows(
        self,
        symbol_filter: Optional[str] = None,
        period_filter: Optional[str] = None,
        symbols: Optional[List[str]] = None,
        contract_ids: Optional[List[str]] = None,
        eligible_only: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Returns mapped preview records matching the output schema.
        Supports multi-product (symbols) and multi-contract (contract_ids) filtering.
        """
        data = self.parse_summary_and_contracts()
        preview_records: List[Dict[str, Any]] = []
        sl_no = 1

        allowed_symbols = None
        if symbols:
            allowed_symbols = {s.upper() for s in symbols}
        elif symbol_filter and symbol_filter.upper() != "ALL":
            allowed_symbols = {symbol_filter.upper()}

        allowed_contract_ids = {cid for cid in contract_ids} if contract_ids else None

        for c in data["contracts"]:
            if eligible_only and not c["is_eligible"]:
                continue
            if allowed_contract_ids is not None and c["contract_id"] not in allowed_contract_ids:
                continue
            if allowed_symbols is not None and c["symbol"].upper() not in allowed_symbols:
                continue
            if period_filter and period_filter.upper() != "ALL" and c["period"].upper() != period_filter.upper():
                continue

            strike_val = c.get("strike")
            strike_display = (
                int(strike_val) if isinstance(strike_val, (int, float)) and float(strike_val).is_integer()
                else strike_val
            ) if strike_val is not None else ""

            # Fetch rows directly from the contract partition
            for r in c.get("rows", []):
                qty = r["qty"]
                side = "Buy" if qty > 0 else "Sell"
                lots = abs(qty)
                lots_display = int(lots) if lots.is_integer() else lots

                bdate_dt = parse_date_safe(r["business_date"])
                bdate_str = bdate_dt.strftime("%m/%d/%Y") if bdate_dt else r["business_date"]

                preview_records.append({
                    "sl_no": sl_no,
                    "from_account": r["account_id"],
                    "to_account": DEFAULT_TO_ACCOUNT,
                    "instr": c["symbol"],
                    "instr_desp": c["description"],
                    "buy_sell": side,
                    "lots": lots_display,
                    "contract_month": c["period"],
                    "cp": c.get("cp", ""),
                    "strike": strike_display,
                    "price": c["price"],
                    "date": bdate_str,
                    "comments": "",
                })
                sl_no += 1

        return preview_records

    def _get_contract_rows(self, symbol: str, period: str, description: str) -> List[Dict[str, Any]]:
        escaped_path = self.filepath.replace("\\", "/")
        col_acc = f'"{self.col_map["account id"]}"'
        col_sym = f'"{self.col_map["reporting symbol"]}"'
        col_desc = f'"{self.col_map["instrument description"]}"'
        col_qty = f'"{self.col_map["quantity"]}"'
        col_period = f'"{self.col_map["delivery period"]}"'
        col_price = f'"{self.col_map["market price"]}"'
        col_date = f'"{self.col_map["business date"]}"'

        q = f"""
            SELECT
                TRIM({col_acc}) AS account_id,
                CAST(REPLACE(COALESCE({col_qty}, '0'), ',', '') AS DOUBLE) AS qty,
                CAST(REPLACE(COALESCE({col_price}, '0'), ',', '') AS DOUBLE) AS price,
                TRIM({col_date}) AS business_date
            FROM read_csv('{escaped_path}', header=true, all_varchar=true)
            WHERE TRIM({col_sym}) = '{symbol}'
              AND TRIM({col_period}) = '{period}'
              AND TRIM({col_desc}) = '{description}'
              AND NULLIF(TRIM({col_acc}), '') IS NOT NULL
        """
        rows = self.con.execute(q).fetchall()
        res = []
        for acc, qty, price, bdate in rows:
            if abs(qty) > 1e-6:
                res.append({
                    "account_id": acc,
                    "qty": qty,
                    "price": price,
                    "business_date": bdate,
                })
        return res

    def export_consolidated_excel(
        self,
        output_xlsx_path: str,
        symbol_filter: Optional[str] = None,
        period_filter: Optional[str] = None,
        symbols: Optional[List[str]] = None,
        contract_ids: Optional[List[str]] = None,
        eligible_only: bool = True,
        custom_comments: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Generates single-worksheet 'StoneX Netting' Excel file matching institutional Trade Transfer Form template.
        Zero yellow fill colors.
        """
        preview_rows = self.get_preview_rows(
            symbol_filter=symbol_filter,
            period_filter=period_filter,
            symbols=symbols,
            contract_ids=contract_ids,
            eligible_only=eligible_only,
        )

        if not preview_rows:
            raise ValueError("No net-zero contracts available to export.")

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "StoneX Netting"

        # Column Widths matching institutional sample (Columns A through M)
        col_widths = {
            "A": 8,   # Sl.No.
            "B": 14,  # FROM
            "C": 12,  # TO
            "D": 10,  # Instr.
            "E": 28,  # Instr.Desp
            "F": 10,  # Buy/Sell
            "G": 10,  # Lots
            "H": 16,  # Contract Month
            "I": 6,   # C/P
            "J": 8,   # Strike
            "K": 14,  # Price
            "L": 14,  # Date
            "M": 14,  # Comments
        }
        for col_l, width in col_widths.items():
            ws.column_dimensions[col_l].width = width

        # Border definition
        thin_side = Side(border_style="thin", color="000000")
        cell_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

        # Alignment
        center_align = Alignment(horizontal="center", vertical="center")
        title_font = Font(name="Calibri", size=11, bold=True)
        header_font = Font(name="Calibri", size=11, bold=True)
        data_font = Font(name="Calibri", size=11, bold=False)

        # Row 1: Merged Title 'Trade Transfer Form' (A1:M1)
        ws.merge_cells("A1:M1")
        title_cell = ws.cell(row=1, column=1, value="Trade Transfer Form")
        title_cell.font = title_font
        title_cell.alignment = center_align
        # Ensure title cells have thin border
        for col in range(1, 14):
            c = ws.cell(row=1, column=col)
            c.border = cell_border

        # Row 2: Column Headers (A2:M2)
        for col_idx, header in enumerate(EXCEL_HEADERS, start=1):
            cell = ws.cell(row=2, column=col_idx, value=header)
            cell.font = header_font
            cell.alignment = center_align
            cell.border = cell_border

        # Rows 3+: Consolidated Data Rows
        current_row = 3
        for row_data in preview_rows:
            ws.cell(row=current_row, column=1, value=row_data["sl_no"]).alignment = center_align
            ws.cell(row=current_row, column=2, value=row_data["from_account"]).alignment = center_align
            ws.cell(row=current_row, column=3, value=row_data["to_account"]).alignment = center_align
            ws.cell(row=current_row, column=4, value=row_data["instr"]).alignment = center_align
            ws.cell(row=current_row, column=5, value=row_data["instr_desp"]).alignment = center_align
            ws.cell(row=current_row, column=6, value=row_data["buy_sell"]).alignment = center_align

            # Lots
            lots_cell = ws.cell(row=current_row, column=7, value=row_data["lots"])
            lots_cell.alignment = center_align
            lots_cell.number_format = "#,##0"

            # Contract Month
            ws.cell(row=current_row, column=8, value=row_data["contract_month"]).alignment = center_align

            # C/P, Strike (only written if instrument is of type Option)
            cp_val = row_data.get("cp") or None
            raw_strike = row_data.get("strike")
            strike_val = raw_strike if (raw_strike is not None and raw_strike != "") else None

            cp_cell = ws.cell(row=current_row, column=9, value=cp_val)
            cp_cell.alignment = center_align

            strike_cell = ws.cell(row=current_row, column=10, value=strike_val)
            strike_cell.alignment = center_align
            if strike_val is not None and isinstance(strike_val, (int, float)):
                strike_cell.number_format = "#,##0" if float(strike_val).is_integer() else "#,##0.00"

            # Price
            price_cell = ws.cell(row=current_row, column=11, value=row_data["price"])
            price_cell.alignment = center_align
            price_cell.number_format = "#,##0.00"

            # Date
            date_cell = ws.cell(row=current_row, column=12, value=row_data["date"])
            date_cell.alignment = center_align

            # Comments
            comment_val = None
            if custom_comments:
                comment_val = custom_comments.get(str(row_data["sl_no"])) or custom_comments.get(row_data["sl_no"])
            if not comment_val:
                comment_val = row_data.get("comments") or None

            ws.cell(row=current_row, column=13, value=comment_val).alignment = center_align

            # Apply font and border to all columns in this row
            for c_idx in range(1, 14):
                c = ws.cell(row=current_row, column=c_idx)
                c.font = data_font
                c.border = cell_border
                # Explicitly no fill
                c.fill = PatternFill(fill_type=None)

            current_row += 1

        output_dir = os.path.dirname(os.path.abspath(output_xlsx_path))
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        wb.save(output_xlsx_path)
        logger.info("Saved consolidated StoneX Netting workbook to %s (%d rows)", output_xlsx_path, len(preview_rows))
        return output_xlsx_path
