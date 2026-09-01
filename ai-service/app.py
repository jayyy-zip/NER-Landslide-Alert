import os
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, List

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ner-ai-service")

# Path to V3 Model Bundle
MODEL_PATH = os.path.join(os.path.dirname(__file__), "ner_landslide_risk_v3.joblib")

# Global state for loaded model & metadata
model_state: Dict[str, Any] = {
    "model": None,
    "features": [
        "rainfall_24h_mm",
        "rainfall_72h_mm",
        "slope_deg",
        "elevation_m",
        "historical_event_count",
    ],
    "version": "NER V3",
    "threshold": 0.40,
}


def get_risk_tier(prob: float) -> str:
    """
    V3 Risk Tier Mapping:
      0.00 <= probability < 0.40 -> Normal
      0.40 <= probability < 0.60 -> Medium
      0.60 <= probability < 0.80 -> High
      0.80 <= probability <= 1.00 -> Severe
    """
    if prob < 0.40:
        return "Normal"
    elif prob < 0.60:
        return "Medium"
    elif prob < 0.80:
        return "High"
    else:
        return "Severe"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model once on startup
    logger.info(f"Loading NER V3 model from {MODEL_PATH}...")
    if not os.path.exists(MODEL_PATH):
        logger.error(f"Model file not found at {MODEL_PATH}!")
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    loaded_data = joblib.load(MODEL_PATH)
    if isinstance(loaded_data, dict):
        model_state["model"] = loaded_data.get("model", loaded_data)
        if "features" in loaded_data:
            model_state["features"] = loaded_data["features"]
        if "model_version" in loaded_data:
            model_state["version"] = loaded_data["model_version"]
    else:
        model_state["model"] = loaded_data

    model = model_state["model"]
    n_features = getattr(model, "n_features_in_", len(model_state["features"]))
    logger.info(
        f"NER V3 model loaded successfully. Type: {type(model).__name__}, Features expected: {n_features}"
    )
    yield
    logger.info("Shutting down NER AI service.")


app = FastAPI(
    title="NER Landslide Risk V3 Inference API",
    description="Production inference microservice for the NER Disaster Management System (NH-27 Corridor).",
    version="3.0.0",
    lifespan=lifespan,
)

# CORS configuration
allowed_origins_env = os.getenv("CORS_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    rainfall_24h_mm: float = Field(..., description="24-hour cumulative rainfall in mm")
    rainfall_72h_mm: float = Field(..., description="72-hour cumulative rainfall in mm")
    slope_deg: float = Field(..., description="Slope inclination angle in degrees")
    elevation_m: float = Field(..., description="Elevation in meters above sea level")
    historical_event_count: float = Field(..., description="Historical landslide event frequency count")

    class Config:
        json_schema_extra = {
            "example": {
                "rainfall_24h_mm": 31.8,
                "rainfall_72h_mm": 59.4,
                "slope_deg": 34.0,
                "elevation_m": 1200.0,
                "historical_event_count": 3,
            }
        }


class PredictResponse(BaseModel):
    risk_probability: float
    risk_tier: str
    model: str = "NER V3"


class HealthResponse(BaseModel):
    status: str
    model: str


@app.get("/health", response_model=HealthResponse)
def health_check():
    if model_state["model"] is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model is not loaded",
        )
    return {"status": "ok", "model": "NER V3"}


@app.post("/predict", response_model=PredictResponse)
def predict_risk(payload: PredictRequest):
    model = model_state.get("model")
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="NER V3 model is not loaded",
        )

    feature_names = model_state["features"]
    row_values = [
        payload.rainfall_24h_mm,
        payload.rainfall_72h_mm,
        payload.slope_deg,
        payload.elevation_m,
        payload.historical_event_count,
    ]

    # Validate finite numeric values
    for val, name in zip(row_values, feature_names):
        if not np.isfinite(val):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid non-finite value for feature '{name}': {val}",
            )

    try:
        input_df = pd.DataFrame([row_values], columns=feature_names)
        probas = model.predict_proba(input_df)
        prob = float(probas[0][1])
        prob_rounded = round(prob, 4)
        tier = get_risk_tier(prob_rounded)

        return PredictResponse(
            risk_probability=prob_rounded,
            risk_tier=tier,
            model="NER V3",
        )
    except Exception as e:
        logger.error(f"Inference error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference computation error: {str(e)}",
        )
