#!/usr/bin/env bash
# Export a markdown file from docs-private/ to HTML + PDF (pandoc + XeLaTeX / LuaLaTeX preferred).
#
# Usage:
#   ./scripts/export-unicef-strategy.sh
#       → UNICEF_REQUIREMENTS_STRATEGY.md → .html + .pdf
#   ./scripts/export-unicef-strategy.sh UNICEF_reg_mamta.md
#       → UNICEF_reg_mamta.md → .html + .pdf
#   ./scripts/export-unicef-strategy.sh UNICEF_reg_mamta.md "UNICEF registration workbook (internal)"
#       → optional custom HTML/PDF title
#
# Plain pdflatex often fails on emoji / Unicode box-drawing; use xelatex (BasicTeX includes it).

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INPUT="${1:-UNICEF_REQUIREMENTS_STRATEGY.md}"
CUSTOM_TITLE="${2:-}"

# Only allow basenames ending in .md (no paths)
if [[ "${INPUT}" != *.md ]] || [[ "${INPUT}" == */* ]]; then
  echo "Usage: $0 [<file.md>] [<document title>]  (file must live in docs-private/, basename only)" >&2
  echo "Examples: $0" >&2
  echo "          $0 UNICEF_reg_mamta.md" >&2
  exit 1
fi

DOC="${ROOT}/docs-private/${INPUT}"
cd "${ROOT}/docs-private"

if [[ ! -f "${INPUT}" ]]; then
  echo "Missing ${DOC}" >&2
  exit 1
fi

STEM="${INPUT%.md}"
case "${STEM}" in
  UNICEF_REQUIREMENTS_STRATEGY)
    TITLE_DEFAULT="UNICEF Venture Fund Strategy (internal)" ;;
  UNICEF_reg_mamta)
    TITLE_DEFAULT="UNICEF registration workbook — Mamta (internal)" ;;
  *)
    TITLE_DEFAULT="${STEM//_/ } (internal)" ;;
esac
TITLE="${CUSTOM_TITLE:-$TITLE_DEFAULT}"

echo "Building ${INPUT} → ${STEM}.html + ${STEM}.pdf (title: ${TITLE})"

echo "Refreshing HTML (pandoc)…"
pandoc "${INPUT}" -s --toc \
  --metadata title="${TITLE}" \
  -o "${STEM}.html"

pdf_engine=""
if command -v xelatex >/dev/null 2>&1; then
  pdf_engine=xelatex
elif command -v lualatex >/dev/null 2>&1; then
  pdf_engine=lualatex
elif command -v pdflatex >/dev/null 2>&1; then
  echo "Warning: only pdflatex found; PDF may fail on emoji / Unicode (use xelatex or lualatex)." >&2
  pdf_engine=pdflatex
else
  echo "Note: no LaTeX engine on PATH — PDF not generated." >&2
  echo "  Install BasicTeX, then put /Library/TeX/texbin on PATH (or restart Terminal)." >&2
  echo "  Or open ${STEM}.html in a browser → Print → Save as PDF." >&2
  exit 0
fi

echo "Building PDF (${pdf_engine})…"
if [[ "${pdf_engine}" == "xelatex" ]]; then
  pandoc "${INPUT}" -o "${STEM}.pdf" \
    --pdf-engine=xelatex \
    -V geometry:margin=1in \
    -V linkcolor=blue \
    -V urlcolor=blue \
    -V mainfont="Helvetica" \
    -V monofont="Menlo"
elif [[ "${pdf_engine}" == "lualatex" ]]; then
  pandoc "${INPUT}" -o "${STEM}.pdf" \
    --pdf-engine=lualatex \
    -V geometry:margin=1in \
    -V linkcolor=blue \
    -V urlcolor=blue
else
  pandoc "${INPUT}" -o "${STEM}.pdf" --pdf-engine=pdflatex
fi

echo "Done: docs-private/${STEM}.html and docs-private/${STEM}.pdf"
