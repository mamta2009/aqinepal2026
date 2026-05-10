"""Process-wide MongoDB database handle for modules that must not import ``main``."""

from __future__ import annotations

from typing import Any

mongo_db: Any | None = None


def set_mongo_database(db: Any | None) -> None:
    global mongo_db
    mongo_db = db


def require_mongo_db() -> Any:
    from fastapi import HTTPException

    if mongo_db is None:
        raise HTTPException(
            status_code=503,
            detail="MongoDB not configured (set MONGODB_URL or DATABASE_URL in .env)",
        )
    return mongo_db
