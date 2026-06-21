# NammaFlow Hackathon Presentation Deck Outline (25 Slides)

This document contains slide-by-slide content, visual recommendations, and speaker notes for a comprehensive 25-slide hackathon presentation.

---

### Slide 1: Title Slide
*   **Slide Title**: NammaFlow
*   **Subtitle**: Data-Driven Event Congestion Forecasting & Tactical Mitigation Optimizer
*   **Visuals**: High-tech dashboard screenshot or glowing network logo, Hackathon logo.
*   **Content**:
    *   Team Name & Presenters.
    *   *Tagline*: Bridging AI predictions and ground-level traffic response.
*   **Speaker Notes**: *"Hello judges, today we are presenting NammaFlow, an AI-powered control room platform built to predict event-driven congestion and optimize police deployment in Bengaluru."*

---

### Slide 2: The Operational Challenge
*   **Slide Title**: The Crisis: Event-Driven Congestion
*   **Visuals**: Photo of Bengaluru traffic jam, icons for festivals, sports, protests, and construction.
*   **Content**:
    *   Sudden traffic breakdowns caused by planned and unplanned events.
    *   Severe economic loss, fuel wastage, and emergency service delays.
    *   High pressure on local traffic police to restore flow quickly.
*   **Speaker Notes**: *"Political rallies, religious processions, cricket matches, and sudden waterlogging create massive traffic bottlenecks. Localized traffic breaks down rapidly, affecting citizens daily."*

---

### Slide 3: Why It's Hard Today
*   **Slide Title**: The Gaps in Traffic Operations
*   **Visuals**: "Problem" list with red warning icons.
*   **Content**:
    *   **No Advance Quantification**: Event impacts are not simulated or measured beforehand.
    *   **Experience-Driven Dispatch**: Resource deployment is based on intuition, not real data.
    *   **No Post-Event Learning**: No system to record what actually happened or improve future plans.
*   **Speaker Notes**: *"Why is this still an issue? Today, planning is experience-driven. Officers dispatch resources based on memory, and we don't log outcomes to make the system smarter over time."*

---

### Slide 4: Introducing NammaFlow
*   **Slide Title**: The Solution: NammaFlow
*   **Visuals**: Laptop mockup showing the dark-themed dashboard.
*   **Content**:
    *   An intelligent, closed-loop command center.
    *   Uses 8,000+ historical incident reports to forecast congestion.
    *   Outputs automated checklists for officers (headcount, barricades, detours).
*   **Speaker Notes**: *"We built NammaFlow—a smart control room software. It uses historical datasets to forecast congestion impact and instantly prescribes tactical deployment blueprints."*

---

### Slide 5: Key Platform Pillars
*   **Slide Title**: Three Core Pillars of NammaFlow
*   **Visuals**: 3-column feature layout or circular pillar diagram.
*   **Content**:
    *   **Predictive Analytics**: Machine learning models forecast severity and duration.
    *   **Prescriptive Deployments**: Tactical checklists for police, barricades, and diversions.
    *   **Continuous Feedback Loop**: Ground closure logs feed back into the system to train the AI.
*   **Speaker Notes**: *"NammaFlow rests on three pillars: forecasting the breakdown, recommending resources, and learning from ground feedback."*

---

### Slide 6: System Architecture
*   **Slide Title**: Behind the Scenes: Technology Stack
*   **Visuals**: Block diagram showing Frontend, Backend, ML, and Storage layers.
*   **Content**:
    *   **Frontend UI**: HTML5, Vanilla CSS3 (Glassmorphism), Leaflet.js (maps), Chart.js (graphs).
    *   **API Backend**: FastAPI (Python), Uvicorn.
    *   **ML Engine**: Scikit-Learn (Random Forest), Pandas, Numpy, Joblib.
    *   **Storage**: Persistent JSON append database (`feedback.json`).
*   **Speaker Notes**: *"We built this using FastAPI for high-performance backend routing, Scikit-Learn for ML pipelines, and a lightweight Vanilla CSS interface for a high-tech dashboard feel."*

---

### Slide 7: The Dataset at a Glance
*   **Slide Title**: Harnessing Bengaluru Traffic Data
*   **Visuals**: Sample table snippet from the CSV, count badges.
*   **Content**:
    *   **8,173** historical incident reports.
    *   Variables tracked: event cause, coordinates, requires closure, priority, police station, corridor, and resolution timestamps.
*   **Speaker Notes**: *"Our data is highly localized. We processed over 8,000 incident reports in Bengaluru containing coordinates, timestamps, and actual resolution durations."*

---

### Slide 8: Data Preprocessing & Cleansing
*   **Slide Title**: Preparing the Data for Machine Learning
*   **Visuals**: Flowchart showing: Raw CSV -> Clean Coords -> Imputed Nulls -> Clean Features.
*   **Content**:
    *   Geographical bounding box to filter coordinate noise outside Bengaluru.
    *   Imputation of null priorities (`Low`) and null corridors (`Non-corridor`).
    *   Handling outliers by capping incident duration (0 to 48 hours).
