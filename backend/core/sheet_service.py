"""
sheet_service.py
Google Sheets client, cache, and record normalizer for People Onboarding.

Features:
- Reads credentials from key.json (flexible path resolution).
- Auto-loads saved sheet URL/GID from SQLite (sheet_config table).
- Case-insensitive header matching and mixed-case value normalization.
- Joint account detection (r'\\s*/\\s*' whitespace-tolerant) & splitting.
- Derives preview fields via onboarding_engine.
- Clear error handling for 403 (permissions), 404 (not found), and .xlsx formats.
"""

import os
import re
import json
import datetime
from typing import Optional, Dict, Any, List, Tuple

import gspread
from core.onboarding_db import (
    get_sheet_config,
    save_sheet_config,
    clear_sheet_config,
    save_sheet_records_cache,
    get_cached_records_count,
    search_cached_accounts,
    lookup_cached_account,
    batch_lookup_cached_accounts,
)
from core.onboarding_engine import derive_preview


# ---------------------------------------------------------------------------
# Key file resolution & service email helper
# ---------------------------------------------------------------------------

def get_key_path() -> Optional[str]:
    """
    Finds key.json or service account credentials from environment variables,
    project root, backend directory, or ancestor folders.
    """
    # 1. Environment variables
    for env_var in ("GOOGLE_KEY_PATH", "GOOGLE_APPLICATION_CREDENTIALS"):
        env_val = os.environ.get(env_var)
        if env_val and os.path.isfile(env_val):
            return os.path.abspath(env_val)

    # 2. Search ancestor directories from this file and current working directory
    search_dirs: List[str] = []

    # Ascend up from current file directory (sheet_service.py -> core -> backend -> project root)
    curr = os.path.dirname(os.path.abspath(__file__))
    for _ in range(6):
        if curr not in search_dirs:
            search_dirs.append(curr)
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        curr = parent

    # Ascend up from current working directory
    curr = os.path.abspath(os.getcwd())
    for _ in range(6):
        if curr not in search_dirs:
            search_dirs.append(curr)
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        curr = parent

    candidate_names = [
        "key.json",
        "service_account.json",
        "google_key.json",
        "credentials.json",
    ]

    for d in search_dirs:
        for fname in candidate_names:
            candidate = os.path.join(d, fname)
            if os.path.isfile(candidate):
                return os.path.abspath(candidate)

    return None


def get_service_account_email() -> str:
    """Reads client_email from key.json with safe fallback."""
    kp = get_key_path()
    if kp and os.path.isfile(kp):
        try:
            with open(kp, "r", encoding="utf-8") as f:
                data = json.load(f)
                email = data.get("client_email")
                if email and isinstance(email, str) and email.strip():
                    return email.strip()
        except Exception:
            pass
    return "axxela@cohesive-apogee-117512.iam.gserviceaccount.com"


def extract_sheet_id_and_gid(url_or_id: str) -> Tuple[str, Optional[int]]:
    """Extracts spreadsheet ID and optional GID from Google Sheets URL or raw ID."""
    raw = (url_or_id or "").strip()
    if not raw:
        return "", None

    # Check for /d/<ID> in URL
    match = re.search(r"/d/([a-zA-Z0-9-_]+)", raw)
    sheet_id = match.group(1) if match else raw

    # Check for gid in URL
    gid_match = re.search(r"[#&?]gid=([0-9]+)", raw)
    gid = int(gid_match.group(1)) if gid_match else None

    return sheet_id, gid


# ---------------------------------------------------------------------------
# Value Normalizers
# ---------------------------------------------------------------------------

def clean_title_case(val: str) -> str:
    """Converts string with mixed casing to clean Title Case."""
    if not val:
        return ""
    words = val.strip().split()
    return " ".join(w.capitalize() for w in words)


def split_joint_str(val: str) -> List[str]:
    """Splits string on '/' or ';' ignoring surrounding whitespace."""
    if not val:
        return []
    parts = re.split(r"\s*[/;]\s*", val.strip())
    return [p.strip() for p in parts if p.strip()]


def parse_names(name_raw: str) -> List[Tuple[str, str]]:
    """
    Parses name field into a list of (firstname, lastname) tuples.
    If joint ('/'), returns 2 tuples.
    """
    if not name_raw:
        return [("", "")]

    joint_parts = split_joint_str(name_raw)
    if len(joint_parts) >= 2:
        results = []
        for p in joint_parts[:2]:
            words = p.split()
            if not words:
                results.append(("", ""))
            elif len(words) == 1:
                results.append((clean_title_case(words[0]), ""))
            else:
                first = clean_title_case(" ".join(words[:-1]))
                last = clean_title_case(words[-1])
                results.append((first, last))
        return results

    # Single name
    words = name_raw.strip().split()
    if not words:
        return [("", "")]
    if len(words) == 1:
        return [(clean_title_case(words[0]), "")]
    first = clean_title_case(" ".join(words[:-1]))
    last = clean_title_case(words[-1])
    return [(first, last)]


