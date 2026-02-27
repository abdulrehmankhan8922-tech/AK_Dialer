from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.core.database import get_db
from app.core.config import settings
from app.schemas.call import DialRequest, CallResponse, DispositionRequest
from app.models.call import Call, CallStatus, CallDirection
from app.models.agent import Agent, AgentStatus
from app.models.contact import Contact, ContactStatus
from app.services.dialer_service import DialerService
from app.services.websocket_manager import websocket_manager
from app.api.deps import get_current_agent_id
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/calls", tags=["calls"])

# Initialize dialer service as a singleton
dialer_service = DialerService()


@router.post("/dial", response_model=CallResponse)
async def dial(
    dial_request: DialRequest,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Initiate a call"""
    try:
        # Fetch agent once
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        
        # Create call record
        call_unique_id = str(uuid.uuid4())
        call = Call(
            agent_id=agent_id,
            campaign_id=dial_request.campaign_id,
            contact_id=dial_request.contact_id,
            phone_number=dial_request.phone_number,
            direction=CallDirection.OUTBOUND,
            status=CallStatus.DIALING,
            call_unique_id=call_unique_id
        )
        db.add(call)
        db.flush()  # Flush to get the ID without committing
        
        # Initiate call via dialer service
        call_result = await dialer_service.initiate_call(
            phone_number=dial_request.phone_number,
            agent_extension=agent.phone_extension,
            campaign_id=dial_request.campaign_id,
            contact_id=dial_request.contact_id
        )
        
        # Update call status
        call.status = call_result.get("status", CallStatus.DIALING)
        call.freeswitch_channel = call_result.get("asterisk_channel") or call_result.get("freeswitch_channel")
        
        # Update agent status
        agent.status = AgentStatus.IN_CALL.value
        
        # Single commit for all changes
        db.commit()
        db.refresh(call)
        
        # Register call in channel tracker
        from app.services.channel_tracker import channel_tracker
        channel_tracker.register_call(call.call_unique_id)
        
        # Send WebSocket update (non-blocking)
        try:
            # Handle both enum and string status
            status_value = call.status.value if hasattr(call.status, 'value') else call.status
            await websocket_manager.send_call_update(agent_id, {
                "call_id": call.id,
                "status": status_value,
                "phone_number": call.phone_number
            })
        except Exception as ws_error:
            logger.warning(f"WebSocket update failed: {ws_error}")
        
        return CallResponse.model_validate(call)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error initiating call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error initiating call")


@router.post("/hangup/{call_id}")
async def hangup(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Hangup a call"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        if not call.call_unique_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call unique ID not found")
        
        # Hangup via dialer service (uses call_unique_id)
        success = await dialer_service.hangup_call(call.call_unique_id)
        
        if success:
            call.status = CallStatus.ENDED
            call.end_time = datetime.now(timezone.utc)
            if call.start_time:
                duration = (call.end_time - call.start_time).total_seconds()
                call.duration = int(duration)
            # Calculate talk duration (answered to end)
            if call.answered_time:
                talk_duration = (call.end_time - call.answered_time).total_seconds()
                call.talk_duration = int(talk_duration)
            
            # Update agent status
            agent = db.query(Agent).filter(Agent.id == agent_id).first()
            if agent:
                agent.status = AgentStatus.AVAILABLE.value
            
            db.commit()
            
            # Send WebSocket updates
            try:
                await websocket_manager.send_call_update(agent_id, {
                    "call_id": call.id,
                    "status": CallStatus.ENDED.value
                })
                await websocket_manager.send_agent_status_update(agent_id, "available")
            except Exception as ws_error:
                logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"success": success, "call_id": call_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error hanging up call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error hanging up call")


@router.post("/transfer/{call_id}")
async def transfer(
    call_id: int,
    target_extension: str,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Transfer a call"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        if not call.call_unique_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call unique ID not found")
        
        success = await dialer_service.transfer_call(call.call_unique_id, target_extension)
        
        if success:
            call.status = CallStatus.TRANSFERRED
            call.end_time = datetime.now(timezone.utc)
            db.commit()
            
            try:
                await websocket_manager.send_call_update(agent_id, {
                    "call_id": call.id,
                    "status": CallStatus.TRANSFERRED.value
                })
                await websocket_manager.send_agent_status_update(agent_id, "available")
            except Exception as ws_error:
                logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"success": success}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error transferring call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error transferring call")


@router.post("/park/{call_id}")
async def park(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Park a call"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        if not call.call_unique_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call unique ID not found")
        
        success = await dialer_service.park_call(call.call_unique_id)
        
        if success:
            call.status = CallStatus.PARKED
            db.commit()
            
            try:
                await websocket_manager.send_call_update(agent_id, {
                    "call_id": call.id,
                    "status": CallStatus.PARKED.value
                })
                await websocket_manager.send_agent_status_update(agent_id, "available")
            except Exception as ws_error:
                logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"success": success}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error parking call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error parking call")


@router.get("/current")
async def get_current_call(db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Get current active call for agent"""
    try:
        call = db.query(Call).filter(
            Call.agent_id == agent_id,
            Call.status.in_([CallStatus.DIALING, CallStatus.RINGING, CallStatus.CONNECTED, CallStatus.ANSWERED])
        ).order_by(Call.start_time.desc()).first()
        
        if not call:
            return {"call": None}
        
        return {"call": CallResponse.model_validate(call)}
    except Exception as e:
        logger.error(f"Error getting current call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error fetching current call")


@router.get("/history", response_model=List[CallResponse])
async def get_call_history(
    filter: str = "today",
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Get call history for agent"""
    try:
        query = db.query(Call).filter(Call.agent_id == agent_id)
        
        if filter == "today":
            # Use timezone-aware datetime
            now = datetime.now(timezone.utc)
            today = now.date()
            today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
            query = query.filter(Call.start_time >= today_start)
        elif filter == "outbound":
            query = query.filter(Call.direction == CallDirection.OUTBOUND)
        elif filter == "inbound":
            query = query.filter(Call.direction == CallDirection.INBOUND)
        # "all" doesn't add any filter
        
        calls = query.order_by(Call.start_time.desc()).limit(100).all()
        return [CallResponse.model_validate(call) for call in calls]
    except Exception as e:
        logger.error(f"Error getting call history: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error fetching call history")


@router.post("/{call_id}/disposition")
async def set_disposition(
    call_id: int,
    disposition_request: DispositionRequest,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Set disposition code and notes for a call"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found or not owned by agent")
        
        # Update call notes and disposition
        if disposition_request.notes:
            call.notes = disposition_request.notes
        call.disposition = disposition_request.disposition
        
        # Update call status to ended if not already
        if call.status not in [CallStatus.ENDED, CallStatus.FAILED, CallStatus.TRANSFERRED, CallStatus.PARKED]:
            call.status = CallStatus.ENDED
            call.end_time = datetime.now(timezone.utc)
            if call.start_time:
                duration = (call.end_time - call.start_time).total_seconds()
                call.duration = int(duration)
        
        # Update contact status based on disposition
        if call.contact_id:
            contact = db.query(Contact).filter(Contact.id == call.contact_id).first()
            if contact:
                # Map disposition to contact status
                disposition_map = {
                    "SALE": ContactStatus.CONTACTED,
                    "NA": ContactStatus.NOT_ANSWERED,
                    "BUSY": ContactStatus.BUSY,
                    "VM": ContactStatus.NOT_ANSWERED,
                    "DNC": ContactStatus.DO_NOT_CALL
                }
                contact.status = disposition_map.get(disposition_request.disposition, ContactStatus.CONTACTED)
        
        # Update agent status to available
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if agent:
            agent.status = AgentStatus.AVAILABLE
        
        db.commit()
        
        # Send WebSocket updates
        try:
            await websocket_manager.send_call_update(agent_id, {
                "call_id": call.id,
                "status": CallStatus.ENDED.value,
                "disposition": disposition_request.disposition
            })
            await websocket_manager.send_agent_status_update(agent_id, "available")
        except Exception as ws_error:
            logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"message": "Disposition set successfully", "call_id": call_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error setting disposition: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error setting disposition")


@router.post("/{call_id}/mute")
async def mute_call(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Mute a call"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        if not call.call_unique_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call unique ID not found")
        
        success = await dialer_service.mute_call(call.call_unique_id)
        
        if success:
            call.is_muted = True
            db.commit()
            
            try:
                await websocket_manager.send_call_update(agent_id, {
                    "call_id": call.id,
                    "is_muted": True
                })
            except Exception as ws_error:
                logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"success": success, "is_muted": call.is_muted}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error muting call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error muting call")


@router.post("/{call_id}/unmute")
async def unmute_call(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Unmute a call"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        if not call.call_unique_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call unique ID not found")
        
        success = await dialer_service.unmute_call(call.call_unique_id)
        
        if success:
            call.is_muted = False
            db.commit()
            
            try:
                await websocket_manager.send_call_update(agent_id, {
                    "call_id": call.id,
                    "is_muted": False
                })
            except Exception as ws_error:
                logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"success": success, "is_muted": call.is_muted}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error unmuting call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error unmuting call")


@router.post("/{call_id}/hold")
async def hold_call(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Put a call on hold"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        if not call.call_unique_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call unique ID not found")
        
        success = await dialer_service.hold_call(call.call_unique_id)
        
        if success:
            call.is_on_hold = True
            db.commit()
            
            try:
                await websocket_manager.send_call_update(agent_id, {
                    "call_id": call.id,
                    "is_on_hold": True
                })
            except Exception as ws_error:
                logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"success": success, "is_on_hold": call.is_on_hold}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error holding call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error holding call")


@router.post("/{call_id}/unhold")
async def unhold_call(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Take a call off hold"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        if not call.call_unique_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call unique ID not found")
        
        success = await dialer_service.unhold_call(call.call_unique_id)
        
        if success:
            call.is_on_hold = False
            db.commit()
            
            try:
                await websocket_manager.send_call_update(agent_id, {
                    "call_id": call.id,
                    "is_on_hold": False
                })
            except Exception as ws_error:
                logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"success": success, "is_on_hold": call.is_on_hold}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error unholding call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error unholding call")


@router.post("/inbound/{call_id}/answer")
async def answer_inbound_call(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Answer an incoming call"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.direction == CallDirection.INBOUND.value).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inbound call not found")
        
        if call.status != CallStatus.RINGING.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call is not in ringing state")
        
        # Update call status to answered and assign to agent
        call.status = CallStatus.ANSWERED.value
        call.agent_id = agent_id
        
        # Track answered time and calculate ring duration
        if not call.answered_time:
            call.answered_time = datetime.now(timezone.utc)
            if call.ring_time:
                ring_duration = (call.answered_time - call.ring_time).total_seconds()
                call.ring_duration = int(ring_duration)
        
        db.commit()
        
        # Send WebSocket update
        try:
            await websocket_manager.send_call_update(agent_id, {
                "call_id": call.id,
                "status": call.status,
                "phone_number": call.phone_number,
                "direction": call.direction
            })
        except Exception as ws_error:
            logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"success": True, "call_id": call_id, "status": call.status}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error answering inbound call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error answering call")


@router.post("/inbound/{call_id}/reject")
async def reject_inbound_call(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Reject an incoming call"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.direction == CallDirection.INBOUND.value).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inbound call not found")
        
        # Update call status to ended
        call.status = CallStatus.ENDED.value
        call.end_time = datetime.now(timezone.utc)
        db.commit()
        
        # Hangup the call via Asterisk if we have the channel
        if call.call_unique_id:
            try:
                # Get agent channel and hangup
                from app.services.channel_tracker import channel_tracker
                channels = channel_tracker.get_call_channels(call.call_unique_id)
                if channels and channels.get('customer_channel'):
                    from app.services.asterisk_service import AsteriskService
                    asterisk_service = AsteriskService()
                    await asterisk_service.hangup_call(channels['customer_channel'])
            except Exception as hangup_error:
                logger.warning(f"Error hanging up rejected call: {hangup_error}")
        
        # Send WebSocket update
        try:
            await websocket_manager.send_call_update(agent_id, {
                "call_id": call.id,
                "status": call.status
            })
        except Exception as ws_error:
            logger.warning(f"WebSocket update failed: {ws_error}")
        
        return {"success": True, "call_id": call_id, "status": call.status}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error rejecting inbound call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error rejecting call")
