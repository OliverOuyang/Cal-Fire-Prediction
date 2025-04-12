import os
import sys
import json
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
from dotenv import load_dotenv

# Set up logging
logs_dir = "logs"
if not os.path.exists(logs_dir):
    os.makedirs(logs_dir)

log_file = os.path.join(logs_dir, f"app_{datetime.now().strftime('%Y%m%d')}.log")
logger = logging.getLogger("fire_prediction")
logger.setLevel(logging.INFO)

# Add file handler
file_handler = RotatingFileHandler(log_file, maxBytes=10485760, backupCount=5)
file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)
logger.addHandler(file_handler)

# Add console handler
console_handler = logging.StreamHandler()
console_formatter = logging.Formatter('%(levelname)s: %(message)s')
console_handler.setFormatter(console_formatter)
logger.addHandler(console_handler)

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
    logger.info("Environment variables loaded from .env file")
except:
    logger.info("Using system environment variables")

# Setup OpenAI client
openai_available = False
openai_client = None
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Initialize OpenAI client (if API key is available)
try:
    from openai import OpenAI
    if OPENAI_API_KEY and OPENAI_API_KEY != "your_openai_api_key_here":
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        openai_available = True
        logger.info("OpenAI client initialized successfully")
    else:
        logger.warning("OpenAI API key not found or not set. AI Analysis will not be available.")
        logger.warning("Please add your OpenAI API key to the .env file.")
except ImportError:
    logger.error("OpenAI module not found. AI Analysis will not be available.")
    logger.error("Install it using: pip install openai")
    
# Load the ML model
model = None
model_path = "Prediction Model/fire_prediction_model.pkl"

try:
    if os.path.exists(model_path):
        logger.info(f"Found model at: {model_path}")
        model = joblib.load(model_path)
        logger.info("Successfully loaded prediction model") 
    else:
        logger.warning(f"Model not found at: {model_path}")
        logger.info("Running in cloud-based prediction mode")
except Exception as e:
    logger.error(f"Error loading model: {e}")
    logger.info("Running in cloud-based prediction mode")

selected_features = [
    'max_temp_c', 'min_temp_c', 'avg_temp_c', 'heating_deg_days_c',
    'cooling_deg_days_c', 'precip_mm', 'avg_humidity',
    'avg_wind_speed_knots', 'avg_dew_point_f', 'avg_visibility_km',
    'avg_sea_level_pressure_mb', 'temp_range_c', 'heat_index', 'drought_indicator'
]

app = FastAPI()
logger.info("FastAPI application initialized")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up Jinja2 templates
templates = Jinja2Templates(directory="templates")

# Define request models
class FireRequest(BaseModel):
    max_temp_c: float
    min_temp_c: float
    avg_temp_c: float
    heating_deg_days_c: float
    cooling_deg_days_c: float
    precip_mm: float
    avg_humidity: float
    avg_wind_speed_knots: float
    avg_dew_point_f: float
    avg_visibility_km: float
    avg_sea_level_pressure_mb: float
    location: str = None

class AnalysisRequest(BaseModel):
    fire_probability: float
    weather_data: dict
    location: str = "Unknown location"

@app.get("/", response_class=HTMLResponse)
async def get_home(request: Request):
    logger.info("Home page requested")
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/status")
async def get_status():
    logger.info("API status requested")
    return {
        "model_loaded": model is not None,
        "openai_available": openai_available,
        "system_info": {
            "python_version": sys.version,
            "current_directory": os.getcwd()
        }
    }

@app.post("/api/predict")
async def predict_fire_prob(req: FireRequest):
    logger.info(f"Prediction requested for location: {req.location}")
    
    try:
        # Calculate derived features
        temp_range = req.max_temp_c - req.min_temp_c
        heat_index = req.avg_temp_c * (1 + 0.01 * req.avg_humidity)
        drought_indicator = int(req.precip_mm < 5 and req.avg_temp_c > 25)

        input_data = {
            **req.dict(exclude={"location"}),
            "temp_range_c": temp_range,
            "heat_index": heat_index,
            "drought_indicator": drought_indicator
        }

        # Use local model if available
        if model is not None:
            input_df = pd.DataFrame([input_data])[selected_features]
            fire_prob = model.predict_proba(input_df)[0, 1]
            probability = round(float(fire_prob), 4)
            logger.info(f"Fire probability calculated using local model: {probability}")
        else:
            # Use rule-based prediction when model is not available (for Vercel deployment)
            logger.info("Using rule-based prediction (model not available)")
            
            # Simple rule-based prediction based on key features
            base_prob = 0.01  # Base probability
            
            # Temperature factors
            if req.avg_temp_c > 30:
                base_prob += 0.20
            elif req.avg_temp_c > 25:
                base_prob += 0.10
            elif req.avg_temp_c > 20:
                base_prob += 0.05
                
            # Humidity factors
            if req.avg_humidity < 30:
                base_prob += 0.20
            elif req.avg_humidity < 40:
                base_prob += 0.10
                
            # Precipitation factors
            if req.precip_mm < 1:
                base_prob += 0.15
            elif req.precip_mm < 5:
                base_prob += 0.05
                
            # Wind factors
            if req.avg_wind_speed_knots > 15:
                base_prob += 0.15
            elif req.avg_wind_speed_knots > 10:
                base_prob += 0.10
                
            # Cap probability at 0.99
            probability = min(0.99, round(base_prob, 4))
            logger.info(f"Fire probability calculated using rules: {probability}")

        return {
            "fire_probability": probability,
            "location": req.location or "Unknown location",
            "prediction_method": "model" if model is not None else "rule-based"
        }
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        raise HTTPException(status_code=500, detail=f"Error making prediction: {str(e)}")

