// AstraFlow Dashboard Javascript

// Global Variables
let analyticsMap = null;
let plannerMap = null;
let simulatorMarker = null;
let diversionMarkers = [];
let diversionLines = [];

let chartCauses = null;
let chartHours = null;
let chartStations = null;
let chartCorridors = null;
let chartLearningCurve = null;

// API Base URL: Auto-detects local vs production Render backend
const RENDER_BACKEND_URL = "https://YOUR-RENDER-APP-NAME.onrender.com"; // <-- REPLACE WITH YOUR RENDER URL
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
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
async function loadMetaDropdowns() {
    try {
        const response = await fetch(`${API_BASE}/api/meta`);
        if (!response.ok) throw new Error("Could not fetch metadata");
        const meta = await response.json();
        
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
        stationSelect.addEventListener("change", async () => {
            const station = stationSelect.value;
            // Get coordinates from static station file if possible
            const coordsResponse = await fetch(`${API_BASE}/api/meta`);
            const metaData = await coordsResponse.json();
            // Fetch center coordinate of the police station
            const responseStats = await fetch(`${API_BASE}/api/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_type: "unplanned",
                    event_cause: "others",
                    requires_road_closure: false,
                    priority: "Low",
                    corridor: "Non-corridor",
                    police_station: station,
                    latitude: 12.9716,
                    longitude: 77.5946,
                    hour: 12,
                    day_of_week: 1
                })
            });
            // We can resolve coordinates by placing a test call or load directly.
            // Let's call the station mapping directly from models backend.
        });
        
    } catch (error) {
        console.error("Error loading metadata dropdowns:", error);
        showToast("Error loading incident configuration parameters", "error");
    }
}

// 3. Tab 1: Historical Analytics initialization
async function initAnalyticsTab() {
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
        showToast("Error retrieving historical analytics records", "error");
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
            plannerMap = L.map('planner-map').setView([12.9716, 77.5946], 12);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 20
            }).addTo(plannerMap);
            
            // Map click listener to set coordinates
            plannerMap.on('click', (e) => {
                const { lat, lng } = e.latlng;
                setSimulationLocation(lat, lng);
            });
            
            // Add default marker
            setSimulationLocation(12.9716, 77.5946);
        } else {
            plannerMap.invalidateSize();
        }
    }, 100);
}

// Place pin on simulation map
function setSimulationLocation(lat, lng) {
    document.getElementById("sim-latitude").value = lat.toFixed(6);
    document.getElementById("sim-longitude").value = lng.toFixed(6);
    document.getElementById("simulator-coordinates").textContent = `Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    
    if (simulatorMarker) {
        simulatorMarker.setLatLng([lat, lng]);
    } else {
        simulatorMarker = L.marker([lat, lng], {
            draggable: true
        }).addTo(plannerMap);
        
        simulatorMarker.on('dragend', () => {
            const pos = simulatorMarker.getLatLng();
            setSimulationLocation(pos.lat, pos.lng);
        });
    }
    plannerMap.panTo([lat, lng]);
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
                li.innerHTML = `<i class="fa-solid fa-diamond-turn-right"></i> ${junc}`;
                junctionContainer.appendChild(li);
            });
        } else {
            divStatus.className = "diversion-alert text-low";
            divStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> Standard traffic flow. No diversions required.`;
            document.getElementById("res-diversion-desc").textContent = "Traffic flows normal. Police monitoring suggested at junctions.";
            document.getElementById("res-diversion-junctions").innerHTML = "<li class='junction-tag'><i class='fa-solid fa-ban'></i> None</li>";
        }
        
        // Update Simulator Map with Diversion Points
        clearDiversions();
        
        if (result.diversion.required && result.diversion.map_points.length > 0) {
            result.diversion.map_points.forEach(divPt => {
                // Create orange marker for diversion points
                const divIcon = L.divIcon({
                    html: `<div style="background: var(--severity-high); width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
                    className: 'custom-div-icon',
                    iconSize: [14, 14]
                });
                
                const marker = L.marker([divPt.lat, divPt.lng], { icon: divIcon }).addTo(plannerMap);
                marker.bindPopup(`<strong>${divPt.name}</strong><br>${divPt.role}`);
                diversionMarkers.push(marker);
                
                // Draw connecting dashed line
                const polyline = L.polyline([[latitude, longitude], [divPt.lat, divPt.lng]], {
                    color: '#f77f00',
                    weight: 2,
                    dashArray: '5, 8',
                    opacity: 0.8
                }).addTo(plannerMap);
                diversionLines.push(polyline);
            });
            
            // Adjust bounds to fit all
            const group = new L.featureGroup([simulatorMarker, ...diversionMarkers]);
            plannerMap.fitBounds(group.getBounds().pad(0.2));
        }
        
        // Populate hidden feedback inputs
        document.getElementById("feed-event-id").value = result.event_id;
        document.getElementById("feed-event-cause").value = event_cause;
        document.getElementById("feed-pred-severity").value = result.predicted_severity;
        document.getElementById("feed-pred-duration").value = result.predicted_duration_minutes;
        document.getElementById("feed-rec-officers").value = result.manpower.recommended_headcount;
        document.getElementById("feed-rec-barricades").value = result.barricading.recommended_count;
        
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

function clearDiversions() {
    diversionMarkers.forEach(m => plannerMap.removeLayer(m));
    diversionLines.forEach(l => plannerMap.removeLayer(l));
    diversionMarkers = [];
    diversionLines = [];
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
        actual_severity, actual_duration, actual_officers, actual_barricades, diversion_effective, rating
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
        const response = await fetch(`${API_BASE}/api/feedback/stats`);
        const stats = await fetch(`${API_BASE}/feedback.json`); // load full list of entries
        if (!stats.ok) return;
        const list = await stats.json();
        
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
