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
    logger.info("Starting up AK Dialer API...")
    
    # Start AMI event listener if not using mock dialer
    # Start in background to avoid blocking startup - completely fire and forget
    if not settings.USE_MOCK_DIALER:
        try:
            logger.info("Starting AMI event listener in background (non-blocking)...")
            # Start in background task with delay - fire and forget, don't wait
            async def delayed_start():
                await asyncio.sleep(5)  # Wait 5 seconds for app to fully start
                try:
                    await ami_event_listener.start_listening()
                except Exception as e:
                    logger.error(f"Error in AMI event listener background task: {e}")
            
            # Create task but don't await - completely non-blocking
            task = asyncio.create_task(delayed_start())
            # Don't wait for it, let it run in background
            logger.info("AMI event listener task created (will start in 5s, non-blocking)")
        except Exception as e:
            logger.error(f"Failed to create AMI event listener task: {e}")
            logger.warning("Continuing without AMI event listener (calls may not update in real-time)")
    else:
        logger.info("Using mock dialer - AMI event listener disabled")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AK Dialer API...")
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
    title="AK Dialer API",
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

# Security - use the one from deps.py to avoid duplication
from app.api.deps import get_current_agent_id


# Include routers
app.include_router(api_router)
app.include_router(websocket_router)


@app.get("/")
async def root():
    return {
        "message": "AK Dialer API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
