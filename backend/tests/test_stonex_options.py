import os
import tempfile
import pytest
import openpyxl

from core.stonex_netting_engine import StoneXNettingEngine, DEFAULT_TO_ACCOUNT

@pytest.fixture
def options_sample_csv():
    """Generates synthetic StoneX CSV containing Futures and Options (Call & Put)."""
    content = """Grouping,Business Date,Account Id,Family Group,Legal Account Name,Exchange Id,Currency,Exchange Clearing Id,Reporting Symbol,Instrument Description,Trade Type,Option Syle,Strike Price,Quantity,Delivery Period,Net Long Quantity,Net Short Quantity,Weighted Average Price,Market Price,MtM,Market Value,Option Value,Intrinsic Value,Composite Delta,Maturity Date,OTC Indicator,Contract Size,Delivery Cycle,Last Traded Date,First Notice Date,Legal Entity Identifier,FX Rate
ACC01,2026-10-09,ACC01,GRP1,SYM LTD,CBT,USD,C,CSB,SOYBEANS,Put,American,"1,100.0000000000",10,Mar-27,,,,100.0,105.0,,,,,,,,,,,,
ACC02,2026-10-09,ACC02,GRP1,SYM LTD,CBT,USD,C,CSB,SOYBEANS,Put,American,"1,100.0000000000",-10,Mar-27,,,,100.0,105.0,,,,,,,,,,,,
ACC01,2026-10-09,ACC01,GRP1,SYM LTD,CBT,USD,C,ES,MINI S&P 500,Call,American,"6,100.0000000000",5,Dec-26,,,,200.0,210.0,,,,,,,,,,,,
ACC02,2026-10-09,ACC02,GRP1,SYM LTD,CBT,USD,C,ES,MINI S&P 500,Call,American,"6,100.0000000000",-5,Dec-26,,,,200.0,210.0,,,,,,,,,,,,
ACC01,2026-10-09,ACC01,GRP1,SYM LTD,CBT,USD,C,CLC,LIVE CATTLE,Future,,0.0,2,Dec-26,,,,50.0,55.0,,,,,,,,,,,,
ACC02,2026-10-09,ACC02,GRP1,SYM LTD,CBT,USD,C,CLC,LIVE CATTLE,Future,,0.0,-2,Dec-26,,,,50.0,55.0,,,,,,,,,,,,
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
        f.write(content)
        path = f.name
    yield path
    if os.path.exists(path):
        os.remove(path)


def test_option_cp_and_strike_parsing(options_sample_csv):
    engine = StoneXNettingEngine(options_sample_csv)
    summary = engine.parse_summary_and_contracts()

    assert summary["eligible_contracts_count"] == 3
    assert summary["total_products"] == 3

    # Check Put Option on CSB
    csb_put = next(c for c in summary["contracts"] if c["symbol"] == "CSB")
    assert csb_put["is_option"] is True
    assert csb_put["cp"] == "P"
    assert csb_put["strike"] == 1100.0
    assert csb_put["is_eligible"] is True
    assert csb_put["buy_lots"] == 10.0
    assert csb_put["sell_lots"] == 10.0

    # Check Call Option on ES
    es_call = next(c for c in summary["contracts"] if c["symbol"] == "ES")
    assert es_call["is_option"] is True
    assert es_call["cp"] == "C"
    assert es_call["strike"] == 6100.0
    assert es_call["is_eligible"] is True

    # Check Future on CLC
    clc_fut = next(c for c in summary["contracts"] if c["symbol"] == "CLC")
    assert clc_fut["is_option"] is False
    assert clc_fut["cp"] == ""
    assert clc_fut["strike"] is None
    assert clc_fut["is_eligible"] is True


def test_option_preview_rows_and_excel_export(options_sample_csv):
    engine = StoneXNettingEngine(options_sample_csv)
    preview = engine.get_preview_rows(eligible_only=True)

    assert len(preview) == 6  # 2 rows for CSB, 2 for ES, 2 for CLC

    csb_row = next(r for r in preview if r["instr"] == "CSB")
    assert csb_row["cp"] == "P"
    assert csb_row["strike"] == 1100

    es_row = next(r for r in preview if r["instr"] == "ES")
    assert es_row["cp"] == "C"
    assert es_row["strike"] == 6100

    clc_row = next(r for r in preview if r["instr"] == "CLC")
    assert clc_row["cp"] == ""
    assert clc_row["strike"] == ""

    # Test Excel generation
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
        out_path = f.name

    try:
        engine.export_consolidated_excel(out_path, eligible_only=True)
        wb = openpyxl.load_workbook(out_path)
        ws = wb["StoneX Netting"]

        # Row 5 (CSB Put): Col 10 (J) is 'P', Col 11 (K) is 1100
        # Row 7 (ES Call): Col 10 (J) is 'C', Col 11 (K) is 6100
        # Row 9 (CLC Future): Col 10 (J) is None, Col 11 (K) is None
        found_p = False
        found_c = False
        found_future_blank = False

        for r in range(3, ws.max_row + 1):
            instr = ws.cell(row=r, column=4).value
            cp_val = ws.cell(row=r, column=9).value
            strike_val = ws.cell(row=r, column=10).value

            if instr == "CSB":
                assert cp_val == "P"
                assert strike_val == 1100
                found_p = True
            elif instr == "ES":
                assert cp_val == "C"
                assert strike_val == 6100
                found_c = True
            elif instr == "CLC":
                assert cp_val is None
                assert strike_val is None
                found_future_blank = True

        assert found_p and found_c and found_future_blank
        wb.close()
    finally:
        if os.path.exists(out_path):
            os.remove(out_path)
