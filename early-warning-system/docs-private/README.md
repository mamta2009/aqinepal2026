# Private / internal docs

Files here are **not** exposed by the demo website. Only `docs/tech/` is served at `/documentation/media/tech/…`; the rest of `docs/` (including `blockchain-ai/` markdown and Python references) is not mounted for browsing.  
Keep partner-restricted or draft strategy material in this folder.

- `UNICEF_REQUIREMENTS_STRATEGY.md` — internal messaging checklist; cross-check runnable claims against **`../docs/IMPLEMENTATION_SNAPSHOT.md`**. Exported HTML mirrors this file (run script below).
- `UNICEF_reg_mamta.md` — internal registration / submission workbook. Addendum bullets point to **`IMPLEMENTATION_SNAPSHOT.md`**.

---

## Keeping strategy work honest

Before pasting wording into UNICEF portals, compare claims to **`../docs/IMPLEMENTATION_SNAPSHOT.md`** (resolver order, synthetic vs keyed upstreams, `provenance.deployment_role`). Regenerate exported HTML/PDF after substantive edits (`scripts/export-unicef-strategy.sh`).

- **PDF / HTML:** from repo root:

  `./early-warning-system/scripts/export-unicef-strategy.sh` → `UNICEF_REQUIREMENTS_STRATEGY.{html,pdf}`

  `./early-warning-system/scripts/export-unicef-strategy.sh UNICEF_reg_mamta.md` → `UNICEF_reg_mamta.{html,pdf}`

  Optional **second** argument is a **custom title** for the exported HTML/PDF metadata.

  The script prefers **`xelatex`** or **`LuaLaTeX`** for Unicode (✅, tree-drawing trees, etc.); **`pdflatex` alone fails** on those glyphs. BasicTeX includes `xelatex` under `/Library/TeX/texbin`.

Public technical diagrams remain under `docs/tech/`; concept SVGs linked from the documentation hub live under `landing/assets/diagrams/`.

