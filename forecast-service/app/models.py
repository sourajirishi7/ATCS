from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class ForecastStatusEnum(str, Enum):
    WITHIN_FORECAST = "WITHIN_FORECAST"
    NEAR_FORECAST_LIMIT = "NEAR_FORECAST_LIMIT"
    PROJECTED_VIOLATION = "PROJECTED_VIOLATION"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"

class TransactionInput(BaseModel):
    amount: float
    date: str
    categoryId: Optional[str] = None

class ForecastRequest(BaseModel):
    departmentId: str
    categoryId: Optional[str] = None
    period: str
    budgetAmount: float
    currentActualSpend: float
    currentCommittedSpend: float = 0.0
    transactions: List[TransactionInput] = []
    periodStartDate: Optional[str] = None
    periodEndDate: Optional[str] = None

class ForecastResponse(BaseModel):
    departmentId: str
    categoryId: Optional[str] = None
    period: str
    historicalSpend: float
    currentBurnRate: float
    projectedAmount: float
    budgetAmount: float
    variance: float
    confidence: float
    methodology: str
    status: ForecastStatusEnum
    reason: str
    trendData: Optional[List[Dict[str, Any]]] = None