def normalize_location(branch_raw: str) -> str:
    """Normalizes branch to canonical location (Title Case)."""
    b = (branch_raw or "").strip().lower()
    mapping = {
        "kolkata": "Kolkata",
        "gurugram": "Gurgaon",
        "gurgaon": "Gurgaon",
        "bangalore": "Bengaluru",
        "bengaluru": "Bengaluru",
        "mumbai": "Mumbai",
        "dubai": "Dubai",
    }
    return mapping.get(b, clean_title_case(branch_raw))


def normalize_sub_branch(sub_raw: str) -> str:
    b = (sub_raw or "").strip().lower()
    if b == "senior":
        return "Senior"
    if b == "junior":
        return "Junior"
    return ""


# ---------------------------------------------------------------------------
# GoogleSheetService Class
# ---------------------------------------------------------------------------

class GoogleSheetService:
    def __init__(self):
        self._cache: List[Dict[str, Any]] = []
        self._last_synced: Optional[datetime.datetime] = None
        self._sheet_title: str = ""
        self._account_map: Dict[str, Dict[str, Any]] = {}

    def disconnect_sheet(self) -> Dict[str, Any]:
        """Clears saved Google Sheet configuration and flushes memory/SQLite cache."""
        clear_sheet_config()
        self._cache = []
        self._account_map = {}
        self._sheet_title = ""
        self._last_synced = None
        return {
            "success": True,
            "message": "Google Sheet disconnected successfully.",
            "status": self.get_sync_status(),
        }

    def get_sync_status(self) -> Dict[str, Any]:
        """Returns current configuration & cache status."""
        config = get_sheet_config()
        configured = bool(config and config.get("sheet_url"))
        service_email = get_service_account_email()

        if not configured:
            return {
                "configured": False,
                "connected": False,
                "sheet_title": "",
                "sheet_url": "",
                "worksheet_gid": "",
                "row_count": 0,
                "service_email": service_email,
                "last_synced": None,
                "message": "No Google Sheet configured. Please connect your Google Sheet.",
            }

        cached_count = get_cached_records_count()
        # If configured but cache is empty, attempt initial load
        if cached_count == 0 and not self._cache:
            try:
                self.load_cache()
                cached_count = get_cached_records_count()
            except Exception as e:
                return {
                    "configured": True,
                    "connected": False,
                    "sheet_title": config.get("sheet_title", ""),
                    "sheet_url": config.get("sheet_url", ""),
                    "worksheet_gid": config.get("worksheet_gid", ""),
                    "row_count": 0,
                    "service_email": service_email,
                    "last_synced": None,
                    "error": str(e),
                }

        effective_count = cached_count if cached_count > 0 else len(self._account_map)
        return {
            "configured": True,
            "connected": True,
            "sheet_title": self._sheet_title or config.get("sheet_title", ""),
            "sheet_url": config.get("sheet_url", ""),
            "worksheet_gid": config.get("worksheet_gid", ""),
            "row_count": effective_count,
            "service_email": service_email,
            "last_synced": self._last_synced.strftime("%Y-%m-%d %H:%M:%S") if self._last_synced else config.get("last_synced"),
        }

    def _fetch_sheet_data_robust(self, worksheet: gspread.Worksheet) -> List[List[Any]]:
        """
        Fetches all rows from worksheet with chunked streaming fallback.
        Supports large sheets with 100,000+ records without hitting Google Sheets
        API response size limits (~10MB payload ceiling) or socket timeouts.
        """
        total_rows = worksheet.row_count

        # For sheets up to 15,000 rows, get_all_values is fastest
        if total_rows <= 15000:
            try:
                return worksheet.get_all_values()
            except Exception:
                pass

        # For sheets with > 15,000 rows (up to 100,000+) or when get_all_values times out:
        try:
            header_vals = worksheet.row_values(1)
        except Exception:
            header_vals = []

        if not header_vals:
            return []

        col_count = len(header_vals)
        from gspread.utils import rowcol_to_a1
        end_col_a1 = rowcol_to_a1(1, col_count).replace("1", "")

        chunk_size = 10000
        all_rows = [header_vals]

        start_row = 2
        while start_row <= total_rows:
            end_row = min(start_row + chunk_size - 1, total_rows)
            cell_range = f"A{start_row}:{end_col_a1}{end_row}"
            try:
                chunk = worksheet.get(cell_range)
                if not chunk:
                    break
                all_rows.extend(chunk)
                if len(chunk) < (end_row - start_row + 1):
                    # End of actual data rows
                    break
            except Exception as e:
                if chunk_size > 2500:
                    chunk_size = 2500
                    continue
                raise RuntimeError(f"Failed fetching rows {start_row}-{end_row} from Google Sheet: {str(e)}")
            start_row = end_row + 1

        return all_rows

    def _open_worksheet(self, sheet_url_or_id: str, target_gid: Optional[Any] = None) -> Tuple[gspread.Worksheet, str]:
        """Opens worksheet with robust authentication and error mapping."""
        key_file = get_key_path()
        if not key_file:
            raise FileNotFoundError(
                "Google Service Account key file ('key.json') not found. "
                "Please place 'key.json' in the project root or configure the GOOGLE_KEY_PATH environment variable."
            )

        try:
            gc = gspread.service_account(filename=key_file)
        except json.JSONDecodeError as jde:
            raise ValueError(f"Service account key file '{key_file}' contains invalid JSON: {jde.msg}")
        except Exception as auth_err:
            raise ValueError(f"Failed to authenticate with Google service account key ('{key_file}'): {str(auth_err)}")

        sheet_id, url_gid = extract_sheet_id_and_gid(sheet_url_or_id)
        if not sheet_id:
            raise ValueError("Invalid Google Sheet URL or ID. Please provide a valid Google Spreadsheet URL.")

        effective_gid = target_gid if target_gid is not None and str(target_gid).strip() else url_gid

        try:
            sh = gc.open_by_key(sheet_id)
        except gspread.exceptions.SpreadsheetNotFound:
            raise FileNotFoundError(f"Google Sheet not found (404) for ID '{sheet_id}'. Please verify the Sheet URL or ID.")
        except PermissionError:
            service_email = get_service_account_email()
            raise PermissionError(
                f"Permission Denied (403): Please share your Google Sheet with '{service_email}' as Viewer."
            )
        except gspread.exceptions.APIError as err:
            err_str = str(err)
            if "must not be an Office file" in err_str:
                raise ValueError(
                    "Target document is an uploaded .xlsx file. In Google Sheets, click File -> Save as Google Sheets, then share the new sheet."
                )
            if "403" in err_str or "caller does not have permission" in err_str.lower():
                service_email = get_service_account_email()
                raise PermissionError(
                    f"Permission Denied (403): Please share your Google Sheet with '{service_email}' as Viewer."
                )
            if "404" in err_str or "not found" in err_str.lower():
                raise FileNotFoundError(f"Google Sheet not found (404). Please verify the Sheet URL.")
            if "429" in err_str or "quota" in err_str.lower():
                raise RuntimeError("Google Sheets API rate limit exceeded (429). Please wait a few seconds and try again.")
            raise ValueError(f"Google Sheets API error: {err_str}")
        except Exception as err:
            err_str = str(err)
            if "403" in err_str or "caller does not have permission" in err_str.lower():
                service_email = get_service_account_email()
                raise PermissionError(
                    f"Permission Denied (403): Please share your Google Sheet with '{service_email}' as Viewer."
                )
            raise ValueError(f"Unable to access Google Sheet: {err_str}")

        worksheet = None
        if effective_gid is not None:
            try:
                worksheet = sh.get_worksheet_by_id(int(effective_gid))
            except Exception:
                worksheet = None

        if worksheet is None:
            try:
                worksheet = sh.sheet1
            except Exception as err:
                raise ValueError(f"Spreadsheet '{sh.title}' does not contain any accessible worksheets: {str(err)}")

        return worksheet, sh.title

    def test_and_save_sheet(self, sheet_url: str, worksheet_gid: str = "") -> Dict[str, Any]:
        """
        Validates access to given sheet URL, updates SQLite, and populates memory cache.
        """
        raw_url = sheet_url.strip()
        if not raw_url:
            raise ValueError("Sheet URL cannot be empty.")

        sheet_id, parsed_gid = extract_sheet_id_and_gid(raw_url)
        gid_val = str(worksheet_gid).strip() if worksheet_gid else (str(parsed_gid) if parsed_gid is not None else "")

        # Open and verify
        worksheet, sheet_title = self._open_worksheet(raw_url, gid_val if gid_val else None)

        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        save_sheet_config(
            sheet_url=raw_url,
            sheet_id=sheet_id,
            worksheet_gid=gid_val,
            sheet_title=sheet_title,
            last_synced=now_str,
        )

        # Reload cache immediately
        self.load_cache()

        cached_count = get_cached_records_count()
        return {
            "success": True,
            "sheet_title": sheet_title,
            "row_count": cached_count if cached_count > 0 else len(self._account_map),
            "last_synced": now_str,
        }

    def load_cache(self, force: bool = False) -> None:
        """Loads records from the configured Google Sheet into SQLite & memory cache."""
        config = get_sheet_config()
        if not config or not config.get("sheet_url"):
            self._cache = []
            self._account_map = {}
            return

        worksheet, sheet_title = self._open_worksheet(
            config["sheet_url"],
            config.get("worksheet_gid") or None,
        )
        self._sheet_title = sheet_title

        # Stream rows robustly (supports 100k+ rows with chunked reading)
        raw_values = self._fetch_sheet_data_robust(worksheet)
        if not raw_values or len(raw_values) < 2:
            raw_records = []
        else:
            headers = [str(h).strip() for h in raw_values[0]]
            raw_records = []
            for row in raw_values[1:]:
                row_dict = {}
                for idx, h in enumerate(headers):
                    if h:
                        row_dict[h] = row[idx] if idx < len(row) else ""
                raw_records.append(row_dict)

        self._cache = raw_records
        self._account_map = {}
        parsed_records = []

        for raw_row in raw_records:
            parsed_row = self._parse_raw_row(raw_row)
            acc = parsed_row["account"].upper()
            if acc:
                self._account_map[acc] = parsed_row
                parsed_records.append(parsed_row)

        # Persist into high-performance SQLite cache
        save_sheet_records_cache(parsed_records)

        self._last_synced = datetime.datetime.now()
        save_sheet_config(
            sheet_url=config["sheet_url"],
            sheet_id=config["sheet_id"],
            worksheet_gid=config.get("worksheet_gid", ""),
            sheet_title=sheet_title,
            last_synced=self._last_synced.strftime("%Y-%m-%d %H:%M:%S"),
        )

    def _parse_raw_row(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Maps raw row with case-insensitive headers into standardized, casing-normalized structure.
        """
        norm_keys = {}
        for k, v in raw.items():
            clean_k = re.sub(r"[^a-z0-9]", "", str(k).lower())
            norm_keys[clean_k] = v

        def get_val(*keys: str) -> str:
            for k in keys:
                ck = re.sub(r"[^a-z0-9]", "", k.lower())
                if ck in norm_keys:
                    val = norm_keys[ck]
                    return "" if val is None else str(val).strip()
            return ""

        account_raw = get_val("account", "acct", "clientid")
        account = account_raw.upper()

        name_raw = get_val("name", "fullname")
        email_raw = get_val("email", "emailaddress")
        branch_raw = get_val("branch", "location")
        sub_branch_raw = get_val("subbranch", "sub_branch")
        subgroup_dates_raw = get_val("subgroupdates", "subgroup_dates", "subgroupdate")
        rebates_raw = get_val("rebates", "rebate")
        status_raw = get_val("accountstatus", "account_status", "status")

        # Casing normalization
        location = normalize_location(branch_raw)
        sub_branch = normalize_sub_branch(sub_branch_raw) if location == "Kolkata" else ""
        subgroup_prefix = str(subgroup_dates_raw).strip()[:8]
        comms = "ALGO" if "algo" in rebates_raw.lower() else "CWSYM"

        # Detect Joint Account
        is_joint = (
            "joint" in status_raw.lower()
            or "/" in name_raw
            or "/" in email_raw
            or ";" in name_raw
            or ";" in email_raw
        )

        name_pairs = parse_names(name_raw)
        email_parts = split_joint_str(email_raw)

        # Build persons list
        persons = []
        if is_joint and len(name_pairs) >= 2:
            p1_email = email_parts[0].lower() if len(email_parts) > 0 else email_raw.lower()
            p2_email = email_parts[1].lower() if len(email_parts) > 1 else email_raw.lower()

            p1_input = {
                "firstname": name_pairs[0][0],
                "lastname": name_pairs[0][1],
                "clientid": account,
                "email": p1_email,
                "commsgroupcode": comms,
                "location": location,
                "sub_branch": sub_branch,
                "is_commodity": False,
                "subgroupPrefix": subgroup_prefix,
            }
            p2_input = {
                "firstname": name_pairs[1][0],
                "lastname": name_pairs[1][1],
                "clientid": account,
                "email": p2_email,
                "commsgroupcode": comms,
                "location": location,
                "sub_branch": sub_branch,
                "is_commodity": False,
                "subgroupPrefix": subgroup_prefix,
            }
            persons.append({"label": f"Person 1: {name_pairs[0][0]} {name_pairs[0][1]}", "input": p1_input, "derived": derive_preview(p1_input)})
            persons.append({"label": f"Person 2: {name_pairs[1][0]} {name_pairs[1][1]}", "input": p2_input, "derived": derive_preview(p2_input)})
        else:
            first_n, last_n = name_pairs[0]
            clean_email = email_raw.lower()
            single_input = {
                "firstname": first_n,
                "lastname": last_n,
                "clientid": account,
                "email": clean_email,
                "commsgroupcode": comms,
                "location": location,
                "sub_branch": sub_branch,
                "is_commodity": False,
                "subgroupPrefix": subgroup_prefix,
            }
            persons.append({"label": f"{first_n} {last_n}".strip(), "input": single_input, "derived": derive_preview(single_input)})

        return {
            "account": account,
            "raw_name": name_raw,
            "raw_email": email_raw,
            "location": location,
            "sub_branch": sub_branch,
            "subgroup_prefix": subgroup_prefix,
            "commsgroupcode": comms,
            "is_joint": is_joint,
            "persons": persons,
        }

    def list_accounts(self, query: str = "", limit: int = 50) -> List[Dict[str, Any]]:
        """
        Returns account summaries for UI search / autocomplete.
        Delegates to indexed SQLite for sub-millisecond search across 100,000+ accounts.
        """
        cached = search_cached_accounts(query=query, limit=limit)
        if cached:
            return cached

        if not self._account_map and get_cached_records_count() == 0:
            try:
                self.load_cache()
                return search_cached_accounts(query=query, limit=limit)
            except Exception:
                return []

        q = query.strip().upper()
        summaries = []
        for acc, record in self._account_map.items():
            if not q or q in acc or q in record["raw_name"].upper():
                summaries.append({
                    "account": acc,
                    "name": record["raw_name"],
                    "branch": record["location"],
                    "is_joint": record["is_joint"],
                })
                if len(summaries) >= limit:
                    break
        return summaries

    def lookup_account(self, account_str: str, chosen_person: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Looks up a single account by ID (case-insensitive).
        O(1) indexed lookup from SQLite cache or memory map.
        """
        acc_upper = (account_str or "").strip().upper()
        if not acc_upper:
            return None

        record = lookup_cached_account(acc_upper)
        if not record:
            record = self._account_map.get(acc_upper)

        if not record and get_cached_records_count() == 0 and not self._account_map:
            try:
                self.load_cache()
                record = lookup_cached_account(acc_upper) or self._account_map.get(acc_upper)
            except Exception:
                record = None

        if not record:
            return None

        if chosen_person == "p1" and len(record["persons"]) > 0:
            return {**record, "selected": record["persons"][0]}
        elif chosen_person == "p2" and len(record["persons"]) > 1:
            return {**record, "selected": record["persons"][1]}

        return record

    def batch_lookup_accounts(
        self,
        account_list: List[str],
        joint_choices: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Looks up multiple accounts in batch using indexed SQLite cache.
        """
        if get_cached_records_count() == 0 and not self._account_map:
            try:
                self.load_cache()
            except Exception:
                pass

        choices = joint_choices or {}
        rows_to_add = []
        missing = []
        joint_detected = []

        cached_dict = batch_lookup_cached_accounts(account_list)

        for raw_acc in account_list:
            acc = raw_acc.strip().upper()
            if not acc:
                continue

            record = cached_dict.get(acc) or self._account_map.get(acc)
            if not record:
                missing.append(acc)
                continue

            if record["is_joint"]:
                joint_detected.append(acc)
                choice = choices.get(acc, "both")
                if choice == "p1":
                    rows_to_add.append(record["persons"][0])
                elif choice == "p2" and len(record["persons"]) > 1:
                    rows_to_add.append(record["persons"][1])
                else:
                    rows_to_add.extend(record["persons"])
            else:
                rows_to_add.append(record["persons"][0])

        return {
            "success": True,
            "rows": rows_to_add,
            "missing": missing,
            "joint_detected": joint_detected,
        }


# Singleton service instance
_sheet_service_instance: Optional[GoogleSheetService] = None

def get_sheet_service() -> GoogleSheetService:
    global _sheet_service_instance
    if _sheet_service_instance is None:
        _sheet_service_instance = GoogleSheetService()
    return _sheet_service_instance
