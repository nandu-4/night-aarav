"""
SkillForge — the enterprise learning portal of the Talent Nurturing ecosystem.
"Forging skills, closing gaps."

Employees train here; the Talent Nurturing Agent stays the source of truth
(programs, grading, completion, certification records, HIL decisions).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import ensure_indexes
from routers import analytics, auth_routes, certs, employee, manage, notify
from services.portal import seed_users


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_indexes()
    await seed_users()
    yield


app = FastAPI(title="SkillForge API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(employee.router)
app.include_router(certs.router)
app.include_router(notify.router)
app.include_router(manage.router)
app.include_router(analytics.router)


@app.get("/")
async def root():
    return {"service": "SkillForge", "tagline": "Forging skills, closing gaps",
            "source_of_truth": "Talent Nurturing Agent"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
