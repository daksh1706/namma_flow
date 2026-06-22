// NammaFlow Dashboard Javascript

// Global Variables
let analyticsMap = null;
let plannerMap = null;
let sourceMarker = null; // Incident Source / Barricade point
let destMarker = null;   // Incident Destination / Reopen point
let diversionMarkers = [];
let diversionLines = [];
let jurisdictionLayer = null;
let stationMarker = null;
let meta = null; // Store metadata globally
let lastSimulationResult = null;
let simulationActive = false;

const sourceIcon = L.divIcon({
    html: `
      <div class="tactical-pin barricade-pin">
        <div class="pin-icon-wrap">
          <i class="fa-solid fa-road-barrier"></i>
        </div>
        <div class="pin-pulse"></div>
      </div>
    `,
    className: 'custom-tactical-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

const destIcon = L.divIcon({
    html: `
      <div class="tactical-pin destination-pin">
        <div class="pin-icon-wrap">
          <i class="fa-solid fa-flag-checkered"></i>
        </div>
        <div class="pin-pulse"></div>
      </div>
    `,
    className: 'custom-tactical-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

let chartCauses = null;
let chartHours = null;
let chartStations = null;
let chartCorridors = null;
let chartLearningCurve = null;

// API Base URL: Auto-detects local vs production Render backend
const RENDER_BACKEND_URL = "https://astra-flow-q3m2.onrender.com"; // <-- REPLACE WITH YOUR RENDER URL
const API_BASE = (window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' || 
                  window.location.hostname === '' ||
                  window.location.port !== '') 
    ? "" 
    : RENDER_BACKEND_URL;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    loadMetaDropdowns();
    initAnalyticsTab();
    
    // Connect Form Submit Actions
    document.getElementById("simulator-form").addEventListener("submit", handleSimulatorSubmit);
    document.getElementById("feedback-form").addEventListener("submit", handleFeedbackSubmit);
});

// 1. Navigation Tab Handling
function setupNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const tabs = document.querySelectorAll(".tab-content");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");
    
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");
            
            // Toggle nav active classes
            navItems.forEach(n => n.classList.remove("active"));
            item.classList.add("active");
            
            // Toggle tab content active classes
            tabs.forEach(t => t.classList.remove("active"));
            const targetTab = document.getElementById(`tab-${tabId}`);
            targetTab.classList.add("active");
            
            // Update Headers
            if (tabId === "analytics") {
                pageTitle.textContent = "Historical Analytics";
                pageSubtitle.textContent = "Visualizing congestion insights and hotspots from 8,000+ historical reports in Bengaluru";
                if (analyticsMap) analyticsMap.invalidateSize();
            } else if (tabId === "planner") {
                pageTitle.textContent = "Mitigation Planner & Simulator";
                pageSubtitle.textContent = "Forecast congestion severity and generate data-driven manpower, barricading, and diversion blueprints";
                initPlannerTab(); // Lazy load planner map
            } else if (tabId === "learning") {
                pageTitle.textContent = "Post-Event Learning System";
                pageSubtitle.textContent = "Closing the loop: analyzing ground officer feedback to continually refine predictive precision";
                loadLearningTab();
            }
        });
    });
}

// Helper: Show notifications
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let iconClass = "fa-circle-check";
    if (type === "info") iconClass = "fa-circle-info";
    if (type === "error") iconClass = "fa-triangle-exclamation";
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Fade out and remove after 4 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(50px)";
        toast.style.transition = "all 0.5s ease-out";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// 2. Fetch dropdown choices from API
