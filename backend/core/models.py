from dataclasses import dataclass
from typing import Optional, List, Any
from datetime import datetime

EXCEL_HEADERS = [
    "TradeType", "TrdTyp", "TrdSubtyp", "Market ID", "Symbol",
    "Contract Expiry", "TransactionTyp", "Qty", "TradePrice", "Product Type",
    "C/P", "Strike", "Account", "Date", "Expdate",
    "Currency", "Comment", "Fees"
]


@dataclass
class TransferRoute:
    id: int
    from_account: str
    to_account: str


@dataclass
class TradeAllocation:
    row_id: str
    from_account: str
    to_account: str
    transfer_qty: float
    custom_price: Optional[float] = None
    custom_date: Optional[str] = None
    price_mode: Optional[str] = None   # 'price' | 'settle' | 'manual' — overrides global when set


@dataclass
class FileValidationResult:
    is_valid: bool
    missing_required: List[str]
    detected_headers: List[str]
    row_count: int = 0
    account_count: int = 0
    error_message: Optional[str] = None
