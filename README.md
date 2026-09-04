# 🌧️ LARS — Landslide Alert & Response System

<p align="center">
  <strong>AI-assisted landslide risk monitoring & early warning for Northeast India</strong><br/>
  <a href="https://ner-landslide-alert.onrender.com">Live Prototype</a> · 
  <a href="https://github.com/jayyy-zip/NER-Landslide-Alert">Repository</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Smart%20India%20Hackathon-2026-0b5cab?style=for-the-badge" alt="Smart India Hackathon 2026"/>
  <img src="https://img.shields.io/badge/Problem%20Statement-SIH26001-0b7a53?style=for-the-badge" alt="SIH26001"/>
  <img src="https://img.shields.io/badge/Theme-Disaster%20Management-e05252?style=for-the-badge" alt="Disaster Management"/>
  <img src="https://img.shields.io/badge/Status-Prototype-f0b429?style=for-the-badge" alt="Prototype"/>
</p>

---

## 🚨 What Is NER?

**NER** is a location-aware disaster-risk platform designed to help citizens and authorities understand landslide risk along vulnerable highway corridors in Northeast India.

For the prototype, the system is scoped to a **25 km NH-27 pilot corridor around Jatinga–Haflong, Dima Hasao, Assam**.

The core idea is simple:

> **Sense → Assess → Locate → Alert → Report → Respond**

LARS combines historical landslide information, rainfall, terrain characteristics, GIS road segmentation and citizen reports into a single operational workflow.

---

## 🎯 Problem

Landslides in Northeast India can disrupt road connectivity, isolate communities and delay emergency response. Risk information is often distributed across different sources, while citizens and authorities need a simple answer:

**“How risky is this road/location right now, and what should we do?”**

LARS is built around that decision rather than around a standalone prediction model.

---

## 💡 How it works

```text
Historical Events   Rainfall   Terrain   Road/GPS   Citizen Reports
        \               |         |          |             /
         \______________|_________|__________|____________/
                              ↓
                       Feature Processing
                              ↓
                         Risk Engine
                              ↓
                    0–100 Safety / Risk Score
                              ↓
                 ┌────────────┴────────────┐
                 ↓                         ↓
            Citizen View              Officer View
                 ↓                         ↓
         Check My Safety            Risk Monitoring
         Safety Guidance             Reports Queue
         Report Hazard               Alerts / Response
                 └────────────┬────────────┘
                              ↓
                     Supabase Data Layer
                              ↓
                  Offline Queue / Sync Loop
```

### Risk levels

| Level | Meaning |
|---|---|
| 🟢 Low | Normal monitoring |
| 🟡 Moderate | Exercise caution |
| 🟠 High | Avoid exposure where possible |
| 🔴 Severe | Immediate attention required |

---

## 🧭 Citizen workflow

1. Open NER
2. **Check My Safety**
3. Share GPS location or select a point on the map
4. View the nearby risk score and contributing factors
5. Read safety guidance
6. Upload a geotagged hazard report with photo + description
7. Report is sent to the response system

## 🛡️ Officer workflow

1. Open the Officer Dashboard
2. Monitor risk segments on the GIS map
3. Inspect high/severe-risk road sections
4. Review citizen submissions
5. Verify or reject reports
6. Use alerts and risk context to prioritize response

---

## 🗺️ Prototype scope

**Pilot corridor:** NH-27 — Jatinga–Haflong / Dima Hasao

**Length:** 25 km

**Segmentation:** approximately 1 km road segments

Each segment is designed to carry contextual information such as:

- Risk score / risk tier
- Rainfall
- Slope
- Historical event density
- Nearby historical events
- Last synchronization time

The architecture is intentionally corridor-based so the prototype can scale later to additional districts and highways without redesigning the product.

---

## 🧠 AI / Risk Model

The frontend is designed to consume a future validated **Python + scikit-learn Random Forest** model.

Planned features include:

- 24-hour rainfall
- 72-hour rainfall
- Slope
- Elevation
- Historical landslide density
- Distance to historical events
- Land-cover / terrain proxies
- Road-related terrain features

The current frontend can operate with deterministic prototype risk data while the ML pipeline is trained and validated separately.

> **Important:** prototype/demo risk values must be clearly distinguished from validated operational predictions.

---

## 🛰️ Data strategy

The project is designed around modular data sources so live feeds can be swapped in without rewriting the dashboard.

**Historical landslides**
- Cleaned NER event records
- GSI / ISRO inventory resources for future expansion

**Weather**
- OpenWeatherMap for prototype integration
- IMD as the production target

**Terrain**
- DEM-derived elevation and slope

**GIS**
- NH-27 geometry
- Risk segmentation
- Historical event markers
- Citizen reports

---

