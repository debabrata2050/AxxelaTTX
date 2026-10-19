"""
stonex_netting_converter.py
Command-Line Interface (CLI) for StoneX Netting workflow.
Parses StoneX positions CSV, identifies net-zero contracts, and exports consolidated Trade Transfer Form Excel.

Usage:
    python backend/stonex_netting_converter.py --input "data/stoneX netting/NetPositions20261009.csv" --output "StoneX_Netting_Consolidated.xlsx"
"""

import os
import sys
import argparse

# Add backend directory to sys.path so core modules can be resolved
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from core.stonex_netting_engine import StoneXNettingEngine, DEFAULT_TO_ACCOUNT


def convert_stonex_netting(
    input_csv_path: str,
    output_xlsx_path: str = None,
    symbol_filter: str = None,
    period_filter: str = None,
    eligible_only: bool = True,
) -> str:
    if not os.path.exists(input_csv_path):
        raise FileNotFoundError(f"Input file not found: {input_csv_path}")

    if not output_xlsx_path:
        base_name, _ = os.path.splitext(input_csv_path)
        output_xlsx_path = f"{base_name}_Netting_Consolidated.xlsx"

    print(f"[*] Initializing StoneX Netting Engine on: {input_csv_path}")
    engine = StoneXNettingEngine(input_csv_path)

    print("[*] Parsing positions and evaluating The Netting Rule (Buy == Sell)...")
    summary = engine.parse_summary_and_contracts()

    print(f"[+] Total Positions Scanned : {summary['total_positions']}")
    print(f"[+] Distinct Products Found : {summary['total_products']}")
    print(f"[+] Total Contracts Found  : {summary['total_contracts']}")
    print(f"[+] Net-Zero Eligible       : {summary['eligible_contracts_count']} contracts ({summary['total_eligible_lots']:g} lots)")

    if summary["eligible_contracts_count"] == 0:
        print("[!] No contracts met The Netting Rule (Buy + Sell = 0).")
        if eligible_only:
            raise ValueError("No net-zero contracts available to export.")

    print("\n--- Eligible Net-Zero Contracts ---")
    for c in summary["contracts"]:
        if c["is_eligible"]:
            print(f"  * {c['symbol']:<6s} | {c['period']:<10s} | {c['description']:<26s} | Lots: {c['buy_lots']:>6g} Buy / {c['sell_lots']:>6g} Sell")

    print(f"\n[*] Generating consolidated single-worksheet Excel: {output_xlsx_path}")
    out_path = engine.export_consolidated_excel(
        output_xlsx_path=output_xlsx_path,
        symbol_filter=symbol_filter,
        period_filter=period_filter,
        eligible_only=eligible_only,
    )
    print(f"[OK] Successfully exported consolidated Trade Transfer Form to:\n     {os.path.abspath(out_path)}")
    return out_path


def main():
    parser = argparse.ArgumentParser(
        description="StoneX Netting CLI Converter — Ingests NetPositions CSV and generates consolidated Trade Transfer Form Excel."
    )
    parser.add_argument("--input", "-i", required=True, help="Path to input StoneX NetPositions CSV")
    parser.add_argument("--output", "-o", help="Custom output Excel (.xlsx) file path")
    parser.add_argument("--symbol", "-s", help="Optional filter by Reporting Symbol (Col I)")
    parser.add_argument("--period", "-p", help="Optional filter by Delivery Period (Col O)")
    parser.add_argument(
        "--include-unbalanced",
        action="store_true",
        help="Include unbalanced contracts (default exports net-zero eligible contracts only)",
    )

    args = parser.parse_args()
    try:
        convert_stonex_netting(
            input_csv_path=args.input,
            output_xlsx_path=args.output,
            symbol_filter=args.symbol,
            period_filter=args.period,
            eligible_only=not args.include_unbalanced,
        )
    except Exception as e:
        print(f"\n[ERROR] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
