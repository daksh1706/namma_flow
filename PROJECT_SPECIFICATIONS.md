# Project Technical Specifications & Video Demonstration Guide

This document outlines the technologies, methodology, and features of the **AstraFlow (Event-Driven Traffic Mitigation Platform)** prototype. Use this guide to structure your video demonstration, slides, and presentation.

---

## 1. Project Overview & Tagline
*   **Project Title**: AstraFlow
*   **Tagline**: Data-driven, closed-loop event traffic forecasting & tactical resource deployment optimizer.
*   **Target Impact**: Replaces experience-driven, manual traffic planning with predictive ML models and automated resource dispatch checklists, incorporating a first-of-its-kind post-event feedback loop.

---

## 2. Technology Stack

*   **Backend Application Server**:
    *   **FastAPI (Python)**: High-performance, async web framework serving analytical endpoints, prediction pipelines, and feedback logs.
    *   **Uvicorn**: Asynchronous Server Gateway Interface (ASGI) server for executing the FastAPI container.
*   **Machine Learning Engine**:
    *   **Scikit-Learn**: Powering the `RandomForestClassifier` (for severity) and `RandomForestRegressor` (for duration).
    *   **Pandas & Numpy**: For data cleansing, temporal feature engineering, and computing spatial police jurisdiction center points.
    *   **Joblib**: For serializing and loading trained models and encoders.
*   **Frontend UI Dashboard**:
    *   **Core**: HTML5 structure & ES6 JavaScript.
    *   **Vanilla CSS3**: Cyberpunk dark-themed glassmorphism interface, custom sliders, responsive grid system, and floating mesh background gradients. No heavy CSS dependencies.
    *   **Leaflet.js (via CDN)**: Open-source mapping library showing hotspots in Bangalore and plotting detour points.
    *   **Chart.js (via CDN)**: Responsive rendering of analytical and learning progression graphs.
*   **Database & File Storage**:
    *   **JSON Local Storage (`feedback.json`)**: Persistent file acting as the system's ledger for ground officer ratings and actual metrics.

---

## 3. Data-Science & Machine Learning Methodology

### A. Preprocessing & Feature Engineering
- **Coordinate Filtering**: Cleanses and scopes latitude/longitude values to the greater Bengaluru region.
- **Centroid Mapping**: Groups historical data by police station to compute the exact geographical center (`latitude.mean()`, `longitude.mean()`) for 55 station jurisdictions.
- **Temporal Feature Extraction**: Parses timestamps to extract `hour`, `day_of_week`, `month`, and flags peak commute hours (`is_peak_hour = 1` for 8–11 AM and 5–8 PM).

### B. Congestion Impact Score Formulation
To classify congestion severity, a data-driven heuristic formula calculates the composite impact of an incident:
$$\text{Congestion Score} = \text{BaseWeight(EventCause)} \times \text{PriorityMultiplier} \times \text{ClosureMultiplier} \times \text{CorridorMultiplier} \times \text{PeakMultiplier}$$

*   **Base Weights**: e.g., `Accident` = 4, `Protest` = 5, `VIP Movement` = 5, `Vehicle Breakdown` = 2.
*   **Multipliers**: Priority High = `x1.3`, Road Closure = `x1.5`, Major Corridor = `x1.2`, Peak Commute Hour = `x1.2`.
*   **Severity Buckets**:
    *   `Low`: Score $< 3$
    *   `Medium`: Score $3$ to $5$
    *   `High`: Score $5$ to $7$
    *   `Critical`: Score $> 7$

### C. Machine Learning Models
1.  **Congestion Severity Classifier (`RandomForestClassifier`)**:
    *   Predicts the categorical severity (`Low`, `Medium`, `High`, `Critical`) using inputs: `event_type`, `event_cause`, `requires_road_closure`, `priority`, `corridor`, `police_station`, `hour`, `day_of_week`, `is_peak_hour`.
    *   *Accuracy*: Achieved **99%** classification accuracy.
