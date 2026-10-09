"""Single-segment SMS limits (Sparrow / GSM 03.38).

From Sparrow SMS length spec (Janaki Technology):
- Standard GSM 03.38: 160 characters per SMS
- Any non-GSM character forces Unicode: 70 characters per SMS
- Multi-part is 153 (GSM) or 67 (Unicode) per part — we never send those.

https://sparrowsms.com/sms-length-calculator
"""

from __future__ import annotations

import unicodedata
from typing import Literal

# 3GPP TS 23.038 default alphabet (basic GSM 03.38).
_GSM_BASIC = set(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ"
    " !\"#¤%&'()*+,-./0123456789:;<=>?"
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿"
    "abcdefghijklmnopqrstuvwxyzäöñüà"
)

# GSM extension table: each character costs 2 septets (escape + char).
_GSM_EXTENDED = set("^{}\\[~]|€")

GSM_SINGLE_SEPTETS = 160
UNICODE_SINGLE_CHARS = 70

_LOOKALIKES = str.maketrans(
    {
        "\u2018": "'",
        "\u2019": "'",
        "\u201a": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
        "\u2212": "-",
        "\u00a0": " ",
        "\u202f": " ",
        "\u2009": " ",
        "\u2022": "-",
        "\u00b7": ".",
        "\u00d7": "x",
        "\u2026": ".",
        "\u00b0": " ",  # degree → space; callers should write "C" not "°C"
        "\u221e": " ",
        "\u2011": "-",
        "\u00ad": "",
        "\ufeff": "",
        "\u200b": "",
        "\u200c": "",
        "\u200d": "",
        "\u2028": "\n",
        "\u2029": "\n",
        "•": "-",
        "–": "-",
        "—": "-",
        "×": "x",
        "·": ".",
        "°": " ",
    }
)


SmsEncoding = Literal["gsm", "unicode"]


def normalize_sms_text(text: str) -> str:
    """Normalize newlines and punctuation so more messages stay in GSM 03.38."""
    s = (text or "").replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    s = s.translate(_LOOKALIKES)
    s = "\n".join(line.rstrip() for line in s.split("\n")).strip()
    return s


def gsm_septet_length(text: str) -> int | None:
    """Septet count if ``text`` is GSM 03.38; otherwise ``None`` (Unicode)."""
    n = 0
    for ch in text:
        if ch in _GSM_EXTENDED:
            n += 2
        elif ch in _GSM_BASIC:
            n += 1
        else:
            return None
    return n


def sms_encoding(text: str) -> SmsEncoding:
    return "gsm" if gsm_septet_length(text) is not None else "unicode"


def _has_non_gsm_letter(text: str) -> bool:
    for ch in text:
        if ch in _GSM_BASIC or ch in _GSM_EXTENDED:
            continue
        if ch.isalpha():
            return True
    return False


def _strip_non_gsm_symbols(text: str) -> str:
    """Drop emoji/symbols that would force Unicode, keep GSM letters and spaces."""
    out: list[str] = []
    prev_space = False
    for ch in text:
        if ch in _GSM_BASIC or ch in _GSM_EXTENDED:
            space = ch in " \n"
            if space and prev_space and ch == " ":
                continue
            out.append(ch)
            prev_space = space
            continue
        cat = unicodedata.category(ch)
        if cat.startswith("L") or cat.startswith("N"):
            out.append(ch)
            prev_space = False
        elif ch in "\n":
            out.append("\n")
            prev_space = True
        else:
            if not prev_space and out:
                out.append(" ")
                prev_space = True
    return "".join(out).strip()


def prefer_gsm(text: str) -> str:
    """Replace lookalikes and strip emoji when the remaining text is GSM."""
    s = normalize_sms_text(text)
    if gsm_septet_length(s) is not None:
        return s
    if _has_non_gsm_letter(s):
        return s
    stripped = _strip_non_gsm_symbols(s)
    stripped = " ".join(stripped.split())
    if gsm_septet_length(stripped) is not None:
        return stripped
    return s


