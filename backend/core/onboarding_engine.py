"""
onboarding_engine.py
Pure-function derivation logic + openpyxl Excel builder for People Onboarding.

All business rules (clientgroup, clientsubgroup, distributor, cleareraccountid)
are driven by the SQLite lookup tables in onboarding_db.py, so they can be
updated at runtime without touching this file.
"""

import os
import tempfile
from typing import Optional

import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side

from core.onboarding_db import (
    list_clientgroup_rules,
    list_broker_rules,
    list_subgroup_suffixes,
)

# ---------------------------------------------------------------------------
# Constants – columns that never change regardless of input
# ---------------------------------------------------------------------------

CONSTANTS = {
    "clientcountrycode": "IN",
    "basecurrency":       "USD",
    "accountstatus":      "Active",
    "accountdescription": "Trading",
    "accountcollateral":  "N",
    "margingroupcode":    "Default",
    "sourcefield1":       "*",
    "sourcefield2":       "*",
    "sourcefield3":       "*",
    "sourcefield4":       "*",
    "flagfield1":         "wildcard",
    "flagfield2":         "wildcard",
    "flagfield3":         "wildcard",
    "flagfield4":         "wildcard",
    "accountmapstatus":   "Active",
    "trdstatus":          "A",
    "clientsummary":      "N",
    "period":             "Daily, Monthly",
    "emailtotype":        "To",
    "clientreportstatus": "Active",
}

# Ordered column list – matches the target Excel template column order
COLUMN_ORDER = [
    "firstname", "lastname", "clientid", "clientcountrycode", "basecurrency",
    "clientgroup", "clientsubgroup", "email", "accountid", "accountstatus",
    "accountdescription", "accountcollateral", "commsgroupcode", "margingroupcode",
    "distributor", "accountmap", "sourcefield1", "sourcefield2", "sourcefield3",
    "sourcefield4", "flagfield1", "flagfield2", "flagfield3", "flagfield4",
    "cleareraccountid", "accountmapstatus", "trdstatus", "clientsummary",
    "period", "emailaddress", "emailtotype", "clientreportstatus", "useremail",
]

# Header rows 1 & 2 (Required YN / Collection) – kept minimal; row 3 = field names
_ROW1_REQUIRED = {
    "firstname": "Y", "lastname": "Y", "clientid": "Y", "clientcountrycode": "Y",
    "basecurrency": "Y", "clientgroup": "Y", "clientsubgroup": "Y", "email": "Y",
    "accountid": "Y", "accountstatus": "Y", "accountdescription": "Y",
    "accountcollateral": "Y", "commsgroupcode": "Y", "margingroupcode": "Y",
    "distributor": "Y", "accountmap": "Y", "sourcefield1": "N", "sourcefield2": "N",
    "sourcefield3": "N", "sourcefield4": "N", "flagfield1": "N", "flagfield2": "N",
    "flagfield3": "N", "flagfield4": "N", "cleareraccountid": "Y",
    "accountmapstatus": "Y", "trdstatus": "Y", "clientsummary": "Y",
    "period": "Y", "emailaddress": "Y", "emailtotype": "Y",
    "clientreportstatus": "Y", "useremail": "Y",
}

_ROW2_COLLECTION = {
    "firstname": "Client", "lastname": "Client", "clientid": "Client",
    "clientcountrycode": "Client", "basecurrency": "Client", "clientgroup": "Client",
    "clientsubgroup": "Client", "email": "Client", "accountid": "Account",
    "accountstatus": "Account", "accountdescription": "Account",
    "accountcollateral": "Account", "commsgroupcode": "Account",
    "margingroupcode": "Account", "distributor": "Account", "accountmap": "AccountMap",
    "sourcefield1": "AccountMap", "sourcefield2": "AccountMap",
    "sourcefield3": "AccountMap", "sourcefield4": "AccountMap",
    "flagfield1": "AccountMap", "flagfield2": "AccountMap",
    "flagfield3": "AccountMap", "flagfield4": "AccountMap",
    "cleareraccountid": "AccountMap", "accountmapstatus": "AccountMap",
    "trdstatus": "AccountMap", "clientsummary": "AccountMap",
    "period": "Email", "emailaddress": "Email", "emailtotype": "Email",
    "clientreportstatus": "Email", "useremail": "Email",
}


