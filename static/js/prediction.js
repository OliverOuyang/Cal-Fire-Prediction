/**
 * Fire Prediction Model functionality
 */
document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentLocation = "Unknown location";
    
    // DOM elements
    const predictionForm = document.getElementById('prediction-form');
    const locationInput = document.getElementById('location-input');
    const useMyLocationBtn = document.getElementById('use-my-location');
    const fetchWeatherBtn = document.getElementById('fetch-weather');
    const manualEntryBtn = document.getElementById('manual-entry');
    const modelResult = document.getElementById('model-result');
    const modelProbability = document.getElementById('model-probability');
    const loadingIndicator = document.getElementById('loading');
    const analysisContent = document.getElementById('analysis-content');
    const riskAssessment = document.getElementById('risk-assessment');
    const contributingFactors = document.getElementById('contributing-factors');
    const recommendedActions = document.getElementById('recommended-actions');
    
    // Form fields (for validation and accessing values)
    const formFields = {
        max_temp_c: document.getElementById('max_temp_c'),
        min_temp_c: document.getElementById('min_temp_c'),
        avg_temp_c: document.getElementById('avg_temp_c'),
        heating_deg_days_c: document.getElementById('heating_deg_days_c'),
        cooling_deg_days_c: document.getElementById('cooling_deg_days_c'),
        precip_mm: document.getElementById('precip_mm'),
        avg_humidity: document.getElementById('avg_humidity'),
        avg_wind_speed_knots: document.getElementById('avg_wind_speed_knots'),
        avg_dew_point_f: document.getElementById('avg_dew_point_f'),
        avg_visibility_km: document.getElementById('avg_visibility_km'),
        avg_sea_level_pressure_mb: document.getElementById('avg_sea_level_pressure_mb')
    };
    
    // Event handlers
    useMyLocationBtn.addEventListener('click', getUserLocation);
    fetchWeatherBtn.addEventListener('click', fetchWeatherData);
    manualEntryBtn.addEventListener('click', clearFormFields);
    predictionForm.addEventListener('submit', handlePredictionSubmit);
    
    // Add event handler for date filter
    const dateSelector = document.getElementById('date-selector');
    const applyDateBtn = document.getElementById('apply-date-filter');
    if (applyDateBtn) {
        applyDateBtn.addEventListener('click', function() {
            fetchWeatherData();
        });
    }
    
    // Location search button
    document.getElementById('search-location').addEventListener('click', function() {
        const location = locationInput.value.trim();
        if (location) {
            currentLocation = location;
            // In a real app, this would geocode the location
            alert(`Location set to: ${location}`);
        }
    });
    
    // Get user's geolocation
    function getUserLocation() {
        if (navigator.geolocation) {
            useMyLocationBtn.disabled = true;
            useMyLocationBtn.innerHTML = '<i class="bi bi-cursor"></i> Getting location...';
            
            navigator.geolocation.getCurrentPosition(
                // Success
                function(position) {
                    const lat = position.coords.latitude.toFixed(6);
                    const lon = position.coords.longitude.toFixed(6);
                    currentLocation = `${lat},${lon}`;
                    locationInput.value = currentLocation;
                    
                    useMyLocationBtn.disabled = false;
                    useMyLocationBtn.innerHTML = '<i class="bi bi-cursor"></i> Use My Location';
                    
                    // Fetch weather data automatically after getting location
                    fetchWeatherData();
                },
                // Error
                function(error) {
                    console.error("Error getting location:", error);
                    let errorMessage = "Unable to retrieve your location. ";
                    
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += "User denied the request for geolocation.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += "Location information is unavailable.";
                            break;
                        case error.TIMEOUT:
                            errorMessage += "The request to get user location timed out.";
                            break;
                        case error.UNKNOWN_ERROR:
                            errorMessage += "An unknown error occurred.";
                            break;
                    }
                    
                    alert(errorMessage);
                    useMyLocationBtn.disabled = false;
                    useMyLocationBtn.innerHTML = '<i class="bi bi-cursor"></i> Use My Location';
                },
                // Options
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            alert("Geolocation is not supported by your browser. Please enter your location manually.");
        }
    }
    
    // Fetch weather data for the current location
    function fetchWeatherData() {
        const location = locationInput.value.trim() || currentLocation;
        
        if (!location) {
            alert('Please set a location first');
            return;
        }
        
        // Get the selected date (if any)
        const dateSelector = document.getElementById('date-selector');
        const selectedDate = dateSelector ? dateSelector.value : '';
        
        // Show loading state
        fetchWeatherBtn.disabled = true;
        fetchWeatherBtn.innerHTML = '<i class="bi bi-cloud-download"></i> Loading...';
        
        // Build API URL with query parameters
        let apiUrl = `/api/weather?location=${encodeURIComponent(location)}`;
        if (selectedDate) {
            apiUrl += `&date=${encodeURIComponent(selectedDate)}`;
        }
        
        // Call the weather API
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                return response.json();
            })
            .then(weatherData => {
                // Populate the form fields with real data
                for (const [key, value] of Object.entries(weatherData)) {
                    if (formFields[key] && key !== 'date') {
                        formFields[key].value = value;
                    }
                }
                
                // Display date information if available
                if (weatherData.date && dateSelector) {
                    dateSelector.value = weatherData.date;
                }
                
                // Reset button state
                fetchWeatherBtn.disabled = false;
                fetchWeatherBtn.innerHTML = '<i class="bi bi-cloud-download"></i> Auto-fetch Weather';
            })
            .catch(error => {
                console.error("Weather API Error:", error);
                alert(`Error fetching weather data: ${error.message}`);
                
                // Reset button state
                fetchWeatherBtn.disabled = false;
                fetchWeatherBtn.innerHTML = '<i class="bi bi-cloud-download"></i> Auto-fetch Weather';
            });
    }
    
    // Clear all form fields
    function clearFormFields() {
        for (const field of Object.values(formFields)) {
            field.value = '';
        }
    }
    
    // Handle form submission
    async function handlePredictionSubmit(e) {
        e.preventDefault();
        
        // Validate all fields have values
        let isValid = true;
        let formData = {};
        
        for (const [key, field] of Object.entries(formFields)) {
            if (!field.value) {
                isValid = false;
                field.classList.add('is-invalid');
            } else {
                field.classList.remove('is-invalid');
                formData[key] = parseFloat(field.value);
            }
        }
        
        if (!isValid) {
            alert('Please fill in all required fields.');
            return;
        }
        
        // Add location to the form data
        formData.location = currentLocation;
        
        try {
            // Call the prediction API
            const predictionResponse = await callPredictionAPI(formData);
            
            // Show the result
            modelResult.classList.remove('d-none');
            const probability = Math.round(predictionResponse.fire_probability * 100);
            modelProbability.textContent = `${probability}%`;
            
            // Update gauge graphic
            const gaugeRing = modelResult.querySelector('.gauge-ring');
            gaugeRing.style.background = `conic-gradient(#dc3545 0% ${probability}%, #e9ecef ${probability}% 100%)`;
            
            // Call the AI analysis API with the prediction result and weather data
            getAIAnalysis(predictionResponse.fire_probability, formData, predictionResponse.location);
            
        } catch (error) {
            console.error("Error in prediction:", error);
            alert("Error submitting prediction. Please try again.");
        }
    }
    
    // Call the prediction API
    async function callPredictionAPI(formData) {
        try {
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    }
    
    // Get AI analysis for the prediction result
    async function getAIAnalysis(probability, weatherData, location) {
        try {
            // Show loading indicator
            loadingIndicator.classList.remove('d-none');
            analysisContent.classList.add('d-none');
            
            const analysisRequest = {
                fire_probability: probability,
                weather_data: weatherData,
                location: location
            };
            
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(analysisRequest)
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const analysisData = await response.json();
            
            // Update the UI with the analysis
            riskAssessment.innerHTML = analysisData.risk_assessment;
            
            // Clear and re-populate contributing factors
            contributingFactors.innerHTML = '';
            analysisData.contributing_factors.forEach(factor => {
                const li = document.createElement('li');
                li.textContent = factor;
                contributingFactors.appendChild(li);
            });
            
            recommendedActions.innerHTML = analysisData.recommended_actions;
            
            // Hide loading, show content
            loadingIndicator.classList.add('d-none');
            analysisContent.classList.remove('d-none');
            
        } catch (error) {
            console.error("AI Analysis Error:", error);
            alert("Error generating AI analysis. Please try again.");
            loadingIndicator.classList.add('d-none');
            analysisContent.classList.remove('d-none');
        }
    }
    
    // Initialize with default date
    document.getElementById('date-selector').valueAsDate = new Date();
}); 