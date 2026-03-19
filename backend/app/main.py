from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import router  # Or wherever your router lives

app = FastAPI(title="Smart Classroom API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # "*" catches "null" too in most browsers; drop explicit "null" if not needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
async def root():  # Add 'async' for consistency (optional)
    return {"message": "Backend is running 🚀"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)