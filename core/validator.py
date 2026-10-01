import re
from typing import List, Tuple, Set, Optional


class SchemaValidator:
    """
    Validates CSV headers and step-by-step business constraints (S.O.L.I.D SRP).
    Does NOT depend on file names containing 'OPD'.
    """

    MANDATORY_COLUMNS = ["contractcode", "transactiontype", "qtybalance"]
    ACCOUNT_COLUMNS = ["clientaccountnumber", "clientnumber"]

    @classmethod
    def validate_headers(cls, detected_columns: List[str]) -> Tuple[bool, List[str]]:
        normalized = [c.strip().lower() for c in detected_columns if c]
        missing = []

        for req in cls.MANDATORY_COLUMNS:
            if req not in normalized:
                missing.append(req)

        has_account = any(acc in normalized for acc in cls.ACCOUNT_COLUMNS)
        if not has_account:
            missing.append("clientaccountnumber or clientnumber")

        is_valid = len(missing) == 0
        return is_valid, missing

    @classmethod
    def validate_route(
        cls,
        from_account: str,
        to_account: str,
        existing_accounts: Set[str],
        existing_routes: List[dict]
    ) -> Tuple[bool, Optional[str]]:
        src = from_account.strip().upper() if from_account else ""
        dst = to_account.strip().upper() if to_account else ""

        if not src:
            return False, "Sender account cannot be empty."
        if not dst:
            return False, "Recipient account cannot be empty."

        # Check sender exists
        existing_upper = {a.upper() for a in existing_accounts}
        if src not in existing_upper:
            return False, f"Sender account '{src}' is not present in the loaded trade file."

        # Check self-transfer
        if src == dst:
            return False, "Sender and Recipient cannot be the exact same account."

        # Check duplicate
        for r in existing_routes:
            r_src = r.get("from", r.get("from_account", "")).strip().upper()
            r_dst = r.get("to", r.get("to_account", "")).strip().upper()
            if r_src == src and r_dst == dst:
                return False, f"Route {src} -> {dst} already exists."

        return True, None

    @classmethod
    def validate_allocation(cls, transfer_qty: float, available_qty: float) -> Tuple[bool, Optional[str]]:
        if transfer_qty < 0:
            return False, "Transfer quantity cannot be negative."
        if transfer_qty > available_qty:
            return False, f"Transfer quantity ({transfer_qty}) exceeds available balance ({available_qty})."
        return True, None

    @classmethod
    def validate_price(cls, price_mode: str, price_val: Optional[float]) -> Tuple[bool, Optional[str]]:
        if price_mode == "manual":
            if price_val is None:
                return False, "Manual price mode requires a price value."
            if price_val <= 0:
                return False, "Manual price must be greater than zero."
        return True, None

    @classmethod
    def validate_export_filename(cls, filename: str) -> Tuple[bool, Optional[str]]:
        if not filename or not filename.strip():
            return False, "Filename cannot be empty."
        cleaned = filename.strip()
        # Disallow invalid windows file characters
        if re.search(r'[<>:"/\\|?*]', cleaned.replace(".xlsx", "")):
            return False, 'Filename contains invalid characters (<>:"/\\|?*).'
        return True, None