@app.post("/api/analyze")
async def get_ai_analysis(req: AnalysisRequest):
    logger.info(f"AI analysis requested for location: {req.location}, probability: {req.fire_probability}")
    
    if not openai_available:
        logger.warning("OpenAI not available, returning fallback response")
        # Return a fallback response when OpenAI is not available
        return JSONResponse(status_code=200, content={
            "risk_assessment": f"AI analysis is not available. The fire probability is {req.fire_probability:.2%}, which suggests a {'high' if req.fire_probability > 0.5 else 'moderate' if req.fire_probability > 0.3 else 'low'} risk level.",
            "contributing_factors": [
                "Temperature and humidity conditions",
                "Recent precipitation levels",
                "Wind conditions"
            ],
            "recommended_actions": "Please consult local fire authorities for specific recommendations based on your location and conditions."
        })
        
    try:
        logger.info("Preparing OpenAI prompt")
        # Prepare weather data for the prompt
        weather_summary = "\n".join([f"- {key}: {value}" for key, value in req.weather_data.items()])
        
        # Create prompt for OpenAI
        prompt = f"""
        You are a wildfire risk assessment expert. Based on the following weather data for {req.location}, 
        provide a comprehensive analysis of wildfire risk. The calculated fire probability is {req.fire_probability}.
        
        Weather data:
        {weather_summary}
        
        Your analysis should include:
        1. An overall fire risk assessment 
        2. Key contributing factors to the risk level
        3. Recommended actions for residents and authorities
        
        Format your response in JSON with the following structure:
        {{
            "risk_assessment": "Your overall assessment of fire risk",
            "contributing_factors": ["Factor 1", "Factor 2", "Factor 3"],
            "recommended_actions": "Your recommendations for handling the risk"
        }}
        
        Important: Return ONLY the JSON object without any markdown formatting, code blocks, or additional text.
        """
        
        logger.info("Calling OpenAI API")
        # Call OpenAI API
        try:
            response = openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "system", "content": "You are a wildfire risk assessment expert. Always respond with valid JSON only, without any markdown formatting or code blocks."},
                          {"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=500
            )
            
            # Parse the response
            analysis_text = response.choices[0].message.content.strip()
            logger.info("Received OpenAI response")
            logger.debug(f"Response text: {analysis_text}")
            
            # Remove any markdown code block formatting if present
            if analysis_text.startswith("```") and "```" in analysis_text[3:]:
                # Extract content between first and last ```
                first_block = analysis_text.find("```")
                second_block = analysis_text.rfind("```")
                
                if first_block != second_block:
                    # Extract content between the markdown code blocks
                    cleaned_text = analysis_text[first_block+3:second_block].strip()
                    
                    # If there's a language specifier (like ```json), remove that too
                    if cleaned_text.startswith("json") or cleaned_text.startswith("JSON"):
                        cleaned_text = cleaned_text[4:].strip()
                    
                    analysis_text = cleaned_text
                    logger.info("Cleaned markdown formatting from response")
            
            try:
                analysis_data = json.loads(analysis_text)
                logger.info("Successfully parsed OpenAI response as JSON")
                return analysis_data
            except json.JSONDecodeError as json_err:
                logger.error(f"Failed to parse OpenAI response as JSON: {json_err}")
                logger.error(f"Response was: {analysis_text}")
                
                # Try extracting JSON with regex as a last resort
                import re
                json_pattern = r'({[\s\S]*})'
                match = re.search(json_pattern, analysis_text)
                
                if match:
                    try:
                        potential_json = match.group(1)
                        logger.info(f"Attempting to parse extracted JSON: {potential_json}")
                        analysis_data = json.loads(potential_json)
                        logger.info("Successfully parsed extracted JSON")
                        return analysis_data
                    except:
                        logger.error("Failed to parse extracted JSON")
                
                # Fallback in case the response is not valid JSON
                return {
                    "risk_assessment": "Unable to parse AI response. Based on the fire probability, there is a risk of wildfire in your area.",
                    "contributing_factors": ["Weather conditions", "Environmental factors"],
                    "recommended_actions": "Monitor local fire warnings and follow guidance from local authorities."
                }
        except Exception as openai_err:
            logger.error(f"OpenAI API error: {openai_err}")
            raise
            
    except Exception as e:
        logger.error(f"Error in AI analysis: {e}")
        # Provide a graceful fallback response
        return {
            "risk_assessment": f"Based on the data, the fire probability is {req.fire_probability:.2%}, which indicates a {'high' if req.fire_probability > 0.5 else 'moderate' if req.fire_probability > 0.3 else 'low'} risk level.",
            "contributing_factors": [
                "Temperature conditions",
                "Humidity levels",
                "Precipitation data"
            ],
            "recommended_actions": "Stay informed about local fire conditions and follow guidance from authorities."
        }

