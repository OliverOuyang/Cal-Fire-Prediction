/**
 * California Fire Map functionality with GeoJSON data
 */
document.addEventListener('DOMContentLoaded', function() {
    // Main variables
    let fireData = null;
    let ecoregionData = null;
    let map = null;
    let counties = new Set();
    let ecoregions = new Set();
    let fireLayerGroup = L.layerGroup();
    let ecoregionLayerGroup = L.layerGroup();
    let lastFiveYears = [];
    let countyBounds = {}; // Store county boundaries for zoom feature
    
    // County name mapping from codes to full names
    const countyNameMapping = {
        'ALA': 'Alameda',
        'ALP': 'Alpine',
        'AMA': 'Amador',
        'BUT': 'Butte',
        'CAL': 'Calaveras',
        'CC': 'Contra Costa',
        'COL': 'Colusa',
        'DN': 'Del Norte',
        'ELD': 'El Dorado',
        'FRE': 'Fresno',
        'GLE': 'Glenn',
        'HUM': 'Humboldt',
        'IMP': 'Imperial',
        'INY': 'Inyo',
        'KRN': 'Kern',
        'KNG': 'Kings',
        'LAK': 'Lake',
        'LAS': 'Lassen',
        'LA': 'Los Angeles',
        'MAD': 'Madera',
        'MRN': 'Marin',
        'MPA': 'Mariposa',
        'MEN': 'Mendocino',
        'MER': 'Merced',
        'MOD': 'Modoc',
        'MNO': 'Mono',
        'MTY': 'Monterey',
        'NAP': 'Napa',
        'NEV': 'Nevada',
        'ORA': 'Orange',
        'PLA': 'Placer',
        'PLU': 'Plumas',
        'RIV': 'Riverside',
        'SAC': 'Sacramento',
        'SBN': 'San Benito',
        'SBD': 'San Bernardino',
        'SD': 'San Diego',
        'SF': 'San Francisco',
        'SJ': 'San Joaquin',
        'SLO': 'San Luis Obispo',
        'SM': 'San Mateo',
        'SB': 'Santa Barbara',
        'SCL': 'Santa Clara',
        'SCR': 'Santa Cruz',
        'SHA': 'Shasta',
        'SIE': 'Sierra',
        'SIS': 'Siskiyou',
        'SOL': 'Solano',
        'SON': 'Sonoma',
        'STA': 'Stanislaus',
        'SUT': 'Sutter',
        'TEH': 'Tehama',
        'TRI': 'Trinity',
        'TUL': 'Tulare',
        'TUO': 'Tuolumne',
        'VEN': 'Ventura',
        'YOL': 'Yolo',
        'YUB': 'Yuba',
        // Add any other county codes that might be in your data
    };
    
    // Initialize the map centered on California
    function initMap() {
        map = L.map('map').setView([37.8, -122.0], 6);
    
    // Add the base tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
        // Add empty layer groups to the map
        fireLayerGroup.addTo(map);
        ecoregionLayerGroup.addTo(map);
    }
    
    // Set default date range (last 5 years)
    function setupDefaultDateRange() {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 4; // last 5 years
        
        // Store the last five years
        for (let year = startYear; year <= currentYear; year++) {
            lastFiveYears.push(year);
        }
        
        // Set default start date to January 1st five years ago
        const startDate = document.getElementById('start-date');
        startDate.value = `${startYear}-01-01`;
        
        console.log(`Setting default date range: ${startYear} to ${currentYear}`);
    }
    
    // Fetch GeoJSON data
    async function fetchGeoJSONData() {
        try {
            // Show loading state
            document.getElementById('map-loading').classList.remove('d-none');
            
            // Load ecoregion data
            const ecoResponse = await fetch('/static/data/ecoregions_fixed.geojson');
            if (!ecoResponse.ok) throw new Error('Failed to fetch ecoregion data');
            ecoregionData = await ecoResponse.json();
            
            // Extract ecoregions
            const tempEcoregions = new Set();
            ecoregionData.features.forEach(feature => {
                if (feature.properties && feature.properties.ECOREGION_SECTION) {
                    tempEcoregions.add(feature.properties.ECOREGION_SECTION);
                }
            });
            
            // Sort ecoregion names
            ecoregions = Array.from(tempEcoregions).sort();
            populateEcoregionDropdown();
            
            // Load fire data
            const fireResponse = await fetch('/static/data/fires_optimized.geojson');
            if (!fireResponse.ok) throw new Error('Failed to fetch fire data');
            fireData = await fireResponse.json();
            
            // Extract counties and store their boundaries
            const tempCounties = new Set();
            
            fireData.features.forEach(feature => {
                if (feature.properties && feature.properties.UNIT_ID) {
                    const county = feature.properties.UNIT_ID;
                    tempCounties.add(county);
                    
                    // Store bounds for each county
                    if (!countyBounds[county] && feature.geometry) {
                        try {
                            // Create temporary layer to calculate bounds
                            const tempLayer = L.geoJSON(feature.geometry);
                            const bounds = tempLayer.getBounds();
                            
                            // Initialize or extend county bounds
                            if (!countyBounds[county]) {
                                countyBounds[county] = bounds;
                            } else {
                                countyBounds[county].extend(bounds);
                            }
                        } catch (e) {
                            console.warn(`Could not calculate bounds for county ${county}:`, e);
                        }
                    }
                }
            });
            
            // Sort county names
            counties = Array.from(tempCounties).sort();
            console.log("Extracted counties from data:", counties.slice(0, 10));
            console.log("County code example:", counties.length > 0 ? counties[0] : 'No counties found');
            populateCountyDropdown();
            
            // Hide loading state
            document.getElementById('map-loading').classList.add('d-none');
            
            // Update data status
            document.getElementById('data-status').textContent = 'Showing last 5 years data';
            
            // Display data based on current filters
            displayFireData();
            displayEcoregionData();
        } catch (error) {
            console.error('Error fetching GeoJSON data:', error);
            document.getElementById('map-loading').classList.add('d-none');
            alert('Failed to load map data. Please try again later.');
        }
    }
    
    // Populate county dropdown
    function populateCountyDropdown() {
        const countySelect = document.getElementById('county-select');
        
        // Clear existing options
        countySelect.innerHTML = '';
        
        // Add "All Counties" option
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'All Counties';
        countySelect.appendChild(allOption);
        
        // Debug county values
        console.log("Counties array:", counties);
        console.log("County mapping sample:", Object.keys(countyNameMapping).slice(0, 5));
        
        // Add each county as an option
        counties.forEach(county => {
            const option = document.createElement('option');
            option.value = county;
            
            // Try to find the mapping in various forms (case-insensitive)
            let mappedName = null;
            if (countyNameMapping[county]) {
                // Direct match
                mappedName = countyNameMapping[county];
            } else if (county && countyNameMapping[county.toUpperCase()]) {
                // Try uppercase version
                mappedName = countyNameMapping[county.toUpperCase()];
            } else if (county && countyNameMapping[county.toLowerCase()]) {
                // Try lowercase version
                mappedName = countyNameMapping[county.toLowerCase()];
            }
            
            // Use mapped name or fallback to code
            option.textContent = mappedName || county;
            
            // Debug for this specific county if mapping is missing
            if (!mappedName) {
                console.log(`No mapping found for county code: "${county}"`);
            }
            
            countySelect.appendChild(option);
        });
    }
    
    // Populate ecoregion dropdown
    function populateEcoregionDropdown() {
        const ecoregionSelect = document.getElementById('ecoregion-select');
        
        // Clear existing options
        ecoregionSelect.innerHTML = '';
        
        // Add "All Ecoregions" option
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'All Ecoregions';
        ecoregionSelect.appendChild(allOption);
        
        // Add each ecoregion as an option
        ecoregions.forEach(ecoregion => {
            const option = document.createElement('option');
            option.value = ecoregion;
            option.textContent = ecoregion;
            ecoregionSelect.appendChild(option);
        });
    }
    
    // Zoom to county
    function zoomToCounty(county) {
        if (county === 'all') {
            // Zoom out to show all of California
            map.setView([37.8, -122.0], 6);
            return;
        }
        
        if (countyBounds[county]) {
            // Zoom to county bounds with some padding
            map.fitBounds(countyBounds[county], {
                padding: [50, 50],
                maxZoom: 10
            });
            console.log(`Zoomed to county: ${county}`);
        } else {
            console.warn(`No bounds found for county: ${county}`);
        }
    }
    
    // Load all historical data regardless of year filter
    function loadAllData(callback) {
        console.log("Loading all historical fire data...");
        
        // Since data is already loaded, we just need to update the display state
        // and make sure the 5-year filter is not applied
        
        // Reset the shouldApplyYearFilter logic in displayFireData
        // This is handled by the status being "Showing all historical data"
        
        // If callback is provided, execute it
        if (typeof callback === 'function') {
            callback();
        }
    }
    
    // Display fire data on the map
    function displayFireData() {
        if (!fireData) return;
        
        // Clear previous fire layers
        fireLayerGroup.clearLayers();
        
        // Get filter values
        const selectedCounty = document.getElementById('county-select').value;
        const displayType = document.getElementById('display-type').value;
        const startDateVal = document.getElementById('start-date').value;
        const endDateVal = document.getElementById('end-date').value;
        
        // Parse dates if provided
        let startDateObj = null;
        let endDateObj = null;
        
        if (startDateVal) {
            startDateObj = new Date(startDateVal);
        }
        
        if (endDateVal) {
            endDateObj = new Date(endDateVal);
            // Set to the end of the day
            endDateObj.setHours(23, 59, 59, 999);
        }
        
        console.log(`Filtering fires: County=${selectedCounty}, Start=${startDateVal}, End=${endDateVal}`);
        
        // Check if the function is called from the Apply Filters button
        const applyFiltersClicked = document.activeElement && document.activeElement.id === 'apply-filters';
        
        // Apply the 5-year filter only if no county is selected, no specific dates are set, and not clicked Apply Filters
        const shouldApplyYearFilter = selectedCounty === 'all' && !(applyFiltersClicked && (startDateVal !== '' || endDateVal !== ''));
        
        // Filter features
        const filteredFeatures = fireData.features.filter(feature => {
            // Skip features without properties
            if (!feature.properties) return false;
            
            const props = feature.properties;
            
            // Apply the 5-year filter if needed (only when no county is selected)
            if (shouldApplyYearFilter && props.YEAR_ && !lastFiveYears.includes(props.YEAR_)) {
                return false;
            }
            
            // Filter by county if a specific one is selected
            if (selectedCounty !== 'all' && props.UNIT_ID !== selectedCounty) {
                return false;
            }
            
            // Filter by date if provided
            if (startDateObj || endDateObj) {
                let featureDate = null;
                
                // Try to parse date from ALARM_DATE
                if (props.ALARM_DATE) {
                    try {
                        featureDate = new Date(props.ALARM_DATE);
                    } catch (e) {
                        console.warn("Could not parse date:", props.ALARM_DATE);
                    }
                }
                
                // If no date or invalid date, try using year
                if (!featureDate && props.YEAR_) {
                    try {
                        featureDate = new Date(props.YEAR_, 0, 1); // Set to January 1st of that year
                    } catch (e) {
                        console.warn("Could not use year as date:", props.YEAR_);
                    }
                }
                
                // Skip if no valid date
                if (!featureDate) return false;
                
                // Apply date filters
                if (startDateObj && featureDate < startDateObj) return false;
                if (endDateObj && featureDate > endDateObj) return false;
            }
            
            return true;
        });
        
        console.log(`Filtered to ${filteredFeatures.length} features`);
        
        // Update data status message based on filter state
        if (selectedCounty !== 'all') {
            document.getElementById('data-status').textContent = 'Showing all historical data for selected county';
        } else if (!shouldApplyYearFilter) {
            document.getElementById('data-status').textContent = 'Showing all historical data with date filter';
        } else {
            document.getElementById('data-status').textContent = 'Showing last 5 years data';
        }
        
        // If no features match the filters, show a message
        if (filteredFeatures.length === 0) {
            const centerLatLng = map.getCenter();
            const noDataMarker = L.marker(centerLatLng)
                .bindPopup("<strong>No fire data matches your filters</strong>")
                .addTo(fireLayerGroup);
            noDataMarker.openPopup();
            return;
        }
        
        // Update feature count display
        document.getElementById('feature-count').textContent = filteredFeatures.length;
        
        // Add filtered features to the map
        filteredFeatures.forEach(feature => {
            // Skip features without geometry
            if (!feature.geometry || !feature.geometry.coordinates) return;
            
            try {
                // Create polygon and add to layer group
                const polygon = L.geoJSON(feature, {
                    style: {
                        color: '#FF5500',
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.4
                    }
                }).bindPopup(createFirePopup(feature));
                
                fireLayerGroup.addLayer(polygon);
            } catch (e) {
                console.error("Error adding feature to map:", e);
            }
        });
    }
    
    // Display ecoregion data on the map
    function displayEcoregionData() {
        if (!ecoregionData) return;
        
        console.log("Starting to display ecoregion data...");
        
        // Clear previous ecoregion layers
        ecoregionLayerGroup.clearLayers();
        
        // Get filter values
        const selectedEcoregion = document.getElementById('ecoregion-select').value;
        const displayType = document.getElementById('display-type').value;
        
        // Only show ecoregions on specific display types
        if (displayType !== 'ecoregions' && displayType !== 'all') {
            console.log("Display type not set to show ecoregions, skipping");
            return;
        }
        
        console.log(`Filtering ecoregions: Selected=${selectedEcoregion}, Total=${ecoregionData.features.length}`);
        
        // Filter features
        const filteredFeatures = ecoregionData.features.filter(feature => {
            // Skip features without properties
            if (!feature.properties) return false;
            
            // Filter by ecoregion if a specific one is selected
            if (selectedEcoregion !== 'all' && 
                feature.properties.ECOREGION_SECTION !== selectedEcoregion) {
                return false;
            }
            
            return true;
        });
        
        console.log(`Filtered to ${filteredFeatures.length} ecoregion features`);
        
        // If no features match the filters, show a message
        if (filteredFeatures.length === 0) {
            const centerLatLng = map.getCenter();
            const noDataMarker = L.marker(centerLatLng)
                .bindPopup("<strong>No ecoregion data matches your filters</strong>")
                .addTo(ecoregionLayerGroup);
            noDataMarker.openPopup();
            return;
        }
        
        // Track successfully added features
        let successCount = 0;
        
        // Add filtered features to the map
        filteredFeatures.forEach((feature, index) => {
            try {
                // Skip features without geometry
                if (!feature.geometry || !feature.geometry.coordinates) {
                    console.warn(`Ecoregion feature ${index} missing geometry`);
                    return;
                }
                
                // Create style object with different colors for each ecoregion
                const colors = [
                    '#3388FF', '#33CC55', '#FF6666', '#CC3333', '#FF9900', 
                    '#9966CC', '#CC6633', '#0099CC', '#FFCC33', '#9933CC'
                ];
                const colorIndex = index % colors.length;
                
                // Create style options
                const style = {
                    color: colors[colorIndex],
                    weight: 1,
                    opacity: 0.8,
                    fillOpacity: 0.4
                };
                
                // Add GeoJSON feature to map
                const geoLayer = L.geoJSON(feature, {
                    style: style,
                    onEachFeature: function(feature, layer) {
                        layer.bindPopup(createEcoregionPopup(feature));
                    }
                });
                
                ecoregionLayerGroup.addLayer(geoLayer);
                successCount++;
            } catch (e) {
                console.error(`Error adding ecoregion feature ${index} to map:`, e);
            }
        });
        
        console.log(`Successfully added ${successCount} out of ${filteredFeatures.length} ecoregion features`);
    }
    
    // Create popup content for fire feature
    function createFirePopup(feature) {
        if (!feature || !feature.properties) {
            return "<div class='feature-popup'><p>No data available</p></div>";
        }
        
        const props = feature.properties;
        let content = `<div class="feature-popup">`;
        
        // Add fire name if available
        if (props.FIRE_NAME) {
            content += `<h5>${props.FIRE_NAME} Fire</h5>`;
        } else {
            content += `<h5>Fire Event</h5>`;
        }
        
        // Add other properties
        if (props.YEAR_) content += `<p><strong>Year:</strong> ${props.YEAR_}</p>`;
        
        if (props.ALARM_DATE) {
            try {
                const date = new Date(props.ALARM_DATE);
                content += `<p><strong>Date:</strong> ${date.toLocaleDateString()}</p>`;
            } catch (e) {
                content += `<p><strong>Date:</strong> ${props.ALARM_DATE}</p>`;
            }
        }
        
        if (props.UNIT_ID) content += `<p><strong>County:</strong> ${props.UNIT_ID}</p>`;
        
        if (props.CAUSE) {
            const causes = {
                1: "Lightning",
                2: "Equipment Use", 
                3: "Smoking",
                4: "Campfire",
                5: "Debris Burning",
                6: "Railroad",
                7: "Arson",
                8: "Playing with Fire",
                9: "Miscellaneous",
                10: "Vehicle",
                11: "Power Line",
                12: "Firefighter Training",
                13: "Non-Firefighter Training",
                14: "Unknown",
                15: "Structure",
                16: "Aircraft",
                17: "Volcanic",
                18: "Escaped Prescribed Burn",
                19: "Illegal Burn"
            };
            
            const causeText = causes[props.CAUSE] || `Unknown (${props.CAUSE})`;
            content += `<p><strong>Cause:</strong> ${causeText}</p>`;
        }
        
        content += `</div>`;
        return content;
    }
    
    // Create popup content for ecoregion feature
    function createEcoregionPopup(feature) {
        if (!feature || !feature.properties) {
            return "<div class='feature-popup'><p>No data available</p></div>";
        }
        
        const props = feature.properties;
        let content = `<div class="feature-popup">`;
        
        // Add ecoregion name if available
        if (props.ECOREGION_SECTION) {
            content += `<h5>${props.ECOREGION_SECTION}</h5>`;
        } else {
            content += `<h5>Ecoregion</h5>`;
        }
        
        // Add other properties
        if (props.Ecoregion_Acres) {
            try {
                const acres = Number(props.Ecoregion_Acres);
                content += `<p><strong>Area:</strong> ${acres.toLocaleString()} acres</p>`;
            } catch (e) {
                content += `<p><strong>Area:</strong> ${props.Ecoregion_Acres} acres</p>`;
            }
        }
        
        content += `</div>`;
        return content;
    }
    
    // Initialize the application
    function initApp() {
        initMap();
        setupDefaultDateRange();
        
        // Set default display type to "Counties Only"
        const displayTypeSelect = document.getElementById('display-type');
        displayTypeSelect.value = 'counties';
        
        // Initial data load
        fetchGeoJSONData();
        
        // Set up event listeners
        document.getElementById('county-select').addEventListener('change', () => {
            const selectedCounty = document.getElementById('county-select').value;
            // Zoom to the selected county
            zoomToCounty(selectedCounty);
            // Update displayed data
            displayFireData();
        });
        
        document.getElementById('ecoregion-select').addEventListener('change', () => {
            displayEcoregionData();
        });
        
        document.getElementById('display-type').addEventListener('change', () => {
            const displayType = document.getElementById('display-type').value;
            
            // Show/hide appropriate layer groups based on display type
            if (displayType === 'counties' || displayType === 'all') {
                fireLayerGroup.addTo(map);
            } else {
                map.removeLayer(fireLayerGroup);
            }
            
            if (displayType === 'ecoregions' || displayType === 'all') {
                ecoregionLayerGroup.addTo(map);
            } else {
                map.removeLayer(ecoregionLayerGroup);
            }
            
            // Refresh data
            displayFireData();
            displayEcoregionData();
        });
        
        // Set up event listeners for date inputs
        document.getElementById('start-date').addEventListener('change', () => {
            const dataStatus = document.getElementById('data-status');
            dataStatus.textContent = "Loading all historical data...";
            
            // Show loading indicator
            const loadingIndicator = document.getElementById('map-loading');
            loadingIndicator.classList.remove('d-none');
            
            // Load all data when date is changed
            loadAllData(() => {
                dataStatus.textContent = "Showing all historical data";
                loadingIndicator.classList.add('d-none');
                displayFireData();
            });
        });
        
        document.getElementById('end-date').addEventListener('change', () => {
            const dataStatus = document.getElementById('data-status');
            dataStatus.textContent = "Loading all historical data...";
            
            // Show loading indicator
            const loadingIndicator = document.getElementById('map-loading');
            loadingIndicator.classList.remove('d-none');
            
            // Load all data when date is changed
            loadAllData(() => {
                dataStatus.textContent = "Showing all historical data";
                loadingIndicator.classList.add('d-none');
                displayFireData();
            });
        });
        
        document.getElementById('apply-filters').addEventListener('click', () => {
            displayFireData();
            displayEcoregionData();
        });
    }
    
    // Start the application
    initApp();
}); 