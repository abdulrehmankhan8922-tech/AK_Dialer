from fastapi import APIRouter
from app.api.routes import auth, agents, calls, campaigns, stats, contacts, admin, recordings

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(agents.router)
api_router.include_router(calls.router)
api_router.include_router(recordings.router)
api_router.include_router(campaigns.router)
api_router.include_router(stats.router)
api_router.include_router(contacts.router)
api_router.include_router(admin.router)
