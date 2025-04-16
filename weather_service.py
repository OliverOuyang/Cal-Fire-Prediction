import os
import requests
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Set up logging
logger = logging.getLogger("fire_prediction.weather")

# Load environment variables
load_dotenv()
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
logger.info(f"Using OpenWeather API key: {'Available' if OPENWEATHER_API_KEY else 'Not available'}")

# Constants
# DEFAULT_API_KEY = "ef2206ff5da67de63306d0b143e20872"  # Fallback API key, free tier limited usage
BASE_URL_CURRENT = "https://api.openweathermap.org/data/2.5/weather"
BASE_URL_FORECAST = "https://api.openweathermap.org/data/2.5/forecast"
BASE_URL_GEOCODING = "https://api.openweathermap.org/geo/1.0/direct"

def get_coordinates(location):
    """Get latitude and longitude from location name."""
    try:
        if not OPENWEATHER_API_KEY:
            logger.error("No OpenWeather API key available")
            return None
            
        params = {
            "q": location,
            "limit": 1,
            "appid": OPENWEATHER_API_KEY
        }
        
        logger.info(f"Calling geocoding API for location: {location}")
        response = requests.get(BASE_URL_GEOCODING, params=params)
        response.raise_for_status()
        
        data = response.json()
        if data and len(data) > 0:
            logger.info(f"Found coordinates for {location}: {data[0]['lat']}, {data[0]['lon']}")
            return {
                "lat": data[0]["lat"],
                "lon": data[0]["lon"],
                "name": data[0]["name"],
                "country": data[0]["country"]
            }
        else:
            logger.warning(f"No location found for: {location}")
            return None
    except Exception as e:
        logger.error(f"Error getting coordinates for {location}: {e}")
        return None

def get_weather_data(location, date=None):
    """
    Get weather data for a specific location and date.
    If date is None, current weather is returned.
    """
    try:
        # Check if API key is available
        if not OPENWEATHER_API_KEY:
            logger.error("No OpenWeather API key available")
            return {"error": "OpenWeather API key is not configured"}
            
        # Get location coordinates if a string was provided
        coords = None
        location_name = ""
        
        if isinstance(location, str):
            # Check if it's in "lat,lon" format
            if "," in location and all(part.replace('.', '', 1).replace('-', '', 1).isdigit() 
                                     for part in location.split(",")):
                lat, lon = map(float, location.split(","))
                coords = {"lat": lat, "lon": lon, "name": f"Coordinates {lat},{lon}"}
                location_name = f"Coordinates {lat},{lon}"
            else:
                # It's a city name
                coords = get_coordinates(location)
                if coords:
                    location_name = f"{coords['name']}, {coords['country']}"
                else:
                    return {
                        "error": f"Could not find coordinates for location: {location}"
                    }
        else:
            # Assume it's a dictionary with lat and lon
            coords = location
            location_name = f"Coordinates {coords['lat']},{coords['lon']}"
        
        # Use appropriate API based on whether date is provided
        
        if date is None or date == datetime.now().date():
            # Get current weather
            params = {
                "lat": coords["lat"],
                "lon": coords["lon"],
                "units": "metric", # Use metric units
                "appid": OPENWEATHER_API_KEY
            }
            
            logger.info(f"Calling weather API for coordinates: {coords['lat']}, {coords['lon']}")
            response = requests.get(BASE_URL_CURRENT, params=params)
            response.raise_for_status()
            data = response.json()
            
            logger.info(f"Weather API response received: {data}")
            
            # Process current weather data
            weather = {
                "location": location_name,
                "date": datetime.now().strftime("%Y-%m-%d"),
                "max_temp_c": round(data["main"]["temp_max"], 1),
                "min_temp_c": round(data["main"]["temp_min"], 1),
                "avg_temp_c": round(data["main"]["temp"], 1),
                "avg_humidity": round(data["main"]["humidity"], 1),
                "avg_wind_speed_knots": round(data["wind"]["speed"] * 1.94384, 1),  # Convert m/s to knots
                "avg_visibility_km": round(data["visibility"] / 1000, 1),  # Convert m to km
                "avg_sea_level_pressure_mb": round(data["main"]["pressure"], 1),
            }
            
            # Handle precipitation - it might not exist in the response
            if "rain" in data and "1h" in data["rain"]:
                weather["precip_mm"] = round(data["rain"]["1h"], 1)
            else:
                weather["precip_mm"] = 0.0
                
            # Calculate derived values
            weather["avg_dew_point_f"] = round(calculate_dew_point(data["main"]["temp"], data["main"]["humidity"]), 1)
            weather["heating_deg_days_c"] = round(max(0, 18 - data["main"]["temp"]), 1)  # Base temperature 18°C
            weather["cooling_deg_days_c"] = round(max(0, data["main"]["temp"] - 18), 1)  # Base temperature 18°C
            
            logger.info(f"Successfully fetched current weather for {location_name}")
            return weather
        else:
            # For historical data, we would normally use paid APIs
            # In this demo, we'll generate synthetic data based on seasonal averages
            return generate_synthetic_weather_data(coords, date, location_name)
            
    except Exception as e:
        logger.error(f"Error fetching weather data: {e}")
        return {
            "error": f"Error fetching weather data: {str(e)}"
        }