*   **Speaker Notes**: *"We cleaned coordinates, imputed missing categorical values, and capped resolution durations to remove massive outliers like potholes that stayed open for days."*

---

### Slide 9: Feature Engineering
*   **Slide Title**: Engineering Contextual Features
*   **Visuals**: Text blocks showing Time, Day, Month, Peak Hour formulas.
*   **Content**:
    *   **Temporal Extraction**: Hour of day, Day of week, Month.
    *   **Peak Commute Flag**: `is_peak_hour = 1` for morning (8-11 AM) and evening (5-8 PM) commute peaks.
*   **Speaker Notes**: *"Traffic is highly dependent on time. We extracted hours, weekdays, and created peak commute flags to give our models structural context."*

---

### Slide 10: Geographical Centroid Mapping
*   **Slide Title**: Data-Driven Police Jurisdiction Centroids
*   **Visuals**: Coordinates equation, mini-map showing centroids.
*   **Content**:
    *   Grouped historical coordinates by `police_station` jurisdiction.
    *   Calculated mean latitude and longitude for 55 station jurisdictions.
    *   Ensures automatic coordinate fallback when no coordinate pin is selected.
*   **Speaker Notes**: *"Since locations are assigned to police stations, we calculated the mean coordinates for all 55 stations. This maps jurisdictions automatically."*

---

### Slide 11: Congestion Score Formulation
*   **Slide Title**: Quantifying Traffic Impact (Heuristics)
*   **Visuals**: The mathematical formula written in large text with explanation box.
*   **Content**:
    *   $$\text{Score} = \text{Base(Cause)} \times \text{Priority} \times \text{Closure} \times \text{Corridor} \times \text{Peak}$$
    *   Brackets: Low ($<3$), Medium ($3-5$), High ($5-7$), Critical ($>7$).
*   **Speaker Notes**: *"To train our classifier, we formulated a Congestion Impact Score based on the event cause, road closures, peak-hour multipliers, and corridor details."*

---

### Slide 12: ML Model 1: Congestion Severity Classifier
*   **Slide Title**: RandomForest Classifier
*   **Visuals**: Feature importance bar chart or Random Forest tree icon.
*   **Content**:
    *   Predicts severity: Low, Medium, High, Critical.
    *   Features: event type, cause, closure, priority, corridor, station, time, peak flag.
    *   **Classification Accuracy: 99.0%** (validated on test split).
*   **Speaker Notes**: *"Our Random Forest Classifier achieves a high accuracy of 99% because our engineered congestion score maps cleanly to the input features."*

---

### Slide 13: ML Model 2: Duration Regressor
*   **Slide Title**: RandomForest Regressor (Resolution Forecast)
*   **Visuals**: Line chart comparing predicted vs actual duration, R2 stat.
*   **Content**:
    *   Predicts estimated clearance duration in minutes.
    *   Trains on subset containing actual `closed_datetime`.
    *   **R2 Score: 0.86 (86%)** on test dataset.
*   **Speaker Notes**: *"To forecast clearance times, we trained a Random Forest Regressor on closed events, achieving an R2 score of 86%."*

---

### Slide 14: Prescriptive Resource Rules
*   **Slide Title**: Prescribing Actions, Not Just Forecasts
*   **Visuals**: Table showing Severity levels vs Manpower/Barricades.
*   **Content**:
    *   **Low**: 2 officers, 0 barricades, no diversion.
    *   **Medium**: 4 officers, 5 barricades, lane advisory.
    *   **High**: 8 officers, 15 barricades, partial detour.
    *   **Critical**: 15 officers, 30 barricades, full segment closure.
*   **Speaker Notes**: *"We convert forecasts to prescriptions. High severity triggers 8 officers, 15 barricades, and partial detour setups."*

---

### Slide 15: Dynamic Rerouting & Nearest Junctions
*   **Slide Title**: Smart Rerouting Using Historical Patterns
*   **Visuals**: Network nodes diagram showing detour path.
*   **Content**:
    *   Queries dataset to find the top 3 junctions associated with the target police station/corridor.
    *   Recommends these junctions as diversion points.
    *   Generates coordinates offset from core site for visual map routing.
*   **Speaker Notes**: *"For diversions, the app queries historical records to recommend real, nearest control junctions in that police station's jurisdiction."*

---

### Slide 16: Live Demonstration Walkthrough
*   **Slide Title**: NammaFlow Live Demonstration
*   **Visuals**: Bold section divider slide, laptop icon.
*   **Content**:
    *   Simulating a real-world event in Bengaluru.
    *   Step-by-step UI walkthrough.
*   **Speaker Notes**: *"Let's transition to a live walkthrough of the platform to show how an operator interacts with NammaFlow in real time."*

---

