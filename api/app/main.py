from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import vendors, employees, verification

settings = get_settings()

app = FastAPI(title="Vendor Onboarding API")

_origins = [settings.frontend_url, "https://zamp-vendor-onboarding.vercel.app"]
# Include any additional origins from env (comma-separated)
if settings.frontend_url not in _origins:
    _origins.append(settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://zamp-vendor-onboarding.*\.vercel\.app",
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
