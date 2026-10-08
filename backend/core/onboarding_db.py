"""
onboarding_db.py
SQLite-backed lookup tables for People Onboarding derivation rules.

Tables
------
  clientgroup_rules      – (location, sub_branch, is_commodity, comms_code) -> clientgroup
  broker_rules           – account-id prefix -> distributor + clearer template
  clientsubgroup_suffixes – clientgroup -> subgroup suffix

All tables are seeded with defaults on first import.  Any row can be
added / replaced / deleted at runtime via the helper functions below;
the data is persisted in  backend/onboarding.db .
"""

import os
import json
import sqlite3
from typing import Optional, List, Dict, Any

# ---------------------------------------------------------------------------
# DB path
# ---------------------------------------------------------------------------

_HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(_HERE, "..", "onboarding.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


# ---------------------------------------------------------------------------
# Schema + seed
# ---------------------------------------------------------------------------

_DDL = """
CREATE TABLE IF NOT EXISTS clientgroup_rules (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    comms_code   TEXT,        -- 'ALGO' | NULL
    location     TEXT,        -- 'Kolkata' | 'Gurgaon' | 'Bengaluru' | 'Mumbai' | NULL
    sub_branch   TEXT,        -- 'Senior' | 'Junior' | NULL
    is_commodity INTEGER,     -- 1 | 0 | NULL
    clientgroup  TEXT NOT NULL,
    priority     INTEGER NOT NULL DEFAULT 0  -- higher = wins on ambiguous match
);

CREATE TABLE IF NOT EXISTS broker_rules (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix            TEXT NOT NULL UNIQUE,
    distributor       TEXT NOT NULL,
    clearer_template  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clientsubgroup_suffixes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    clientgroup TEXT NOT NULL UNIQUE,
    suffix      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sheet_config (
    id            INTEGER PRIMARY KEY,
    sheet_url     TEXT NOT NULL,
    sheet_id      TEXT NOT NULL,
    worksheet_gid TEXT DEFAULT '',
    sheet_title   TEXT DEFAULT '',
    last_synced   TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sheet_accounts_cache (
    account          TEXT PRIMARY KEY,
    raw_name         TEXT,
    location         TEXT,
    sub_branch       TEXT,
    subgroup_prefix  TEXT,
    commsgroupcode   TEXT,
    is_joint         INTEGER DEFAULT 0,
    raw_data_json    TEXT
);
CREATE INDEX IF NOT EXISTS idx_sheet_cache_acc ON sheet_accounts_cache(account);
CREATE INDEX IF NOT EXISTS idx_sheet_cache_name ON sheet_accounts_cache(raw_name);
"""

_SEED_CLIENTGROUP = [
    # (comms_code, location, sub_branch, is_commodity, clientgroup, priority)
    ("ALGO", None,        None,       None, "ALGO",   100),
    (None,   "Kolkata",   "Senior",   None, "KOLSR",   20),
    (None,   "Kolkata",   "Junior",   None, "KOLJR",   20),
    (None,   "Gurgaon",   None,       1,    "GURCOM",  10),
    (None,   "Gurgaon",   None,       0,    "GURFI",   10),
    (None,   "Bengaluru", None,       None, "BAN",      5),
    (None,   "Mumbai",    None,       None, "MUM",      5),
    (None,   "Dubai",     None,       None, "GLB",      5),
]

# Prefixes ordered longest-first so EEGG is matched before EE
_SEED_BROKER = [
    ("EEGG", "MARIX", "CLR MARIX SYM"),
    ("KT",   "KGI",   "CLR KGI SYM"),
    ("EX",   "ETAO",  "CLR ETAO SYM"),
    ("SY",   "SXUK",  "CLR STX SYM"),
    ("EE",   "Marex", "CLR MRX SYM"),
    ("GG",   "Marex", "CLR MRX SYM"),
    ("AX",   "ITAU",  "CLR ITAU SYM"),
]

_SEED_SUBGROUP = [
    ("ALGO",   "ALGOX"),
    ("KOLSR",  "KOLSR"),
    ("KOLJR",  "KOLJR"),
    ("GURCOM", "GURCO"),
    ("GURFI",  "GURFI"),
    ("BAN",    "BLORE"),
    ("MUM",    "MUMBA"),
    ("GLB",    "GLOBL"),
]


def init_db() -> None:
    """Create tables and insert seed rows (idempotent)."""
    with _get_conn() as conn:
        conn.executescript(_DDL)

        # Seed clientgroup_rules only if empty
        if conn.execute("SELECT COUNT(*) FROM clientgroup_rules").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO clientgroup_rules "
                "(comms_code, location, sub_branch, is_commodity, clientgroup, priority) "
                "VALUES (?,?,?,?,?,?)",
                _SEED_CLIENTGROUP,
            )
        else:
            # Ensure Dubai rule is present if DB was already seeded
            if conn.execute("SELECT COUNT(*) FROM clientgroup_rules WHERE location = 'Dubai'").fetchone()[0] == 0:
                conn.execute(
                    "INSERT INTO clientgroup_rules (comms_code, location, sub_branch, is_commodity, clientgroup, priority) "
                    "VALUES (?,?,?,?,?,?)",
                    (None, "Dubai", None, None, "GLB", 5),
                )

        # Seed broker_rules only if empty
        if conn.execute("SELECT COUNT(*) FROM broker_rules").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO broker_rules (prefix, distributor, clearer_template) VALUES (?,?,?)",
                _SEED_BROKER,
            )

        # Seed clientsubgroup_suffixes only if empty
        if conn.execute("SELECT COUNT(*) FROM clientsubgroup_suffixes").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO clientsubgroup_suffixes (clientgroup, suffix) VALUES (?,?)",
                _SEED_SUBGROUP,
            )

        conn.commit()


