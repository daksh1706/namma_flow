# Complete Step-by-Step Guide: Running AstraFlow From Scratch

This document provides a comprehensive guide to setting up, training, and running the **AstraFlow (Event-Driven Traffic Mitigation Platform)** prototype on your local machine and deploying it to the cloud.

---

## Part 1: Local Setup

### Step 1: Clone or Download the Project Files
Create a project folder on your machine and ensure the following files exist in this structure:
```
astra_flow/
  ├── static/
  │    ├── index.html
  │    ├── css/
  │    │    └── styles.css
  │    └── js/
  │         └── dashboard.js
  ├── app.py
  ├── model_trainer.py
  ├── run_app.py
  ├── requirements.txt
  └── Dockerfile
```

### Step 2: Install Python & Package Dependencies
Ensure Python 3.9+ is installed on your system. Install the required libraries using `pip`:
```bash
pip install -r requirements.txt
```
*Note: This command installs `fastapi`, `uvicorn`, `pandas`, `scikit-learn`, `joblib`, `numpy`, and `pydantic`.*

### Step 3: Add the Dataset File
Download the traffic incident dataset and place it directly in the root directory:
- Filename must be: `Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv`

### Step 4: Train the Machine Learning Engine
Before running the server, you must train the Random Forest models on the dataset to create the predictive assets.
Run the training script in your terminal:
```bash
python3 model_trainer.py
```
**What this does**:
- Preprocesses coordinates, timestamps, and missing values.
- Computes spatial center points for each of the 50+ police stations.
- Trains a Random Forest Classifier to forecast **Congestion Severity**.
- Trains a Random Forest Regressor to forecast **Resolution Duration**.
- Creates a `models/` directory containing the saved serialized files (`encoders.joblib`, `severity_classifier.joblib`, `duration_regressor.joblib`, `station_coords.json`, `meta_info.json`).

### Step 5: Launch the Application
Run the launch script:
```bash
python3 run_app.py
```
**What this does**:
- Starts the FastAPI backend server on `http://127.0.0.1:8000`.
- Automatically opens your default web browser to the dashboard page.
- You can now test the simulator, maps, and charts locally!

---

## Part 2: Cloud Deployment (Render + Vercel)

For hackathon submissions, deploying the app online is highly recommended. We use a hybrid setup: **Render** for the ML backend, and **Vercel** for the static frontend.

### Step 1: Deploy the Python Backend on Render
1. Push your project folder to your GitHub account (e.g. repository `astra_flow`).
2. Register and log into [Render.com](https://render.com/).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Set the following configuration:
   - **Language**: `Docker` (Render will automatically detect the `Dockerfile` and build it)
   - **Branch**: `main`
6. Select the **Free Tier** and click **Deploy Web Service**.
7. Once deployed, copy your live backend URL (e.g., `https://astra-flow-q3m2.onrender.com`).

### Step 2: Configure the Frontend with your Backend URL
1. Open the file `static/js/dashboard.js`.
2. Locate the variable `RENDER_BACKEND_URL` on line 17 and replace it with your actual Render URL:
   ```javascript
   const RENDER_BACKEND_URL = "https://astra-flow-q3m2.onrender.com"; // <-- Paste your URL here
   ```
3. Commit and push the changes to GitHub:
   ```bash
   git add static/js/dashboard.js
   git commit -m "Update actual Render URL"
   git push
   ```

### Step 3: Deploy the Static Frontend on Vercel
1. Log into [Vercel.com](https://vercel.com/) with your GitHub account.
2. Click **Add New...** -> **Project**.
3. Import your `astra_flow` repository.
4. **Important Settings Adjustments**:
   - Set **Framework Preset** to `Other`.
   - Next to **Root Directory**, click *Edit* and select the **`static`** folder.
5. Click **Deploy**.

Vercel will host your user interface. When users visit the Vercel site, it will query your live Render service to calculate machine learning predictions dynamically!