def calculate_dew_point(temp_c, humidity):
    """Calculate dew point in Fahrenheit from temperature in Celsius and humidity percentage."""
    a = 17.27
    b = 237.7
    
    # Calculate dew point in Celsius
    alpha = ((a * temp_c) / (b + temp_c)) + math.log(humidity / 100.0)
    dew_point_c = (b * alpha) / (a - alpha)
    
    # Convert to Fahrenheit
    dew_point_f = (dew_point_c * 9/5) + 32
    
    return dew_point_f

def generate_synthetic_weather_data(coords, date, location_name):
    """Generate synthetic weather data for demonstration purposes."""
    import random
    
    # Convert string date to datetime if needed
    if isinstance(date, str):
        date = datetime.strptime(date, "%Y-%m-%d").date()
    
    # Base temperature on season (Northern Hemisphere)
    month = date.month
    
    # Seasonal temperature ranges (adjust based on latitude)
    lat = coords["lat"]
    seasonal_factor = abs(lat) / 90.0  # Higher latitudes have more seasonal variation
    
    # Northern Hemisphere seasons
    if lat >= 0:
        if 3 <= month <= 5:  # Spring
            base_temp = 15 + random.uniform(-5, 5)
        elif 6 <= month <= 8:  # Summer
            base_temp = 25 + random.uniform(-5, 5)
        elif 9 <= month <= 11:  # Fall
            base_temp = 15 + random.uniform(-5, 5)
        else:  # Winter
            base_temp = 5 + random.uniform(-5, 5)
    # Southern Hemisphere seasons (reversed)
    else:
        if 3 <= month <= 5:  # Fall
            base_temp = 15 + random.uniform(-5, 5)
        elif 6 <= month <= 8:  # Winter
            base_temp = 5 + random.uniform(-5, 5)
        elif 9 <= month <= 11:  # Spring
            base_temp = 15 + random.uniform(-5, 5)
        else:  # Summer
            base_temp = 25 + random.uniform(-5, 5)
    
    # Adjust for latitude
    base_temp = base_temp - (seasonal_factor * 20)
    
    # Daily temperature fluctuation
    avg_temp = base_temp
    max_temp = avg_temp + random.uniform(2, 8)
    min_temp = avg_temp - random.uniform(2, 8)
    
    # Humidity varies by temperature (hotter = potentially less humid)
    humidity = max(30, min(90, 70 - (avg_temp - 15) + random.uniform(-20, 20)))
    
    # Precipitation - higher chance in spring/fall
    if (3 <= month <= 5) or (9 <= month <= 11):
        precip_chance = 0.4
    else:
        precip_chance = 0.2
    
    precip_mm = 0
    if random.random() < precip_chance:
        precip_mm = random.uniform(0.1, 30)
    
    # Wind speed - higher in winter/spring
    if month <= 5 or month == 12:
        wind_speed = random.uniform(5, 15)
    else:
        wind_speed = random.uniform(2, 10)
    
    # Calculate dew point, simulated
    dew_point_c = avg_temp - ((100 - humidity) / 5)
    dew_point_f = (dew_point_c * 9/5) + 32
    
    # Visibility - lower with precipitation
    visibility = max(0.5, min(20, 15 - (precip_mm / 5) + random.uniform(-2, 2)))
    
    # Pressure - normal range with slight variation
    pressure = 1013 + random.uniform(-10, 10)
    
    # Heating/cooling degree days (base temperature 18°C)
    heating_deg_days = max(0, 18 - avg_temp)
    cooling_deg_days = max(0, avg_temp - 18)
    
    weather = {
        "location": location_name,
        "date": date.strftime("%Y-%m-%d"),
        "max_temp_c": round(max_temp, 1),
        "min_temp_c": round(min_temp, 1),
        "avg_temp_c": round(avg_temp, 1),
        "heating_deg_days_c": round(heating_deg_days, 1),
        "cooling_deg_days_c": round(cooling_deg_days, 1),
        "precip_mm": round(precip_mm, 1),
        "avg_humidity": round(humidity, 1),
        "avg_wind_speed_knots": round(wind_speed, 1),
        "avg_dew_point_f": round(dew_point_f, 1),
        "avg_visibility_km": round(visibility, 1),
        "avg_sea_level_pressure_mb": round(pressure, 1),
    }
    
    logger.info(f"Generated synthetic weather data for {location_name} on {date}")
    return weather

# Import math module for dew point calculation
import math 