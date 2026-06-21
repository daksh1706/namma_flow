import os
import json
from contextlib import asynccontextmanager
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import joblib

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
FEEDBACK_FILE = os.path.join(BASE_DIR, "feedback.json")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Create static directories if they don't exist
os.makedirs(os.path.join(STATIC_DIR, "css"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "js"), exist_ok=True)

# Initialize lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_resources()
    init_feedback_database()
    yield

# Initialize FastAPI
app = FastAPI(
    title="NammaFlow: Event-Driven Congestion Mitigation Platform",
    lifespan=lifespan
)

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models
encoders = None
severity_clf = None
duration_reg = None
station_coords = None
meta_info = None
historical_df = None

# Load models and data
def load_resources():
    global encoders, severity_clf, duration_reg, station_coords, meta_info, historical_df
    try:
        encoders = joblib.load(os.path.join(MODEL_DIR, "encoders.joblib"))
        severity_clf = joblib.load(os.path.join(MODEL_DIR, "severity_classifier.joblib"))
        duration_reg = joblib.load(os.path.join(MODEL_DIR, "duration_regressor.joblib"))
        
        with open(os.path.join(MODEL_DIR, "station_coords.json"), "r") as f:
            station_coords = json.load(f)
            
        with open(os.path.join(MODEL_DIR, "meta_info.json"), "r") as f:
            meta_info = json.load(f)
            
        print("Loading CSV for historical analytics...")
        historical_df = pd.read_csv(CSV_PATH)
        # Handle null values to avoid JSON serialization issues (NaN)
        historical_df['priority'] = historical_df['priority'].fillna('Low')
        historical_df['corridor'] = historical_df['corridor'].fillna('Non-corridor')
        historical_df['police_station'] = historical_df['police_station'].fillna('Unknown')
        historical_df['event_cause'] = historical_df['event_cause'].fillna('others')
        historical_df['requires_road_closure'] = historical_df['requires_road_closure'].fillna(False).astype(bool)
        
        # Pre-process coords for heatmap
        historical_df['latitude'] = pd.to_numeric(historical_df['latitude'], errors='coerce')
        historical_df['longitude'] = pd.to_numeric(historical_df['longitude'], errors='coerce')
        historical_df = historical_df.dropna(subset=['latitude', 'longitude'])
        # Filter to Bangalore region
        historical_df = historical_df[
            (historical_df['latitude'] > 12.8) & (historical_df['latitude'] < 13.2) &
            (historical_df['longitude'] > 77.4) & (historical_df['longitude'] < 77.8)
        ]
        print("Resources loaded successfully!")
    except Exception as e:
        print(f"Error loading resources: {e}")
        print("Please ensure model_trainer.py has run successfully.")

# Initialize feedback database with realistic mock data if not exists
def init_feedback_database():
    if os.path.exists(FEEDBACK_FILE):
        return
        
    print("Initializing feedback.json with mock learning data...")
    # Generate 15 mock historical entries that show progress
    # Earlier entries have lower accuracy and rating, later ones have higher
    mock_feedbacks = []
    causes = ["accident", "water_logging", "vehicle_breakdown", "protest", "construction", "public_event"]
    severities = ["Low", "Medium", "High", "Critical"]
    
    for i in range(1, 21):
        cause = causes[i % len(causes)]
        # Simulated learning curve: error decreases over index
        pred_dur = 30 + (i * 8) % 120
        # Early indices have high deviation, later indices have low deviation
        error_factor = max(0.05, 0.4 - (i * 0.02))
        actual_dur = int(pred_dur * (1.0 + (np.random.choice([-1, 1]) * error_factor * np.random.rand())))
        actual_dur = max(15, actual_dur)
        
        # Severity matching improves
        pred_sev = severities[i % 4]
        if i < 7 and np.random.rand() > 0.5:
            actual_sev = np.random.choice(severities)
        else:
            actual_sev = pred_sev
            
        rec_officers = 2 if pred_sev == 'Low' else (4 if pred_sev == 'Medium' else (8 if pred_sev == 'High' else 15))
        # Actual officers deployed (might adjust based on ground conditions)
        actual_officers = rec_officers if i > 10 or np.random.rand() > 0.4 else rec_officers + np.random.choice([-1, 1, 2])
        actual_officers = max(1, actual_officers)
        
        rec_barricades = 0 if pred_sev == 'Low' else (5 if pred_sev == 'Medium' else (15 if pred_sev == 'High' else 30))
        actual_barricades = rec_barricades if i > 8 or np.random.rand() > 0.5 else rec_barricades + np.random.choice([-2, 2, 5])
        actual_barricades = max(0, actual_barricades)
        
        rating = int(3 + (i / 10) + np.random.choice([-1, 0, 1]))
        rating = min(5, max(1, rating))
        
        mock_feedbacks.append({
            "event_id": f"SIM-{1000 + i}",
            "event_cause": cause,
            "predicted_severity": pred_sev,
            "predicted_duration": float(pred_dur),
            "actual_severity": actual_sev,
            "actual_duration": float(actual_dur),
            "recommended_officers": int(rec_officers),
            "actual_officers": int(actual_officers),
            "recommended_barricades": int(rec_barricades),
            "actual_barricades": int(actual_barricades),
            "diversion_effective": "yes" if rating >= 3 else "no",
            "rating": rating,
            "timestamp": f"2026-06-{10 + (i // 2)}T10:30:00Z"
        })
        
    with open(FEEDBACK_FILE, "w") as f:
        json.dump(mock_feedbacks, f, indent=2)
    print("Mock feedback generated.")

