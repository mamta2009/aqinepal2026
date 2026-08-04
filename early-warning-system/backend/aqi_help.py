"""
aqiHelp — documentation-grounded Q&A over public guides (TF–IDF retrieval + OpenRouter).

Does not load docs-private/. Requires OPENROUTER_API_KEY server-side.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

import external_integrations
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/help", tags=["help"])

_BACKEND_ROOT = Path(__file__).resolve().parent
_DOCS_GUIDES = (_BACKEND_ROOT.parent / "docs" / "guides").resolve()

# Explicit allow-list only (avoid pulling sensitive or huge paths).
_CORPUS_RELPATHS: tuple[str, ...] = (
    "APPLICATION_OVERVIEW.md",
    "DASHBOARD_FEATURES.md",
    "IMPLEMENTATION_SNAPSHOT.md",
    "README.md",
    "CURSOR_SETUP_GUIDE.md",
    "LANDING_PAGE_GUIDE.md",
    "PACKAGE_COMPLETE.md",
    "prompts.md",
    "blockchain-ai/README.md",
    "blockchain-ai/INTEGRATION_GUIDE.md",
)

_MAX_CHUNK_CHARS = 2200
_MAX_CONTEXT_CHARS = 14_000
_TOP_K_CHUNKS = 10


class _HelpCorpusState:
    def __init__(self) -> None:
        self.chunk_meta: list[dict[str, str]] = []
        self.chunk_texts: list[str] = []
        self.vectorizer: TfidfVectorizer | None = None
        self.matrix: Any | None = None  # scipy sparse
        self.built_at: float | None = None
        self.build_error: str | None = None

    def clear(self) -> None:
        self.chunk_meta.clear()
        self.chunk_texts.clear()
        self.vectorizer = None
        self.matrix = None
        self.built_at = None
        self.build_error = None


_STATE = _HelpCorpusState()
_RATE_BUCKET: dict[str, list[float]] = {}
_RATE_LIMIT = 24
_RATE_WINDOW_S = 60.0


def _rate_allow(client_ip: str) -> bool:
    now = time.monotonic()
    buf = _RATE_BUCKET.setdefault(client_ip, [])
    buf[:] = [t for t in buf if now - t < _RATE_WINDOW_S]
    if len(buf) >= _RATE_LIMIT:
        return False
    buf.append(now)
    return True


def _normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def _split_into_chunks(source_label: str, raw: str) -> list[tuple[str, str]]:
    """
    Split markdown into chunks on ``## `` headings (keeps subsection context in heading prefix).
    """
    text = raw.replace("\r\n", "\n")
    parts = re.split(r"(?m)^##\s+", text)
    out: list[tuple[str, str]] = []
    if not parts:
        return out
    head0 = "(intro)"
    body0 = parts[0].strip()
    if body0:
        out.append((head0, body0[:_MAX_CHUNK_CHARS]))
    for i in range(1, len(parts)):
        block = parts[i].strip()
        if not block:
            continue
        first_line, _, rest = block.partition("\n")
        heading = _normalize_ws(first_line) or f"section_{i}"
        body = rest.strip() if rest else first_line
        blob = body if rest else ""
        while len(blob) > _MAX_CHUNK_CHARS:
            out.append((heading, blob[:_MAX_CHUNK_CHARS]))
            blob = blob[_MAX_CHUNK_CHARS:].lstrip()
        if blob:
            out.append((heading, blob[:_MAX_CHUNK_CHARS]))
    return out


def _load_corpus_sync() -> None:
    _STATE.clear()
    if not _DOCS_GUIDES.is_dir():
        _STATE.build_error = f"Guides directory missing: {_DOCS_GUIDES}"
        logger.warning("%s", _STATE.build_error)
        return

    chunk_meta: list[dict[str, str]] = []
    chunk_texts: list[str] = []

    for rel in _CORPUS_RELPATHS:
        path = (_DOCS_GUIDES / rel).resolve()
        try:
            path.relative_to(_DOCS_GUIDES)
        except ValueError:
            continue
        if not path.is_file():
            continue
        try:
            raw = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            logger.warning("aqiHelp: skip %s — %s", rel, exc)
            continue

        label = rel.replace("\\", "/")
        for heading, body in _split_into_chunks(label, raw):
            body = _normalize_ws(body)
            if len(body) < 40:
                continue
            chunk_meta.append({"source": label, "heading": heading})
            chunk_texts.append(f"[{label} § {heading}]\n{body}")

    if not chunk_texts:
        _STATE.build_error = "No guide chunks loaded (check docs/guides paths)."
        logger.warning("%s", _STATE.build_error)
        return

    vec = TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        max_features=12_000,
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.95,
    )
    mat = vec.fit_transform(chunk_texts)
    _STATE.chunk_meta = chunk_meta
    _STATE.chunk_texts = chunk_texts
    _STATE.vectorizer = vec
    _STATE.matrix = mat
    _STATE.built_at = time.time()
    _STATE.build_error = None
    logger.info("aqiHelp: loaded %s chunks from %s files", len(chunk_texts), len(_CORPUS_RELPATHS))


async def ensure_corpus_built() -> None:
    if _STATE.matrix is not None and _STATE.vectorizer is not None:
        return
    await asyncio.to_thread(_load_corpus_sync)


def _retrieve_context(query: str, top_k: int = _TOP_K_CHUNKS) -> tuple[str, list[dict[str, Any]]]:
    if _STATE.build_error or _STATE.vectorizer is None or _STATE.matrix is None:
        return "", []
    qvec = _STATE.vectorizer.transform([query])
    sims = cosine_similarity(qvec, _STATE.matrix).flatten()
    if sims.size == 0:
        return "", []
    k = min(top_k, int(sims.size))
    idx = np.argpartition(-sims, k - 1)[:k]
    idx_sorted = sorted(idx.tolist(), key=lambda i: float(sims[i]), reverse=True)

    cites: list[dict[str, Any]] = []
    parts: list[str] = []
    total = 0
    for i in idx_sorted:
        meta = _STATE.chunk_meta[int(i)]
        body = _STATE.chunk_texts[int(i)]
        cite = {
            "source": meta["source"],
            "heading": meta["heading"],
            "score": round(float(sims[int(i)]), 4),
        }
        cites.append(cite)
        if total + len(body) > _MAX_CONTEXT_CHARS:
            break
        parts.append(body)
        total += len(body)
    return "\n\n---\n\n".join(parts), cites


_SYSTEM_INSTRUCTIONS = """You are **aqiHelp**, the Nepal Climate Compass assistant.

