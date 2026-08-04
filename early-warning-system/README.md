# Climate Compass (Nepal AQI demo)

**Repository:** [github.com/mamta2009/aqinepal2026](https://github.com/mamta2009/aqinepal2026)

- **Hands-on overview & URLs:** **[`docs/guides/APPLICATION_OVERVIEW.md`](docs/guides/APPLICATION_OVERVIEW.md)**
- **Canonical technical spec:** **[`docs/guides/IMPLEMENTATION_SNAPSHOT.md`](docs/guides/IMPLEMENTATION_SNAPSHOT.md)**
- **All public markdown index:** **[`docs/guides/README.md`](docs/guides/README.md)**
- **Guides hub in the browser (when API is running):** `/guides` and `/guides/md/…`

Quick run:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