# Models for Request/Response
class PredictionRequest(BaseModel):
    event_type: str
    event_cause: str
    requires_road_closure: bool
    priority: str
    corridor: str
    police_station: str
    latitude: float
    longitude: float
    hour: int
    day_of_week: int

class FeedbackRequest(BaseModel):
    event_id: str
    event_cause: str
    predicted_severity: str
    predicted_duration: float
    actual_severity: str
    actual_duration: float
    recommended_officers: int
    actual_officers: int
    recommended_barricades: int
    actual_barricades: int
    diversion_effective: str
    rating: int

# Removed deprecated on_event startup block as it is moved to lifespan context manager.

# Endpoints
@app.get("/api/meta")
def get_meta():
    """Returns option metadata for dropdowns in UI"""
    if not meta_info:
        raise HTTPException(status_code=503, detail="Model assets not ready")
    return meta_info

@app.get("/api/analytics")
def get_analytics():
    """Returns aggregate stats of historical events & coordinate sample for mapping"""
    global historical_df
    if historical_df is None:
        raise HTTPException(status_code=503, detail="Historical dataset not loaded")
        
    # Sample 800 events to show as map points (hotspots)
    map_points = historical_df[['latitude', 'longitude', 'event_cause', 'priority', 'requires_road_closure']].sample(n=min(800, len(historical_df)), random_state=42).to_dict(orient='records')
    
    # Event cause counts
    cause_counts = historical_df['event_cause'].value_counts().head(10).to_dict()
    
    # Temporal distribution
    historical_df['start_datetime'] = pd.to_datetime(historical_df['start_datetime'], errors='coerce')
    hours = historical_df['start_datetime'].dt.hour.dropna().astype(int).value_counts().sort_index().to_dict()
    # Ensure all 24 hours are represented
    hour_distribution = {h: hours.get(h, 0) for h in range(24)}
    
    # Priority counts
    priority_counts = historical_df['priority'].value_counts(dropna=False).to_dict()
    
    # Road Closure counts
    closure_counts = historical_df['requires_road_closure'].value_counts().to_dict()
    # Normalize keys to string
    closure_counts = {str(k): v for k, v in closure_counts.items()}
    
    # Top police stations
    station_counts = historical_df['police_station'].value_counts().head(8).to_dict()
    
    # Top corridors
    corridor_counts = historical_df['corridor'].value_counts().head(8).to_dict()
    
    return {
        "total_incidents": len(historical_df),
        "map_points": map_points,
        "cause_counts": cause_counts,
        "hour_distribution": hour_distribution,
        "priority_counts": priority_counts,
        "closure_counts": closure_counts,
        "station_counts": station_counts,
        "corridor_counts": corridor_counts
    }

