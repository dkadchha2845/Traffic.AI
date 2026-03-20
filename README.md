# Traffic.AI — Smart City Traffic Command Center

![Status](https://img.shields.io/badge/Status-Production--Ready-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Tech](https://img.shields.io/badge/Tech-FastAPI%20%7C%20React%20%7C%20Supabase-orange?style=for-the-badge)

**Traffic.AI** is a state-of-the-art, production-hardened Smart City Traffic Management System designed for the Bangalore metropolitan area. It leverages multi-agent AI architectures, real-time computer vision, and predictive analytics to optimize urban mobility and ensure zero-delay emergency corridors.

---

## 🚀 Key Features

### 📡 Real-time Command Center
- **Live Telemetry**: Real-time WebSocket-driven monitoring of vehicle counts, congestion density, and signal phases.
- **Traffic Decision Panel**: Granular control and analysis of 9+ major Bangalore junctions (Silk Board, Marathahalli, Hebbal, etc.).
- **Incident Management**: Automated detection of traffic anomalies and real-time response logs.

### 🚑 Emergency Green-Wave Corridor
- **Priority Routing**: Instant activation of synchronized green lights for ambulances and emergency vehicles.
- **Path Optimization**: Real-time route calculation from origin to destination across the city grid.

### 🧠 AI & Analytics
- **Predictive Forecasting**: 30-minute traffic density projections using Deep Learning (AutoARIMA/Transformer models).
- **Vision Tracking**: Real-time vehicle detection and queue sensing powered by YOLOv8.
- **Efficiency Metrics**: Comparative analysis of AI-driven signal control vs. traditional fixed-timer systems.

### 💬 CityOS Assistant
- **AI Chatbot**: Intelligent RAG-powered assistant for querying historical traffic data and system status.
- **Audit Logs**: Comprehensive tracking of all AI decisions and system events stored in Supabase.

---

## 🛠 Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Framer Motion, Tailwind CSS, Lucide |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, WebSockets, Pydantic |
| **Database** | Supabase (PostgreSQL), Real-time Subscriptions, RAG Vector Store |
| **AI/ML** | YOLOv8 (Vision), OpenAI GPT-4 (Chat), AutoARIMA (Forecasting) |
| **APIs** | TomTom Traffic API, OpenWeatherMap API |

---

## 📦 Installation & Setup

### 1. Prerequisites
- Node.js 18+
- Python 3.10+
- Supabase account (or local instance)

### 2. Frontend Setup
```bash
git clone https://github.com/your-repo/Traffic.AI.git
cd Traffic.AI
npm install
```

### 3. Backend Setup
```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate
pip install -r requirements.txt
```

### 4. Environment Variables
Create a `.env` file in the root and another in the `/backend` directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=your_openai_key
TOMTOM_API_KEY=your_tomtom_key
OPENWEATHERMAP_API_KEY=your_weather_key
```

---

## 🚦 How to Run

### Start the Backend
```bash
cd backend
python main.py
```

### Start the Frontend
```bash
cd ..
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) to access the Command Center.

---

## 📁 Project Structure

```text
├── src/                # React Frontend
│   ├── pages/          # Dashboard, Analytics, CameraFeed, etc.
│   ├── hooks/          # useLiveTelemetry, useTrafficDB
│   └── components/     # UI Design System
├── backend/            # FastAPI Microservices
│   ├── main.py         # Entry point & WebSockets
│   ├── simulation_api.py # Traffic Engine
│   └── reports_api.py  # PDF Generation
├── supabase/           # Database Migrations & Edge Functions
└── README.md           # Project Documentation
```

---

## 🛡 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Developed with ❤️ for **Smart City Bangalore**.
