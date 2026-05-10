# Private / partner-restricted documentation

Markdown and exports under **`early-warning-system/docs-private/`** are **internal** UNICEF/strategy drafts. They intentionally **do not** appear as links on the public **Guides** page (`GET /guides`).

## How teammates read them safely

On a trusted machine, unlocked operators use **`/admin/dashboard`**:

1. Enter the PIN and save **`NOTIFICATION_API_KEY`** as usual  
2. **Private documentation** → **Refresh file list** → pick a `*.md` path → **Open**  
   (JSON endpoints: **`GET /api/admin/private-documentation/md-files`**, **`GET /api/admin/private-documentation/md?path=…`**)  

HTML marketing pages (`/`, `/registration`), the **Guides** hub (`/guides`), **`/guides/md/…`**, **`/frontend/index.html`**, and **`/admin/dashboard`** are the main browser surfaces described in **`../docs/guides/IMPLEMENTATION_SNAPSHOT.md`** when it references routes.

Technical **diagrams** (non-confidential SVG) stay in **`docs/tech/`** and are exposed at **`/guides/media/tech/…`** (legacy **`/documentation/media/tech/…`** redirects).

## Staying truthful

Before exporting claims to UNICEF portals, reconcile wording with **`../docs/guides/IMPLEMENTATION_SNAPSHOT.md`** (resolver order, synthetic data, **`provenance.deployment_role`**). Export scripts:

```bash
./early-warning-system/scripts/export-unicef-strategy.sh
```

These files remain in **git**: if your GitHub repo is public, recognise that clones still contain **`docs-private/`** — confidentiality is organisational, not URL-hiding alone.
