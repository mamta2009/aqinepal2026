# Private / internal docs

HTML text in this repository is served only where FastAPI mounts it: the **marketing** pages, **`/registration`**, **`/documentation`** (diagrams + linked media), **`/frontend/index.html`**, and **`/admin/dashboard`**. Only `docs/tech/` is exposed under **`/documentation/media/tech/…`**; Markdown under `docs/blockchain-ai/` and this **`docs-private/`** tree is **not** browsable via those URLs—but **files still exist in the git checkout**, so anyone with repo access can read them. For partner-sensitive PDFs/strategy drafts, confirm whether the **`aqinepal2026`** visibility model is acceptable or keep copies outside the public repo.

Keep partner-restricted or draft strategy material here *by convention* and reconcile wording with runnable behaviour before external use.

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

