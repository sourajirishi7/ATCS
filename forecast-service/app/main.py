from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .models import ForecastRequest, ForecastResponse
from .forecaster import generate_forecast

app = FastAPI(
    title="ATCS Python Forecasting Engine",
    description="Statistical & Machine Learning Spending Forecast Service for ATCS",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "atcs-forecasting-service",
        "version": "1.0.0"
    }

@app.post("/forecast/evaluate", response_model=ForecastResponse)
def evaluate_forecast(req: ForecastRequest):
    try:
        return generate_forecast(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting engine error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