# ---------------------------------------------------------------------------
# Derivation helpers
# ---------------------------------------------------------------------------

def derive_clientgroup(
    comms_code: str,
    location: Optional[str],
    sub_branch: Optional[str],
    is_commodity: bool,
) -> str:
    """
    Matches the highest-priority rule from clientgroup_rules.
    Falls back to empty string if nothing matches.
    """
    rules = list_clientgroup_rules()  # already sorted by priority DESC
    for rule in rules:
        # comms_code match
        if rule["comms_code"] and rule["comms_code"] != comms_code:
            continue
        # location match
        if rule["location"] and rule["location"] != location:
            continue
        # sub_branch match
        if rule["sub_branch"] and rule["sub_branch"] != sub_branch:
            continue
        # is_commodity match (only when the rule explicitly sets it)
        if rule["is_commodity"] is not None:
            rule_commodity = bool(rule["is_commodity"])
            if rule_commodity != bool(is_commodity):
                continue
        return rule["clientgroup"]
    return ""


def derive_clientsubgroup(clientgroup: str, prefix: str = "") -> str:
    """
    Returns prefix + suffix for the given clientgroup.
    prefix is up to 8 characters provided by the user (e.g. a date like 20261007).
    Falls back to the clientgroup code itself if no suffix mapping exists.
    """
    suffixes = {r["clientgroup"]: r["suffix"] for r in list_subgroup_suffixes()}
    suffix = suffixes.get(clientgroup, clientgroup)
    return (prefix[:8] + suffix) if prefix else suffix


def derive_broker(clientid: str) -> tuple[str, str]:
    """
    Returns (distributor, clearer_template).
    Prefixes are matched longest-first (guaranteed by list_broker_rules order).
    """
    cid_upper = (clientid or "").upper()
    for rule in list_broker_rules():
        if cid_upper.startswith(rule["prefix"].upper()):
            return rule["distributor"], rule["clearer_template"]
    return "", ""


# ---------------------------------------------------------------------------
# Row builder
# ---------------------------------------------------------------------------

def build_row(user_input: dict) -> dict:
    """
    Given a dict of user-entered fields, returns a complete flat dict
    with all 33 columns populated.

    user_input keys:
        firstname, lastname, clientid, email, commsgroupcode,
        location, sub_branch, is_commodity
    """
    clientid     = (user_input.get("clientid") or "").strip()
    email        = (user_input.get("email") or "").strip()
    comms        = (user_input.get("commsgroupcode") or "CWSYM").strip().upper()
    location     = user_input.get("location") or None
    sub_branch   = user_input.get("sub_branch") or None
    is_commodity = bool(user_input.get("is_commodity", False))
    subgroup_pfx = (user_input.get("subgroupPrefix") or "").strip()[:8]

    clientgroup    = derive_clientgroup(comms, location, sub_branch, is_commodity)
    clientsubgroup = derive_clientsubgroup(clientgroup, subgroup_pfx)
    distributor, clearer = derive_broker(clientid)

    row = {
        **CONSTANTS,
        "firstname":        (user_input.get("firstname") or "").strip(),
        "lastname":         (user_input.get("lastname") or "").strip(),
        "clientid":         clientid,
        "clientgroup":      clientgroup,
        "clientsubgroup":   clientsubgroup,
        "email":            email,
        "accountid":        clientid,
        "commsgroupcode":   comms,
        "distributor":      distributor,
        "accountmap":       clientid,
        "cleareraccountid": clearer,
        "emailaddress":     email,
        "useremail":        email,
    }
    return row


