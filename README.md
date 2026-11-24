# Market Correlation Analyzer

Live market correlation dashboard with a FastAPI backend and a lightweight frontend.

## Run locally on Windows

From the repository root in PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000>. The backend serves the frontend and fetches Yahoo Finance data, cached locally for six hours.

Asset X and Asset Y each have their own custom ticker field. Enter a Yahoo Finance symbol and choose **Use** (or press Enter) to apply it to that asset and refresh the analysis.

## Project layout

- `frontend/` — dashboard and Correlation Sprint
- `backend/` — FastAPI API and Yahoo Finance data handling

Only the web application and its backend are included in this repository. Historical analysis scripts, raw and processed data, and generated research outputs are maintained separately.

## Deploy to Vercel

Import this GitHub repository into Vercel with the **Root Directory** set to `.`. Leave the framework preset and build command on automatic detection. The root `pyproject.toml` identifies `backend.app:app`, and the root `requirements.txt` installs the backend dependencies. The frontend is served by FastAPI and its static files are promoted to Vercel's CDN.

The market-data cache uses Vercel's temporary directory. It can speed up repeat requests within a function instance, but is not persistent between instances or deployments.