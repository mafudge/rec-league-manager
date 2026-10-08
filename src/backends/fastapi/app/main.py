from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Rec League Manager API")

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
