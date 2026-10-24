from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .db import create_tables
from .errors import register_handlers
from .routes import auth as auth_routes
from .routes import entrants as entrant_routes
from .routes import leagues as league_routes
from .routes import schedule as schedule_routes


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_tables()
    yield


app = FastAPI(title="Rec League Manager API", lifespan=lifespan)
register_handlers(app)
app.include_router(auth_routes.router)
app.include_router(league_routes.router)
app.include_router(entrant_routes.router)
app.include_router(schedule_routes.router)

# Browser frontends (web, Flutter) run on another port, so allow any origin (ADR 003).
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/backend")
def backend() -> dict[str, str]:
    return {"backend": "fastapi"}


@app.get("/api/hello", response_model=None)
def hello(name: str = "") -> dict[str, str] | JSONResponse:
    # Refuse a blank name with 400 ourselves, not FastAPI's 422, so every backend refuses alike.
    name = name.strip()
    if not name:
        return JSONResponse({"error": "Name is required"}, status_code=400)
    return {"message": f"Hello {name}"}