// 2. Fetch dropdown choices from API with retry protection for Render cold starts
async function loadMetaDropdowns(retryCount = 0) {
    try {
        const response = await fetch(`${API_BASE}/api/meta`);
        if (!response.ok) throw new Error("Could not fetch metadata");
        meta = await response.json();
        
        const causeSelect = document.getElementById("sim-event-cause");
        const stationSelect = document.getElementById("sim-police-station");
        const corridorSelect = document.getElementById("sim-corridor");
        
        // Populating Cause select
        causeSelect.innerHTML = "";
        meta.event_causes.forEach(cause => {
            const opt = document.createElement("option");
            opt.value = cause;
            // Humanize cause label
            opt.textContent = cause.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            causeSelect.appendChild(opt);
        });
        // Select standard default
        causeSelect.value = "accident";
        
        // Populating Police Station select
        stationSelect.innerHTML = "";
        meta.police_stations.forEach(station => {
            const opt = document.createElement("option");
            opt.value = station;
            opt.textContent = station;
            stationSelect.appendChild(opt);
        });
        stationSelect.value = "Yeshwanthpura"; // default choice
        
        // Populating Corridor select
        corridorSelect.innerHTML = "";
        meta.corridors.forEach(corridor => {
            const opt = document.createElement("option");
            opt.value = corridor;
            opt.textContent = corridor;
            corridorSelect.appendChild(opt);
        });
        corridorSelect.value = "Tumkur Road"; // default choice
        
        // Add listener to station selection to center simulator marker automatically
        stationSelect.addEventListener("change", () => {
            const station = stationSelect.value;
            if (meta && meta.station_coords && meta.station_coords[station]) {
                const coords = meta.station_coords[station];
                setSourceLocation(coords.lat, coords.lng);
                setDestLocation(coords.lat + 0.0005, coords.lng - 0.001); // offset slightly
                if (plannerMap) {
                    plannerMap.panTo([coords.lat, coords.lng]);
                }
                if (simulationActive) {
                    drawSimulationRoutes();
                }
            }
        });
        
    } catch (error) {
        console.error("Error loading metadata dropdowns:", error);
        if (retryCount < 10) {
            console.log(`Retrying metadata fetch in 4s... (Attempt ${retryCount + 1}/10)`);
            showToast("Server is starting up. Retrying connection...", "info");
            setTimeout(() => loadMetaDropdowns(retryCount + 1), 4000);
        } else {
            showToast("Error loading incident configuration parameters from server", "error");
        }
    }
}

// 3. Tab 1: Historical Analytics initialization with retry protection for Render cold starts
async function initAnalyticsTab(retryCount = 0) {
    try {
        const response = await fetch(`${API_BASE}/api/analytics`);
        if (!response.ok) throw new Error("Could not fetch analytics data");
        const data = await response.json();
        
        // Update basic KPIs
        document.getElementById("kpi-total-events").textContent = Number(data.total_incidents).toLocaleString();
        
        // Render Map
        if (!analyticsMap) {
            analyticsMap = L.map('analytics-map').setView([12.9716, 77.5946], 11);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(analyticsMap);
            
            // Plot sample circles
            data.map_points.forEach(pt => {
                let color = "rgba(59, 130, 246, 0.65)"; // blue for low priority
                if (pt.priority === 'High') {
                    color = pt.requires_road_closure ? "rgba(239, 68, 68, 0.75)" : "rgba(245, 158, 11, 0.7)";
                }
                
                const circle = L.circleMarker([pt.latitude, pt.longitude], {
                    radius: pt.priority === 'High' ? 5 : 3.5,
                    fillColor: color,
                    color: color,
                    weight: 1,
                    opacity: 0.8,
                    fillOpacity: 0.65
                }).addTo(analyticsMap);
                
                const popupContent = `
                    <div class="map-popup-title">${pt.event_cause.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
                    <div class="map-popup-text">
                        <strong>Priority:</strong> <span class="${pt.priority === 'High' ? 'text-high' : 'text-low'}">${pt.priority}</span><br>
                        <strong>Road Closure:</strong> ${pt.requires_road_closure ? 'Yes' : 'No'}
                    </div>
                `;
                circle.bindPopup(popupContent);
            });
        }
        
        // Render Charts
        renderCausesChart(data.cause_counts);
        renderHoursChart(data.hour_distribution);
        renderStationsChart(data.station_counts);
        renderCorridorsChart(data.corridor_counts);
        
    } catch (error) {
        console.error("Error loading analytics tab:", error);
        if (retryCount < 10) {
            // Keep retrying in silence to avoid double toasts, as loadMetaDropdowns handles visual feedback
            setTimeout(() => initAnalyticsTab(retryCount + 1), 4000);
        } else {
            showToast("Error retrieving historical analytics records from server", "error");
        }
    }
}

// Chart Renderers
function renderCausesChart(causeCounts) {
    const ctx = document.getElementById('chart-causes').getContext('2d');
    
    // Sort and process labels
    const labels = Object.keys(causeCounts).map(k => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    const values = Object.values(causeCounts);
    
    if (chartCauses) chartCauses.destroy();
    
    chartCauses = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Reported Incidents',
                data: values,
                backgroundColor: 'rgba(157, 77, 221, 0.6)',
                borderColor: 'rgba(157, 77, 221, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#111318', titleFont: { family: 'Outfit' }, bodyFont: { family: 'Inter' } }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                y: { grid: { display: false }, ticks: { color: '#9ca3af' } }
            }
        }
    });
}

