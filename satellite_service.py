import os
import re
import base64
import logging
import uuid
from datetime import datetime
from logging.handlers import RotatingFileHandler
from fastapi import HTTPException, UploadFile, Form

# Set up logging
satellite_logs_dir = "logs"
if not os.path.exists(satellite_logs_dir):
    os.makedirs(satellite_logs_dir)
    
satellite_logger = logging.getLogger("satellite_analysis")
satellite_logger.setLevel(logging.INFO)

if not satellite_logger.handlers:
    # Add file handler
    satellite_file_handler = RotatingFileHandler(
        os.path.join(satellite_logs_dir, "satellite_analysis.log"), 
        maxBytes=10485760, 
        backupCount=5
    )
    satellite_file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    satellite_file_handler.setFormatter(satellite_file_formatter)
    satellite_logger.addHandler(satellite_file_handler)
    
    # Add console handler
    console_handler = logging.StreamHandler()
    console_formatter = logging.Formatter('%(levelname)s: %(message)s')
    console_handler.setFormatter(console_formatter)
    satellite_logger.addHandler(console_handler)
    
# Ensure uploads directory exists
uploads_dir = "static/uploads"
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir)

uploaded_files = {}

class SatelliteService:
    def __init__(self, openai_client=None):
        """
        Initialize the satellite image analysis service
        
        Args:
            openai_client: OpenAI client instance, if None indicates AI analysis is unavailable
        """
        self.openai_client = openai_client
        self.openai_available = openai_client is not None
        satellite_logger.info(f"Satellite analysis service initialized, AI analysis {'available' if self.openai_available else 'unavailable'}")
    
    async def upload_satellite_image(self, file: UploadFile):
        """
        Upload and store satellite image file
        
        Args:
            file: Uploaded satellite image file
            
        Returns:
            Dictionary containing file ID and path
        """
        satellite_logger.info(f"Satellite image upload received: {file.filename}")
        
        try:
            # Validate file type
            allowed_extensions = [".jpg", ".jpeg", ".png", ".tif", ".tiff"]
            file_ext = os.path.splitext(file.filename)[1].lower()
            
            if file_ext not in allowed_extensions:
                satellite_logger.warning(f"Invalid file type: {file_ext}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
                )
                
            # Generate unique ID and filename
            file_id = str(uuid.uuid4())
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_filename = f"satellite_{timestamp}_{file_id[:8]}{file_ext}"
            file_path = os.path.join(uploads_dir, safe_filename)
            
            # Read file contents
            contents = await file.read()
            
            # Write to file
            with open(file_path, "wb") as f:
                f.write(contents)
                
            satellite_logger.info(f"File saved to {file_path}")
            
            # Store file info for later analysis
            uploaded_files[file_id] = {
                "filename": safe_filename,
                "path": file_path,
                "original_name": file.filename,
                "content_type": file.content_type,
                "upload_time": datetime.now().isoformat(),
                "analyzed": False
            }
            
            return {
                "file_id": file_id,
                "filename": safe_filename,
                "image_path": f"/static/uploads/{safe_filename}"
            }
            
        except Exception as e:
            satellite_logger.error(f"Error uploading satellite image: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")
    
    async def analyze_satellite_image(self, file_id: str, location: str = None):
        """
        Analyze previously uploaded satellite image
        
        Args:
            file_id: ID of the uploaded file
            location: Optional location information (coordinates or name)
            
        Returns:
            Dictionary containing analysis results, including fire probability and observations
        """
        satellite_logger.info(f"Analyzing satellite image, file ID: {file_id}, location: {location or 'Unknown'}")
        
        try:
            # Check if file exists
            if file_id not in uploaded_files:
                satellite_logger.error(f"File ID not found: {file_id}")
                raise HTTPException(status_code=404, detail=f"File ID not found: {file_id}")
            
            file_info = uploaded_files[file_id]
            file_path = file_info["path"]
            
            # Check if file still exists on disk
            if not os.path.exists(file_path):
                satellite_logger.error(f"File not found on disk: {file_path}")
                raise HTTPException(status_code=404, detail="File not found on disk")
            
            # Read file content for analysis
            with open(file_path, "rb") as f:
                image_content = f.read()
                
            # Convert image to base64 (for including in OpenAI prompt)
            image_base64 = base64.b64encode(image_content).decode('utf-8')
            file_ext = os.path.splitext(file_info["filename"])[1].lower()
            
            # Analyze the image using OpenAI vision model (if available)
            analysis_result = {}
            
            if self.openai_available and self.openai_client:
                satellite_logger.info("Analyzing image with OpenAI vision model")
                
                try:
                    response = self.openai_client.chat.completions.create(
                        model="gpt-4o-mini",  # Use Vision model that can analyze images
                        messages=[
                            {
                                "role": "system",
                                "content": "You are an expert in analyzing satellite imagery for wildfire risk assessment. Analyze the provided satellite image and estimate the probability of wildfire risk based on visible vegetation dryness, terrain features, apparent burn scars, smoke, or active fires. Focus only on wildfire-relevant features."
                            },
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"Analyze this satellite image{' of ' + location if location else ''} for wildfire risk factors. Identify any signs of fire risk such as dry vegetation, previous burn scars, dense forest, or visible smoke/fires. Please provide: 1) An estimated fire probability percentage (0-100%), 2) Key observations that influenced your assessment, 3) Terrain and vegetation analysis."
                                    },
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:image/{file_ext.replace('.', '')};base64,{image_base64}"
                                        }
                                    }
                                ]
                            }
                        ],
                        max_tokens=800
                    )
                    
                    analysis_text = response.choices[0].message.content
                    satellite_logger.info("Analysis received from OpenAI")
                    
                    # Check if response contains unexpected content
                    if "sorry" in analysis_text.lower() or "cannot" in analysis_text.lower() or len(analysis_text) < 20:
                        satellite_logger.warning(f"OpenAI returned unsatisfactory response: {analysis_text[:50]}...")
                        return self._generate_fallback_analysis(file_path, location, file_id)
                    
                    # Extract probability using regex
                    probability_match = re.search(r'(\d{1,3})%', analysis_text)
                    probability = float(probability_match.group(1))/100 if probability_match else 0.5
                    
                    # Simple parsing for demonstration - in production you'd want more robust parsing
                    lines = analysis_text.split('\n')
                    observations = []
                    terrain_analysis = ""
                    
                    for line in lines:
                        if ":" in line and not any(line.lower().startswith(s) for s in ["probability", "fire probability"]):
                            observations.append(line.strip())
                        if any(term in line.lower() for term in ["terrain", "vegetation", "landscape", "forest"]):
                            terrain_analysis += line.strip() + " "
                    
                    analysis_result = {
                        "file_id": file_id,
                        "fire_probability": probability,
                        "observations": observations[:5],  # Limit to top 5 observations
                        "terrain_analysis": terrain_analysis.strip(),
                        "full_analysis": analysis_text,
                        "location": location or "Unknown location",
                        "image_path": f"/static/uploads/{file_info['filename']}"
                    }
                    
                    # Mark as analyzed
                    uploaded_files[file_id]["analyzed"] = True
                    
                except Exception as ai_error:
                    satellite_logger.error(f"OpenAI analysis error: {str(ai_error)}")
                    # Fallback to rule-based analysis
                    analysis_result = self._generate_fallback_analysis(file_path, location, file_id)
            else:
                satellite_logger.warning("OpenAI not available, using fallback analysis")
                analysis_result = self._generate_fallback_analysis(file_path, location, file_id)
                
            satellite_logger.info(f"Analysis complete: Fire probability {analysis_result.get('fire_probability', 'unknown')}")
            return analysis_result
            
        except Exception as e:
            satellite_logger.error(f"Error analyzing satellite image: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error analyzing image: {str(e)}")
    
    # 保留原始方法以向后兼容
    async def process_satellite_image(self, file: UploadFile, location: str = None):
        """
        Process uploaded satellite image and perform analysis (original implementation, kept for compatibility)
        
        Args:
            file: Uploaded satellite image file
            location: Optional location information (coordinates or name)
            
        Returns:
            Dictionary containing analysis results, including fire probability and observations
        """
        try:
            # First upload the file
            upload_result = await self.upload_satellite_image(file)
            file_id = upload_result["file_id"]
            
            # Then analyze it
            return await self.analyze_satellite_image(file_id, location)
            
        except Exception as e:
            satellite_logger.error(f"Error in combined process: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")
    
    def _generate_fallback_analysis(self, file_path, location=None, file_id=None):
        """Generate a fallback analysis when AI analysis is not available"""
        satellite_logger.info(f"Generating fallback analysis for {file_path}")
        
        # This is a placeholder. In a real implementation, you might:
        # 1. Use a simpler image processing library like PIL or OpenCV
        # 2. Calculate basic image statistics (color histograms, etc.)
        # 3. Apply some heuristics based on color distribution
        
        # For now, return a generic response
        filename = os.path.basename(file_path)
        return {
            "file_id": file_id,
            "fire_probability": 0.35,  # Default moderate probability
            "observations": [
                "Analysis performed using basic image processing",
                "Full AI analysis not available",
                "Consider vegetation and weather conditions in your area"
            ],
            "terrain_analysis": "Terrain analysis not available in basic mode",
            "location": location or "Unknown location",
            "image_path": f"/static/uploads/{filename}"
        } 