# ---------------------------------------------------------------------------
# clientgroup_rules CRUD
# ---------------------------------------------------------------------------

def list_clientgroup_rules() -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM clientgroup_rules ORDER BY priority DESC, id"
        ).fetchall()
        return [dict(r) for r in rows]


def upsert_clientgroup_rule(
    clientgroup: str,
    comms_code: Optional[str] = None,
    location: Optional[str] = None,
    sub_branch: Optional[str] = None,
    is_commodity: Optional[int] = None,
    priority: int = 0,
    rule_id: Optional[int] = None,
) -> int:
    """Insert or update.  Pass rule_id to update an existing row."""
    with _get_conn() as conn:
        if rule_id:
            conn.execute(
                "UPDATE clientgroup_rules SET comms_code=?, location=?, sub_branch=?, "
                "is_commodity=?, clientgroup=?, priority=? WHERE id=?",
                (comms_code, location, sub_branch, is_commodity, clientgroup, priority, rule_id),
            )
            conn.commit()
            return rule_id
        else:
            cur = conn.execute(
                "INSERT INTO clientgroup_rules "
                "(comms_code, location, sub_branch, is_commodity, clientgroup, priority) "
                "VALUES (?,?,?,?,?,?)",
                (comms_code, location, sub_branch, is_commodity, clientgroup, priority),
            )
            conn.commit()
            return cur.lastrowid


def delete_clientgroup_rule(rule_id: int) -> bool:
    with _get_conn() as conn:
        cur = conn.execute("DELETE FROM clientgroup_rules WHERE id=?", (rule_id,))
        conn.commit()
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# broker_rules CRUD
# ---------------------------------------------------------------------------

def list_broker_rules() -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM broker_rules ORDER BY LENGTH(prefix) DESC, prefix"
        ).fetchall()
        return [dict(r) for r in rows]


def upsert_broker_rule(
    prefix: str,
    distributor: str,
    clearer_template: str,
    rule_id: Optional[int] = None,
) -> int:
    with _get_conn() as conn:
        if rule_id:
            conn.execute(
                "UPDATE broker_rules SET prefix=?, distributor=?, clearer_template=? WHERE id=?",
                (prefix.upper(), distributor, clearer_template, rule_id),
            )
            conn.commit()
            return rule_id
        else:
            conn.execute(
                "INSERT INTO broker_rules (prefix, distributor, clearer_template) VALUES (?,?,?) "
                "ON CONFLICT(prefix) DO UPDATE SET distributor=excluded.distributor, "
                "clearer_template=excluded.clearer_template",
                (prefix.upper(), distributor, clearer_template),
            )
            conn.commit()
            row = conn.execute(
                "SELECT id FROM broker_rules WHERE prefix=?", (prefix.upper(),)
            ).fetchone()
            return row["id"]


def delete_broker_rule(rule_id: int) -> bool:
    with _get_conn() as conn:
        cur = conn.execute("DELETE FROM broker_rules WHERE id=?", (rule_id,))
        conn.commit()
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# clientsubgroup_suffixes CRUD
# ---------------------------------------------------------------------------

def list_subgroup_suffixes() -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM clientsubgroup_suffixes ORDER BY clientgroup"
        ).fetchall()
        return [dict(r) for r in rows]


def upsert_subgroup_suffix(
    clientgroup: str,
    suffix: str,
    rule_id: Optional[int] = None,
) -> int:
    with _get_conn() as conn:
        if rule_id:
            conn.execute(
                "UPDATE clientsubgroup_suffixes SET clientgroup=?, suffix=? WHERE id=?",
                (clientgroup, suffix, rule_id),
            )
            conn.commit()
            return rule_id
        else:
            conn.execute(
                "INSERT INTO clientsubgroup_suffixes (clientgroup, suffix) VALUES (?,?) "
                "ON CONFLICT(clientgroup) DO UPDATE SET suffix=excluded.suffix",
                (clientgroup, suffix),
            )
            conn.commit()
            row = conn.execute(
                "SELECT id FROM clientsubgroup_suffixes WHERE clientgroup=?", (clientgroup,)
            ).fetchone()
            return row["id"]


