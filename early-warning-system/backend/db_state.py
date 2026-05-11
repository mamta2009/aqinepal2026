"""Process-wide MongoDB database handle for modules that must not import ``main``."""

from __future__ import annotations

from typing import Any

mongo_db: Any | None = None

# Set at startup when the Motor client fails or the URI is missing / invalid (for 503 detail text).
mongo_last_connect_error: str | None = None


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
            "Set `MONGODB_URL` (or `DATABASE_URL`) on Render to your Atlas URI and redeploy; check Render logs if it still fails."
        )
        if mongo_last_connect_error:
            base = "MongoDB did not connect at startup — " + mongo_last_connect_error
        raise HTTPException(status_code=503, detail=base)
    return mongo_db
