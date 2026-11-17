from pathlib import Path

from dotenv import load_dotenv

# Local dev only: read src/backends/fastapi/.env (if present) before any module reads the environment.
# An explicit path, so a .env elsewhere in the repo is never picked up. Real environment variables win,
# so Render's settings are never overridden.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
