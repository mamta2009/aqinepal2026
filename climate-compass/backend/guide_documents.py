"""Resolve and render Markdown under docs/guides/ and docs-private/."""

from __future__ import annotations

import html
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

_backend_dir = Path(__file__).resolve().parent
_docs_dir = (_backend_dir / ".." / "docs").resolve()
GUIDES_MARKDOWN_ROOT = (_docs_dir / "guides").resolve()
PRIVATE_MARKDOWN_ROOT = (_docs_dir / ".." / "docs-private").resolve()

_SAFE_TAGS = {
    "a", "blockquote", "br", "code", "del", "em", "h1", "h2", "h3", "h4",
    "h5", "h6", "hr", "li", "ol", "p", "pre", "strong", "table", "tbody",
    "td", "th", "thead", "tr", "ul",
}
_VOID_TAGS = {"br", "hr"}
_DROP_CONTENT_TAGS = {"iframe", "object", "script", "style", "svg"}


def _safe_href(value: str) -> bool:
    value = value.strip()
    if not value:
        return False
    parsed = urlsplit(value)
    return not parsed.scheme or parsed.scheme.lower() in {"http", "https", "mailto"}


class _GuideHTMLSanitizer(HTMLParser):
    """Small allowlist sanitizer for Markdown-generated guide fragments."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._drop_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS:
            self._drop_depth += 1
            return
        if self._drop_depth or tag not in _SAFE_TAGS:
            return
        rendered_attrs = ""
        if tag == "a":
            href = next((value for name, value in attrs if name.lower() == "href"), None)
            if href and _safe_href(href):
                rendered_attrs = f' href="{html.escape(href, quote=True)}"'
        self.parts.append(f"<{tag}{rendered_attrs}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS:
            if self._drop_depth:
                self._drop_depth -= 1
            return
        if not self._drop_depth and tag in _SAFE_TAGS and tag not in _VOID_TAGS:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if not self._drop_depth:
            self.parts.append(html.escape(data))


def sanitize_html_fragment(fragment: str) -> str:
    sanitizer = _GuideHTMLSanitizer()
    sanitizer.feed(fragment)
    sanitizer.close()
    return "".join(sanitizer.parts)


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
        return sanitize_html_fragment(
            md_lib.markdown(
                source,
                extensions=["fenced_code", "tables", "nl2br", "sane_lists"],
            )
        )
    except Exception:
        return '<pre class="md-pre">' + html.escape(source) + "</pre>"


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