def delete_subgroup_suffix(rule_id: int) -> bool:
    with _get_conn() as conn:
        cur = conn.execute("DELETE FROM clientsubgroup_suffixes WHERE id=?", (rule_id,))
        conn.commit()
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# sheet_config CRUD
# ---------------------------------------------------------------------------

def get_sheet_config() -> Optional[dict]:
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM sheet_config WHERE id = 1").fetchone()
        return dict(row) if row else None


def save_sheet_config(
    sheet_url: str,
    sheet_id: str,
    worksheet_gid: str = "",
    sheet_title: str = "",
    last_synced: str = "",
) -> None:
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO sheet_config (id, sheet_url, sheet_id, worksheet_gid, sheet_title, last_synced)
            VALUES (1, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                sheet_url=excluded.sheet_url,
                sheet_id=excluded.sheet_id,
                worksheet_gid=excluded.worksheet_gid,
                sheet_title=excluded.sheet_title,
                last_synced=excluded.last_synced
            """,
            (sheet_url, sheet_id, str(worksheet_gid or ""), sheet_title, last_synced),
        )
        conn.commit()


def clear_sheet_config() -> None:
    with _get_conn() as conn:
        conn.execute("DELETE FROM sheet_config WHERE id = 1")
        conn.execute("DELETE FROM sheet_accounts_cache")
        conn.commit()


def save_sheet_records_cache(records: List[Dict[str, Any]]) -> None:
    """Replaces cached records in SQLite using a high-speed batch transaction."""
    rows = []
    for r in records:
        acc = str(r.get("account", "")).strip().upper()
        if not acc:
            continue
        rows.append((
            acc,
            r.get("raw_name", ""),
            r.get("location", ""),
            r.get("sub_branch", ""),
            r.get("subgroup_prefix", ""),
            r.get("commsgroupcode", ""),
            1 if r.get("is_joint") else 0,
            json.dumps(r),
        ))

    with _get_conn() as conn:
        conn.execute("DELETE FROM sheet_accounts_cache")
        if rows:
            conn.executemany(
                """
                INSERT OR REPLACE INTO sheet_accounts_cache
                (account, raw_name, location, sub_branch, subgroup_prefix, commsgroupcode, is_joint, raw_data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
        conn.commit()


def get_cached_records_count() -> int:
    """Returns count of accounts stored in SQLite cache."""
    with _get_conn() as conn:
        cur = conn.execute("SELECT COUNT(*) FROM sheet_accounts_cache")
        return cur.fetchone()[0]


def search_cached_accounts(query: str = "", limit: int = 50) -> List[Dict[str, Any]]:
    """
    High-performance indexed search for autocomplete or list.
    Supports instant queries even with 100,000+ accounts.
    """
    limit_val = max(1, min(int(limit), 200))
    q = (query or "").strip()

    with _get_conn() as conn:
        if not q:
            cur = conn.execute(
                """
                SELECT account, raw_name, location, is_joint
                FROM sheet_accounts_cache
                ORDER BY account ASC
                LIMIT ?
                """,
                (limit_val,),
            )
        else:
            q_prefix = f"{q.upper()}%"
            q_contain = f"%{q.lower()}%"
            cur = conn.execute(
                """
                SELECT account, raw_name, location, is_joint
                FROM sheet_accounts_cache
                WHERE account LIKE ? OR LOWER(raw_name) LIKE ?
                ORDER BY (CASE WHEN account LIKE ? THEN 0 ELSE 1 END), account ASC
                LIMIT ?
                """,
                (q_prefix, q_contain, q_prefix, limit_val),
            )

        return [
            {
                "account": row["account"],
                "name": row["raw_name"],
                "branch": row["location"],
                "is_joint": bool(row["is_joint"]),
            }
            for row in cur.fetchall()
        ]


def lookup_cached_account(account_code: str) -> Optional[Dict[str, Any]]:
    """O(1) indexed lookup for a single account from SQLite cache."""
    acc = (account_code or "").strip().upper()
    if not acc:
        return None

    with _get_conn() as conn:
        cur = conn.execute(
            "SELECT raw_data_json FROM sheet_accounts_cache WHERE account = ?",
            (acc,),
        )
        row = cur.fetchone()
        if not row or not row["raw_data_json"]:
            return None
        try:
            return json.loads(row["raw_data_json"])
        except Exception:
            return None


def batch_lookup_cached_accounts(account_list: List[str]) -> Dict[str, Dict[str, Any]]:
    """Batch lookup for accounts in SQLite cache."""
    clean_accs = list({a.strip().upper() for a in account_list if a.strip()})
    if not clean_accs:
        return {}

    placeholders = ",".join("?" for _ in clean_accs)
    with _get_conn() as conn:
        cur = conn.execute(
            f"SELECT account, raw_data_json FROM sheet_accounts_cache WHERE account IN ({placeholders})",
            clean_accs,
        )
        res = {}
        for row in cur.fetchall():
            try:
                res[row["account"]] = json.loads(row["raw_data_json"])
            except Exception:
                pass
        return res


# ---------------------------------------------------------------------------
# Auto-init on import
# ---------------------------------------------------------------------------
init_db()
