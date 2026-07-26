from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import assignments, hil, escalations, certifications, audit, analytics, intake, programs, learning, avathar, meetings

app = FastAPI(title="Avathar — Talent Nurturing API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assignments.router)
app.include_router(hil.router)
app.include_router(escalations.router)
app.include_router(certifications.router)
app.include_router(audit.router)
app.include_router(analytics.router)
app.include_router(intake.router)
app.include_router(programs.router)
app.include_router(learning.router)
app.include_router(avathar.router)
app.include_router(meetings.router)

@app.get("/")
async def root():
    return {"status": "ok", "service": "Talent Nurturing API v2"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
