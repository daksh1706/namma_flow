# NammaFlow: Dashboard User Guide & Demo Walkthrough

This guide explains how to use and demonstrate the **NammaFlow Dashboard** interface, detailing the fields, tabs, and interactive maps.

---

## Navigation Overview
The application consists of a **Sidebar Navigation Menu** on the left with three primary tabs:
1. **Historical Analytics** (Default page)
2. **Mitigation Planner** (The core simulator engine)
3. **Post-Event Learning** (The continuous feedback dashboard)

---

## Tab 1: Historical Analytics (Dashboard)

This tab displays historical incident distributions, hotspots, and temporal trends in Bengaluru.

*   **Hotspot Map**: Center of the dashboard. Shows 800 sampled historical traffic breakdown coordinates.
    *   *How to interact*: 
        *   Zoom in/out and drag to pan across Bengaluru.
        *   **Hover/Click on any circle marker** to see a popup details card showing the incident cause, priority, and whether it required a road closure.
        *   *Color Coding*: **Red** (High Priority + Road Closure), **Orange** (High Priority + No Closure), **Blue** (Low Priority).
*   **KPI Banner**: Displays total aggregated numbers, priority ratios, and road closure counts.
*   **Analytical Graphs**:
    *   *Event Cause Breakdown*: Bar chart showing the most common congestion drivers (Breakdowns, Potholes, construction).
    *   *Hourly Incident Distribution*: Commute peak trend lines (identifying the heavy morning and evening peaks).
    *   *Top Stations / Corridors*: Bar charts showing where incidents are concentrated.

---

## Tab 2: Mitigation Planner & Simulator (How to Run a Scenario)

This tab is the core predictive and prescriptive engine. Use it to simulate an upcoming event or sudden incident and generate a tactical traffic deployment plan.

### Step 1: Select the Incident Location (Spatial Coordinates)
There are two ways to choose the location:
1.  **Direct Map Snapping (Recommended)**: Look at the **Live Simulation Map** on the right. **Click anywhere on the map** to place a **Red Marker**. The form's `Latitude` and `Longitude` fields will instantly update to the clicked location. You can also drag the Red Marker around the map.
2.  **Manual Input**: Type exact latitude and longitude values in the form.

### Step 2: Configure the Incident Parameters
Fill out the **Event Simulation Parameters** form on the left:
*   **Event Type**: Choose `Planned` (e.g. rally, construction, festival) or `Unplanned` (breakdown, accident).
*   **Event Cause**: Select from the dropdown list (e.g. `Accident`, `Protest`, `VIP Movement`, `Water Logging`, `Construction`, etc.).
*   **Priority**: Select `High` or `Low` priority.
*   **Road Closure**: Toggle **Requires Closure** to green/checked if the event blocks the street (e.g. major construction/protest).
*   **Target Police Station & Target Corridor**: Choose the local traffic jurisdiction in charge.
*   **Time of Day (Hour) & Day of Week**: Set the timing to simulate Peak hours vs Off-peak times.

### Step 3: Run the Simulator
Click the glowing **"Run Impact Analysis"** button. The dashboard will scroll down and display the customized prescriptions.

### Step 4: Review the ML Prescriptions
*   **Predictive Impact Forecast**:
    *   *Congestion Severity*: Glowing badge (`Low`, `Medium`, `High`, `Critical`) representing predicted traffic delay severity.
    *   *Forecasted Resolution Time*: Random Forest regression output showing the predicted traffic clearance time in minutes.
*   **Tactical Manpower (Traffic Police)**:
    *   Shows the exact **headcount of officers** recommended.
    *   Provides a **Role Distribution Breakdown**: how many officers should control the core site, guide upstream junctions, and patrol the area.
*   **Barricading Strategy**:
    *   Prescribes the count of barricades and specific placement guidelines.
*   **Diversion & Rerouting Protocol**:
    *   States whether diversion is necessary.
    *   Queries database to suggest real local control junctions.
    *   **Map Routing Visualization**: On the simulator map, **Amber Diversion Markers** appear showing where to divert traffic, connected to the core incident site by **Dashed detour lines**.

### Step 5: Log Post-Event Closure (Feedback Loop)
At the bottom of the planner results, there is a **"Post-Event Incident Closure"** form. Fill this out after the simulated event ends to log ground truth data:
1.  Verify/Adjust the fields: set the **Actual Severity** observed, the **Actual Duration** (minutes) it took to clear, the **Actual Police Headcount** deployed, and the **Actual Barricades** used.
2.  Select whether the diversion was effective.
3.  Choose a **Star Rating (1 to 5)** representing how helpful the system recommendations were to the ground team.
4.  Click **"Submit Ground Closure"**.

---

## Tab 3: Post-Event Learning (Optimization Dashboard)

After submitting the closure feedback, the dashboard will automatically redirect you to this tab.

*   **Continuous Learning KPIs**:
    *   *Closed Feedback Cycles*: Total incidents closed with feedback.
    *   *Model Confidence Rating*: Average star rating given by officers (aiming for 4.0+/5.0).
    *   *Severity Prediction Accuracy*: Percentage of times the machine learning model predicted the correct ground severity.
    *   *Manpower Hours Saved*: Tracks cumulative police headcount saved by applying data-driven recommendations.
*   **Learning Progression Curve**: A chart mapping accuracy improvements and error (MAE) reductions as the system processes more feedback, demonstrating model self-calibration.
*   **Recent Ground Feedback Log**: A detailed tabular history of all closed events, showing predicted vs actual comparisons, officer ratings, and diversion effectiveness.
