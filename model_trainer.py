import os
import json
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import joblib

# Paths
CSV_PATH = "/Users/daksh/Desktop/hackathon/Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv"
MODEL_DIR = "/Users/daksh/Desktop/hackathon/models"
os.makedirs(MODEL_DIR, exist_ok=True)

def train_and_save():
    print("Loading dataset...")
    df = pd.read_csv(CSV_PATH)
    
    # Fill basic missing values
    df['priority'] = df['priority'].fillna('Low')
    df['corridor'] = df['corridor'].fillna('Non-corridor')
    df['police_station'] = df['police_station'].fillna('Unknown')
    df['event_cause'] = df['event_cause'].fillna('others')
    df['requires_road_closure'] = df['requires_road_closure'].fillna(False).astype(bool)
    
    # Parse dates
    df['start_datetime'] = pd.to_datetime(df['start_datetime'], errors='coerce')
    df['closed_datetime'] = pd.to_datetime(df['closed_datetime'], errors='coerce')
    df = df.dropna(subset=['start_datetime'])
    
    # Compute average coordinates for each police station
    print("Computing police station coordinates mapping...")
    station_coords = {}
    valid_coords_df = df.dropna(subset=['latitude', 'longitude'])
    # Filter coordinates to Bangalore region roughly (lat 12.8 to 13.2, lon 77.4 to 77.8)
    valid_coords_df = valid_coords_df[
        (valid_coords_df['latitude'] > 12.0) & (valid_coords_df['latitude'] < 14.0) &
        (valid_coords_df['longitude'] > 77.0) & (valid_coords_df['longitude'] < 78.5)
    ]
    station_grouped = valid_coords_df.groupby('police_station')
    for station, group in station_grouped:
        station_coords[station] = {
            "lat": float(group['latitude'].mean()),
            "lng": float(group['longitude'].mean())
        }
    # Add default center (Bangalore center)
    station_coords['default'] = {"lat": 12.9716, "lng": 77.5946}
    
    # Save police station coordinates mapping
    with open(os.path.join(MODEL_DIR, "station_coords.json"), "w") as f:
        json.dump(station_coords, f, indent=2)
    print(f"Saved station coordinates for {len(station_coords)} stations.")

    # Feature extraction
    df['hour'] = df['start_datetime'].dt.hour
    df['day_of_week'] = df['start_datetime'].dt.dayofweek
    df['month'] = df['start_datetime'].dt.month
    df['is_peak_hour'] = df['hour'].isin([8, 9, 10, 11, 17, 18, 19, 20]).astype(int)
    
    # Compute Congestion Impact Score
    # Score = Base(Cause) * PriorityMultiplier * ClosureMultiplier * CorridorMultiplier * PeakMultiplier
    def calculate_congestion_score(row):
        cause_weights = {
            'accident': 4,
            'protest': 5,
            'procession': 4,
            'public_event': 5,
            'vip_movement': 5,
            'water_logging': 4,
            'tree_fall': 3,
            'construction': 3,
            'pot_holes': 2,
            'road_conditions': 2,
            'congestion': 3,
            'vehicle_breakdown': 2,
            'others': 2
        }
        base = cause_weights.get(str(row['event_cause']).lower(), 2)
        
        priority_multiplier = 1.3 if row['priority'] == 'High' else 1.0
        closure_multiplier = 1.5 if row['requires_road_closure'] else 1.0
        corridor_multiplier = 1.2 if row['corridor'] != 'Non-corridor' else 1.0
        peak_multiplier = 1.2 if row['is_peak_hour'] == 1 else 1.0
        
        return base * priority_multiplier * closure_multiplier * corridor_multiplier * peak_multiplier

    df['congestion_score'] = df.apply(calculate_congestion_score, axis=1)
    
    def get_severity(score):
        if score < 3.0:
            return 'Low'
        elif score < 5.0:
            return 'Medium'
        elif score < 7.0:
            return 'High'
        else:
            return 'Critical'
            
    df['congestion_severity'] = df['congestion_score'].apply(get_severity)
    
    # Define categorical features to encode
    categorical_features = ['event_type', 'event_cause', 'priority', 'corridor', 'police_station']
    
    # We will fit encoders and save them
    encoders = {}
    X_encoded = df.copy()
    
    for col in categorical_features:
        le = LabelEncoder()
        # Add a placeholder for unseen labels during prediction
        unique_vals = list(df[col].astype(str).unique())
        if 'Unknown' not in unique_vals:
            unique_vals.append('Unknown')
        le.fit(unique_vals)
        X_encoded[col] = le.transform(df[col].astype(str))
        encoders[col] = le
        
    # Save encoders
    joblib.dump(encoders, os.path.join(MODEL_DIR, "encoders.joblib"))
    print("Saved categorical encoders.")

    # 1. Train Congestion Severity Classifier
    feature_cols = ['event_type', 'event_cause', 'requires_road_closure', 'priority', 'corridor', 'police_station', 'hour', 'day_of_week', 'is_peak_hour']
    
    X_clf = X_encoded[feature_cols].copy()
    y_clf = df['congestion_severity']
    
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X_clf, y_clf)
    joblib.dump(clf, os.path.join(MODEL_DIR, "severity_classifier.joblib"))
    print(f"Severity Classifier trained. Accuracy: {clf.score(X_clf, y_clf):.4f}")
    
    # 2. Train Event Duration Regressor
    # Get subset with valid durations (outliers filtered)
    sub_df = df.dropna(subset=['closed_datetime']).copy()
    sub_df['duration_min'] = (sub_df['closed_datetime'] - sub_df['start_datetime']).dt.total_seconds() / 60.0
    sub_df = sub_df[(sub_df['duration_min'] > 0) & (sub_df['duration_min'] < 2880)] # Cap at 48 hours
    
    if len(sub_df) > 0:
        sub_encoded = X_encoded.loc[sub_df.index].copy()
        X_reg = sub_encoded[feature_cols].copy()
        y_reg = sub_df['duration_min']
        
        reg = RandomForestRegressor(n_estimators=100, random_state=42)
        reg.fit(X_reg, y_reg)
        joblib.dump(reg, os.path.join(MODEL_DIR, "duration_regressor.joblib"))
        print(f"Duration Regressor trained on {len(sub_df)} rows. R2 score: {reg.score(X_reg, y_reg):.4f}")
    else:
        # Fallback empty model or standard model
        print("Warning: No valid durations found for regressor!")
        reg = RandomForestRegressor(n_estimators=10, random_state=42)
        # Train on dummy data just to instantiate
        dummy_X = pd.DataFrame(0, index=[0], columns=feature_cols)
        dummy_y = [60.0]
        reg.fit(dummy_X, dummy_y)
        joblib.dump(reg, os.path.join(MODEL_DIR, "duration_regressor.joblib"))

    # Save a list of unique police stations, corridors, and causes for frontend lists
    meta_info = {
        "police_stations": sorted(list(df['police_station'].astype(str).unique())),
        "corridors": sorted(list(df['corridor'].astype(str).unique())),
        "event_causes": sorted(list(df['event_cause'].astype(str).unique())),
        "event_types": sorted(list(df['event_type'].astype(str).unique())),
        "junctions": sorted(list(df['junction'].dropna().astype(str).unique()))
    }
    with open(os.path.join(MODEL_DIR, "meta_info.json"), "w") as f:
        json.dump(meta_info, f, indent=2)
    print("Saved meta info.")

if __name__ == "__main__":
    train_and_save()
