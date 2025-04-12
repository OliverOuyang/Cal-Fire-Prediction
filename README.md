# California Fire Prediction System

This application provides a comprehensive interface for predicting and analyzing wildfire risks in California. It combines weather data, machine learning-based fire prediction, and AI-powered analysis to give users detailed insights.

## Features

- **Fire Prediction Model**: Predicts fire probability based on weather parameters
- **Interactive Map**: Visualizes current, historical, and risk areas for fires across California
- **Satellite Image Analysis**: Allows upload and analysis of satellite imagery for fire detection
- **AI-powered Analysis**: Leverages OpenAI to provide comprehensive risk assessments and recommendations
- **Historical Weather Analysis**: Retrieve weather data for specific dates to analyze past fire events or study seasonal patterns
- **Real-time Weather Data**: Fetches current weather data from OpenWeatherMap API

## Requirements

- Python 3.8 or higher
- OpenAI API key (for AI analysis)
- OpenWeatherMap API key (for weather data)

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/california-fire-prediction.git
   cd california-fire-prediction
   ```

2. Create a `.env` file in the root directory with your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   OPENWEATHER_API_KEY=your_openweather_api_key_here
   ```

3. Install required dependencies:
   ```
   pip install -r requirements.txt
   ```

## Running the Application

### Using the Batch File (Windows)

Simply run the included batch file:
```
run_server.bat
```

This will check your environment, install dependencies, and start the server.

### Manual Startup

1. Activate your virtual environment (if using one)
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Run the application:
   ```
   python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
   ```
4. Open your browser and navigate to `http://127.0.0.1:8000`

## Using the Application

1. **Set Location**: Enter a city name or coordinates, or use "Use My Location"
2. **Select Date**: Choose a specific date to analyze historical weather data
3. **Get Weather Data**: Click "Auto-fetch Weather" or "Get Weather for Date" to retrieve weather information
4. **Calculate Risk**: Submit the form to calculate fire probability
5. **View Analysis**: Review the AI-generated risk assessment and recommendations

## API Endpoints

- **GET /**: Main application interface
- **POST /api/predict**: Predict fire probability based on weather parameters
- **POST /api/analyze**: Generate AI analysis of fire risk
- **GET /api/weather**: Get weather data for a specific location, with optional date parameter
  - Query parameters:
    - `location`: City name or coordinates in format "lat,lon"
    - `date`: (Optional) Date in YYYY-MM-DD format for historical weather data

## Project Structure

- `/static`: Static assets (CSS, JavaScript)
- `/templates`: HTML templates
- `/Prediction Model`: Contains the fire prediction machine learning model
- `app.py`: Main FastAPI application
- `requirements.txt`: Required Python packages
- `weather_service.py`: Module for fetching weather data

## Technical Details

- **Backend**: FastAPI
- **Frontend**: HTML, CSS, JavaScript, Bootstrap 5
- **Mapping**: Leaflet.js
- **ML Model**: Scikit-learn and XGBoost based fire prediction model
- **AI Analysis**: OpenAI GPT-3.5 Turbo API
- **Weather Data**: OpenWeatherMap API

## Troubleshooting

- **API Key Issues**: Make sure your API keys are correctly set in the `.env` file
- **Weather Data Errors**: Check your location format and ensure you have an active internet connection
- **Browser Cache**: If UI updates don't appear, try clearing your browser cache or use incognito mode

## License

This project is provided for educational purposes. Use responsibly.

## Contributors

- Your Name
- UC Berkeley MIDS Program

## Deployment

### Vercel Deployment

This project can be deployed on Vercel. Follow these steps:

1. Fork or clone this repository to your GitHub account
2. Sign up for a [Vercel account](https://vercel.com/signup) if you don't have one
3. From the Vercel dashboard, click "New Project"
4. Import your GitHub repository
5. Configure the project:
   - Set Framework Preset to "Other"
   - Configure environment variables:
     - `OPENAI_API_KEY`: Your OpenAI API key
     - `OPENWEATHER_API_KEY`: Your OpenWeather API key
6. Click "Deploy"

The application will be automatically built and deployed. Vercel will provide you with a URL for your deployed application.

### Notes on Vercel Deployment

- The free tier of Vercel has some limitations regarding computation time
- The application might experience cold starts
- For heavier workloads, consider using a dedicated hosting service like Heroku or AWS 