def derive_preview(user_input: dict) -> dict:
    """
    Returns only the derived fields for live UI preview (no constants).
    """
    clientid     = (user_input.get("clientid") or "").strip()
    comms        = (user_input.get("commsgroupcode") or "CWSYM").strip().upper()
    location     = user_input.get("location") or None
    sub_branch   = user_input.get("sub_branch") or None
    is_commodity = bool(user_input.get("is_commodity", False))
    subgroup_pfx = (user_input.get("subgroupPrefix") or "").strip()[:8]

    clientgroup    = derive_clientgroup(comms, location, sub_branch, is_commodity)
    clientsubgroup = derive_clientsubgroup(clientgroup, subgroup_pfx)
    distributor, clearer = derive_broker(clientid)

    return {
        "clientgroup":      clientgroup,
        "clientsubgroup":   clientsubgroup,
        "accountid":        clientid,
        "accountmap":       clientid,
        "distributor":      distributor,
        "cleareraccountid": clearer,
        "emailaddress":     user_input.get("email") or "",
        "useremail":        user_input.get("email") or "",
        "basecurrency":     "USD",
        "clientcountrycode": "IN",
    }


# ---------------------------------------------------------------------------
# Excel builder
# ---------------------------------------------------------------------------
# Excel builder
# ---------------------------------------------------------------------------

_BOLD_FONT   = Font(name="Calibri", size=11, bold=True)
_NORM_FONT   = Font(name="Calibri", size=11)
_CENTER      = Alignment(horizontal="center", vertical="center", wrap_text=True)
_THIN_BORDER = Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"),  bottom=Side(style="thin"),
)

# Label column A values for the three header rows
_COL_A_LABELS = ["Required YN", "Collection", "Field Name"]


def build_onboarding_excel(rows: list[dict]) -> str:
    """
    Builds an .xlsx file matching the Sample of All template:
      Col A  – fixed labels: "Required YN" / "Collection" / "Field Name" / blank
      Col B+ – data columns in COLUMN_ORDER
      Row 1  – Required YN values
      Row 2  – Collection grouping
      Row 3  – Field names
      Row 4+ – Data rows

    No fill colours.  All cells: Calibri 11pt, thin border, centred.
    Header rows 1-3 use bold; data rows use regular weight.

    Returns the path to the temporary file.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"

    # ── Build and append each of the 3 header rows ───────────────────────────
    header_data = [
        ["Required YN"] + [_ROW1_REQUIRED.get(col, "") for col in COLUMN_ORDER],
        ["Collection"]  + [_ROW2_COLLECTION.get(col, "") for col in COLUMN_ORDER],
        ["Field Name"]  + list(COLUMN_ORDER),
    ]
    for row_values in header_data:
        ws.append(row_values)

    # Style header rows (bold, border, centre — no fill)
    total_cols = len(COLUMN_ORDER) + 1   # +1 for label column A
    for r_idx in range(1, 4):
        for c_idx in range(1, total_cols + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.font      = _BOLD_FONT
            cell.alignment = _CENTER
            cell.border    = _THIN_BORDER

    # ── Data rows ────────────────────────────────────────────────────────────
    for row_dict in rows:
        full_row = build_row(row_dict)
        # Col A blank, then data columns
        row_values = [""] + [full_row.get(col, "") for col in COLUMN_ORDER]
        ws.append(row_values)

        r_idx = ws.max_row
        for c_idx in range(1, total_cols + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.font      = _NORM_FONT
            cell.alignment = _CENTER
            cell.border    = _THIN_BORDER

    # ── Column widths ────────────────────────────────────────────────────────
    for c_idx in range(1, total_cols + 1):
        col_letter = openpyxl.utils.get_column_letter(c_idx)
        max_len = max(
            len(str(ws.cell(row=r, column=c_idx).value or ""))
            for r in range(1, ws.max_row + 1)
        )
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    # ── Write to temp file ───────────────────────────────────────────────────
    tmp = tempfile.NamedTemporaryFile(
        delete=False, suffix=".xlsx", prefix="Onboarding_"
    )
    tmp.close()
    wb.save(tmp.name)
    return tmp.name
