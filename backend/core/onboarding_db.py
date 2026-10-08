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
import sqlite3
from typing import Optional

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
) -> int:
    with _get_conn() as conn:
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


def upsert_subgroup_suffix(clientgroup: str, suffix: str) -> int:
    with _get_conn() as conn:
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
# Auto-init on import
# ---------------------------------------------------------------------------
init_db()