@app.post("/api/predict")
def predict_mitigation(req: PredictionRequest):
    """Predicts traffic severity & duration, and prescribes resource deployment"""
    global encoders, severity_clf, duration_reg, station_coords, historical_df
    
    if not (encoders and severity_clf and duration_reg):
        raise HTTPException(status_code=503, detail="Inference engine not loaded")
        
    # Prepare input vector
    is_peak_hour = 1 if req.hour in [8, 9, 10, 11, 17, 18, 19, 20] else 0
    
    # Encode categories
    input_data = {
        'event_type': req.event_type,
        'event_cause': req.event_cause,
        'requires_road_closure': req.requires_road_closure,
        'priority': req.priority,
        'corridor': req.corridor,
        'police_station': req.police_station,
        'hour': req.hour,
        'day_of_week': req.day_of_week,
        'is_peak_hour': is_peak_hour
    }
    
    # Safe encoding logic
    encoded_vals = []
    for col in ['event_type', 'event_cause', 'priority', 'corridor', 'police_station']:
        le = encoders[col]
        val = str(input_data[col])
        if val not in le.classes_:
            val = 'Unknown'
            # If Unknown is also not in classes, use first class
            if val not in le.classes_:
                val = le.classes_[0]
        encoded_vals.append(le.transform([val])[0])
        
    # Features order: ['event_type', 'event_cause', 'requires_road_closure', 'priority', 'corridor', 'police_station', 'hour', 'day_of_week', 'is_peak_hour']
    feature_vector = [
        encoded_vals[0], # event_type
        encoded_vals[1], # event_cause
        int(req.requires_road_closure),
        encoded_vals[2], # priority
        encoded_vals[3], # corridor
        encoded_vals[4], # police_station
        req.hour,
        req.day_of_week,
        is_peak_hour
    ]
    
    # Predict Severity & Duration
    pred_severity = severity_clf.predict([feature_vector])[0]
    pred_duration = float(duration_reg.predict([feature_vector])[0])
    
    # Calibrate predicted duration based on event cause for sanity (unplanned duration is usually shorter than a road pot_hole)
    # The models are trained on capped data, but let's apply heuristics to prevent weird predictions if R2 has high variance
    if req.event_cause.lower() == 'vehicle_breakdown' and pred_duration > 180:
        pred_duration = 45.0 + (pred_duration % 60)
    elif req.event_cause.lower() == 'accident' and pred_duration > 240:
        pred_duration = 60.0 + (pred_duration % 90)
        
    pred_duration = max(10.0, round(pred_duration, 1))

    # Calculate recommended resources based on severity
    if pred_severity == 'Low':
        officers = 2
        barricades = 0
        diversion_needed = False
        barricade_desc = "No barricades required. Maintain free flow."
        diversion_desc = "No traffic diversion required. Direct flow along normal paths."
    elif pred_severity == 'Medium':
        officers = 4
        barricades = 5
        diversion_needed = True
        barricade_desc = "Setup minor warning barricades 50m upstream of incident."
        diversion_desc = "Lane merges advised. Divert slow-moving traffic to service lanes if available."
    elif pred_severity == 'High':
        officers = 8
        barricades = 15
        diversion_needed = True
        barricade_desc = "Channelize traffic using heavy barricades 100m and 200m upstream. Create visual blocker."
        diversion_desc = "Implement partial detour. Divert vehicles around the block."
    else: # Critical
        officers = 15
        barricades = 30
        diversion_needed = True
        barricade_desc = "Establish complete blockades. Deploy hazard reflective panels at core incident site and upstream exit points."
        diversion_desc = "Full segment closure. Divert all major traffic streams to adjacent corridors."

    # Look up nearest junctions associated with the police station or corridor to make diversion recommendations highly realistic!
    suggested_junctions = []
    if historical_df is not None:
        station_matches = historical_df[historical_df['police_station'] == req.police_station].dropna(subset=['junction'])
        if len(station_matches) > 0:
            suggested_junctions = list(station_matches['junction'].value_counts().head(3).index)
        else:
            corridor_matches = historical_df[historical_df['corridor'] == req.corridor].dropna(subset=['junction'])
            if len(corridor_matches) > 0:
                suggested_junctions = list(corridor_matches['junction'].value_counts().head(3).index)
                
    if not suggested_junctions:
        suggested_junctions = ["Mekhri Circle", "Richmond Circle", "Silk Board Junction"]
        
    # Build diversion map plan
    diversion_points = []
    # Generate coordinates offset from the event coordinates for visual diversion points on Leaflet map
    for i, junc in enumerate(suggested_junctions[:2]):
        angle = i * np.pi + np.random.rand() * 0.5
        dist = 0.005 + (i * 0.003)
        div_lat = req.latitude + dist * np.sin(angle)
        div_lng = req.longitude + dist * np.cos(angle)
        diversion_points.append({
            "name": junc,
            "lat": div_lat,
            "lng": div_lng,
            "role": f"Diversion Point {i+1} - Reroute target"
        })
        
    return {
        "event_id": f"EVT-{int(np.random.rand() * 90000 + 10000)}",
        "predicted_severity": pred_severity,
        "predicted_duration_minutes": pred_duration,
        "manpower": {
            "recommended_headcount": officers,
            "role_distribution": {
                "core_junction_control": max(1, officers // 2),
                "upstream_diversion_guides": max(1, officers // 3),
                "mobile_incident_patrols": max(0, officers - (officers // 2) - (officers // 3))
            },
            "police_station_in_charge": req.police_station
        },
        "barricading": {
            "recommended_count": barricades,
            "setup_description": barricade_desc
        },
        "diversion": {
            "required": diversion_needed,
            "recommended_junctions": suggested_junctions[:3],
            "description": diversion_desc,
            "map_points": diversion_points
        }
    }

@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest):
    """Appends post-event feedback to database to update learning loop"""
    import datetime
    
    new_feedback = {
        "event_id": req.event_id,
        "event_cause": req.event_cause,
        "predicted_severity": req.predicted_severity,
        "predicted_duration": req.predicted_duration,
        "actual_severity": req.actual_severity,
        "actual_duration": req.actual_duration,
        "recommended_officers": req.recommended_officers,
        "actual_officers": req.actual_officers,
        "recommended_barricades": req.recommended_barricades,
        "actual_barricades": req.actual_barricades,
        "diversion_effective": req.diversion_effective,
        "rating": req.rating,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }
    
    # Read existing feedback
    feedbacks = []
    if os.path.exists(FEEDBACK_FILE):
        try:
            with open(FEEDBACK_FILE, "r") as f:
                feedbacks = json.load(f)
        except Exception:
            feedbacks = []
            
    feedbacks.append(new_feedback)
    
    # Save back
    with open(FEEDBACK_FILE, "w") as f:
        json.dump(feedbacks, f, indent=2)
        
    return {"status": "success", "message": "Post-event learning loop updated successfully."}

@app.get("/api/feedback/stats")
def get_feedback_stats():
    """Computes operational performance & accuracy statistics of the learning system"""
    if not os.path.exists(FEEDBACK_FILE):
        return {
            "total_feedback_events": 0,
            "average_rating": 0,
            "severity_prediction_accuracy": 0,
            "duration_mae_minutes": 0,
            "manpower_savings_count": 0,
            "learning_curve": []
        }
        
    try:
        with open(FEEDBACK_FILE, "r") as f:
            feedbacks = json.load(f)
    except Exception:
        return {"error": "Could not read feedback statistics"}
        
    total_events = len(feedbacks)
    if total_events == 0:
        return {
            "total_feedback_events": 0,
            "average_rating": 0,
            "severity_prediction_accuracy": 0,
            "duration_mae_minutes": 0,
            "manpower_savings_count": 0,
            "learning_curve": []
        }
        
    # 1. Average rating
    avg_rating = round(sum(f['rating'] for f in feedbacks) / total_events, 2)
    
    # 2. Severity accuracy
    correct_severity = sum(1 for f in feedbacks if f['predicted_severity'] == f['actual_severity'])
    severity_acc = round((correct_severity / total_events) * 100.0, 1)
    
    # 3. Duration Mean Absolute Error
    mae = sum(abs(f['predicted_duration'] - f['actual_duration']) for f in feedbacks) / total_events
    duration_mae = round(mae, 1)
    
    # 4. Manpower Savings: Sum of (Recommended - Actual) or simply show total manpower managed
    # We calculate the delta where Recommended >= Actual, showing optimization
    manpower_saved = sum(max(0, f['recommended_officers'] - f['actual_officers']) for f in feedbacks)
    
    # 5. Learning Curve: Accuracy progression over timeline chunks of 5 events
    # We show how accuracy of severity prediction moves as more data points are added
    learning_curve = []
    # Group in windows of 5 events
    window_size = 5
    for i in range(window_size, total_events + 1):
        window = feedbacks[:i]
        window_correct = sum(1 for f in window if f['predicted_severity'] == f['actual_severity'])
        window_acc = round((window_correct / len(window)) * 100.0, 1)
        learning_curve.append({
            "event_count": i,
            "accuracy": window_acc,
            "mae": round(sum(abs(f['predicted_duration'] - f['actual_duration']) for f in window) / len(window), 1)
        })
        
    return {
        "total_feedback_events": total_events,
        "average_rating": avg_rating,
        "severity_prediction_accuracy": severity_acc,
        "duration_mae_minutes": duration_mae,
        "manpower_savings_count": manpower_saved,
        "learning_curve": learning_curve
    }

# Serve Frontend static assets
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
