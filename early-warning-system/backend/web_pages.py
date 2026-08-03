"""Jinja2 page rendering for landing / dashboard HTML shells."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import Request
from fastapi.templating import Jinja2Templates

_BACKEND_ROOT = Path(__file__).resolve().parent
_TEMPLATES_DIR = (_BACKEND_ROOT.parent / "landing" / "templates").resolve()

templates = Jinja2Templates(directory=str(_TEMPLATES_DIR))


def render(request: Request, name: str, **context: Any):
    """Render a template under ``landing/templates/`` (e.g. ``pages/home.html``)."""
    ctx: dict[str, Any] = {"request": request, **context}
    return templates.TemplateResponse(name, ctx)


def templates_dir() -> Path:
    return _TEMPLATES_DIR


def landing_root() -> Path:
    return _BACKEND_ROOT.parent / "landing"
