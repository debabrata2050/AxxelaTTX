"""
kgi_netting_engine.py
Core parsing, netting evaluation, and single-worksheet Excel generation for KGI Positions.
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

# Mandatory columns in KGI position feed
MANDATORY_KGI_COLUMNS = [
    "trade date",
    "contract",
    "buysell",
    "quantity",
    "expirydate",
    "client code",
    "trade price",
]

DEFAULT_KGI_TO_ACCOUNT = "KT513Z"

EXCEL_HEADERS = [
    "Sl.No.",
    "FROM",
    "TO",
    "Instr.",
    "Instr.Desp",
    "Buy/Sell",
    "Lots",
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


def parse_trade_date(val: Any) -> Optional[datetime]:
    """Parse trade date from DD/MM/YYYY or YYYY-MM-DD or standard formats."""
    if val is None or str(val).strip() == "":
        return None
    if isinstance(val, datetime):
        return val
    s = str(val).strip()
    # KGI standard is DD/MM/YYYY
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%b-%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    try:
        from dateutil import parser as date_parser
        return date_parser.parse(s, dayfirst=True)
    except Exception:
        return None


def parse_expiry_date(val: Any) -> Tuple[Optional[datetime], str]:
    """
    Parse KGI EXPIRYDATE (e.g. 'Dec 31 2049 12:00AM', 'Oct 29 2026 12:00AM')
    Returns: (parsed_datetime, formatted_mmm_yy string)
    """
    if val is None or str(val).strip() == "":
        return None, ""
    if isinstance(val, datetime):
        return val, val.strftime("%b-%y")
    s = str(val).strip()
    # Try formats like 'Dec 31 2049 12:00AM' or 'Dec 31 2049'
    for fmt in (
        "%b %d %Y %I:%M%p",
        "%b %d %Y %H:%M:%S",
        "%b %d %Y",
        "%d/%m/%Y",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(s, fmt)
            return dt, dt.strftime("%b-%y")
        except ValueError:
            pass
    try:
        from dateutil import parser as date_parser
        dt = date_parser.parse(s)
        return dt, dt.strftime("%b-%y")
    except Exception:
        return None, s


class KGINettingEngine:
    """
    Parses KGI CSV with DuckDB, validates headers, aggregates contracts,
    evaluates The Netting Rule (Buy == Sell), and exports consolidated single-sheet Excel.
    Starts at cell A1 with zero gaps, formatted per sample Trade Transfer Form.
    """

    def __init__(self, filepath: str):
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"KGI CSV file not found: {filepath}")
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
        """Inspect headers in KGI CSV and map to mandatory fields."""
        escaped_path = self.filepath.replace("\\", "/")
        sample_q = f"SELECT * FROM read_csv('{escaped_path}', header=true, all_varchar=true) LIMIT 1;"
        res = self.con.execute(sample_q)
        self.raw_columns = [desc[0] for desc in res.description]
        col_lookup = {c.strip().lower(): c for c in self.raw_columns}

        missing = []
        for req in MANDATORY_KGI_COLUMNS:
            if req in col_lookup:
                self.col_map[req] = col_lookup[req]
            else:
                missing.append(req)

        if missing:
            raise ValueError(
                f"Missing required columns in KGI CSV: {missing}. "
                f"Found columns: {self.raw_columns}"
            )

        # Optional columns
        for opt in ["exchange", "del.month", "c.p.f", "strike", "settlement price", "unrealised pl", "deal ref"]:
            if opt in col_lookup:
                self.col_map[opt] = col_lookup[opt]

    def parse_summary_and_contracts(self) -> Dict[str, Any]:
        """
        Parses all rows, groups positions by (contract, expirydate, cpf, strike),
        evaluates Net-Zero balance, and returns summary catalog.
        """
        escaped_path = self.filepath.replace("\\", "/")
        col_contract = f'"{self.col_map["contract"]}"'
        col_expiry = f'"{self.col_map["expirydate"]}"'
        col_bs = f'"{self.col_map["buysell"]}"'
        col_qty = f'"{self.col_map["quantity"]}"'
        col_price = f'"{self.col_map["trade price"]}"'
        col_client = f'"{self.col_map["client code"]}"'

        col_cpf = f'"{self.col_map["c.p.f"]}"' if "c.p.f" in self.col_map else "''"
        col_strike = f'"{self.col_map["strike"]}"' if "strike" in self.col_map else "'0'"
        col_del_month = f'"{self.col_map["del.month"]}"' if "del.month" in self.col_map else "''"

        agg_query = f"""
            SELECT
                TRIM({col_contract}) AS contract,
                TRIM({col_expiry}) AS expirydate,
                TRIM(COALESCE({col_del_month}, '')) AS del_month,
                TRIM(COALESCE({col_cpf}, 'F')) AS cpf,
                CAST(REPLACE(COALESCE({col_strike}, '0'), ',', '') AS DOUBLE) AS strike,
                COUNT(*) AS row_count,
                SUM(CASE WHEN UPPER(TRIM({col_bs})) = 'B' THEN CAST(REPLACE(COALESCE({col_qty}, '0'), ',', '') AS DOUBLE) ELSE 0 END) AS buy_lots,
                SUM(CASE WHEN UPPER(TRIM({col_bs})) = 'S' THEN CAST(REPLACE(COALESCE({col_qty}, '0'), ',', '') AS DOUBLE) ELSE 0 END) AS sell_lots,
                AVG(CAST(REPLACE(COALESCE({col_price}, '0'), ',', '') AS DOUBLE)) AS avg_price
            FROM read_csv('{escaped_path}', header=true, all_varchar=true)
            WHERE NULLIF(TRIM({col_contract}), '') IS NOT NULL
              AND NULLIF(TRIM({col_expiry}), '') IS NOT NULL
            GROUP BY 1, 2, 3, 4, 5
            ORDER BY 1, 2
        """

        raw_contracts = self.con.execute(agg_query).fetchall()

        contracts_list: List[Dict[str, Any]] = []
        product_map: Dict[str, Dict[str, Any]] = {}
        total_positions = 0
        eligible_contracts_count = 0
        total_eligible_lots = 0

        for r in raw_contracts:
            contract_name, expiry, del_month, cpf, strike, row_cnt, b_lots, s_lots, avg_pr = r
            buy_lots = int(round(b_lots))
            sell_lots = int(round(s_lots))
            net_delta = buy_lots - sell_lots
            total_positions += row_cnt

            is_eligible = (net_delta == 0 and buy_lots > 0)
            if is_eligible:
                eligible_contracts_count += 1
                total_eligible_lots += buy_lots

            dt_expiry, formatted_expiry = parse_expiry_date(expiry)

            # Contract ID key
            clean_strike = f"{strike:.2f}" if strike > 0 else "0"
            contract_id = f"{contract_name}_{expiry.replace(' ', '_')}_{cpf}_{clean_strike}"

            status_badge = "Net-Zero Balanced" if is_eligible else (
                f"Delta: +{net_delta}" if net_delta > 0 else f"Delta: {net_delta}"
            )
            status_message = "Eligible for Transfer" if is_eligible else "Unbalanced (Buy ≠ Sell)"

            contract_obj = {
                "contract_id": contract_id,
                "contract": contract_name,
                "symbol": contract_name,  # Product alias
                "expirydate": expiry,
                "period": expiry,
                "formatted_expiry": formatted_expiry,
                "del_month": del_month,
                "cpf": cpf,
                "strike": strike if strike > 0 else None,
                "row_count": row_cnt,
                "buy_lots": buy_lots,
                "sell_lots": sell_lots,
                "net_delta": net_delta,
                "price": round(avg_pr, 4),
                "is_eligible": is_eligible,
                "status_badge": status_badge,
                "status_message": status_message,
            }
            contracts_list.append(contract_obj)

            # Accumulate into product catalog
            if contract_name not in product_map:
                product_map[contract_name] = {
                    "symbol": contract_name,
                    "contract": contract_name,
                    "contract_count": 0,
                    "net_zero_count": 0,
                    "expiries": [],
                    "total_positions": 0,
                }
            product_map[contract_name]["contract_count"] += 1
            product_map[contract_name]["total_positions"] += row_cnt
            if is_eligible:
                product_map[contract_name]["net_zero_count"] += 1
            if expiry not in product_map[contract_name]["expiries"]:
                product_map[contract_name]["expiries"].append(expiry)

        products_list = list(product_map.values())
        products_list.sort(key=lambda p: (-p["net_zero_count"], p["contract"]))

        return {
            "filename": self.filename,
            "filepath": self.filepath,
            "total_positions": total_positions,
            "total_products": len(products_list),
            "total_contracts": len(contracts_list),
            "eligible_contracts_count": eligible_contracts_count,
            "total_eligible_lots": total_eligible_lots,
            "products": products_list,
            "contracts": contracts_list,
        }

    def get_preview_rows(
        self,
        contracts: Optional[List[str]] = None,
        contract_ids: Optional[List[str]] = None,
        destination_account: str = DEFAULT_KGI_TO_ACCOUNT,
        eligible_only: bool = True,
        custom_comments: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Extracts mapped preview rows for specified contracts or contract_ids.
        Groups Buy ('B') rows first chronologically, followed by Sell ('S') rows chronologically.
        """
        summary_info = self.parse_summary_and_contracts()
        all_contracts = summary_info["contracts"]

        # Filter target contracts
        target_contract_objs = []
        for c in all_contracts:
            if eligible_only and not c["is_eligible"]:
                continue
            if contract_ids is not None and c["contract_id"] not in contract_ids:
                continue
            if contracts is not None and c["contract"] not in contracts:
                continue
            target_contract_objs.append(c)

        if not target_contract_objs:
            return []

        escaped_path = self.filepath.replace("\\", "/")
        col_contract = f'"{self.col_map["contract"]}"'
        col_expiry = f'"{self.col_map["expirydate"]}"'
        col_bs = f'"{self.col_map["buysell"]}"'
        col_qty = f'"{self.col_map["quantity"]}"'
        col_price = f'"{self.col_map["trade price"]}"'
        col_client = f'"{self.col_map["client code"]}"'
        col_tdate = f'"{self.col_map["trade date"]}"'
        col_cpf = f'"{self.col_map["c.p.f"]}"' if "c.p.f" in self.col_map else "''"
        col_strike = f'"{self.col_map["strike"]}"' if "strike" in self.col_map else "'0'"

        all_raw_rows = []
        for c in target_contract_objs:
            c_name = c["contract"].replace("'", "''")
            c_exp = c["expirydate"].replace("'", "''")
            c_cpf = c["cpf"].replace("'", "''")
            c_strike = c["strike"] if c["strike"] is not None else 0

            # Query positions for this partition
            strike_condition = f"ABS(CAST(REPLACE(COALESCE({col_strike}, '0'), ',', '') AS DOUBLE) - {c_strike}) < 0.001"
            q = f"""
                SELECT
                    TRIM({col_client}) AS client_code,
                    TRIM({col_contract}) AS contract,
                    TRIM({col_expiry}) AS expirydate,
                    UPPER(TRIM({col_bs})) AS buysell,
                    CAST(REPLACE(COALESCE({col_qty}, '0'), ',', '') AS DOUBLE) AS qty,
                    TRIM(COALESCE({col_cpf}, 'F')) AS cpf,
                    CAST(REPLACE(COALESCE({col_strike}, '0'), ',', '') AS DOUBLE) AS strike,
                    CAST(REPLACE(COALESCE({col_price}, '0'), ',', '') AS DOUBLE) AS price,
                    TRIM({col_tdate}) AS trade_date
                FROM read_csv('{escaped_path}', header=true, all_varchar=true)
                WHERE TRIM({col_contract}) = '{c_name}'
                  AND TRIM({col_expiry}) = '{c_exp}'
                  AND TRIM(COALESCE({col_cpf}, 'F')) = '{c_cpf}'
                  AND {strike_condition}
                  AND NULLIF(TRIM({col_client}), '') IS NOT NULL
            """
            rows = self.con.execute(q).fetchall()
            for r in rows:
                client_code, contract, expiry, bs, qty, cpf_val, strk, price, tdate = r
                lots = int(round(qty))
                if lots <= 0:
                    continue

                parsed_dt = parse_trade_date(tdate)
                dt_exp, formatted_exp = parse_expiry_date(expiry)

                all_raw_rows.append({
                    "from_account": client_code,
                    "to_account": destination_account,
                    "instr": contract,
                    "instr_desp": formatted_exp,
                    "expiry_dt": dt_exp,
                    "buy_sell": bs,
                    "lots": lots,
                    "cp": cpf_val if cpf_val in ("C", "P") else None,
                    "strike": strk if strk > 0 else None,
                    "price": price,
                    "date_str": tdate,
                    "parsed_date": parsed_dt,
                })

        # Sort order:
        # 1. Product (instr)
        # 2. Expiry date
        # 3. Buy/Sell: 'B' before 'S'
        # 4. Trade Date ascending
        def sort_key(row):
            bs_rank = 0 if row["buy_sell"] == "B" else 1
            dt_sort = row["parsed_date"] or datetime(1970, 1, 1)
            return (row["instr"], row["instr_desp"], bs_rank, dt_sort)

        all_raw_rows.sort(key=sort_key)

        preview_rows: List[Dict[str, Any]] = []
        for idx, row in enumerate(all_raw_rows, start=1):
            sl_key = str(idx)
            comment = ""
            if custom_comments and sl_key in custom_comments:
                comment = custom_comments[sl_key]

            preview_rows.append({
                "sl_no": idx,
                "from_account": row["from_account"],
                "to_account": row["to_account"],
                "instr": row["instr"],
                "instr_desp": row["instr_desp"],
                "expiry_dt": row["expiry_dt"],
                "buy_sell": row["buy_sell"],
                "lots": row["lots"],
                "contract_month": row["instr_desp"],
                "cp": row["cp"],
                "strike": row["strike"],
                "price": row["price"],
                "date": row["parsed_date"].strftime("%m/%d/%Y") if row["parsed_date"] else row["date_str"],
                "parsed_date": row["parsed_date"],
                "comments": comment,
            })

        return preview_rows

    def export_consolidated_excel(
        self,
        output_xlsx_path: str,
        contracts: Optional[List[str]] = None,
        contract_ids: Optional[List[str]] = None,
        destination_account: str = DEFAULT_KGI_TO_ACCOUNT,
        eligible_only: bool = True,
        custom_comments: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Generates single-worksheet 'Sheet1' Excel file matching institutional KGI Trade Transfer template.
        Starts directly at cell A1 with zero margin gaps:
        - Row 1: Merged Title 'Trade Transfer Form' (A1:L1), clean bold 11pt Calibri, centered, thin borders.
        - Row 2: Headers (A2:L2), clean bold 11pt Calibri, centered, thin borders (no yellow highlight).
        - Rows 3+: Consolidated Data rows, thin borders, B rows first sorted by Date, then S rows sorted by Date.
        """
        preview_rows = self.get_preview_rows(
            contracts=contracts,
            contract_ids=contract_ids,
            destination_account=destination_account,
            eligible_only=eligible_only,
            custom_comments=custom_comments,
        )

        if not preview_rows:
            raise ValueError("No net-zero contracts available to export.")

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Sheet1"

        # Explicit Column Widths matching sample (Columns A through L)
        col_widths = {
            "A": 8,   # Sl.No.
            "B": 16,  # FROM (Client Code)
            "C": 12,  # TO (KT513Z)
            "D": 8,   # Instr. (Contract)
            "E": 14,  # Instr.Desp (e.g. Oct-26)
            "F": 10,  # Buy/Sell
            "G": 8,   # Lots
            "H": 6,   # C/P
            "I": 8,   # Strike
            "J": 12,  # Price
            "K": 14,  # Date
            "L": 18,  # Comments
        }
        for col_l, width in col_widths.items():
            ws.column_dimensions[col_l].width = width

        # Border definition
        thin_side = Side(border_style="thin", color="000000")
        cell_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

        # Style definitions
        title_font = Font(name="Calibri", size=11, bold=True)
        header_font = Font(name="Calibri", size=11, bold=True)
        data_font = Font(name="Calibri", size=11, bold=False)

        center_align = Alignment(horizontal="center", vertical="center")
        right_align = Alignment(horizontal="right", vertical="center")
        left_align = Alignment(horizontal="left", vertical="center")

        # Row 1: Merged Title 'Trade Transfer Form' (A1:L1)
        ws.merge_cells("A1:L1")
        title_cell = ws.cell(row=1, column=1, value="Trade Transfer Form")
        title_cell.font = title_font
        title_cell.alignment = center_align

        for col in range(1, 13):
            c = ws.cell(row=1, column=col)
            c.border = cell_border

        # Row 2: Headers (A2:L2)
        for col_idx, header in enumerate(EXCEL_HEADERS, start=1):
            cell = ws.cell(row=2, column=col_idx, value=header)
            cell.font = header_font
            cell.alignment = center_align
            cell.border = cell_border

        # Rows 3+: Data Rows
        current_row = 3
        for row_data in preview_rows:
            # 1. Sl.No.
            c_sl = ws.cell(row=current_row, column=1, value=row_data["sl_no"])
            c_sl.alignment = center_align

            # 2. FROM
            c_from = ws.cell(row=current_row, column=2, value=row_data["from_account"])
            c_from.alignment = center_align

            # 3. TO
            c_to = ws.cell(row=current_row, column=3, value=row_data["to_account"])
            c_to.alignment = center_align

            # 4. Instr.
            c_instr = ws.cell(row=current_row, column=4, value=row_data["instr"])
            c_instr.alignment = center_align

            # 5. Instr.Desp (date formatted as mmm-yy per sample)
            c_desp = ws.cell(row=current_row, column=5)
            if row_data.get("expiry_dt") and isinstance(row_data["expiry_dt"], datetime):
                # Set 1st day of month to match sample Excel date representation
                c_desp.value = datetime(row_data["expiry_dt"].year, row_data["expiry_dt"].month, 1)
                c_desp.number_format = "mmm-yy"
            else:
                c_desp.value = row_data.get("instr_desp", "")
            c_desp.alignment = center_align

            # 6. Buy/Sell
            c_bs = ws.cell(row=current_row, column=6, value=row_data["buy_sell"])
            c_bs.alignment = center_align

            # 7. Lots
            c_lots = ws.cell(row=current_row, column=7, value=row_data["lots"])
            c_lots.alignment = center_align
            c_lots.number_format = "#,##0"

            # 8. C/P (None for Futures)
            cp_val = row_data.get("cp") or None
            c_cp = ws.cell(row=current_row, column=8, value=cp_val)
            c_cp.alignment = center_align

            # 9. Strike (None if 0)
            strike_val = row_data.get("strike")
            c_strike = ws.cell(row=current_row, column=9, value=strike_val if strike_val else None)
            c_strike.alignment = center_align

            # 10. Price
            c_price = ws.cell(row=current_row, column=10, value=row_data["price"])
            c_price.alignment = right_align

            # 11. Date (Date with mm-dd-yy format)
            c_date = ws.cell(row=current_row, column=11)
            if row_data.get("parsed_date") and isinstance(row_data["parsed_date"], datetime):
                c_date.value = row_data["parsed_date"]
                c_date.number_format = "mm-dd-yy"
            else:
                c_date.value = row_data.get("date", "")
            c_date.alignment = center_align

            # 12. Comments
            comment_text = row_data.get("comments") or None
            c_com = ws.cell(row=current_row, column=12, value=comment_text)
            c_com.alignment = left_align

            # Apply font and thin borders to all columns in this row
            for col_idx in range(1, 13):
                c = ws.cell(row=current_row, column=col_idx)
                c.font = data_font
                c.border = cell_border

            current_row += 1

        os.makedirs(os.path.dirname(os.path.abspath(output_xlsx_path)), exist_ok=True)
        wb.save(output_xlsx_path)
        return output_xlsx_path