function renderHoursChart(hourDistribution) {
    const ctx = document.getElementById('chart-hours').getContext('2d');
    const hours = Object.keys(hourDistribution).map(h => `${String(h).padStart(2, '0')}:00`);
    const counts = Object.values(hourDistribution);
    
    if (chartHours) chartHours.destroy();
    
    chartHours = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [{
                label: 'Hourly Density',
                data: counts,
                fill: true,
                backgroundColor: 'rgba(0, 180, 216, 0.1)',
                borderColor: '#00b4d8',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#111318' }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', maxTicksLimit: 12 } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
            }
        }
    });
}

function renderStationsChart(stationCounts) {
    const ctx = document.getElementById('chart-stations').getContext('2d');
    
    if (chartStations) chartStations.destroy();
    
    chartStations = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(stationCounts),
            datasets: [{
                label: 'Incidents',
                data: Object.values(stationCounts),
                backgroundColor: 'rgba(247, 37, 133, 0.6)',
                borderColor: 'rgba(247, 37, 133, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#111318' }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 45 } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
            }
        }
    });
}

function renderCorridorsChart(corridorCounts) {
    const ctx = document.getElementById('chart-corridors').getContext('2d');
    
    if (chartCorridors) chartCorridors.destroy();
    
    chartCorridors = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(corridorCounts),
            datasets: [{
                label: 'Incidents',
                data: Object.values(corridorCounts),
                backgroundColor: 'rgba(6, 214, 160, 0.6)',
                borderColor: 'rgba(6, 214, 160, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#111318' }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 45 } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
            }
        }
    });
}

// 4. Tab 2: Mitigation Planner initialization
function initPlannerTab() {
    setTimeout(() => {
        if (!plannerMap) {
            plannerMap = L.map('planner-map').setView([12.955048, 77.739780], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 20
            }).addTo(plannerMap);
            
            // Map click listener to set coordinates of the closer pin
            plannerMap.on('click', (e) => {
                const { lat, lng } = e.latlng;
                if (sourceMarker && destMarker) {
                    const distSource = e.latlng.distanceTo(sourceMarker.getLatLng());
                    const distDest = e.latlng.distanceTo(destMarker.getLatLng());
                    if (distSource < distDest) {
                        setSourceLocation(lat, lng);
                    } else {
                        setDestLocation(lat, lng);
                    }
                    if (simulationActive) {
                        drawSimulationRoutes();
                    }
                }
            });
            
            // Add default markers near Whitefield incident coordinates
            setSourceLocation(12.955048, 77.739780);
            setDestLocation(12.955100, 77.738280);
        } else {
            plannerMap.invalidateSize();
        }
    }, 100);
}

// Place source pin on simulation map
function setSourceLocation(lat, lng) {
    document.getElementById("sim-latitude").value = lat.toFixed(6);
    document.getElementById("sim-longitude").value = lng.toFixed(6);
    
    if (sourceMarker) {
        sourceMarker.setLatLng([lat, lng]);
    } else {
        sourceMarker = L.marker([lat, lng], {
            icon: sourceIcon,
            draggable: true
        }).addTo(plannerMap);
        
        sourceMarker.on('dragend', () => {
            const pos = sourceMarker.getLatLng();
            setSourceLocation(pos.lat, pos.lng);
            if (simulationActive) {
                drawSimulationRoutes();
            }
        });
    }
    updateCoordinatesLabel();
}

// Place destination pin on simulation map
function setDestLocation(lat, lng) {
    const latEl = document.getElementById("sim-dest-latitude");
    const lngEl = document.getElementById("sim-dest-longitude");
    if (latEl && lngEl) {
        latEl.value = lat.toFixed(6);
        lngEl.value = lng.toFixed(6);
    }
    
    if (destMarker) {
        destMarker.setLatLng([lat, lng]);
    } else {
        destMarker = L.marker([lat, lng], {
            icon: destIcon,
            draggable: true
        }).addTo(plannerMap);
        
        destMarker.on('dragend', () => {
            const pos = destMarker.getLatLng();
            setDestLocation(pos.lat, pos.lng);
            if (simulationActive) {
                drawSimulationRoutes();
            }
        });
    }
    updateCoordinatesLabel();
}

function updateCoordinatesLabel() {
    if (sourceMarker && destMarker) {
        const sPos = sourceMarker.getLatLng();
        const dPos = destMarker.getLatLng();
        document.getElementById("simulator-coordinates").textContent = 
            `Source: ${sPos.lat.toFixed(5)}, ${sPos.lng.toFixed(5)} | Dest: ${dPos.lat.toFixed(5)}, ${dPos.lng.toFixed(5)}`;
    }
}