Rules:
1) Answer ONLY using the CONTEXT excerpts below (from internal product guides). If the context lacks the answer, say you do not have that detail in the published guides and point users to the site `/guides` page, API `/docs` (Swagger), or their administrator.
2) Explain clearly for health workers and implementers—not clinical care. Do NOT diagnose, prescribe, or give personal medical advice.
3) Do not invent API paths, env var names, or credentials. Prefer naming exact routes from context when present.
4) Mention that alerts, thresholds, and policies may differ per deployment where relevant.
5) Keep replies concise but structured (short paragraphs or bullets). Optional: list which guide sections you leaned on (`source § heading`).
"""

_DEFAULT_USER_DISCLAIMER = (
    "aqiHelp can be mistaken; rely on official documentation and operational runbooks."
)
_SERVICE_UNAVAILABLE = "This service is currently unavailable."


class AqiHelpChatIn(BaseModel):
    message: str = Field(..., min_length=2, max_length=8000)


@router.get("/aqi/meta")
async def aqi_help_meta():
    """Corpus readiness (no retrieval cost)."""
    await ensure_corpus_built()
    return {
        "name": "aqiHelp",
        "corpus_roots": [_DOCS_GUIDES.as_posix()],
        "documents": list(_CORPUS_RELPATHS),
        "chunk_count": len(_STATE.chunk_texts),
        "built_at_unix": _STATE.built_at,
        "build_error": _STATE.build_error,
        "openrouter_configured": bool(external_integrations.openrouter_api_key()),
        "model_default": (
            os.getenv("AQI_HELP_MODEL") or os.getenv("OPENROUTER_MODEL") or "openai/gpt-4o-mini"
        ).strip(),
        "rate_limit_per_minute": _RATE_LIMIT,
        "note": _DEFAULT_USER_DISCLAIMER,
        "unavailable_message": _SERVICE_UNAVAILABLE,
    }


@router.post("/aqi/chat")
async def aqi_help_chat(body: AqiHelpChatIn, request: Request):
    if not external_integrations.openrouter_api_key():
        raise HTTPException(status_code=503, detail=_SERVICE_UNAVAILABLE)
    client_ip = (request.client.host if request.client else "?") or "?"
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if fwd:
        client_ip = fwd
    if not _rate_allow(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests; try again in a minute.")

    await ensure_corpus_built()
    if _STATE.build_error or _STATE.matrix is None:
        logger.warning("aqiHelp corpus unavailable: %s", _STATE.build_error or "unknown")
        raise HTTPException(status_code=503, detail=_SERVICE_UNAVAILABLE)

    context, cites = await asyncio.to_thread(_retrieve_context, body.message.strip())
    if not context.strip():
        logger.warning("aqiHelp retrieval returned empty context")
        raise HTTPException(status_code=503, detail=_SERVICE_UNAVAILABLE)

    model = (os.getenv("AQI_HELP_MODEL") or os.getenv("OPENROUTER_MODEL") or "").strip() or None
    user_block = f"USER QUESTION:\n{body.message.strip()}\n\nCONTEXT (excerpts from guides):\n{context}"

    try:
        raw = await external_integrations.openrouter_chat(
            user_message=user_block,
            system_message=_SYSTEM_INSTRUCTIONS,
            model=model,
            timeout_s=75.0,
        )
    except ValueError as exc:
        logger.warning("aqiHelp OpenRouter config error: %s", exc)
        raise HTTPException(status_code=503, detail=_SERVICE_UNAVAILABLE) from exc
    except httpx.HTTPStatusError as exc:
        snippet = ""
        try:
            snippet = (exc.response.text or "")[:800]
        except Exception:  # noqa: BLE001
            snippet = ""
        logger.warning("aqiHelp OpenRouter HTTP %s: %s", exc.response.status_code, snippet)
        # Auth / missing key / quota → same public message (details stay in server logs)
        raise HTTPException(status_code=503, detail=_SERVICE_UNAVAILABLE) from exc
    except httpx.RequestError as exc:
        logger.warning("aqiHelp OpenRouter request failed: %s", exc)
        raise HTTPException(status_code=503, detail=_SERVICE_UNAVAILABLE) from exc
    choices = raw.get("choices") or []
    if not isinstance(choices, list) or not choices:
        logger.warning("aqiHelp OpenRouter returned no choices")
        raise HTTPException(status_code=503, detail=_SERVICE_UNAVAILABLE)
    msg = choices[0].get("message") if isinstance(choices[0], dict) else {}
    content = (msg.get("content") or "").strip() if isinstance(msg, dict) else ""

    return {
        "reply": content,
        "model": raw.get("model") or model or (os.getenv("OPENROUTER_MODEL") or "").strip(),
        "citations": cites[:8],
        "disclaimer": _DEFAULT_USER_DISCLAIMER,
    }


def warm_corpus_sync() -> None:
    """Optional startup warm in worker thread context (called from lifespan)."""
    _load_corpus_sync()