2.  **Event Duration Regressor (`RandomForestRegressor`)**:
    *   Predicts the estimated resolution time in minutes.
    *   *Preprocessing*: Filters outliers (capping duration between 0 and 48 hours) to prevent extreme skew.

---

## 4. Prescriptive Mitigation Heuristics

Once the model predicts severity, the backend dynamically calculates optimized resource deployment plans:
*   **Low Severity**: 2 officers, 0 barricades, no diversion.
*   **Medium Severity**: 4 officers (2 core control, 1 guide, 1 patrol), 5 warning barricades 50m upstream, lane merge advice.
*   **High Severity**: 8 officers (4 core control, 2 guides, 2 patrols), 15 heavy barricades 100-200m upstream, partial detour.
*   **Critical Severity**: 15 officers (7 core control, 5 guides, 3 patrols), 30 blockades, full segment closure.
*   **Dynamic Junction Querying**: Queries the dataset for the nearest historical junctions associated with that police station or corridor, automatically plotting detour locations on the map.

---

## 5. Scripted Video Demonstration Flow

Structure your screen-recording or demo video into these 5 clear steps:

### Step 1: Dashboard Overview (Tab 1)
*   **What to say**: *"This is AstraFlow, an AI-powered control room dashboard for traffic mitigation in Bengaluru. Our homepage aggregates 8,000+ historical incident reports. You can zoom in on this hotspot map and hover over markers to inspect real accidents, breakdowns, or road works."*
*   **What to show**: Pan around the Leaflet map, click a few markers to show popups, and scroll to show the Cause Breakdown and Hourly Commute Peak charts.

### Step 2: The Mitigation Simulator (Tab 2)
*   **What to say**: *"Let’s simulate an upcoming planned Construction road-closure in the Mico Layout jurisdiction at 6:00 PM. Instead of typing coordinates, I can click anywhere on the live simulator map, and our system automatically snaps the latitude and longitude parameters into the form."*
*   **What to show**: Click Tab 2. Click a point on the map (watch the Red Pin move and coordinates update). Select "Planned", "Construction", "Requires Closure", set priority to "Low", select "Mico Layout" station, set time to 6:00 PM, and click **Run Impact Analysis**.

### Step 3: Actionable Blueprints & Map Detours
*   **What to say**: *"The simulator instantly generates our predictive and prescriptive report. The ML models predict a High congestion severity lasting approximately 523 minutes. Beneath it, the system prescribes a tactical headcount of 8 officers with role assignments, 15 barricades, and details a detour routing. On the map, we see amber pins mapped at Bilekahalli Junction and Jayadeva Hospital Junction, with dashed detour routing lines connecting them."*
*   **What to show**: Scroll down to show the glowing "High" severity card. Highlight the manpower distribution. Hover over the amber diversion pins on the map to show their names.

### Step 4: Closing the Incident & Feedback Loop
*   **What to say**: *"The key challenge today is that traffic command centers do not learn from the past. AstraFlow introduces a post-event feedback loop. When the construction ends, ground officers log the actual values. Let's record that the actual duration was 510 minutes, we deployed 7 officers, and rated the system's diversion plan 5 stars."*
*   **What to show**: In the "Post-Event Closure" form, verify the values, click the 5th star for rating, and click **Submit Ground Closure**.

### Step 5: Demonstration of the Learning System (Tab 3)
*   **What to say**: *"On submission, the system automatically redirects us to the Post-Event Learning tab. We see the KPI banner update. Our system confidence score rises to 4.2 out of 5, severity accuracy matches, and our new feedback entry has been appended to the ground log at the bottom. The system continuously adapts and improves its predictive accuracy over time."*
*   **What to show**: Highlight the 4 KPI cards, point to the live line chart showing "Model Accuracy Progression", and scroll down to highlight the new row inside the recent ground feedback log.