// Handle Run predictive mitigation simulation
async function handleSimulatorSubmit(e) {
    e.preventDefault();
    
    // Gathers form inputs
    const event_type = document.getElementById("sim-event-type").value;
    const event_cause = document.getElementById("sim-event-cause").value;
    const priority = document.getElementById("sim-priority").value;
    const requires_road_closure = document.getElementById("sim-road-closure").checked;
    const police_station = document.getElementById("sim-police-station").value;
    const corridor = document.getElementById("sim-corridor").value;
    const latitude = parseFloat(document.getElementById("sim-latitude").value);
    const longitude = parseFloat(document.getElementById("sim-longitude").value);
    const hour = parseInt(document.getElementById("sim-hour").value);
    const day_of_week = parseInt(document.getElementById("sim-day").value);
    
    const payload = {
        event_type, event_cause, requires_road_closure, priority, corridor, police_station, latitude, longitude, hour, day_of_week
    };
    
    showToast("Analyzing traffic breakdown vectors...", "info");
    
    try {
        const response = await fetch(`${API_BASE}/api/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error("Prediction request failed");
        
        const result = await response.json();
        
        // Show result panel
        document.getElementById("prediction-result-panel").style.display = "block";
        
        // Smooth scroll to results
        document.getElementById("prediction-result-panel").scrollIntoView({ behavior: 'smooth' });
        
        // Render Severity & Duration
        const sevVal = document.getElementById("res-severity-value");
        const sevBadge = document.getElementById("res-severity");
        const durationVal = document.getElementById("res-duration");
        
        sevVal.textContent = result.predicted_severity.toUpperCase();
        durationVal.textContent = `${result.predicted_duration_minutes} min`;
        
        // Severity styling
        sevBadge.className = "severity-badge-large"; // reset
        const severityLower = result.predicted_severity.toLowerCase();
        sevBadge.classList.add(severityLower);
        
        let scopeText = "Lane Merge / Advisory";
        if (severityLower === 'critical') scopeText = "Full Segment Closure";
        if (severityLower === 'high') scopeText = "Partial Detour / Diversion";
        if (severityLower === 'low') scopeText = "Ad-hoc Ground Monitoring";
        document.getElementById("res-scope").textContent = scopeText;
        
        // Populate Manpower Section
        document.getElementById("res-manpower-count").textContent = result.manpower.recommended_headcount;
        const distributionList = document.getElementById("res-manpower-distribution");
        distributionList.innerHTML = `
            <li><span>Core Site Management:</span> <span>${result.manpower.role_distribution.core_junction_control} officers</span></li>
            <li><span>Upstream Diversion Points:</span> <span>${result.manpower.role_distribution.upstream_diversion_guides} officers</span></li>
            <li><span>Mobile Patrol & Assist:</span> <span>${result.manpower.role_distribution.mobile_incident_patrols} officers</span></li>
            <li style="border-left-color: var(--secondary); background: rgba(0, 180, 216, 0.05);">
                <span>Jurisdiction:</span> <span>${result.manpower.police_station_in_charge} Station</span>
            </li>
        `;
        
        // Populate Barricading
        document.getElementById("res-barricades-count").textContent = result.barricading.recommended_count;
        document.getElementById("res-barricades-desc").textContent = result.barricading.setup_description;
        
        // Populate Diversion
        const divStatus = document.getElementById("res-diversion-status");
        if (result.diversion.required) {
            divStatus.className = "diversion-alert text-high";
            divStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Active Rerouting / Diversion protocol active`;
            document.getElementById("res-diversion-desc").textContent = result.diversion.description;
            
            const junctionContainer = document.getElementById("res-diversion-junctions");
            junctionContainer.innerHTML = "";
            result.diversion.recommended_junctions.forEach(junc => {
                const li = document.createElement("li");
                li.className = "junction-tag";
                li.innerHTML = `<i class="fa-solid fa-diamond-turn-right"></i> ${humanizeJunctionName(junc)}`;
                junctionContainer.appendChild(li);
            });
        } else {
            divStatus.className = "diversion-alert text-low";
            divStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> Standard traffic flow. No diversions required.`;
            document.getElementById("res-diversion-desc").textContent = "Traffic flows normal. Police monitoring suggested at junctions.";
            document.getElementById("res-diversion-junctions").innerHTML = "<li class='junction-tag'><i class='fa-solid fa-ban'></i> None</li>";
        }
        
        // Set simulation active and draw routes
        lastSimulationResult = result;
        simulationActive = true;
        drawSimulationRoutes();
        
        // Populate hidden feedback inputs
        document.getElementById("feed-event-id").value = result.event_id;
        document.getElementById("feed-event-cause").value = event_cause;
        document.getElementById("feed-pred-severity").value = result.predicted_severity;
        document.getElementById("feed-pred-duration").value = result.predicted_duration_minutes;
        document.getElementById("feed-rec-officers").value = result.manpower.recommended_headcount;
        document.getElementById("feed-rec-barricades").value = result.barricading.recommended_count;
        document.getElementById("feed-event-type").value = event_type;
        document.getElementById("feed-requires-road-closure").value = requires_road_closure;
        document.getElementById("feed-priority").value = priority;
        document.getElementById("feed-corridor").value = corridor;
        document.getElementById("feed-police-station").value = police_station;
        document.getElementById("feed-hour").value = hour;
        document.getElementById("feed-day-of-week").value = day_of_week;
        
        // Reset Feedback form fields
        document.getElementById("feed-actual-severity").value = result.predicted_severity;
        document.getElementById("feed-actual-duration").value = Math.round(result.predicted_duration_minutes);
        document.getElementById("feed-actual-officers").value = result.manpower.recommended_headcount;
        document.getElementById("feed-actual-barricades").value = result.barricading.recommended_count;
        
        showToast("Impact analysis generated successfully.");
        
    } catch (error) {
        console.error("Error generating predictive model:", error);
        showToast("Error running Machine Learning simulator", "error");
    }
}

function drawSimulationRoutes() {
    if (!lastSimulationResult || !simulationActive) return;
    
    // Clear old lines/diversion markers
    clearDiversions();
    
    const sourceLatLng = sourceMarker.getLatLng();
    const destLatLng = destMarker.getLatLng();
    
    const uLat = sourceLatLng.lat;
    const uLng = sourceLatLng.lng;
    const dLat = destLatLng.lat;
    const dLng = destLatLng.lng;
    
    // Bind / update popups on source and dest markers
    sourceMarker.bindPopup(`
        <div class="map-popup-title">Incident Source (Barricade Point)</div>
        <div class="map-popup-text">
            <strong>Deployment Count:</strong> ${lastSimulationResult.barricading.recommended_count} heavy barricades<br>
            <strong>Location:</strong> Start of Closed Segment<br>
            <strong>Details:</strong> ${lastSimulationResult.barricading.setup_description}
        </div>
    `);
    
    destMarker.bindPopup(`
        <div class="map-popup-title">Incident Destination (Reopen Point)</div>
        <div class="map-popup-text">
            <strong>Location:</strong> End of Closed Segment<br>
            <strong>Status:</strong> Normal traffic flow resumes past this node.
        </div>
    `);
    
    // Draw affected route (red line from Source to Destination)
    getOSRMRoute([[uLat, uLng], [dLat, dLng]]).then(coords => {
        const polylineAffected = L.polyline(coords, {
            color: '#ef4444',
            weight: 6,
            lineCap: 'round',
            lineJoin: 'round',
            opacity: 0.95
        }).addTo(plannerMap);
        polylineAffected.bindTooltip("Affected Route (Road Closed)", { sticky: true, className: "route-tooltip-affected" });
        diversionLines.push(polylineAffected);
    });
    
    // Draw Police Station Jurisdiction Boundary in background
    const selectedStation = document.getElementById("sim-police-station").value;
    if (meta && meta.station_polygons && meta.station_polygons[selectedStation]) {
        const polygonGeoJSON = meta.station_polygons[selectedStation];
        jurisdictionLayer = L.geoJSON(polygonGeoJSON, {
            style: {
                color: "#38A169",
                weight: 2,
                opacity: 0.45,
                fillColor: "#38A169",
                fillOpacity: 0.1,
                dashArray: "3, 6"
            }
        }).addTo(plannerMap);
        
        // Draw Station Centroid Marker
        const stationIcon = L.divIcon({
            html: `<div style="background: #38a169; width: 12px; height: 12px; border: 2px solid white; border-radius: 4px; box-shadow: 0 0 8px rgba(56, 189, 248, 0.5);"></div>`,
            className: 'custom-station-icon',
            iconSize: [12, 12]
        });
        stationMarker = L.marker([meta.station_coords[selectedStation].lat, meta.station_coords[selectedStation].lng], { icon: stationIcon }).addTo(plannerMap);
        stationMarker.bindPopup(`<strong>${selectedStation} Police Station Centroid</strong>`);
    } else if (meta && meta.station_coords && meta.station_coords[selectedStation]) {
        const sCoords = meta.station_coords[selectedStation];
        jurisdictionLayer = L.circle([sCoords.lat, sCoords.lng], {
            radius: 2200,
            color: "#38A169",
            fillColor: "#38A169",
            fillOpacity: 0.1,
            weight: 1.5,
            dashArray: "3, 6"
        }).addTo(plannerMap);
    }
    
    if (lastSimulationResult.diversion.required && lastSimulationResult.diversion.map_points.length > 0) {
        const firstDiv = lastSimulationResult.diversion.map_points[0];
        
        // Calculate detour waypoint: mid-point offset perpendicular to the closed segment
        const midLat = (uLat + dLat) / 2;
        const midLng = (uLng + dLng) / 2;
        const dx = dLat - uLat;
        const dy = dLng - uLng;
        const len = Math.sqrt(dx * dx + dy * dy);
        
        let detourLat = midLat;
        let detourLng = midLng;
        const detourOffset = 0.002; // ~200 meters offset
        
        if (len > 0) {
            // Perpendicular unit vector (rotated 90 degrees)
            const px = -dy / len;
            const py = dx / len;
            detourLat = midLat + px * detourOffset;
            detourLng = midLng + py * detourOffset;
        } else {
            detourLat = midLat + 0.0015;
            detourLng = midLng + 0.0015;
        }
        
        // Manpower Icon
        const manpowerIcon = L.divIcon({
            html: `
              <div class="tactical-pin manpower-pin">
                <div class="pin-icon-wrap">
                  <i class="fa-solid fa-shield-halved"></i>
                </div>
                <div class="pin-pulse"></div>
              </div>
            `,
            className: 'custom-tactical-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });
        
        // Draw Primary Diversion Route (Source -> Detour Waypoint -> firstDiv)
        getOSRMRoute([[uLat, uLng], [detourLat, detourLng], [firstDiv.lat, firstDiv.lng]]).then(coords => {
            const polylinePrimary = L.polyline(coords, {
                color: '#1a73e8', // thick blue line
                weight: 6,
                lineCap: 'round',
                lineJoin: 'round',
                opacity: 0.95
            }).addTo(plannerMap);
            polylinePrimary.bindTooltip("Primary Diversion Route", { sticky: true, className: "route-tooltip-primary" });
            diversionLines.push(polylinePrimary);
        });
        
        // Draw primary guide marker at the primary targeted junction
        const m1 = L.marker([firstDiv.lat, firstDiv.lng], { icon: manpowerIcon }).addTo(plannerMap);
        const off1 = Math.ceil(lastSimulationResult.manpower.recommended_headcount * 0.6);
        m1.bindPopup(`
            <div class="map-popup-title">Traffic Police Control Node</div>
            <div class="map-popup-text">
                <strong>Junction:</strong> ${humanizeJunctionName(firstDiv.name)}<br>
                <strong>Role:</strong> Primary Diversion Control Guide<br>
                <strong>Headcount:</strong> ${off1} Traffic Officers deployed
            </div>
        `);
        diversionMarkers.push(m1);
        
        // Draw Alternative Rerouting Path (Source -> opposite detour waypoint -> secondDiv)
        if (lastSimulationResult.diversion.map_points.length > 1) {
            const secondDiv = lastSimulationResult.diversion.map_points[1];
            
            // Use opposite side of perpendicular for alternative detour
            let altDetourLat = midLat;
            let altDetourLng = midLng;
            if (len > 0) {
                const px = -dy / len;
                const py = dx / len;
                altDetourLat = midLat - px * detourOffset;
                altDetourLng = midLng - py * detourOffset;
            } else {
                altDetourLat = midLat - 0.0015;
                altDetourLng = midLng - 0.0015;
            }
            
            getOSRMRoute([[uLat, uLng], [altDetourLat, altDetourLng], [secondDiv.lat, secondDiv.lng]]).then(coords => {
                const polylineAlt = L.polyline(coords, {
                    color: '#718096', // muted grey
                    weight: 5,
                    dashArray: '8, 8', // dashed
                    lineCap: 'round',
                    lineJoin: 'round',
                    opacity: 0.75
                }).addTo(plannerMap);
                polylineAlt.bindTooltip("Alternative Rerouting Path", { sticky: true, className: "route-tooltip-alt" });
                diversionLines.push(polylineAlt);
            });
            
            // Draw secondary guide marker at the alternative targeted junction
            const m2 = L.marker([secondDiv.lat, secondDiv.lng], { icon: manpowerIcon }).addTo(plannerMap);
            const off2 = Math.floor(lastSimulationResult.manpower.recommended_headcount * 0.4);
            m2.bindPopup(`
                <div class="map-popup-title">Traffic Police Control Node</div>
                <div class="map-popup-text">
                    <strong>Junction:</strong> ${humanizeJunctionName(secondDiv.name)}<br>
                    <strong>Role:</strong> Secondary Rerouting Patrol<br>
                    <strong>Headcount:</strong> ${off2} Traffic Officers deployed
                </div>
            `);
            diversionMarkers.push(m2);
        }
        
        // Adjust bounds to fit all
        setTimeout(() => {
            const group = new L.featureGroup([sourceMarker, destMarker, ...diversionMarkers]);
            plannerMap.fitBounds(group.getBounds().pad(0.2));
        }, 500);
    }
}

function clearDiversions() {
    diversionMarkers.forEach(m => plannerMap.removeLayer(m));
    diversionLines.forEach(l => plannerMap.removeLayer(l));
    diversionMarkers = [];
    diversionLines = [];
    
    if (jurisdictionLayer) {
        plannerMap.removeLayer(jurisdictionLayer);
        jurisdictionLayer = null;
    }
    if (stationMarker) {
        plannerMap.removeLayer(stationMarker);
        stationMarker = null;
    }
}

// 5. Submit feedback (Close event)
async function handleFeedbackSubmit(e) {
    e.preventDefault();
    
    const event_id = document.getElementById("feed-event-id").value;
    const event_cause = document.getElementById("feed-event-cause").value;
    const predicted_severity = document.getElementById("feed-pred-severity").value;
    const predicted_duration = parseFloat(document.getElementById("feed-pred-duration").value);
    const recommended_officers = parseInt(document.getElementById("feed-rec-officers").value);
    const recommended_barricades = parseInt(document.getElementById("feed-rec-barricades").value);
    
    const actual_severity = document.getElementById("feed-actual-severity").value;
    const actual_duration = parseFloat(document.getElementById("feed-actual-duration").value);
    const actual_officers = parseInt(document.getElementById("feed-actual-officers").value);
    const actual_barricades = parseInt(document.getElementById("feed-actual-barricades").value);
    const diversion_effective = document.getElementById("feed-diversion-effective").value;
    
    const event_type = document.getElementById("feed-event-type").value;
    const requires_road_closure = document.getElementById("feed-requires-road-closure").value === "true";
    const priority = document.getElementById("feed-priority").value;
    const corridor = document.getElementById("feed-corridor").value;
    const police_station = document.getElementById("feed-police-station").value;
    const hour = parseInt(document.getElementById("feed-hour").value);
    const day_of_week = parseInt(document.getElementById("feed-day-of-week").value);
    
    // Rating calculation from stars
    const ratingRadios = document.getElementsByName("feed-rating");
    let rating = 3;
    for (let r of ratingRadios) {
        if (r.checked) {
            rating = parseInt(r.value);
            break;
        }
    }
    
    const payload = {
        event_id, event_cause, predicted_severity, predicted_duration, recommended_officers, recommended_barricades,
        actual_severity, actual_duration, actual_officers, actual_barricades, diversion_effective, rating,
        event_type, requires_road_closure, priority, corridor, police_station, hour, day_of_week
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error("Feedback submission failed");
        
        showToast("Ground closure logged. Feedback loops updated!", "success");
        
        // Hide panel & clear marker
        document.getElementById("prediction-result-panel").style.display = "none";
        simulationActive = false;
        lastSimulationResult = null;
        clearDiversions();
        
        // Redirect tab to learning tab
        document.querySelector('[data-tab="learning"]').click();
        
    } catch (error) {
        console.error("Error submitting post-event feedback:", error);
        showToast("Failed to write to Post-Event database", "error");
    }
}

// 6. Tab 3: Post-Event Learning initialization
async function loadLearningTab() {
    try {
        const response = await fetch(`${API_BASE}/api/feedback/stats`);
        if (!response.ok) throw new Error("Could not fetch feedback statistics");
        const stats = await response.json();
        
        // Update stats banners
        document.getElementById("learn-kpi-total").textContent = stats.total_feedback_events;
        document.getElementById("learn-kpi-rating").textContent = `${stats.average_rating} / 5.0`;
        document.getElementById("learn-kpi-accuracy").textContent = `${stats.severity_prediction_accuracy}%`;
        document.getElementById("learn-kpi-savings").textContent = `${stats.manpower_savings_count} officers`;
        
        // Render table
        renderFeedbackLogTable();
        
        // Render Learning progression chart
        renderLearningProgressionChart(stats.learning_curve);
        
    } catch (error) {
        console.error("Error loading learning tab statistics:", error);
        showToast("Error retrieving learning loop outcomes", "error");
    }
}

async function renderFeedbackLogTable() {
    try {
        const response = await fetch(`${API_BASE}/api/feedback`);
        if (!response.ok) return;
        const list = await response.json();
        
        const tbody = document.querySelector("#feedback-log-table tbody");
        tbody.innerHTML = "";
        
        // Render in reverse chronological order
        const sortedList = [...list].reverse();
        
        sortedList.forEach(entry => {
            // Generate star rating string
            let stars = "";
            for (let i = 1; i <= 5; i++) {
                stars += `<i class="${i <= entry.rating ? 'fa-solid' : 'fa-regular'} fa-star table-star-rating"></i>`;
            }
            
            const isSevMatch = entry.predicted_severity === entry.actual_severity;
            const sevCompareClass = isSevMatch ? 'text-low' : 'text-critical';
            
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${entry.event_id}</strong></td>
                <td>${entry.event_cause.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                <td><span class="badge-${entry.predicted_severity.toLowerCase()}">${entry.predicted_severity}</span></td>
                <td><span class="badge-${entry.actual_severity.toLowerCase()} ${sevCompareClass}">${entry.actual_severity}</span></td>
                <td>${entry.predicted_duration}m / ${entry.actual_duration}m</td>
                <td>${entry.recommended_officers} / ${entry.actual_officers}</td>
                <td>${entry.recommended_barricades} / ${entry.actual_barricades}</td>
                <td><div style="white-space: nowrap;">${stars}</div></td>
                <td>
                    <span class="${entry.diversion_effective === 'yes' ? 'table-badge-effective' : 'table-badge-ineffective'}">
                        ${entry.diversion_effective.toUpperCase()}
                    </span>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error("Error rendering feedback log table:", error);
    }
}

function renderLearningProgressionChart(learningCurve) {
    const ctx = document.getElementById('chart-learning-curve').getContext('2d');
    
    if (chartLearningCurve) chartLearningCurve.destroy();
    
    const labels = learningCurve.map(pt => `${pt.event_count} Events`);
    const accuracies = learningCurve.map(pt => pt.accuracy);
    const maes = learningCurve.map(pt => pt.mae);
    
    chartLearningCurve = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Severity Predictor Accuracy (%)',
                    data: accuracies,
                    borderColor: '#06d6a0',
                    backgroundColor: 'rgba(6, 214, 160, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Duration MAE Error (min)',
                    data: maes,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#9ca3af', font: { family: 'Outfit' } } },
                tooltip: { backgroundColor: '#111318' }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#9ca3af' },
                    min: 0,
                    max: 100
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#9ca3af' },
                    min: 0
                }
            }
        }
    });
}

function humanizeJunctionName(name) {
    if (!name) return "";
    
    // Add space before capital letters (camelCase splitting)
    let formatted = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Add space around parentheses
    formatted = formatted.replace(/\s*\(\s*/g, ' (').replace(/\s*\)\s*/g, ') ');
    
    // Replace Junc/Junction with "Junction" cleanly
    formatted = formatted.replace(/Junc\b/g, 'Junction');
    formatted = formatted.replace(/Junctions\b/g, 'Junction');
    
    // Remove duplicate words like "Junction Junction" or fix spacing
    formatted = formatted.replace(/\s+/g, ' ').trim();
    
    return formatted;
}

function generateCurvedPath(lat1, lng1, lat2, lng2) {
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    
    const dx = lat2 - lat1;
    const dy = lng2 - lng1;
    const offsetFactor = 0.15; // curve strength
    const offsetLat = midLat - dy * offsetFactor;
    const offsetLng = midLng + dx * offsetFactor;
    
    // Generate quadratic bezier path (15 steps)
    const points = [];
    for (let t = 0; t <= 1; t += 0.08) {
        const l = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * offsetLat + t * t * lat2;
        const g = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * offsetLng + t * t * lng2;
        points.push([l, g]);
    }
    points.push([lat2, lng2]);
    return points;
}

async function getOSRMRoute(points) {
    try {
        const coordString = points.map(p => `${p[1]},${p[0]}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?geometries=geojson`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("OSRM status not OK");
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        }
    } catch (e) {
        console.error("OSRM routing API error, falling back to curved path:", e);
    }
    // Fallback: concatenate curved paths for consecutive legs
    let fallbackPath = [];
    for (let i = 0; i < points.length - 1; i++) {
        const leg = generateCurvedPath(points[i][0], points[i][1], points[i+1][0], points[i+1][1]);
        fallbackPath = fallbackPath.concat(leg);
    }
    return fallbackPath;
}
