from fastapi import FastAPI

app = FastAPI(title="Rec League Manager API")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
