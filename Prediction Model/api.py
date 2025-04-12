
from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd

model = joblib.load("fire_prediction_model.pkl")
selected_features = [
    'max_temp_c', 'min_temp_c', 'avg_temp_c', 'heating_deg_days_c',
    'cooling_deg_days_c', 'precip_mm', 'avg_humidity',
    'avg_wind_speed_knots', 'avg_dew_point_f', 'avg_visibility_km',
    'avg_sea_level_pressure_mb', 'temp_range_c', 'heat_index', 'drought_indicator'
]

app = FastAPI()

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

@app.post("/predict")
def predict_fire_prob(req: FireRequest):
    temp_range = req.max_temp_c - req.min_temp_c
    heat_index = req.avg_temp_c * (1 + 0.01 * req.avg_humidity)
    drought_indicator = int(req.precip_mm < 5 and req.avg_temp_c > 25)

    input_data = {
        **req.dict(),
        "temp_range_c": temp_range,
        "heat_index": heat_index,
        "drought_indicator": drought_indicator
    }

    input_df = pd.DataFrame([input_data])[selected_features]
    fire_prob = model.predict_proba(input_df)[0, 1]

    return {
        "fire_probability": round(float(fire_prob), 4)
    }
