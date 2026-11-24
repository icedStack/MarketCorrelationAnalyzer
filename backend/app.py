from pathlib import Path
from datetime import timedelta
from typing import Optional
import json
import time

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import numpy as np
import pandas as pd
import yfinance as yf
from scipy import stats

APP_DIR = Path(__file__).resolve().parent
CACHE_DIR = APP_DIR / ".cache"
CACHE_DIR.mkdir(exist_ok=True)
CACHE_TTL_SECONDS = 6 * 60 * 60
WEB_DIR = APP_DIR.parent / "frontend"

app = FastAPI(title="Market Uncertainty & Asset Returns Explorer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PRESETS = [
    {"ticker": "^VIX", "name": "VIX Index"},
    {"ticker": "GC=F", "name": "Gold Futures"},
    {"ticker": "SI=F", "name": "Silver Futures"},
    {"ticker": "PL=F", "name": "Platinum Futures"},
    {"ticker": "^GSPC", "name": "S&P 500"},
    {"ticker": "DX-Y.NYB", "name": "US Dollar Index"},
]


@app.get("/health")
def health():
    return {"status": "ok", "cache": str(CACHE_DIR)}


@app.get("/api/presets")
def presets():
    return {"presets": PRESETS}


@app.get("/")
def frontend():
    return FileResponse(WEB_DIR / "index.html")


app.mount("/frontend", StaticFiles(directory=WEB_DIR), name="frontend")


def period_to_dates(period: str, start: Optional[str], end: Optional[str]):
    if start or end:
        start_date = pd.Timestamp(start).tz_localize(None) if start else pd.Timestamp("1900-01-01")
        end_date = pd.Timestamp(end).tz_localize(None) if end else pd.Timestamp.now().tz_localize(None)
        return start_date, end_date

    end_date = pd.Timestamp.now().tz_localize(None)
    days = {"1Y": 365, "5Y": 365 * 5, "10Y": 365 * 10}
    if period == "MAX":
        return pd.Timestamp("1900-01-01"), end_date
    if period not in days:
        raise HTTPException(status_code=400, detail="Invalid date range.")
    return end_date - timedelta(days=days[period]), end_date


def safe_ticker_name(ticker: str) -> str:
    return "".join(ch for ch in ticker.upper() if ch.isalnum() or ch in "._-")


def fetch_history(ticker: str, period: str, start: Optional[str], end: Optional[str]) -> pd.Series:
    ticker = ticker.strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="A ticker is required.")

    start_date, end_date = period_to_dates(period, start, end)
    cache_key = safe_ticker_name(ticker)
    cache_file = CACHE_DIR / f"{cache_key}_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.json"

    if cache_file.exists() and time.time() - cache_file.stat().st_mtime < CACHE_TTL_SECONDS:
        try:
            payload = json.loads(cache_file.read_text())
            series = pd.Series(payload["values"], index=pd.to_datetime(payload["dates"]))
            return series
        except Exception:
            cache_file.unlink(missing_ok=True)

    try:
        if start or end:
            frame = yf.Ticker(ticker).history(
                start=start_date.strftime("%Y-%m-%d"),
                end=(end_date + timedelta(days=1)).strftime("%Y-%m-%d"),
                auto_adjust=True,
            )
        elif period == "MAX":
            frame = yf.Ticker(ticker).history(period="max", auto_adjust=True)
        else:
            frame = yf.Ticker(ticker).history(period=period.lower(), auto_adjust=True)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch ticker {ticker}: {exc}") from exc

    if frame is None or frame.empty or "Close" not in frame:
        raise HTTPException(status_code=404, detail=f"No market data found for ticker '{ticker}'. Check that the ticker is valid.")

    close = frame["Close"].copy()
    close.index = pd.to_datetime(close.index).tz_localize(None).normalize()
    close = close.replace([np.inf, -np.inf], np.nan).dropna()
    close = close[close > 0]
    close = close[~close.index.duplicated(keep="last")]
    close = close.loc[(close.index >= start_date) & (close.index <= end_date)]

    if close.empty:
        raise HTTPException(status_code=404, detail=f"No positive closing prices found for ticker '{ticker}' in this date range.")

    payload = {"dates": [d.strftime("%Y-%m-%d") for d in close.index], "values": close.astype(float).tolist()}
    cache_file.write_text(json.dumps(payload))
    return close


def transform_metric(prices: pd.Series, metric: str) -> pd.Series:
    if metric == "level":
        return prices
    if metric == "point_change":
        return prices.diff()
    if metric == "pct_return":
        return prices.pct_change(fill_method=None) * 100
    raise HTTPException(status_code=400, detail="Invalid metric.")


def build_matched_pairs(vx: pd.Series, vy: pd.Series, day_offset: int, metric: str) -> pd.DataFrame:
    aligned = pd.concat([vx.rename("x"), vy.rename("y")], axis=1, join="inner")
    aligned = aligned.replace([np.inf, -np.inf], np.nan).dropna()
    if metric != "level":
        aligned = aligned[(aligned["x"] != 0) & (aligned["y"] != 0)]

    original_dates = pd.Series(aligned.index, index=aligned.index)
    aligned["y_date"] = original_dates.shift(-day_offset)
    aligned["y"] = aligned["y"].shift(-day_offset)
    return aligned.dropna(subset=["x", "y", "y_date"])