def fits_single_sms(text: str) -> bool:
    s = prefer_gsm(text)
    septets = gsm_septet_length(s)
    if septets is not None:
        return septets <= GSM_SINGLE_SEPTETS
    return len(s) <= UNICODE_SINGLE_CHARS


def _truncate_gsm(text: str, max_septets: int = GSM_SINGLE_SEPTETS) -> str:
    used = gsm_septet_length(text)
    if used is not None and used <= max_septets:
        return text
    ellipsis = "..."
    budget = max_septets - gsm_septet_length(ellipsis)
    out: list[str] = []
    n = 0
    for ch in text:
        cost = 2 if ch in _GSM_EXTENDED else 1
        if ch not in _GSM_BASIC and ch not in _GSM_EXTENDED:
            break
        if n + cost > budget:
            break
        out.append(ch)
        n += cost
    return "".join(out).rstrip() + ellipsis


def _truncate_unicode(text: str, max_chars: int = UNICODE_SINGLE_CHARS) -> str:
    if len(text) <= max_chars:
        return text
    ellipsis = "..."
    keep = max_chars - len(ellipsis)
    return text[:keep].rstrip() + ellipsis


def fit_to_single_sms(text: str) -> str:
    """Return a body that fits in one SMS (160 GSM septets or 70 Unicode chars)."""
    s = prefer_gsm(text)
    if not s:
        return s
    septets = gsm_septet_length(s)
    if septets is not None:
        return _truncate_gsm(s, GSM_SINGLE_SEPTETS)
    return _truncate_unicode(s, UNICODE_SINGLE_CHARS)


def sms_meta(text: str) -> dict[str, str | int | bool]:
    fitted = fit_to_single_sms(text)
    enc = sms_encoding(fitted)
    septets = gsm_septet_length(fitted)
    return {
        "encoding": enc,
        "length": septets if enc == "gsm" else len(fitted),
        "limit": GSM_SINGLE_SEPTETS if enc == "gsm" else UNICODE_SINGLE_CHARS,
        "single_sms": True,
        "truncated": fitted != prefer_gsm(text),
        "text": fitted,
    }


def compact_alert_sms(
    hazard: str,
    city: str,
    level: str,
    headline: str | None = None,
) -> str:
    """GSM-safe alert that fits in one SMS. Email/WhatsApp keep the long copy."""
    city_s = (city or "your area").strip() or "your area"
    level_s = (level or "ALERT").strip() or "ALERT"
    head = prefer_gsm((headline or "").strip())
    if head in (level_s, city_s):
        head = ""
    haz = (hazard or "air").strip().lower()
    if haz == "heat":
        if head:
            head = head.split("effective")[0].strip(" -.")
        extra = f" {head}" if head else ""
        raw = (
            f"CC HEAT ALERT: {city_s} {level_s}{extra}. "
            "Shade, hydrate, avoid midday exertion. Seek care if fainting or confusion."
        )
    elif haz == "respiratory_surge":
        extra = f" {head}" if head else ""
        raw = (
            f"CC SURGE ALERT: {city_s}{extra}. "
            "Review surge capacity and staffing."
        )
    else:
        extra = ""
        if head:
            extra = f" AQI {head}" if not head.upper().startswith("AQI") else f" {head}"
        raw = (
            f"CC AIR ALERT: {city_s} {level_s}{extra}. "
            "Check O2 stock, alert respiratory staff, prepare for surge."
        )
    return fit_to_single_sms(raw)


def sms_body_for_broadcast(
    full_message: str,
    *,
    hazard: str,
    city: str,
    level: str,
    headline: str | None,
) -> str:
    """Use the operator text only when it already fits in one SMS as written.

    Long email-style bodies with emoji are replaced by ``compact_alert_sms``.
    """
    s = normalize_sms_text(full_message)
    septets = gsm_septet_length(s)
    if septets is not None and septets <= GSM_SINGLE_SEPTETS:
        return s
    if septets is None and len(s) <= UNICODE_SINGLE_CHARS:
        return s
    return compact_alert_sms(hazard, city, level, headline)
