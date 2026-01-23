from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from app.core.database import get_db
from app.models.call import Call, CallStatus
from app.models.call_recording import CallRecording
from app.services.dialer_service import DialerService
from app.services.websocket_manager import websocket_manager
from app.api.deps import get_current_agent_id
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/calls", tags=["recordings"])

dialer_service = DialerService()


@router.post("/{call_id}/recording/start")
async def start_recording(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Start recording a call"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        if not call.call_unique_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call unique ID not found")
        
        if call.status not in [CallStatus.ANSWERED.value, CallStatus.CONNECTED.value]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call must be answered to start recording")
        
        # Generate recording file path
        file_path = f"/var/spool/asterisk/monitor/{call.call_unique_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        
        success = await dialer_service.start_recording(call.call_unique_id, file_path)
        
        if success:
            # Create recording record
            recording = CallRecording(
                call_id=call.id,
                file_path=file_path,
                created_at=datetime.now(timezone.utc)
            )
            db.add(recording)
            db.commit()
            db.refresh(recording)
            
            # Update call recording path if not set
            if not call.recording_path:
                call.recording_path = file_path
                db.commit()
            
            try:
                await websocket_manager.send_call_update(agent_id, {
                    "call_id": call.id,
                    "recording": True,
                    "recording_id": recording.id
                })
            except Exception as ws_error:
                logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"success": success, "call_id": call_id, "recording_id": recording.id if success else None}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error starting recording: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error starting recording")


@router.post("/{call_id}/recording/stop")
async def stop_recording(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Stop recording a call"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        if not call.call_unique_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call unique ID not found")
        
        success = await dialer_service.stop_recording(call.call_unique_id)
        
        if success:
            # Update the latest recording record
            recording = db.query(CallRecording).filter(
                CallRecording.call_id == call.id
            ).order_by(CallRecording.created_at.desc()).first()
            
            if recording:
                # Update recording with end time/duration if available
                # Duration would be calculated from file or CDR
                pass
            
            try:
                await websocket_manager.send_call_update(agent_id, {
                    "call_id": call.id,
                    "recording": False
                })
            except Exception as ws_error:
                logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"success": success, "call_id": call_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error stopping recording: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error stopping recording")


@router.get("/{call_id}/recordings")
async def get_call_recordings(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Get all recordings for a call"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        recordings = db.query(CallRecording).filter(CallRecording.call_id == call_id).order_by(CallRecording.created_at.desc()).all()
        
        return {
            "call_id": call_id,
            "recordings": [
                {
                    "id": r.id,
                    "file_path": r.file_path,
                    "file_size": r.file_size,
                    "duration": r.duration,
                    "created_at": r.created_at.isoformat() if r.created_at else None
                }
                for r in recordings
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching recordings: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error fetching recordings")
