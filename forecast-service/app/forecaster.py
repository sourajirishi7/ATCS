import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List
from .models import ForecastRequest, ForecastResponse, ForecastStatusEnum

def generate_forecast(req: ForecastRequest) -> ForecastResponse:
    # 1. Check for insufficient data
    if not req.transactions or len(req.transactions) < 3:
        # Cannot make a reliable statistical forecast
        # We project simply based on current committed + actual, but mark INSUFFICIENT_DATA
        curr_spend = round(req.currentActualSpend + req.currentCommittedSpend, 2)
        variance = round(curr_spend - req.budgetAmount, 2)
        
        status = ForecastStatusEnum.INSUFFICIENT_DATA
        if curr_spend > req.budgetAmount:
            # Current violation already occurred
            status = ForecastStatusEnum.PROJECTED_VIOLATION
            
        return ForecastResponse(
            departmentId=req.departmentId,
            categoryId=req.categoryId,
            period=req.period,
            historicalSpend=round(req.currentActualSpend, 2),
            currentBurnRate=0.0,
            projectedAmount=curr_spend,
            budgetAmount=round(req.budgetAmount, 2),
            variance=variance,
            confidence=0.0,
            methodology="Insufficient Historical Data (< 3 transaction points)",
            status=status,
            reason="Insufficient historical transaction records to generate a statistically valid projection.",
            trendData=[]
        )

    # 2. Convert transactions into DataFrame
    df = pd.DataFrame([{"amount": t.amount, "date": pd.to_datetime(t.date)} for t in req.transactions])
    df = df.sort_values(by="date")
    
    # Aggregate daily
    daily = df.groupby(df['date'].dt.date)['amount'].sum().reset_index()
    daily['date'] = pd.to_datetime(daily['date'])
    daily = daily.sort_values(by="date")

    total_historical = float(df['amount'].sum())
    first_date = daily['date'].min()
    last_date = daily['date'].max()

    days_observed = max((last_date - first_date).days + 1, len(daily))
    
    # 3. Calculate Burn Rates
    # Simple average daily burn
    simple_daily_burn = total_historical / max(days_observed, 1)

    # Exponential weighted moving average daily burn (giving higher weight to recent spend)
    if len(daily) >= 3:
        span_val = min(len(daily), 7)
        ewm_burn = daily['amount'].ewm(span=span_val).mean().iloc[-1]
    else:
        ewm_burn = simple_daily_burn

    # Blended daily burn rate (60% EWMA, 40% Simple average)
    blended_burn_rate = float(0.6 * ewm_burn + 0.4 * simple_daily_burn)
    
    # 4. Period duration (Assume 90 days for quarterly period unless specified)
    total_period_days = 90
    days_elapsed = min(days_observed, total_period_days)
    days_remaining = max(total_period_days - days_elapsed, 15)

    # 5. Projected Remaining & Total Spend
    projected_remaining_spend = blended_burn_rate * days_remaining
    projected_total = float(req.currentActualSpend + req.currentCommittedSpend + projected_remaining_spend)
    projected_total = round(projected_total, 2)

    variance = round(projected_total - req.budgetAmount, 2)
    
    # 6. Evaluation of Status
    if projected_total > req.budgetAmount:
        status = ForecastStatusEnum.PROJECTED_VIOLATION
        reason = f"At the current burn rate of ₹{blended_burn_rate:,.2f}/day, projected spending (₹{projected_total:,.2f}) will exceed the budget (₹{req.budgetAmount:,.2f}) by ₹{variance:,.2f}."
    elif projected_total >= (0.85 * req.budgetAmount):
        status = ForecastStatusEnum.NEAR_FORECAST_LIMIT
        pct = round((projected_total / req.budgetAmount) * 100, 1)
        reason = f"Projected spending of ₹{projected_total:,.2f} reaches {pct}% of the allocated budget (₹{req.budgetAmount:,.2f})."
    else:
        status = ForecastStatusEnum.WITHIN_FORECAST
        remaining = round(req.budgetAmount - projected_total, 2)
        reason = f"Projected spending of ₹{projected_total:,.2f} is well within the allocated budget, leaving approx ₹{remaining:,.2f} headroom."

    # 7. Confidence Score (Based on consistency of daily spend and sample size)
    cv = float(daily['amount'].std() / daily['amount'].mean()) if len(daily) > 1 and daily['amount'].mean() > 0 else 1.0
    consistency_factor = max(0.5, 1.0 - min(cv * 0.2, 0.4))
    sample_factor = min(len(daily) / 10.0, 1.0)
    confidence = round(float(consistency_factor * sample_factor * 100), 1)
    confidence = max(min(confidence, 95.0), 30.0)

    # Build trend points for chart
    trend_points: List[Dict[str, Any]] = []
    cum_sum = 0.0
    for _, row in daily.iterrows():
        cum_sum += float(row['amount'])
        trend_points.append({
            "date": row['date'].strftime("%Y-%m-%d"),
            "dailySpend": round(float(row['amount']), 2),
            "cumulativeSpend": round(cum_sum, 2)
        })

    return ForecastResponse(
        departmentId=req.departmentId,
        categoryId=req.categoryId,
        period=req.period,
        historicalSpend=round(total_historical, 2),
        currentBurnRate=round(blended_burn_rate, 2),
        projectedAmount=projected_total,
        budgetAmount=round(req.budgetAmount, 2),
        variance=variance,
        confidence=confidence,
        methodology="Exponential Weighted Moving Average (EWMA) + Daily Velocity Analysis",
        status=status,
        reason=reason,
        trendData=trend_points
    )