@app.get("/api/weather")
async def get_weather(
    location: str = Query(..., description="Location name or coordinates"),
    date: str = Query(None, description="Optional date in YYYY-MM-DD format. If not provided, current weather will be returned.")
):
    """
    Get weather data for a specific location and date.
    - Location can be a city name or coordinates in the format "lat,lon".
    - Date should be in YYYY-MM-DD format. If not provided, current weather is returned.
    """
    logger.info(f"Weather data requested for location: {location}, date: {date}")
    
    if not location or location.strip() == "":
        logger.error("Empty location provided")
        raise HTTPException(status_code=400, detail="Location cannot be empty")
    
    try:
        from weather_service import get_weather_data
        
        # Sanitize input
        location = location.strip()
        
        # Parse date if provided
        parsed_date = None
        if date:
            try:
                parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
                logger.info(f"Parsed date: {parsed_date}")
            except ValueError:
                logger.error(f"Invalid date format: {date}")
                raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format")
        
        logger.info(f"Calling weather service for location: {location}, date: {parsed_date}")
        weather_data = get_weather_data(location, parsed_date)
        
        if not weather_data:
            logger.error("Weather service returned empty response")
            raise HTTPException(status_code=500, detail="Failed to retrieve weather data")
        
        if "error" in weather_data:
            logger.error(f"Error fetching weather: {weather_data['error']}")
            raise HTTPException(status_code=500, detail=weather_data["error"])
            
        # Keep only the fields we need for the prediction model and ensure they're all present
        try:
            prediction_fields = {
                'max_temp_c': round(float(weather_data['max_temp_c']), 1),
                'min_temp_c': round(float(weather_data['min_temp_c']), 1),
                'avg_temp_c': round(float(weather_data['avg_temp_c']), 1),
                'heating_deg_days_c': round(float(weather_data['heating_deg_days_c']), 1),
                'cooling_deg_days_c': round(float(weather_data['cooling_deg_days_c']), 1),
                'precip_mm': round(float(weather_data['precip_mm']), 1),
                'avg_humidity': round(float(weather_data['avg_humidity']), 1),
                'avg_wind_speed_knots': round(float(weather_data['avg_wind_speed_knots']), 1),
                'avg_dew_point_f': round(float(weather_data['avg_dew_point_f']), 1),
                'avg_visibility_km': round(float(weather_data['avg_visibility_km']), 1),
                'avg_sea_level_pressure_mb': round(float(weather_data['avg_sea_level_pressure_mb']), 1)
            }
            
            # Add date to response
            prediction_fields['date'] = weather_data.get('date', date if date else datetime.now().strftime("%Y-%m-%d"))
            
            logger.info(f"Weather data processed successfully for {location}, date: {date}")
            return prediction_fields
        except KeyError as ke:
            logger.error(f"Missing key in weather data: {ke}")
            raise HTTPException(status_code=500, detail=f"Weather data missing required field: {ke}")
        except ValueError as ve:
            logger.error(f"Invalid value in weather data: {ve}")
            raise HTTPException(status_code=500, detail=f"Weather data contains invalid value: {ve}")
        
    except ImportError:
        logger.error("Weather service module not found")
        raise HTTPException(status_code=500, detail="Weather service not available")
    except Exception as e:
        logger.error(f"Error in weather API: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching weather data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Uvicorn server")
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)

# Required for Vercel deployment
app = FastAPI() if 'app' not in locals() else app 