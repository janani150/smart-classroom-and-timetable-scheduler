from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Smart Classroom API",
    version="1.0.0",
    description="Backend API for the Smart Classroom management system",
)

# ─── CORS ────────────────────────────────────────────────────────────────────
# Tighten allow_origins in production – replace "*" with your frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(router, prefix="/api")

# ─── Health check ────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Smart Classroom API is running 🚀"}


@app.get("/health")
def health():
    """Lightweight liveness probe for deployment platforms."""
    return {"status": "ok"}


# ─── Entrypoint (dev only) ───────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)