def describe_offset(day_offset: int) -> str:
    if day_offset == 0:
        return "Contemporaneous: pair Asset X on trading day t with Asset Y on the same trading day t."
    direction = "forward" if day_offset > 0 else "backward"
    plural = "day" if abs(day_offset) == 1 else "days"
    return (
        f"Asset Y is shifted {direction} by {abs(day_offset)} trading {plural}; pair Asset X on day t "
        f"(X_t with Y_t{day_offset:+d})."
    )


@app.get("/api/correlation")
def correlation(
    asset_x: str = Query("^VIX", description="Asset X ticker"),
    asset_y: str = Query("GC=F", description="Asset Y ticker"),
    metric: str = Query("pct_return", description="level, point_change, or pct_return"),
    range: str = Query("5Y", alias="range"),
    start: Optional[str] = None,
    end: Optional[str] = None,
    window: int = Query(30, ge=2, le=365),
    day_offset: int = Query(0, ge=-30, le=30),
    x: Optional[str] = Query(None, description="Deprecated alias for asset_x"),
    y: Optional[str] = Query(None, description="Deprecated alias for asset_y"),
):
    if metric not in {"pct_return", "point_change", "level"}:
        raise HTTPException(status_code=400, detail="Invalid metric.")

    asset_x = (x or asset_x).strip()
    asset_y = (y or asset_y).strip()
    if not asset_x or not asset_y:
        raise HTTPException(status_code=400, detail="Asset X and Asset Y tickers are required.")

    px = fetch_history(asset_x, range, start, end)
    py = fetch_history(asset_y, range, start, end)
    vx = transform_metric(px, metric)
    vy = transform_metric(py, metric)
    aligned = build_matched_pairs(vx, vy, day_offset, metric)
    if len(aligned) < 5:
        raise HTTPException(
            status_code=422,
            detail=f"Insufficient overlapping data after applying day_offset={day_offset}: found {len(aligned)} matched observations; at least 5 are required.",
        )

    ax = aligned["x"].to_numpy(dtype=float)
    ay = aligned["y"].to_numpy(dtype=float)
    pearson = stats.pearsonr(ax, ay)
    spearman = stats.spearmanr(ax, ay)
    slope, intercept, r_value, *_ = stats.linregress(ax, ay)

    rolling = aligned["x"].rolling(window).corr(aligned["y"])
    rolling_payload = [
        {
            "date": date.strftime("%Y-%m-%d"),
            "x_date": date.strftime("%Y-%m-%d"),
            "y_date": aligned.loc[date, "y_date"].strftime("%Y-%m-%d"),
            "value": None if pd.isna(value) else round(float(value), 6),
        }
        for date, value in rolling.items()
    ]
    rolling_payload = [point for point in rolling_payload if point["value"] is not None]

    x_min, x_max = float(np.min(ax)), float(np.max(ax))
    if x_max == x_min:
        x_min -= 1
        x_max += 1
    trend_x = np.linspace(x_min, x_max, 120)
    trend_y = intercept + slope * trend_x

    step = max(1, len(aligned) // 1500)
    scatter = [
        {
            "date": date.strftime("%Y-%m-%d"),
            "x_date": date.strftime("%Y-%m-%d"),
            "y_date": row.y_date.strftime("%Y-%m-%d"),
            "x": round(float(row.x), 8),
            "y": round(float(row.y), 8),
        }
        for date, row in aligned.iloc[::step].iterrows()
    ]

    def clean_p(value):
        if not np.isfinite(value):
            return None
        return float(value)

    return {
        "pair": {"x": asset_x, "y": asset_y},
        "metric": metric,
        "date_range": {
            "start": aligned.index.min().strftime("%Y-%m-%d"),
            "end": aligned.index.max().strftime("%Y-%m-%d"),
        },
        "n": len(aligned),
        "sample_size": len(aligned),
        "day_offset": day_offset,
        "offset_description": describe_offset(day_offset),
        "start_date": aligned.index.min().strftime("%Y-%m-%d"),
        "end_date": aligned.index.max().strftime("%Y-%m-%d"),
        "pearson": {"r": round(float(pearson.statistic), 6), "p_value": clean_p(pearson.pvalue)},
        "spearman": {"rho": round(float(spearman.statistic), 6), "p_value": clean_p(spearman.pvalue)},
        "ols": {"slope": round(float(slope), 8), "intercept": round(float(intercept), 8), "r_squared": round(float(r_value ** 2), 6)},
        "scatter": scatter,
        "trendline": [{"x": round(float(a), 8), "y": round(float(b), 8)} for a, b in zip(trend_x, trend_y)],
        "rolling": rolling_payload,
        "window": window,
    }
