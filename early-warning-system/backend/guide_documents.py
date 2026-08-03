"""Resolve and render Markdown under docs/guides/ and docs-private/."""

from __future__ import annotations

import html
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent
_docs_dir = (_backend_dir / ".." / "docs").resolve()
GUIDES_MARKDOWN_ROOT = (_docs_dir / "guides").resolve()
PRIVATE_MARKDOWN_ROOT = (_docs_dir / ".." / "docs-private").resolve()


def safe_markdown_under(root: Path, rel: str) -> Path | None:
    raw = (rel or "").strip().replace("\\", "/").lstrip("/")
    if not raw or raw.startswith("..") or "/../" in f"/{raw}/":
        return None
    full = (root / raw).resolve()
    try:
        full.relative_to(root.resolve())
    except ValueError:
        return None
    if full.is_file() and full.suffix.lower() == ".md":
        return full
    return None


def markdown_to_html_fragment(source: str) -> str:
    try:
        import markdown as md_lib
    except ImportError:
        return '<pre class="md-pre">' + html.escape(source) + "</pre>"
    try:
        return md_lib.markdown(
            source,
            extensions=["fenced_code", "tables", "nl2br", "sane_lists"],
        )
    except Exception:
        return '<pre class="md-pre">' + html.escape(source) + "</pre>"


_SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title}</title>
<link rel="icon" type="image/png" href="/landing-assets/favicon.ico"/>
<style>
:root {{ font-family: system-ui, Segoe UI, sans-serif; color: #0f172a; background:#f8fafc; }}
body {{ margin:0; }}
.back {{ display:inline-block; margin:1rem 0 1rem clamp(16px,4vw,2rem); color:#0369a1; font-weight:600; text-decoration:none; }}
.back:hover {{ text-decoration:underline; }}
article.md-body {{ max-width: 52rem; margin: 0 auto 3rem; padding: 0 1.25rem 2rem; line-height:1.62; }}
article.md-body h1 {{ font-size: 1.75rem; margin-top:0; }}
article.md-body h2 {{ margin-top:1.5rem; font-size:1.2rem; border-bottom:1px solid #e2e8f0; padding-bottom:.25rem; }}
article.md-body h3 {{ font-size: 1.05rem; margin-top:1.1rem; }}
article.md-body code {{ background:#f1f5f9; padding:.1rem .35rem; border-radius:4px; font-size:.9em; }}
article.md-body pre {{ background:#0f172a; color:#e2e8f0; padding:1rem; border-radius:8px; overflow:auto; font-size:.85rem; }}
article.md-body pre code {{ background:transparent; color:inherit; padding:0; }}
article.md-body table {{ border-collapse: collapse; width:100%; font-size:.92rem; }}
article.md-body th, article.md-body td {{ border:1px solid #cbd5e1; padding:.4rem .5rem; vertical-align:top; }}
article.md-body th {{ background:#e2e8f0; text-align:left; }}
</style>
</head><body>
<nav aria-label="Up"><a class="back" href="/guides">&larr; Guides hub</a></nav>
<article class="md-body">
{inner}
</article>
</body></html>"""


def derive_title(markdown_raw: str, fallback: str) -> str:
    t = markdown_raw.lstrip("\ufeff \t")
    if t.startswith("#"):
        end = t.find("\n")
        line = t[1:end] if end >= 0 else t[1:]
        cand = line.strip()
        if cand:
            return cand
    return fallback


def render_markdown_page(full_path: Path) -> tuple[str, str]:
    """Return ``(title, html_fragment)`` for embedding in the public guides layout."""
    raw = full_path.read_text(encoding="utf-8")
    title = derive_title(raw, fallback=full_path.stem.replace("_", " "))
    inner = markdown_to_html_fragment(raw)
    return title, inner


def list_private_markdown_basenames() -> list[str]:
    if not PRIVATE_MARKDOWN_ROOT.is_dir():
        return []
    out = [
        p.relative_to(PRIVATE_MARKDOWN_ROOT).as_posix()
        for p in PRIVATE_MARKDOWN_ROOT.rglob("*.md")
        if p.is_file()
    ]
    return sorted(out)

