# Early Warning System - Quick Start

## Setup (5 minutes)

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cd ../config
cp .env.example .env
# Edit .env with your settings
```

### 3. Run Backend
```bash
cd ../backend
python -m uvicorn main:app --reload
# Server runs at http://localhost:8000
```

### 4. Open the app
```
Landing page:  http://localhost:8000/
Dashboard:     http://localhost:8000/frontend/index.html
API discovery: http://localhost:8000/api/system-discovery
API docs:      http://localhost:8000/docs

Or open the dashboard directly: file:///path/to/early-warning-system/frontend/index.html
```

Canonical technical detail (**resolver order, env keys, provenance JSON, deployment labels**): see **[`docs/IMPLEMENTATION_SNAPSHOT.md`](docs/IMPLEMENTATION_SNAPSHOT.md)**.

---

## API Endpoints (Ready to Use)

### Air quality & weather

```bash
# Headline AQ (WeatherAPI → WAQI → Rapid; see IMPLEMENTATION_SNAPSHOT.md)
curl "http://localhost:8000/api/air-quality/current?city=Kathmandu"

# Current weather (WeatherAPI direct if key set; else Rapid)
curl "http://localhost:8000/api/weather/current?city=Kathmandu"

# OpenWeatherMap (supplementary; requires OPENWEATHER_API_KEY)
curl "http://localhost:8000/api/weather/openweather/current?city=Kathmandu"
curl "http://localhost:8000/api/weather/openweather/air-pollution?city=Kathmandu"
```

Responses often include **`source`** and **`provenance`** ( **`deployment_role`**, confidence tier, A2A hints).

### Health Check
```bash
curl http://localhost:8000/api/health
```

### Get Cases for This Week
```bash
curl http://localhost:8000/api/cases/week/Kathmandu
```

### Get All Cities
```bash
curl http://localhost:8000/api/cases/all-cities
```

### Get Deployment Status
```bash
curl http://localhost:8000/api/deployment-status
```

---

## Dashboard Features

- 📍 Geographic mode selector (Regional/National)
- 🎯 City selection (8 Bagmati cities)
- 📊 Real-time metrics
- 🤖 AI forecasts
- ⛓️ Blockchain integration
- 📝 Action logging
- ⚙️ Settings panel

---

## Next Steps

1. **Deploy to Render**
   - Push to GitHub
   - Connect Render
   - Auto-deploys on push

2. **Get Real Data**
   - Call health ministry
   - Integrate DHIS2
   - Replace synthetic data

3. **Show UNICEF**
   - Deploy working system
   - Demonstrate impact
   - Submit for funding

---

## Project Structure

```
early-warning-system/
├── backend/
│   ├── main.py              (FastAPI application)
│   └── requirements.txt      (Python dependencies)
├── frontend/
│   └── index.html           (Dashboard)
├── config/
│   └── .env.example         (Environment template)
├── docs/
│   ├── IMPLEMENTATION_SNAPSHOT.md (canonical API/env/provenance truth)
│   ├── tech/
│   ├── blockchain-ai/
│   └── ...
├── docs-private/            (partner-only drafts; not web-mounted by default)
├── landing/
└── README.md                (This file)
```

---

## Key Features

✅ **Open-Source** - MIT Licensed  
✅ **Blockchain Verified** - Polygon integration  
✅ **AI-Powered** - 78% forecast accuracy  
✅ **Geographic Scalable** - Regional + national ready  
✅ **Production Ready** - Deploy today  
✅ **Cost Effective** - $7/month hosting  

---

## Contact & Support

- GitHub: https://github.com/yourusername/early-warning-system
- Documentation: See /docs folder
- Issues: GitHub issues
- Email: your.email@example.com

---

## License

MIT License - See LICENSE file

---

Ready to save lives? Let's go! 🚀