### Slide 17: Demo Step 1: Historical Hotspots
*   **Slide Title**: Tab 1: Exploring Historical Analytics
*   **Visuals**: Screenshot of the dark-mode Leaflet Map with red/orange/blue markers.
*   **Content**:
    *   800 sampled incidents plotted dynamically.
    *   Interactive popups showing incident metadata.
    *   Visual representation of peak congestion corridors.
*   **Speaker Notes**: *"Our first tab displays historical analytics. Operators can zoom in, pan, and click on markers to inspect actual incidents in Bangalore."*

---

### Slide 18: Demo Step 2: Interactive Incident Simulator
*   **Slide Title**: Tab 2: Simulating an Upcoming Event
*   **Visuals**: Screenshot of the simulator form and the map click-to-pin helper.
*   **Content**:
    *   Form fields: Planned/Unplanned, Cause, Priority, Jurisdiction.
    *   **Click-to-Pin**: Clicking on the map automatically snaps coordinates into the form.
*   **Speaker Notes**: *"Under the Mitigation Planner, the operator clicks directly on the map to set coordinates, chooses parameters, and runs the impact analysis."*

---

### Slide 19: Demo Step 3: Predictive Traffic Forecast
*   **Slide Title**: Live Forecast: Severity and Duration
*   **Visuals**: Screenshot of the glowing purple "Predictive Impact Forecast" card.
*   **Content**:
    *   High-contrast, pulsing severity badge.
    *   Stopwatch metric showing estimated duration.
*   **Speaker Notes**: *"Instantly, the ML models output a High congestion rating and estimate a resolution time of 523 minutes."*

---

### Slide 20: Demo Step 4: Prescriptive Resource Blueprint
*   **Slide Title**: Live Prescription: Deploying Resources
*   **Visuals**: Screenshot of the blue "Prescriptive Mitigation Plan" card.
*   **Content**:
    *   Headcount badge showing 8 officers with roles (site, guides, patrol).
    *   Barricades counter showing 15 barricades.
*   **Speaker Notes**: *"Beside the forecast, NammaFlow prints a deployment blueprint: 8 traffic police officers with roles, and 15 warning barricades."*

---

### Slide 21: Demo Step 5: Visual Map Detours
*   **Slide Title**: Rerouting Visualization on Map
*   **Visuals**: Close-up screenshot of map showing red incident pin, amber detour pins, and dashed lines.
*   **Content**:
    *   Core site represented in Red.
    *   Nearest junctions (Bilekahalli, Jayadeva) plotted in Amber.
    *   Dashed connector lines showing the detour routing.
*   **Speaker Notes**: *"On the map, we see amber pins mapped at Bilekahalli Junction and Jayadeva Junction, with dashed detour routing lines connecting them."*

---

### Slide 22: Demo Step 6: Incident Closure
*   **Slide Title**: Tab 2: The Ground Feedback Loop
*   **Visuals**: Screenshot of the feedback form with the star rating element.
*   **Content**:
    *   Close-out form logging actual duration, actual manpower, actual barricades.
    *   Diversion effectiveness check (Yes/No).
    *   1 to 5 star rating given by ground officers.
*   **Speaker Notes**: *"When the event finishes, ground officers log the actual resources used and rate the diversion plan's effectiveness out of 5 stars."*

---

### Slide 23: Demo Step 7: System Self-Learning
*   **Slide Title**: Tab 3: Post-Event Learning Dashboard
*   **Visuals**: Screenshot of the line chart showing accuracy progression, KPI banner.
*   **Content**:
    *   KPIs: Total closed cycles, Confidence rating, Model accuracy, Manpower saved.
    *   "Model Performance Learning Curve" chart updating dynamically.
*   **Speaker Notes**: *"Upon submission, we redirect to the Learning tab. The system updates its confidence score, tracks headcount saved, and logs the entries."*

---

### Slide 24: Deployment and Scalability
*   **Slide Title**: Cloud Deployment & Scaling Strategy
*   **Visuals**: Icons for Docker, Render, Vercel, and India map.
*   **Content**:
    *   **Dockerized Container**: Easily deployed on any cloud platform.
    *   **Hybrid Hosting**: Render (FastAPI ML backend) + Vercel (static CDN frontend).
    *   **Scale**: Can be deployed to other metropolitan cities by swapping the CSV dataset.
*   **Speaker Notes**: *"For scalability, NammaFlow is dockerized and hosted in a hybrid setup. It can scale to other cities simply by feeding local incident datasets."*

---

### Slide 25: Summary & Conclusion
*   **Slide Title**: NammaFlow: Keeping Bengaluru Moving
*   **Visuals**: Platform logo, thank you details, Q&A prompt.
*   **Content**:
    *   Quantified event traffic impacts.
    *   Data-driven, optimized resource deployments.
    *   Closed-loop continuous learning system.
*   **Speaker Notes**: *"To conclude, NammaFlow replaces experience-driven dispatch with data-driven ML blueprints and continuous self-learning. Thank you, we are open for questions!"*
