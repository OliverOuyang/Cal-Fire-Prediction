@echo off
echo ======================================================
echo California Fire Prediction System - Server Setup
echo ======================================================

echo Checking Python installation...
python --version || (
    echo Python not found. Please install Python 3.8 or higher.
    exit /b 1
)

echo Installing dependencies...
pip install -r requirements.txt

echo Checking environment variables...
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print('OpenAI API Key:', 'Available' if os.getenv('OPENAI_API_KEY') else 'Not found'); print('OpenWeather API Key:', 'Available' if os.getenv('OPENWEATHER_API_KEY') else 'Not found')" || (
    echo Failed to check environment variables. Make sure your .env file exists.
    echo Please add your API keys to the .env file.
    echo See README.md for details.
)

echo Starting server...
echo Access the application at http://127.0.0.1:8000
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload 