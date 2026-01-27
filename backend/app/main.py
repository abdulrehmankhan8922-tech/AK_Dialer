from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import engine, Base
from app.core.security import decode_access_token
from app.api import api_router
from app.websockets.dialer import router as websocket_router
from app.services.ami_event_listener import ami_event_listener
import asyncio
import logging

logger = logging.getLogger(__name__)

# Note: Database tables are created via SQL script (database_schema.sql)
# Uncomment the line below only if you need SQLAlchemy to create tables automatically
# Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - startup and shutdown"""
    # Startup
    logger.info("Starting up Grainbox Dialer API...")
    
    # Start AMI event listener if not using mock dialer
    # Start in background to avoid blocking startup
    if not settings.USE_MOCK_DIALER:
        try:
            logger.info("Starting AMI event listener in background...")
            # Start in background task to avoid blocking startup
            asyncio.create_task(ami_event_listener.start_listening())
            logger.info("AMI event listener start initiated (will connect in background)")
        except Exception as e:
            logger.error(f"Failed to start AMI event listener: {e}")
            logger.warning("Continuing without AMI event listener (calls may not update in real-time)")
    else:
        logger.info("Using mock dialer - AMI event listener disabled")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Grainbox Dialer API...")
    if not settings.USE_MOCK_DIALER:
        try:
            # Set a timeout for shutdown to avoid hanging
            await asyncio.wait_for(ami_event_listener.stop_listening(), timeout=5.0)
            logger.info("AMI event listener stopped")
        except asyncio.TimeoutError:
            logger.warning("AMI event listener shutdown timed out, forcing disconnect")
            # Force disconnect
            if ami_event_listener.connection:
                try:
                    ami_event_listener.connection.close()
                except:
                    pass
                ami_event_listener.connection = None
                ami_event_listener.connected = False
        except Exception as e:
            logger.error(f"Error stopping AMI event listener: {e}")


app = FastAPI(
    title="Grainbox Dialer API",
    description="Auto-dialer solution API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()


# Dependency function for routes that need agent_id
async def get_current_agent_id(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    """Dependency to extract agent_id from JWT token"""
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    agent_id = payload.get("agent_id")
    if agent_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return agent_id


# Include routers
app.include_router(api_router)
app.include_router(websocket_router)


@app.get("/")
async def root():
    return {
        "message": "Grainbox Dialer API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
