/**
 * Satellite Image Analysis functionality
 * Handles image upload, processing, and displaying analysis results
 */
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements for container version in index.html
    const uploadAreaElement = document.getElementById('satellite-upload-area');
    const fileInputElement = document.getElementById('satellite-upload');
    const previewImageElement = document.getElementById('satellite-preview');
    const previewContainerElement = document.getElementById('satellite-preview-container');
    const removeButtonElement = document.getElementById('remove-satellite');
    const uploadButtonElement = document.getElementById('upload-satellite');
    const analyzeButtonElement = document.getElementById('analyze-satellite');
    const satelliteLoadingElement = document.getElementById('satellite-loading');
    const satelliteResultsElement = document.getElementById('satellite-results');
    const probabilityValueElement = document.getElementById('probability-value');
    const observationsListElement = document.getElementById('observations-list');
    const terrainAnalysisElement = document.getElementById('terrain-analysis');
    const exportButtonElement = document.getElementById('export-analysis');
    
    console.log('Satellite JS initialized (two-step process)');
    
    // Check API availability on page load
    checkApiAvailability();
    
    // Flag to prevent multiple bindings and uploads
    let isProcessing = false;
    // Store uploaded file ID
    let currentFileId = null;
    
    // Check if API is available
    function checkApiAvailability() {
        console.log('Checking API availability...');
        
        // Check upload endpoints - try two paths
        Promise.allSettled([
            fetch('/api/status'),
            fetch('/api/satellite/upload', { method: 'HEAD' }),
            fetch('/satellite/upload', { method: 'HEAD' }),
            fetch('/api/satellite/analyze', { method: 'HEAD' }),
            fetch('/satellite/analyze', { method: 'HEAD' })
        ])
        .then(results => {
            console.log('API availability check results:', results);
            
            results.forEach((result, index) => {
                const endpoints = [
                    '/api/status', 
                    '/api/satellite/upload', 
                    '/satellite/upload',
                    '/api/satellite/analyze',
                    '/satellite/analyze'
                ];
                const endpoint = endpoints[index];
                
                if (result.status === 'fulfilled') {
                    console.log(`Endpoint ${endpoint} accessible, status code: ${result.value.status}`);
                    addStatusMessage(`Endpoint ${endpoint} accessible (${result.value.status})`, 'success');
                } else {
                    console.error(`Endpoint ${endpoint} not accessible:`, result.reason);
                    addStatusMessage(`Endpoint ${endpoint} not accessible`, 'danger');
                }
            });
        });
    }
    
    // Add status message to the page
    function addStatusMessage(message, type) {
        // Create or get status container
        let statusContainer = document.getElementById('api-status-container');
        if (!statusContainer) {
            statusContainer = document.createElement('div');
            statusContainer.id = 'api-status-container';
            statusContainer.className = 'api-status-container position-fixed bottom-0 end-0 p-3';
            statusContainer.style.zIndex = '1050';
            document.body.appendChild(statusContainer);
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add to container
        statusContainer.appendChild(notification);
        
        // Auto-disappear
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }
    
    // Create error message display element
    const errorMessageContainer = document.createElement('div');
    errorMessageContainer.className = 'alert alert-danger mt-2 d-none';
    errorMessageContainer.id = 'satellite-error';
    
    // Add error message container after preview container
    if (previewContainerElement && previewContainerElement.parentNode) {
        previewContainerElement.parentNode.insertBefore(errorMessageContainer, previewContainerElement.nextSibling);
    }
    
    // Function to show error message
    function showError(message) {
        errorMessageContainer.textContent = message;
        errorMessageContainer.classList.remove('d-none');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            errorMessageContainer.classList.add('d-none');
        }, 5000);
    }
    
    // Hide error message
    function hideError() {
        errorMessageContainer.classList.add('d-none');
    }
    
    // Handle file uploads through the upload area
    if (uploadAreaElement) {
        uploadAreaElement.addEventListener('click', function() {
            fileInputElement.click();
        });
        
        uploadAreaElement.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('dragover');
        });
        
        uploadAreaElement.addEventListener('dragleave', function() {
            this.classList.remove('dragover');
        });
        
        uploadAreaElement.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
            
            if (e.dataTransfer.files.length) {
                fileInputElement.files = e.dataTransfer.files;
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
        
        fileInputElement.addEventListener('change', function() {
            if (this.files.length) {
                handleFileSelect(this.files[0]);
            }
        });
    }
    
    // Set upload button event listener
    if (uploadButtonElement) {
        uploadButtonElement.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (isProcessing) {
                showError('Please wait, a request is already being processed');
                return;
            }
            
            if (!fileInputElement.files.length) {
                showError('Please select an image first');
                return;
            }
            
            uploadSelectedImage();
        });
    }
    
    // Set analyze button event listener
    if (analyzeButtonElement) {
        analyzeButtonElement.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (isProcessing) {
                showError('Please wait, a request is already being processed');
                return;
            }
            
            if (!currentFileId) {
                showError('Please upload an image first by clicking the Upload button');
                return;
            }
            
            analyzeUploadedImage();
        });
    }
    
    // Set remove button event listener
    if (removeButtonElement) {
        removeButtonElement.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent triggering upload area click
            resetInterface();
        });
    }
    
    // Reset interface function
    function resetInterface() {
        previewImageElement.src = '';
        fileInputElement.value = '';
        uploadAreaElement.classList.remove('d-none');
        previewContainerElement.classList.add('d-none');
        
        if (satelliteResultsElement) {
            satelliteResultsElement.classList.add('d-none');
        }
        
        // Disable analyze button
        if (analyzeButtonElement) {
            analyzeButtonElement.disabled = true;
        }
        
        // Hide any error messages
        hideError();
        
        // Reset processing flag and file ID
        isProcessing = false;
        currentFileId = null;
    }
    
    // Handle file selection function
    function handleFileSelect(file) {
        // Hide any previous error messages
        hideError();
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/tiff'];
        
        console.log('File selected:', file);
        console.log('File type:', file.type);
        
        if (!validTypes.includes(file.type)) {
            showError('Please select a valid image file (JPEG, PNG, or TIFF)');
            return;
        }
        
        // Reset previous data
        if (analyzeButtonElement) {
            analyzeButtonElement.disabled = true;
        }
        currentFileId = null;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImageElement.src = e.target.result;
            uploadAreaElement.classList.add('d-none');
            previewContainerElement.classList.remove('d-none');
            
            if (satelliteResultsElement) {
                satelliteResultsElement.classList.add('d-none');
            }
        };
        reader.readAsDataURL(file);
    }
    
    // Upload selected image function
    function uploadSelectedImage() {
        // Create FormData object
        const formData = new FormData();
        
        // Get selected file
        const file = fileInputElement.files[0];
        if (!file) {
            showError('No file selected');
            return;
        }
        
        // Add file to FormData
        formData.append('file', file);
        
        // Show loading indicator
        isProcessing = true;
        if (satelliteLoadingElement) {
            satelliteLoadingElement.classList.remove('d-none');
        }
        if (satelliteResultsElement) {
            satelliteResultsElement.classList.add('d-none');
        }
        
        // Add detailed debug information
        console.log('Preparing to upload image to server...');
        console.log('File type:', file.type);
        console.log('File size:', file.size);
        
        // Get base URL
        const baseUrl = window.location.origin;
        const uploadUrl = `${baseUrl}/api/satellite/upload`;
        
        console.log('Upload URL:', uploadUrl);
        
        // Send to server
        fetch(uploadUrl, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log('Upload response status:', response.status);
            console.log('Response headers:', [...response.headers.entries()]);
            
            if (!response.ok) {
                return response.text().then(text => {
                    console.error('Upload error text:', text);
                    throw new Error(`Upload failed, status code: ${response.status}. Details: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Upload successful, file ID:', data.file_id);
            
            // Hide loading indicator
            if (satelliteLoadingElement) {
                satelliteLoadingElement.classList.add('d-none');
            }
            
            // Store file ID
            currentFileId = data.file_id;
            
            // Enable analyze button
            if (analyzeButtonElement) {
                analyzeButtonElement.disabled = false;
            }
            
            // Show success message
            addStatusMessage('Image uploaded successfully! You can now click the Analysis button', 'success');
            
            // Reset processing flag
            isProcessing = false;
        })
        .catch(error => {
            console.error('Error during upload process:', error);
            
            // Try using original URL as fallback
            console.log('Trying original URL as fallback...');
            
            fetch('/api/satellite/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                console.log('Original URL upload response status:', response.status);
                
                if (!response.ok) {
                    return response.text().then(text => {
                        console.error('Original URL upload error text:', text);
                        throw new Error(`Original URL upload failed, status code: ${response.status}. Details: ${text}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log('Original URL upload successful, file ID:', data.file_id);
                
                // Hide loading indicator
                if (satelliteLoadingElement) {
                    satelliteLoadingElement.classList.add('d-none');
                }
                
                // Store file ID
                currentFileId = data.file_id;
                
                // Enable analyze button
                if (analyzeButtonElement) {
                    analyzeButtonElement.disabled = false;
                }
                
                // Show success message
                addStatusMessage('Image uploaded successfully using original URL! You can now click the Analysis button', 'success');
                
                // Reset processing flag
                isProcessing = false;
            })
            .catch(backupError => {
                console.error('Error during original URL upload process:', backupError);
                
                // Hide loading indicator
                if (satelliteLoadingElement) {
                    satelliteLoadingElement.classList.add('d-none');
                }
                
                // Show error message
                showError(`Both upload methods failed, please check if the server is running. (${error.message}; ${backupError.message})`);
                
                // Reset processing flag
                isProcessing = false;
            });
        });
    }
    
    // Analyze uploaded image function
    function analyzeUploadedImage() {
        if (!currentFileId) {
            showError('No image has been uploaded yet');
            return;
        }
        
        // Show loading indicator
        isProcessing = true;
        if (satelliteLoadingElement) {
            satelliteLoadingElement.classList.remove('d-none');
        }
        if (satelliteResultsElement) {
            satelliteResultsElement.classList.add('d-none');
        }
        
        console.log('Starting image analysis, ID:', currentFileId);
        
        // Use correct API path
        const analyzeUrl = '/api/satellite/analyze';
        console.log('Using analysis URL:', analyzeUrl);
        
        // Send to server analysis endpoint
        const formData = new FormData();
        formData.append('file_id', currentFileId);
        
        // If location information is available, add to request
        const locationInput = document.getElementById('location-input');
        if (locationInput && locationInput.value.trim()) {
            formData.append('location', locationInput.value.trim());
        }
        
        fetch(analyzeUrl, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log('Analysis response status:', response.status);
            
            if (!response.ok) {
                return response.text().then(text => {
                    console.error('Analysis error text:', text);
                    throw new Error(`Analysis failed, status code: ${response.status}. Details: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Analysis data received:', data);
            
            // Hide loading indicator
            if (satelliteLoadingElement) {
                satelliteLoadingElement.classList.add('d-none');
            }
            
            // Process and display results
            processAnalysisResults(data);
            
            // Show success message
            addStatusMessage('Image analysis completed successfully!', 'success');
            
            // Reset processing flag
            isProcessing = false;
        })
        .catch(error => {
            console.error('Error during analysis process:', error);
            
            // Try using original URL as fallback
            console.log('Trying original analysis URL as fallback...');
            
            fetch('/api/satellite/analyze', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                console.log('Original analysis URL response status:', response.status);
                
                if (!response.ok) {
                    return response.text().then(text => {
                        console.error('Original analysis URL error text:', text);
                        throw new Error(`Original analysis URL failed, status code: ${response.status}. Details: ${text}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log('Original analysis URL successful, results received');
                
                // Hide loading indicator
                if (satelliteLoadingElement) {
                    satelliteLoadingElement.classList.add('d-none');
                }
                
                // Process and display results
                processAnalysisResults(data);
                
                // Show success message
                addStatusMessage('Image analysis completed successfully using original URL!', 'success');
                
                // Reset processing flag
                isProcessing = false;
            })
            .catch(backupError => {
                console.error('Error during original analysis URL process:', backupError);
                
                // Hide loading indicator
                if (satelliteLoadingElement) {
                    satelliteLoadingElement.classList.add('d-none');
                }
                
                // Show error message
                showError(`Both analysis methods failed, please check if the server is running. (${error.message}; ${backupError.message})`);
                
                // Reset processing flag
                isProcessing = false;
            });
        });
    }
    
    // Process analysis results function
    function processAnalysisResults(data) {
        // Extract information from GPT analysis
        const analysis = data.analysis || '';
        console.log('Raw analysis:', analysis);
        
        // Extract fire probability
        let probability = 0;
        const probMatch = analysis.match(/(\d+)%\s+(?:chance|probability|likelihood|risk)/i);
        if (probMatch && probMatch[1]) {
            probability = parseInt(probMatch[1], 10);
        } else {
            // If no explicit percentage, estimate based on language
            if (analysis.match(/high\s+risk|severe|extreme|very\s+likely/i)) {
                probability = 85;
            } else if (analysis.match(/moderate\s+risk|likely|possible/i)) {
                probability = 50;
            } else if (analysis.match(/low\s+risk|unlikely|minimal/i)) {
                probability = 15;
            } else {
                probability = 30; // Default medium-low risk
            }
        }
        
        // Extract observations
        const observations = [];
        
        // Try to find bullet points or numbered lists
        const bulletMatches = analysis.match(/[•*-]\s+([^\n]+)/g);
        if (bulletMatches && bulletMatches.length > 0) {
            bulletMatches.forEach(match => {
                observations.push(match.replace(/[•*-]\s+/, ''));
            });
        } else {
            // If no bullet points, extract sentences as observations
            const sentences = analysis.match(/[^.!?]+[.!?]+/g);
            if (sentences && sentences.length > 0) {
                // Take up to 4 sentences as observations
                sentences.slice(0, 4).forEach(sentence => {
                    observations.push(sentence.trim());
                });
            }
        }
        
        // Create result data object
        const resultData = {
            fire_probability: probability / 100,
            observations: observations.length > 0 ? observations : ['No specific observations available'],
            terrain_analysis: analysis,
            location: 'Analyzed location'
        };
        
        // Display processed results
        displayAnalysisResults(resultData);
    }
    
    // One-step process function (combines upload and analysis)
    function processSelectedImage() {
        // Create a new FormData object to send the file
        const formData = new FormData();
        
        // Get the file from the input
        const file = fileInputElement.files[0];
        if (!file) {
            showError('No file selected');
            isProcessing = false;
            return;
        }
        
        // Get location info if available
        const locationInput = document.getElementById('location-input');
        const location = locationInput ? locationInput.value.trim() : '';
        
        // Add file and location to form data
        formData.append('file', file);
        if (location) {
            formData.append('location', location);
        }
        
        // Show loading indicator
        if (satelliteLoadingElement) {
            satelliteLoadingElement.classList.remove('d-none');
        }
        if (satelliteResultsElement) {
            satelliteResultsElement.classList.add('d-none');
        }
        
        console.log('Sending file to server for one-step processing');
        
        // Send to server using the combined process endpoint
        fetch('/api/satellite/process', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log('Server response status:', response.status);
            
            // Check if response is OK (status 200-299)
            if (!response.ok) {
                // If not OK, capture more details about the error
                return response.text().then(text => {
                    console.error('Response error text:', text);
                    throw new Error(`Server responded with status: ${response.status}. Details: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Processing data received:', data);
            
            // Hide loading indicator
            if (satelliteLoadingElement) {
                satelliteLoadingElement.classList.add('d-none');
            }
            
            // Display results
            displayAnalysisResults(data);
            
            // Reset processing flag
            isProcessing = false;
        })
        .catch(error => {
            console.error('Error during processing:', error);
            
            // Hide loading indicator
            if (satelliteLoadingElement) {
                satelliteLoadingElement.classList.add('d-none');
            }
            
            // Show error message
            showError(`Error processing image: ${error.message}`);
            
            // Reset processing flag
            isProcessing = false;
        });
    }
    
    // Save single reference to export button
    let exportButtonHandler = null;
    
    // Display analysis results in the UI
    function displayAnalysisResults(data) {
        // Show results container
        if (satelliteResultsElement) {
            satelliteResultsElement.classList.remove('d-none');
        }
        
        // Get observations from the appropriate location in data
        const observations = data.observations || (data.structured_data ? data.structured_data.observations : []);
        
        // Get probability from the appropriate source to determine fire detection
        let probability = 0;
        let fireDetected = false;
        
        // First, try to determine from the observations - specifically look at smoke, heat, and vegetation indicators
        let hasSmoke = false;
        let hasHeat = false;
        let hasUnhealthyVegetation = false;
        
        if (observations && observations.length) {
            observations.forEach(observation => {
                const obsText = typeof observation === 'string' ? observation : observation.text || '';
                
                // Check for smoke indicators
                if (obsText.toLowerCase().includes('smoke:')) {
                    hasSmoke = !obsText.toLowerCase().includes('no smoke') && 
                               !obsText.toLowerCase().includes('no visible smoke') &&
                               !obsText.toLowerCase().includes('absence of smoke');
                }
                
                // Check for heat/fire indicators
                if (obsText.toLowerCase().includes('heat zone') || obsText.toLowerCase().includes('fire:')) {
                    hasHeat = !obsText.toLowerCase().includes('no active burning') && 
                              !obsText.toLowerCase().includes('no heat') &&
                              !obsText.toLowerCase().includes('no fire');
                }
                
                // Check for vegetation indicators
                if (obsText.toLowerCase().includes('vegetation:')) {
                    hasUnhealthyVegetation = obsText.toLowerCase().includes('burn') || 
                                             obsText.toLowerCase().includes('scorch') || 
                                             obsText.toLowerCase().includes('damage') ||
                                             obsText.toLowerCase().includes('distress');
                }
            });
        }
        
        // Look for an explicit conclusion about fire detection
        let conclusionIndicatesFire = false;
        const conclusionObs = observations.find(obs => 
            typeof obs === 'string' && obs.toLowerCase().startsWith('conclusion:')
        );
        
        if (conclusionObs) {
            conclusionIndicatesFire = conclusionObs.toLowerCase().includes('fire detected') || 
                                      conclusionObs.toLowerCase().includes('active fire');
            // If conclusion explicitly states no fire, override any other indicators
            if (conclusionObs.toLowerCase().includes('no fire detected') || 
                conclusionObs.toLowerCase().includes('no active fire')) {
                conclusionIndicatesFire = false;
                hasSmoke = false;
                hasHeat = false;
            }
        }
        
        // Determine fire detection status based on multiple factors
        // If at least heat zones or explicit fire mention in conclusion, we consider it detected
        fireDetected = hasHeat || conclusionIndicatesFire;
        
        // Check for direct fire_detected flag as backup
        if (data.structured_data && typeof data.structured_data.fire_detected === 'boolean') {
            fireDetected = data.structured_data.fire_detected;
        } else if (typeof data.fire_probability === 'number') {
            probability = Math.round(data.fire_probability * 100);
            // Only use probability as a factor if we couldn't determine from observations
            if (!hasHeat && !hasSmoke && !hasUnhealthyVegetation && !conclusionIndicatesFire) {
                fireDetected = probability >= 50;
            }
        } else if (data.structured_data && typeof data.structured_data.fire_probability === 'number') {
            probability = Math.round(data.structured_data.fire_probability * 100);
            // Only use probability as a factor if we couldn't determine from observations
            if (!hasHeat && !hasSmoke && !hasUnhealthyVegetation && !conclusionIndicatesFire) {
                fireDetected = probability >= 50;
            }
        }
        
        console.log('Fire detection indicators:', {
            hasSmoke,
            hasHeat,
            hasUnhealthyVegetation,
            conclusionIndicatesFire,
            probability,
            finalDecision: fireDetected
        });
        
        // Update the fire detection status display
        const fireDetectionStatus = document.getElementById('fire-detection-status');
        if (fireDetectionStatus) {
            // Remove any existing status classes
            fireDetectionStatus.classList.remove('fire-detected', 'no-fire-detected');
            
            // Add appropriate class based on detection status
            fireDetectionStatus.classList.add(fireDetected ? 'fire-detected' : 'no-fire-detected');
            
            // Update icon
            const iconElement = fireDetectionStatus.querySelector('.detection-icon i');
            if (iconElement) {
                // Change icon class
                iconElement.className = fireDetected ? 
                    'bi bi-fire' : 
                    'bi bi-check-circle-fill';
                
                // Set size
                iconElement.style.fontSize = '4rem';
            }
            
            // Update text
            const textElement = fireDetectionStatus.querySelector('.detection-text');
            if (textElement) {
                textElement.textContent = fireDetected ? 'FIRE DETECTED' : 'NO FIRE DETECTED';
            }
        }
        
        // Update observations list with structured format
        if (observationsListElement && observations && observations.length) {
            observationsListElement.innerHTML = '';
            
            // First render the location (ensure it's visible)
            let locationFound = false;
            let conclusionFound = false;
            
            // Process all observations first to avoid rendering issues
            observations.forEach(observation => {
                // Convert to string if it's an object
                let obsText = typeof observation === 'string' ? observation : observation.text || '';
                
                if (obsText.toLowerCase().startsWith('location:')) {
                    locationFound = true;
                    // Create location element
                    const li = document.createElement('li');
                    li.className = 'mb-3';
                    
                    // Extract location content without the prefix
                    const locationText = obsText.replace(/^Location:\s*/i, '');
                    
                    // Create an element with location styling
                    li.innerHTML = `<i class="bi bi-geo-alt text-primary me-2"></i><strong>Location:</strong> ${locationText}`;
                    observationsListElement.appendChild(li);
                }
            });
            
            // If no location was found, add a default one
            if (!locationFound) {
                const li = document.createElement('li');
                li.className = 'mb-3';
                li.innerHTML = `<i class="bi bi-geo-alt text-primary me-2"></i><strong>Location:</strong> Unknown location`;
                observationsListElement.appendChild(li);
            }
            
            // Then render all analysis points (excluding location and conclusion)
            observations.forEach(observation => {
                let obsText = typeof observation === 'string' ? observation : observation.text || '';
                
                // Skip location and conclusion as they're handled separately
                if (!obsText.toLowerCase().startsWith('location:') && !obsText.toLowerCase().startsWith('conclusion:')) {
                    const li = document.createElement('li');
                    li.className = 'mb-2';
                    
                    // Extract label and content
                    const parts = obsText.match(/^([^:]+):\s*(.+)$/);
                    
                    if (parts && parts.length >= 3) {
                        const label = parts[1].trim();
                        const content = parts[2].trim();
                        
                        // Select appropriate icon based on the label
                        let icon = '<i class="bi bi-info-circle text-primary me-2"></i>';
                        if (label.toLowerCase().includes('smoke')) {
                            icon = '<i class="bi bi-cloud-fill text-secondary me-2"></i>';
                        } else if (label.toLowerCase().includes('heat') || label.toLowerCase().includes('fire')) {
                            icon = '<i class="bi bi-fire text-danger me-2"></i>';
                        } else if (label.toLowerCase().includes('vegetation')) {
                            icon = '<i class="bi bi-tree-fill text-success me-2"></i>';
                        }
                        
                        li.innerHTML = `${icon}<strong>${label}:</strong> ${content}`;
                    } else {
                        li.innerHTML = `<i class="bi bi-info-circle text-primary me-2"></i>${obsText}`;
                    }
                    
                    observationsListElement.appendChild(li);
                }
            });
            
            // Finally, render the conclusion at the end
            observations.forEach(observation => {
                let obsText = typeof observation === 'string' ? observation : observation.text || '';
                
                if (obsText.toLowerCase().startsWith('conclusion:')) {
                    conclusionFound = true;
                    const li = document.createElement('li');
                    li.className = 'mb-2 mt-3';
                    
                    // Extract conclusion content without the prefix
                    const conclusionText = obsText.replace(/^Conclusion:\s*/i, '');
                    
                    // Create conclusion with alert styling
                    const alertClass = fireDetected ? 'alert-danger' : 'alert-success';
                    const icon = fireDetected ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
                    
                    li.innerHTML = `<div class="alert ${alertClass} mb-0 p-2"><i class="bi ${icon} me-2"></i><strong>Conclusion:</strong> ${conclusionText}</div>`;
                    observationsListElement.appendChild(li);
                }
            });
            
            // If no conclusion was found, add a default one with the fire detection status
            if (!conclusionFound) {
                const li = document.createElement('li');
                li.className = 'mb-2 mt-3';
                
                const alertClass = fireDetected ? 'alert-danger' : 'alert-success';
                const icon = fireDetected ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
                const text = fireDetected ? 
                    'Active fire detected in the image. Immediate attention and monitoring recommended.' : 
                    'No significant fire activity detected in the image.';
                    
                li.innerHTML = `<div class="alert ${alertClass} mb-0 p-2"><i class="bi ${icon} me-2"></i><strong>Conclusion:</strong> ${text}</div>`;
                observationsListElement.appendChild(li);
            }
        } else if (observationsListElement) {
            observationsListElement.innerHTML = '<li class="text-muted">No specific observations available</li>';
        }
        
        // Enable export button if present
        if (exportButtonElement) {
            exportButtonElement.disabled = false;
            
            // 完全移除之前的事件监听器，避免重复添加
            if (exportButtonHandler) {
                exportButtonElement.removeEventListener('click', exportButtonHandler);
            }
            
            // 创建一个新的处理函数，并保存引用以便稍后移除
            exportButtonHandler = function() {
                exportAnalysisReport(data);
            };
            
            // 添加新的事件监听器
            exportButtonElement.addEventListener('click', exportButtonHandler);
        }
    }
    
    // Export analysis as a text file
    function exportAnalysisReport(data) {
        // Get observations from the appropriate location in data
        const observations = data.observations || (data.structured_data ? data.structured_data.observations : []);
        
        // Use the same fire detection logic as in displayAnalysisResults
        let fireDetected = false;
        
        // First, analyze observations for fire indicators
        let hasSmoke = false;
        let hasHeat = false;
        let hasUnhealthyVegetation = false;
        
        if (observations && observations.length) {
            observations.forEach(observation => {
                const obsText = typeof observation === 'string' ? observation : observation.text || '';
                
                // Check for smoke indicators
                if (obsText.toLowerCase().includes('smoke:')) {
                    hasSmoke = !obsText.toLowerCase().includes('no smoke') && 
                               !obsText.toLowerCase().includes('no visible smoke') &&
                               !obsText.toLowerCase().includes('absence of smoke');
                }
                
                // Check for heat/fire indicators
                if (obsText.toLowerCase().includes('heat zone') || obsText.toLowerCase().includes('fire:')) {
                    hasHeat = !obsText.toLowerCase().includes('no active burning') && 
                              !obsText.toLowerCase().includes('no heat') &&
                              !obsText.toLowerCase().includes('no fire');
                }
                
                // Check for vegetation distress
                if (obsText.toLowerCase().includes('vegetation:')) {
                    hasUnhealthyVegetation = obsText.toLowerCase().includes('burn') || 
                                             obsText.toLowerCase().includes('scorch') || 
                                             obsText.toLowerCase().includes('damage') ||
                                             obsText.toLowerCase().includes('distress');
                }
            });
        }
        
        // Check conclusion
        let conclusionIndicatesFire = false;
        const conclusionObs = observations.find(obs => 
            typeof obs === 'string' && obs.toLowerCase().startsWith('conclusion:')
        );
        
        if (conclusionObs) {
            conclusionIndicatesFire = conclusionObs.toLowerCase().includes('fire detected') || 
                                      conclusionObs.toLowerCase().includes('active fire');
            if (conclusionObs.toLowerCase().includes('no fire detected') || 
                conclusionObs.toLowerCase().includes('no active fire')) {
                conclusionIndicatesFire = false;
                hasSmoke = false;
                hasHeat = false;
            }
        }
        
        // Determine fire detection status - heat or conclusion are most reliable indicators
        fireDetected = hasHeat || conclusionIndicatesFire;
        
        // Fall back to structured data flags if observation analysis is inconclusive
        if (data.structured_data && typeof data.structured_data.fire_detected === 'boolean') {
            // Only use this if we couldn't determine from observations
            if (!hasHeat && !hasSmoke && !conclusionIndicatesFire) {
                fireDetected = data.structured_data.fire_detected;
            }
        } else if (typeof data.fire_probability === 'number') {
            if (!hasHeat && !hasSmoke && !hasUnhealthyVegetation && !conclusionIndicatesFire) {
                fireDetected = data.fire_probability >= 0.5;
            }
        } else if (data.structured_data && typeof data.structured_data.fire_probability === 'number') {
            if (!hasHeat && !hasSmoke && !hasUnhealthyVegetation && !conclusionIndicatesFire) {
                fireDetected = data.structured_data.fire_probability >= 0.5;
            }
        }
        
        const fireStatus = fireDetected ? "FIRE DETECTED" : "NO FIRE DETECTED";
        
        // Format observations for export with structured sections
        let locationText = 'Unknown location';
        let analysisPoints = [];
        let conclusionText = fireDetected ? 
            'Active fire detected in the image. Immediate attention and monitoring recommended.' : 
            'No significant fire activity detected in the image.';
        
        // Extract information from observations
        if (observations && observations.length) {
            observations.forEach(observation => {
                // Convert to string if it's an object
                let obsText = typeof observation === 'string' ? observation : observation.text || '';
                
                // Check the observation type
                if (obsText.toLowerCase().startsWith('location:')) {
                    locationText = obsText.replace(/^Location:\s*/i, '').trim();
                } else if (obsText.toLowerCase().startsWith('conclusion:')) {
                    conclusionText = obsText.replace(/^Conclusion:\s*/i, '').trim();
                } else {
                    // Extract just the content part after the label
                    const parts = obsText.match(/^([^:]+):\s*(.+)$/);
                    if (parts && parts.length >= 3) {
                        const label = parts[1].trim();
                        const content = parts[2].trim();
                        analysisPoints.push(`• ${label}: ${content}`);
                    } else {
                        analysisPoints.push(`• ${obsText.trim()}`);
                    }
                }
            });
        }
        
        // If no analysis points were found, create a placeholder
        if (analysisPoints.length === 0) {
            analysisPoints = [
                "• No detailed analysis points available"
            ];
        }
        
        // Build the formatted report
        const reportText = `
SATELLITE IMAGE FIRE DETECTION REPORT
====================================

DETECTION STATUS: ${fireStatus}

LOCATION: ${locationText}

ANALYSIS DETAILS:
${analysisPoints.join('\n')}

CONCLUSION:
${conclusionText}

Analysis Date: ${new Date().toLocaleDateString()}

Generated by California Fire Prediction System
        `;
        
        // Create and download file
        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fire-detection-report-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
}); 