import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.getenv('DATA_DIR', str(ROOT / 'data'))).resolve()
DATA.mkdir(parents=True, exist_ok=True)
ARTIFACTS = DATA / 'artifacts'
PRODUCTION = os.getenv('APP_ENV', 'development') == 'production'
DEMO = os.getenv('DEMO_MODE', 'true').lower() == 'true'
DATABASE_URL = os.getenv('DATABASE_URL', f'sqlite:///{DATA / "continuum.db"}')
ORIGINS = [x.strip() for x in os.getenv('ALLOWED_ORIGINS', 'http://127.0.0.1:8000,http://localhost:8000,http://127.0.0.1:5173,http://localhost:5173').split(',') if x.strip()]
COOKIE_SECURE = PRODUCTION or os.getenv('COOKIE_SECURE', 'false').lower() == 'true'
SESSION_SECONDS = 8 * 60 * 60
if PRODUCTION and DEMO:
    raise RuntimeError('Production requires DEMO_MODE=false and a separately trained model.')
