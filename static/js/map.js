/**
 * California Fire Map functionality
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map centered on California
    const map = L.map('map').setView([37.8, -122.0], 6);
    
    // Add the base tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Sample fire perimeters (in a real app, this would come from an API)
    const sampleFires = [
        {
            name: "Sample Fire 1", 
            coords: [[37.5, -122.3], [37.7, -122.2], [37.6, -122.0], [37.4, -122.1]],
            type: "current",
            date: "2023-04-15"
        },
        {
            name: "Sample Fire 2", 
            coords: [[38.1, -120.8], [38.3, -120.7], [38.2, -120.5], [38.0, -120.6]],
            type: "current",
            date: "2023-04-12"
        },
        {
            name: "Historical Fire 1", 
            coords: [[34.1, -118.2], [34.2, -118.1], [34.15, -117.9], [34.05, -118.0]],
            type: "historical",
            date: "2022-09-15"
        },
        {
            name: "Risk Zone 1", 
            coords: [[39.5, -121.3], [39.7, -121.2], [39.6, -121.0], [39.4, -121.1]],
            type: "risk",
            date: "2023-04-15" 
        }
    ];
    
    // Store all fire layers
    const fireLayers = {
        current: L.layerGroup(),
        historical: L.layerGroup(),
        risk: L.layerGroup()
    };
    
    // Initialize the map with fire data
    function initializeFireMap() {
        // Add fire perimeters by type
        sampleFires.forEach(fire => {
            const color = fire.type === 'current' ? 'red' : 
                       fire.type === 'historical' ? 'purple' : 'orange';
            
            const polygon = L.polygon(fire.coords, {
                color: color, 
                fillOpacity: 0.5,
                weight: 2
            }).bindPopup(`
                <strong>${fire.name}</strong><br>
                Type: ${fire.type}<br>
                Date: ${fire.date}
            `);
            
            fireLayers[fire.type].addLayer(polygon);
        });
        
        // Add all layers to map by default
        Object.values(fireLayers).forEach(layer => {
            map.addLayer(layer);
        });
    }
    
    // Filter fires by date and type
    function filterFires(date, selectedLayer) {
        // Clear all layers
        Object.values(fireLayers).forEach(layer => {
            map.removeLayer(layer);
        });
        
        // Add selected layers back
        if (selectedLayer === 'all') {
            Object.values(fireLayers).forEach(layer => {
                map.addLayer(layer);
            });
        } else if (fireLayers[selectedLayer]) {
            map.addLayer(fireLayers[selectedLayer]);
        }
        
        // In a real app, you would filter based on the date as well
        console.log(`Filtering fires for date: ${date}`);
    }
    
    // Initialize the map
    initializeFireMap();
    
    // Set up event listeners for the filter buttons
    document.querySelector('#date-selector').addEventListener('change', function() {
        const selectedDate = this.value;
        const layerType = document.querySelector('#map-layer').value;
        filterFires(selectedDate, layerType);
    });
    
    document.querySelector('#map-layer').addEventListener('change', function() {
        const selectedDate = document.querySelector('#date-selector').value;
        const layerType = this.value;
        filterFires(selectedDate, layerType);
    });
    
    // Apply filters button
    document.querySelector('.map-controls').addEventListener('click', function(e) {
        if (e.target.closest('button')) {
            const buttonText = e.target.closest('button').textContent.trim();
            let layerType = 'all';
            
            if (buttonText.includes('Current')) layerType = 'current';
            else if (buttonText.includes('Historical')) layerType = 'historical';
            else if (buttonText.includes('Risk')) layerType = 'risk';
            
            filterFires(document.querySelector('#date-selector').value, layerType);
            
            // Update the dropdown to match the button
            document.querySelector('#map-layer').value = layerType;
        }
    });
}); 