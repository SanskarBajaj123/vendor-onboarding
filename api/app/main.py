from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import vendors, employees, verification

settings = get_settings()

app = FastAPI(title="Vendor Onboarding API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vendors.router)
app.include_router(employees.router)
app.include_router(verification.router)


@app.get("/health")
def health():
    return {"status": "ok"}
