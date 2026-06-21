# AstraFlow (Event-Driven Traffic Mitigation Platform)

AstraFlow is a data-driven predictive platform designed to forecast the traffic impact of planned and unplanned events in Bengaluru and optimize resource deployment (manpower, barricades, and diversions). By leveraging historical traffic incident reports, the platform replaces experience-driven resource planning with automated, predictive decision support, and introduces a **Post-Event Learning System** that continually improves recommendations.

---

## Key Features

1. **Historical Analytics Dashboard**:
   - Interactive Map visualizing 8,000+ historical traffic incident hotspots in Bengaluru.
   - Graphic charts analyzing temporal peaks, top police stations, corridors, and incident causes.

2. **Mitigation Planner & Simulator**:
   - Real-time simulation of traffic incidents (e.g., accidents, waterlogging, procession) with map coordinate snapping.
   - Machine learning forecasting of **Congestion Severity** (Low, Medium, High, Critical) and **Resolution Time** (minutes) via Random Forest models.
   - Optimized, automated resource plans: tactical traffic police headcount, barricade deployment configurations, and traffic diversion target junctions.
   - Visual routing showing detours and diversion points directly on the map.

3. **Post-Event Learning Loop**:
   - Close-out feedback interface where ground officers log actual duration, actual resources deployed, and effectiveness ratings.
   - Continuously computed system performance: severity accuracy %, average rating, and manpower headcount saved.
   - Learning progression curve showing model self-calibration and error reduction.

---

## Directory Structure

```
astra_flow/
  ├── Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv  <-- Place the raw CSV dataset here
  ├── app.py                     <-- FastAPI application & server logic
  ├── model_trainer.py           <-- ML training script (produces models)
  ├── run_app.py                 <-- Runner script (starts server & opens browser)
  ├── feedback.json              <-- Feedback loop database
  ├── models/                    <-- Models directory (contains serialized assets)
  │    ├── severity_classifier.joblib
  │    ├── duration_regressor.joblib
  │    ├── encoders.joblib
  │    ├── station_coords.json
  │    └── meta_info.json
  └── static/                    <-- Frontend Assets
       ├── index.html            <-- Dashboard Layout
       ├── css/
       │    └── styles.css       <-- Dark-mode Glassmorphism Stylesheet
       └── js/
            └── dashboard.js     <-- Map, Charts, and API Event Handler
```

---

## Setup and Installation

### 1. Install Dependencies
Ensure you have the required python packages installed:
```bash
pip install pandas scikit-learn fastapi uvicorn joblib
```

### 2. Dataset Location
Place the provided dataset (`Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv`) directly in the root directory.

### 3. Train the Models
To build the encoders and train the Random Forest Classifier and Regressor models on the dataset:
```bash
python3 model_trainer.py
```
This script will parse the dataset, generate the coordinates maps, train the ML models, and output all assets into the `models/` directory.

### 4. Start the Application
Run the helper launch script:
```bash
python3 run_app.py
```
AstraFlow will start on `http://127.0.0.1:8000` and automatically open in your default browser.

---

## Git Operations and Deployment

To push this repository to GitHub, run the following commands in the project directory:

```bash
git init
git add .
git commit -m "first commit - AstraFlow complete code, models, and static assets"
git branch -M main
git remote add origin https://github.com/daksh1706/astra_flow.git
git push -u origin main
```
