import os
from datetime import datetime
from typing import List, Any, Set
import openpyxl
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Font, Alignment, Border, Side

from core.models import EXCEL_HEADERS
from core.allocator import parse_trade_date


class InstitutionalExcelExporter:
    """
    High-performance streaming Excel exporter matching institutional clearing desk specifications.
    Uses openpyxl in write_only mode to handle 250,000+ rows in <50MB RAM.
    """

    # Pre-calculated column width specifications (avoids iterating millions of cells)
    COLUMN_WIDTHS = {
        "A": 14,  # TradeType
        "B": 10,  # TrdTyp
        "C": 12,  # TrdSubtyp
        "D": 14,  # Market ID
        "E": 24,  # Symbol
        "F": 16,  # Contract Expiry
        "G": 16,  # TransactionTyp
        "H": 12,  # Qty
        "I": 14,  # TradePrice
        "J": 14,  # Product Type
        "K": 8,   # C/P
        "L": 12,  # Strike
        "M": 18,  # Account
        "N": 14,  # Date
        "O": 14,  # Expdate
        "P": 10,  # Currency
        "Q": 20,  # Comment
        "R": 10,  # Fees
    }

    @classmethod
    def export(
        cls,
        rows: List[List[Any]],
        output_xlsx_path: str,
        separator_row_indices: Set[int] = None
    ) -> str:
        if separator_row_indices is None:
            separator_row_indices = set()
        else:
            separator_row_indices = set(separator_row_indices)

        wb = openpyxl.Workbook(write_only=True)
        ws = wb.create_sheet(title="Sheet1")

        # Set column dimensions directly
        for col_letter, width in cls.COLUMN_WIDTHS.items():
            ws.column_dimensions[col_letter].width = width

        # Shared styles
        thin_border = Border(
            left=Side(style="thin"),
            right=Side(style="thin"),
            top=Side(style="thin"),
            bottom=Side(style="thin")
        )
        cell_font = Font(name="Calibri", size=11, bold=True)
        cell_align = Alignment(horizontal="center", vertical="center")

        def _make_cell(val: Any, num_fmt: str = None) -> WriteOnlyCell:
            cell = WriteOnlyCell(ws, value=val)
            cell.font = cell_font
            cell.border = thin_border
            cell.alignment = cell_align
            if num_fmt:
                cell.number_format = num_fmt
            return cell

        # 1. Write Header Row
        header_cells = [_make_cell(h) for h in EXCEL_HEADERS]
        ws.append(header_cells)

        # 2. Stream Data Rows
        # Skip header if already in raw rows
        data_rows = rows
        if data_rows and data_rows[0] == EXCEL_HEADERS:
            data_rows = data_rows[1:]

        for r_idx, row in enumerate(data_rows, start=2):
            # Check separator / empty row
            is_empty = (
                row is None or not row or
                all(c is None or str(c).strip() == "" for c in row) or
                r_idx in separator_row_indices
            )
            if is_empty:
                ws.append([None] * len(EXCEL_HEADERS))
                continue

            row_cells = []
            for c_idx, val in enumerate(row):
                if val is None or str(val).strip() == "":
                    row_cells.append(_make_cell(None))
                    continue

                # Col 6: Contract Expiry (mmm-yy)
                if c_idx == 5:
                    dt = val if isinstance(val, datetime) else parse_trade_date(val)
                    if dt:
                        row_cells.append(_make_cell(dt, "mmm-yy"))
                    else:
                        row_cells.append(_make_cell(val))

                # Col 14: Date (mm-dd-yy)
                elif c_idx == 13:
                    dt = val if isinstance(val, datetime) else parse_trade_date(val)
                    if dt:
                        row_cells.append(_make_cell(dt, "mm-dd-yy"))
                    else:
                        row_cells.append(_make_cell(val))

                # Col 15: Expdate (mm-dd-yy)
                elif c_idx == 14:
                    dt = val if isinstance(val, datetime) else parse_trade_date(val)
                    if dt:
                        row_cells.append(_make_cell(dt, "mm-dd-yy"))
                    else:
                        row_cells.append(_make_cell(val))

                # Col 8: Qty, Col 9: TradePrice, Col 12: Strike -> format numeric if possible
                elif c_idx in (7, 8, 11):
                    try:
                        num = float(val)
                        if num.is_integer():
                            row_cells.append(_make_cell(int(num)))
                        else:
                            row_cells.append(_make_cell(round(num, 4)))
                    except (ValueError, TypeError):
                        row_cells.append(_make_cell(val))

                else:
                    row_cells.append(_make_cell(val))

            ws.append(row_cells)

        out_dir = os.path.dirname(os.path.abspath(output_xlsx_path))
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)

        wb.save(output_xlsx_path)
        return output_xlsx_path
