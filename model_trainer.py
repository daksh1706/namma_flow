import os
import json
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import joblib

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

def train_and_save(feedback_path=None):
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
    # Filter coordinates to Bangalore region roughly (lat 12.0 to 14.0, lon 77.0 to 78.5)
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

    # Compute average coordinates for each junction
    print("Computing junction coordinates mapping...")
    junction_coords = {}
    valid_junc_df = df.dropna(subset=['latitude', 'longitude', 'junction'])
    valid_junc_df = valid_junc_df[
        (valid_junc_df['latitude'] > 12.0) & (valid_junc_df['latitude'] < 14.0) &
        (valid_junc_df['longitude'] > 77.0) & (valid_junc_df['longitude'] < 78.5)
    ]
    junction_grouped = valid_junc_df.groupby('junction')
    for junction, group in junction_grouped:
        junction_coords[junction] = {
            "lat": float(group['latitude'].mean()),
            "lng": float(group['longitude'].mean())
        }
    
    # Save junction coordinates mapping
    with open(os.path.join(MODEL_DIR, "junction_coords.json"), "w") as f:
        json.dump(junction_coords, f, indent=2)
    print(f"Saved junction coordinates for {len(junction_coords)} junctions.")

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
    
    # Prepare classifier dataset
    df_clf = df.copy()
    df_clf['is_feedback'] = False
    
    # Load feedback rows
    feedback_df = None
    if feedback_path and os.path.exists(feedback_path):
        try:
            with open(feedback_path, 'r') as f:
                feedbacks = json.load(f)
            if feedbacks:
                feedback_df = pd.DataFrame(feedbacks)
                print(f"Loaded {len(feedback_df)} feedback rows for retraining.")
                
                # Standardize columns
                if 'actual_severity' in feedback_df.columns:
                    feedback_df['congestion_severity'] = feedback_df['actual_severity']
                if 'actual_duration' in feedback_df.columns:
                    feedback_df['duration_min'] = feedback_df['actual_duration']
                if 'hour' in feedback_df.columns:
                    feedback_df['is_peak_hour'] = feedback_df['hour'].isin([8, 9, 10, 11, 17, 18, 19, 20]).astype(int)
                
                # Fill missing features with defaults
                feedback_df['event_type'] = feedback_df.get('event_type', pd.Series('unplanned', index=feedback_df.index)).fillna('unplanned')
                feedback_df['event_cause'] = feedback_df.get('event_cause', pd.Series('others', index=feedback_df.index)).fillna('others')
                feedback_df['requires_road_closure'] = feedback_df.get('requires_road_closure', pd.Series(False, index=feedback_df.index)).fillna(False).astype(bool)
                feedback_df['priority'] = feedback_df.get('priority', pd.Series('Low', index=feedback_df.index)).fillna('Low')
                feedback_df['corridor'] = feedback_df.get('corridor', pd.Series('Non-corridor', index=feedback_df.index)).fillna('Non-corridor')
                feedback_df['police_station'] = feedback_df.get('police_station', pd.Series('Unknown', index=feedback_df.index)).fillna('Unknown')
                feedback_df['hour'] = feedback_df.get('hour', pd.Series(12, index=feedback_df.index)).fillna(12).astype(int)
                feedback_df['day_of_week'] = feedback_df.get('day_of_week', pd.Series(1, index=feedback_df.index)).fillna(1).astype(int)
        except Exception as e:
            print(f"Error loading feedback file: {e}")
            
    if feedback_df is not None and len(feedback_df) > 0:
        feedback_df_clf = feedback_df.dropna(subset=['congestion_severity']).copy()
        feedback_df_clf['is_feedback'] = True
        combined_clf_df = pd.concat([df_clf, feedback_df_clf], ignore_index=True)
    else:
        combined_clf_df = df_clf
    
    # Define categorical features to encode
    categorical_features = ['event_type', 'event_cause', 'priority', 'corridor', 'police_station']
    
    # We will fit encoders and save them
    encoders = {}
    X_encoded = combined_clf_df.copy()
    
    for col in categorical_features:
        le = LabelEncoder()
        # Add a placeholder for unseen labels during prediction
        unique_vals = list(combined_clf_df[col].astype(str).unique())
        if 'Unknown' not in unique_vals:
            unique_vals.append('Unknown')
        le.fit(unique_vals)
        X_encoded[col] = le.transform(combined_clf_df[col].astype(str))
        encoders[col] = le
        
    # Save encoders
    joblib.dump(encoders, os.path.join(MODEL_DIR, "encoders.joblib"))
    print("Saved categorical encoders.")

    # 1. Train Congestion Severity Classifier
    feature_cols = ['event_type', 'event_cause', 'requires_road_closure', 'priority', 'corridor', 'police_station', 'hour', 'day_of_week', 'is_peak_hour']
    
    X_clf = X_encoded[feature_cols].copy()
    y_clf = combined_clf_df['congestion_severity']
    is_feedback_clf = X_encoded.get('is_feedback', pd.Series(False, index=X_clf.index))
    weights_clf = np.where(is_feedback_clf, 10.0, 1.0)
    
    # Proper Train/Test split for evaluation
    stratify_target = y_clf if (y_clf.value_counts() >= 2).all() else None
    X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
        X_clf, y_clf, weights_clf, test_size=0.2, random_state=42, stratify=stratify_target
    )
    
    clf_eval = RandomForestClassifier(n_estimators=100, random_state=42)
    clf_eval.fit(X_train, y_train, sample_weight=w_train)
    test_acc = clf_eval.score(X_test, y_test)
    print(f"Severity Classifier - Evaluation TEST Accuracy: {test_acc:.4f}")
    
    # Refit on all data for final deployed model
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X_clf, y_clf, sample_weight=weights_clf)
    joblib.dump(clf, os.path.join(MODEL_DIR, "severity_classifier.joblib"))
    print(f"Severity Classifier trained on all data. Accuracy on entire set: {clf.score(X_clf, y_clf):.4f}")
    
    # 2. Train Event Duration Regressor
    # Get subset with valid durations (outliers filtered)
    sub_df = df.dropna(subset=['closed_datetime']).copy()
    sub_df['duration_min'] = (sub_df['closed_datetime'] - sub_df['start_datetime']).dt.total_seconds() / 60.0
    sub_df = sub_df[(sub_df['duration_min'] > 0) & (sub_df['duration_min'] < 2880)] # Cap at 48 hours
    sub_df['is_feedback'] = False
    
    if feedback_df is not None and len(feedback_df) > 0:
        feedback_df_reg = feedback_df.dropna(subset=['duration_min']).copy()
        feedback_df_reg['is_feedback'] = True
        combined_reg_df = pd.concat([sub_df, feedback_df_reg], ignore_index=True)
    else:
        combined_reg_df = sub_df
        
    if len(combined_reg_df) > 0:
        # We need to encode the categories for combined_reg_df
        sub_encoded = combined_reg_df.copy()
        for col in categorical_features:
            le = encoders[col]
            sub_encoded[col] = sub_encoded[col].astype(str).apply(
                lambda x: le.transform([x])[0] if x in le.classes_ else le.transform(['Unknown'])[0]
            )
            
        X_reg = sub_encoded[feature_cols].copy()
        y_reg = combined_reg_df['duration_min']
        is_feedback_reg = sub_encoded.get('is_feedback', pd.Series(False, index=X_reg.index))
        weights_reg = np.where(is_feedback_reg, 10.0, 1.0)
        
        # Proper Train/Test split for evaluation
        X_reg_train, X_reg_test, y_reg_train, y_reg_test, w_reg_train, w_reg_test = train_test_split(
            X_reg, y_reg, weights_reg, test_size=0.2, random_state=42
        )
        
        reg_eval = RandomForestRegressor(n_estimators=100, random_state=42)
        reg_eval.fit(X_reg_train, y_reg_train, sample_weight=w_reg_train)
        test_r2 = reg_eval.score(X_reg_test, y_reg_test)
        from sklearn.metrics import mean_absolute_error
        test_mae = mean_absolute_error(y_reg_test, reg_eval.predict(X_reg_test))
        print(f"Duration Regressor - Evaluation TEST R2 score: {test_r2:.4f}, MAE: {test_mae:.4f} min")
        
        # Refit on all data for final deployed model
        reg = RandomForestRegressor(n_estimators=100, random_state=42)
        reg.fit(X_reg, y_reg, sample_weight=weights_reg)
        joblib.dump(reg, os.path.join(MODEL_DIR, "duration_regressor.joblib"))
        print(f"Duration Regressor trained on {len(combined_reg_df)} rows. R2 score on entire set: {reg.score(X_reg, y_reg):.4f}")
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
        "junctions": sorted(list(df['junction'].dropna().astype(str).unique())),
        "station_coords": station_coords,
        "junction_coords": junction_coords
    }
    with open(os.path.join(MODEL_DIR, "meta_info.json"), "w") as f:
        json.dump(meta_info, f, indent=2)
    print("Saved meta info.")

if __name__ == "__main__":
    train_and_save()
