"""Process-wide MongoDB database handle for modules that must not import ``main``."""

from __future__ import annotations

import os
from typing import Any

mongo_db: Any | None = None

# Set at startup when the Motor client fails or the URI is missing / invalid (for 503 detail text).
mongo_last_connect_error: str | None = None


def _strip_env_value(raw: str | None) -> str:
    """Trim whitespace, BOM, and one layer of ASCII quotes often pasted from dashboards."""
    if raw is None:
        return ""
    s = raw.strip()
    if s.startswith("\ufeff"):
        s = s[1:].strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ("'", '"'):
        s = s[1:-1].strip()
    return s


def _looks_like_mongodb_uri(value: str) -> bool:
    low = value.strip().lower()
    return low.startswith(("mongodb+srv://", "mongodb://"))


def mongo_env_connection_string_and_key() -> tuple[str, str]:
    """
    Return ``(connection_string, env_key_used)``.
    Only values that look like Mongo URIs count — ``DATABASE_URL`` on Render is often Postgres
    (``postgres://…``); those are skipped so Mongo still resolves from ``MONGODB_URL`` / ``MONGODB_URI``.
    """
    for key in ("MONGODB_URL", "MONGODB_URI", "DATABASE_URL"):
        v = _strip_env_value(os.getenv(key))
        if v and _looks_like_mongodb_uri(v):
            return v, key
    return "", ""


def mongo_env_connection_string() -> str:
    return mongo_env_connection_string_and_key()[0]


def mongo_env_database_name_and_source() -> tuple[str, str]:
    """
    Logical database name when the URI has no ``/dbname`` segment (common for Atlas defaults).

    Returns ``(db_name_or_empty, source_label_for_logs)``.
    ``DATABASE_NAME`` is only honored if it follows a mongo-specific variable or if no mongo-specific name is set —
    avoids Render Postgres addon ``DATABASE_NAME`` stealing Mongo when both exist.
    """
    mongo_explicit = (
        ("MONGODB_DB_NAME", "MONGODB_DB_NAME"),
        ("MONGO_DB_NAME", "MONGO_DB_NAME"),
        ("MONGODB_DATABASE", "MONGODB_DATABASE"),
        ("MONGODB_DEFAULT_DB", "MONGODB_DEFAULT_DB"),
        ("DB_NAME", "DB_NAME"),
    )
    for env_key, label in mongo_explicit:
        v = _strip_env_value(os.getenv(env_key))
        if v:
            return v, label
    # Do not use generic DATABASE_NAME — on Render it is often the Postgres DB name when both stacks exist.
    return "", ""


def mongo_env_database_name() -> str:
    return mongo_env_database_name_and_source()[0]


def set_mongo_database(db: Any | None) -> None:
    global mongo_db
    mongo_db = db


def set_mongo_last_connect_error(message: str | None) -> None:
    global mongo_last_connect_error
    mongo_last_connect_error = (message or "")[:800] or None


def require_mongo_db() -> Any:
    from fastapi import HTTPException

    if mongo_db is None:
        base = (
            "MongoDB is not available — admin unlock needs a working database session. "
            "Set `MONGODB_URL` or `MONGODB_URI` (Mongo URI only — `DATABASE_URL` is ignored unless it begins with mongodb)."
        )
        if mongo_last_connect_error:
            base = "MongoDB did not connect at startup — " + mongo_last_connect_error
        raise HTTPException(status_code=503, detail=base)
    return mongo_db