## 📡 Low-network / Offline-first design

Northeast hill corridors can have intermittent connectivity, so LARS is designed around graceful degradation rather than pretending that fresh live data is available offline.

### Available offline

- Cached pilot risk segments
- Cached road geometry
- Last synchronized rainfall
- Safety guidance
- Pending citizen reports

### Offline reporting

```text
User creates report
      ↓
Saved locally
      ↓
“Report saved offline”
      ↓
Network returns
      ↓
Automatic synchronization
      ↓
Supabase
```

When offline, the UI should always show that environmental data may be outdated.

---

## 🧱 Technology stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Maps | Leaflet + React-Leaflet |
| Geospatial | Turf.js |
| Database / Storage | Supabase / PostgreSQL |
| Auth / Realtime | Supabase |
| ML | Python + scikit-learn |
| Weather | OpenWeatherMap (prototype) |
| Location | Browser Geolocation API |
| Offline | IndexedDB / PWA approach |
| Deployment | Vercel |
| Version Control | GitHub |

The repository currently uses React, React Router, Leaflet, React-Leaflet, Supabase, Lucide and Sonner among its frontend dependencies. citehttps://github.com/jayyy-zip/NER-Landslide-Alert/blob/main/package.json

---

## 🧑‍💻 Repository structure

```text
NER-Landslide-Alert/
├── ai-service/          # AI/model service assets
├── rules/               # project/design rules
├── src/                 # React application
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

The current application uses React Router with dedicated routes for role selection, officer dashboard, citizen dashboard and citizen reporting. citehttps://github.com/jayyy-zip/NER-Landslide-Alert/blob/main/src/App.jsx

---

## ✨ Core prototype features

- 📍 Location-aware safety checking
- 🗺️ GIS risk visualization
- 🚧 Segment-level highway monitoring
- 🌧️ Rainfall-aware risk context
- 📷 Geotagged citizen hazard reporting
- 👮 Officer monitoring dashboard
- 🔔 Risk alerts and response workflow
- 🌐 Multilingual-ready safety guidance
- 📡 Offline-first / low-network support
- 🔄 Supabase-backed synchronization

---

## 🚀 Run locally

### Requirements

- Node.js 18+
- npm
- A Supabase project for connected features

### Install

```bash
npm install
```

### Environment

Create a local environment file with the variables required by the current Supabase/weather integration.

Example:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_OWM_API_KEY=your_openweathermap_api_key
```

Never put a Supabase secret/service-role key in frontend code.

### Development

```bash
npm run dev
```

### Production build

```bash
npm run build
```

---

## 🔐 Data & safety principles

LARS is a prototype for disaster-risk decision support, not a guarantee of physical safety.

The project follows these principles:

- Do not present simulated sensor data as real.
- Do not claim model accuracy without measured validation.
- Clearly display last-sync state when data may be stale.
- Citizen reports should be verified before being treated as authoritative ground truth.
- Production deployment should add authentication, moderation and auditability.

---

## 🌱 Roadmap

### Phase 1 — Prototype

- 25 km NH-27 corridor
- GIS risk map
- Citizen reporting
- Officer dashboard
- Offline cache
- Prototype risk engine

### Phase 2 — Model validation

- NER-specific training dataset
- Positive + background/negative samples
- Random Forest training
- Precision / Recall / F1 / ROC-AUC
- Historical-event backtesting

### Phase 3 — Operational integration

- IMD rainfall feeds
- GSI / NESAC data integration
- Authenticated officer roles
- Report moderation
- Better geospatial querying with PostGIS

### Phase 4 — Scale

- More highway corridors
- District/state expansion
- Additional NER languages
- Sensor integration
- Satellite-based deformation monitoring
- Wider NER deployment

---

## 🏆 Why this approach

The innovation is not a claim that LARS replaces existing scientific or government systems.

The goal is to **fuse risk information into a usable road-level workflow** that connects:

**Prediction → Location → Road impact → Alert → Citizen ground truth → Response**

That makes the system more actionable for the people who actually need to make decisions on the ground.

---

## 📸 Prototype

> Add your latest dashboard, citizen app and mobile screenshots here as the UI stabilizes.

Suggested showcase order:

1. Public / Citizen Home
2. Check My Safety
3. NH-27 Risk Map
4. Citizen Hazard Report
5. Officer Dashboard
6. Offline Mode

---

## 📜 Smart India Hackathon

**Problem Statement:** SIH26001  
**Theme:** Disaster Management  
**Category:** Software  
**Solution:** LARS — Landslide Alert & Response System  
**Pilot:** NH-27, Jatinga–Haflong, Dima Hasao

---

<p align="center">
  <strong>Built for safer roads, faster awareness, and more resilient communities in Northeast India.</strong>
</p>
