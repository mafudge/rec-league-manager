from fastapi import FastAPI
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
