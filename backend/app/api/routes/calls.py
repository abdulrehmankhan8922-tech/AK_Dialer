from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.core.database import get_db
from app.core.config import settings
from app.schemas.call import DialRequest, CallResponse, DispositionRequest
from app.models.call import Call, CallStatus, CallDirection
from app.models.agent import Agent, AgentStatus
from app.models.contact import Contact, ContactStatus
from app.services.dialer_service import DialerService
from app.services.websocket_manager import websocket_manager
from app.api.deps import get_current_agent_id
from datetime import datetime, timezone, timedelta
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
        
        # Check if agent already has an active call (prevent duplicate/abandoned calls)
        active_call = db.query(Call).filter(
            Call.agent_id == agent_id,
            Call.status.in_([CallStatus.DIALING.value, CallStatus.RINGING.value, CallStatus.CONNECTED.value, CallStatus.ANSWERED.value]),
            Call.end_time.is_(None)
        ).first()
        
        if active_call:
            current_time = datetime.now(timezone.utc)
            time_diff = None
            
            # Calculate time difference based on available timestamps
            if active_call.start_time:
                time_diff = (current_time - active_call.start_time).total_seconds()
            elif active_call.answered_time:
                time_diff = (current_time - active_call.answered_time).total_seconds()
            
            # Check if call is stuck in DIALING (older than 30 seconds)
            if active_call.status == CallStatus.DIALING.value and time_diff and time_diff > 30:
                logger.warning(f"Clearing stuck DIALING call {active_call.id} for agent {agent_id} (age: {time_diff}s)")
                active_call.status = CallStatus.FAILED.value
                active_call.end_time = current_time
                # Update agent status
                agent.status = AgentStatus.AVAILABLE.value
                # Update contact status if exists
                if active_call.contact_id:
                    contact = db.query(Contact).filter(Contact.id == active_call.contact_id).first()
                    if contact:
                        contact.status = ContactStatus.FAILED
                db.commit()
                # Hang up trunk channels to stop the actual Asterisk call
                try:
                    await dialer_service.asterisk_service.hangup_trunk_channels()
                except Exception:
                    pass
                # Continue with new call
            # Check if call is stuck in CONNECTED/ANSWERED (older than 2 hours - likely stale)
            elif active_call.status in [CallStatus.CONNECTED.value, CallStatus.ANSWERED.value] and time_diff and time_diff > 7200:  # 2 hours
                logger.warning(f"Clearing stale CONNECTED/ANSWERED call {active_call.id} for agent {agent_id} (age: {time_diff}s)")
                active_call.status = CallStatus.ENDED.value
                active_call.end_time = current_time
                # Update agent status
                agent.status = AgentStatus.AVAILABLE.value
                # Update contact status if exists
                if active_call.contact_id:
                    contact = db.query(Contact).filter(Contact.id == active_call.contact_id).first()
                    if contact:
                        # If call was answered and had talk time, mark as CONTACTED
                        if active_call.answered_time and active_call.talk_duration and active_call.talk_duration > 0:
                            contact.status = ContactStatus.CONTACTED
                        else:
                            contact.status = ContactStatus.FAILED
                db.commit()
                # Continue with new call
            # Check if call is in RINGING for too long (older than 30 seconds)
            elif active_call.status == CallStatus.RINGING.value and time_diff and time_diff > 30:
                logger.warning(f"Clearing stuck RINGING call {active_call.id} for agent {agent_id} (age: {time_diff}s)")
                active_call.status = CallStatus.NO_ANSWER.value
                active_call.end_time = current_time
                # Update agent status
                agent.status = AgentStatus.AVAILABLE.value
                # Update contact status if exists
                if active_call.contact_id:
                    contact = db.query(Contact).filter(Contact.id == active_call.contact_id).first()
                    if contact:
                        contact.status = ContactStatus.FAILED
                db.commit()
                # Continue with new call
            else:
                # Call is truly active - block new dial attempt
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Agent already has an active call (ID: {active_call.id}, Status: {active_call.status}). Please hangup the current call first."
                )
        
        # Update contact if contact_id is provided (skip for softphone dials)
        contact = None
        if dial_request.contact_id and not dial_request.softphone_dial:
            contact = db.query(Contact).filter(Contact.id == dial_request.contact_id).first()
            if contact:
                # Update contact dialing info
                contact.last_dialed_at = datetime.now(timezone.utc)
                contact.dial_attempts = (contact.dial_attempts or 0) + 1
                # If 2+ attempts and never successfully contacted, mark as FAILED
                if contact.dial_attempts >= 2 and contact.status != ContactStatus.CONTACTED.value:
                    contact.status = ContactStatus.FAILED
                    logger.info(f"Contact {contact.id} ({contact.phone}) marked FAILED after {contact.dial_attempts} attempts")
        
        # Create call record
        call_unique_id = str(uuid.uuid4())
        call = Call(
            agent_id=agent_id,
            campaign_id=None if dial_request.softphone_dial else dial_request.campaign_id,
            contact_id=None if dial_request.softphone_dial else dial_request.contact_id,
            phone_number=dial_request.phone_number,
            direction=CallDirection.OUTBOUND,
            status=CallStatus.DIALING,
            call_unique_id=call_unique_id
        )
        db.add(call)
        # Update agent status
        agent.status = AgentStatus.IN_CALL.value
        # CRITICAL: Commit BEFORE Originate so AMI event listener can find this DIALING record
        # when the trunk channel appears (fixes race condition for 2nd+ auto-dial calls)
        db.commit()
        db.refresh(call)
        
        # Register call in channel tracker BEFORE originate
        from app.services.channel_tracker import channel_tracker
        channel_tracker.register_call(call.call_unique_id)
        
        # Initiate call via dialer service
        call_result = await dialer_service.initiate_call(
            phone_number=dial_request.phone_number,
            agent_extension=agent.phone_extension,
            campaign_id=None if dial_request.softphone_dial else dial_request.campaign_id,
            contact_id=None if dial_request.softphone_dial else dial_request.contact_id
        )
        
        # Update call with asterisk channel info
        call.freeswitch_channel = call_result.get("asterisk_channel") or call_result.get("freeswitch_channel")
        if call_result.get("status") and call_result["status"] != CallStatus.DIALING:
            call.status = call_result["status"]
        db.commit()
        db.refresh(call)
        
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


@router.post("/dial-next", response_model=CallResponse)
async def dial_next(
    campaign_id: Optional[int] = None,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Auto-dial next available contact"""
    try:
        from app.models.agent import Agent
        
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        
        # Use campaign_id from agent if not provided
        if not campaign_id and hasattr(agent, 'campaign_id') and agent.campaign_id:
            campaign_id = agent.campaign_id
        
        # Get next contact
        contact = db.query(Contact).filter(
            Contact.status == ContactStatus.NEW.value,
            Contact.status != ContactStatus.DO_NOT_CALL.value
        )
        
        if campaign_id:
            contact = contact.filter(Contact.campaign_id == campaign_id)
        
        contact = contact.order_by(Contact.created_at.asc()).first()
        
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No more contacts available to dial"
            )
        
        # Create dial request
        dial_request = DialRequest(
            phone_number=contact.phone,
            campaign_id=contact.campaign_id,
            contact_id=contact.id
        )
        
        # Use existing dial endpoint logic
        return await dial(dial_request, db, agent_id)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error dialing next contact: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error dialing next contact"
        )


@router.post("/hangup/{call_id}")
async def hangup(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Hangup a call - with force fallback for stuck calls"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        # Mark call as ended immediately (even if hangup fails)
        call.status = CallStatus.ENDED.value
        call.end_time = datetime.now(timezone.utc)
        if call.start_time:
            duration = (call.end_time - call.start_time).total_seconds()
            call.duration = int(duration)
        # Calculate talk duration (answered to end)
        if call.answered_time:
            talk_duration = (call.end_time - call.answered_time).total_seconds()
            call.talk_duration = int(talk_duration)
        
        # Try to hangup via dialer service
        hangup_success = False
        if call.call_unique_id:
            hangup_success = await dialer_service.hangup_call(call.call_unique_id)
        
        # If normal hangup failed, try force hangup using database channels
        if not hangup_success and (call.agent_channel or call.customer_channel or call.freeswitch_channel):
            logger.warning(f"Normal hangup failed for call {call_id}, trying force hangup via database channels")
            from app.services.asterisk_service import AsteriskService
            asterisk_service = AsteriskService()
            
            # Try to hangup all known channels
            channels_to_hangup = []
            if call.agent_channel:
                channels_to_hangup.append(call.agent_channel)
            if call.customer_channel:
                channels_to_hangup.append(call.customer_channel)
            if call.freeswitch_channel:
                channels_to_hangup.append(call.freeswitch_channel)
            
            for channel in channels_to_hangup:
                try:
                    await asterisk_service.hangup_call(channel)
                    hangup_success = True
                    logger.info(f"Force hungup channel: {channel}")
                except Exception as e:
                    logger.warning(f"Failed to hangup channel {channel}: {e}")
        
        # Update contact status based on call result (One attempt per contact rule)
        # Rule: Each contact is dialed ONCE
        # - If successful (answered and talked) → CONTACTED → move to dialed list
        # - If failed (any failure) → FAILED → move to failed list
        if call.contact_id:
            contact = db.query(Contact).filter(Contact.id == call.contact_id).first()
            if contact:
                # CONTACTED = Successfully reached and talked (has answered_time and talk_duration > 0)
                if call.answered_time and call.talk_duration and call.talk_duration > 0:
                    contact.status = ContactStatus.CONTACTED
                    logger.info(f"Contact {contact.id} marked as CONTACTED (manual hangup, talk_duration: {call.talk_duration}s)")
                # ALL OTHER CASES = FAILED (one attempt only, no retries)
                else:
                    contact.status = ContactStatus.FAILED
                    logger.info(f"Contact {contact.id} marked as FAILED (manual hangup, status: {call.status})")
        
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
        
        # Always return success since we've marked call as ended
        # Even if Asterisk hangup failed, the call is cleared from UI
        return {"success": True, "call_id": call_id, "hangup_success": hangup_success}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error hanging up call: {e}")
        # Even on error, try to mark call as ended
        try:
            call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
            if call:
                call.status = CallStatus.ENDED.value
                call.end_time = datetime.now(timezone.utc)
                agent = db.query(Agent).filter(Agent.id == agent_id).first()
                if agent:
                    agent.status = AgentStatus.AVAILABLE.value
                db.commit()
        except:
            pass
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


@router.post("/force-clear/{call_id}")
async def force_clear_call(call_id: int, db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Force clear a stuck call - marks it as ended without trying to hangup via Asterisk"""
    try:
        call = db.query(Call).filter(Call.id == call_id, Call.agent_id == agent_id).first()
        if not call:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        
        # Force mark as ended
        call.status = CallStatus.ENDED.value
        call.end_time = datetime.now(timezone.utc)
        if call.start_time:
            duration = (call.end_time - call.start_time).total_seconds()
            call.duration = int(duration)
        
        # Update agent status
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if agent:
            agent.status = AgentStatus.AVAILABLE.value
        
        # Update contact status if exists
        if call.contact_id:
            contact = db.query(Contact).filter(Contact.id == call.contact_id).first()
            if contact and call.status == CallStatus.FAILED.value:
                contact.status = ContactStatus.FAILED
        
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
        
        return {"success": True, "call_id": call_id, "message": "Call force cleared"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error force clearing call: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error force clearing call")


@router.get("/current")
async def get_current_call(db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Get current active call for agent"""
    try:
        # Only get calls that are:
        # 1. In active status (not ended/failed/busy/no_answer)
        # 2. Have no end_time (not ended)
        # 3. Started within last 24 hours (safety check for old stuck calls)
        # 4. Not stuck in DIALING status for more than 30 seconds
        active_statuses = [CallStatus.DIALING, CallStatus.RINGING, CallStatus.CONNECTED, CallStatus.ANSWERED]
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        dialing_timeout = datetime.now(timezone.utc) - timedelta(seconds=30)  # 30 seconds timeout for DIALING
        
        call = db.query(Call).filter(
            Call.agent_id == agent_id,
            Call.status.in_(active_statuses),
            Call.end_time.is_(None),  # Must not have end_time
            Call.start_time >= cutoff_time  # Safety: ignore very old calls
        ).order_by(Call.start_time.desc()).first()
        
        # Check if call is stuck in various statuses
        if call:
            current_time = datetime.now(timezone.utc)
            time_diff = None
            
            # Calculate time difference
            if call.start_time:
                time_diff = (current_time - call.start_time).total_seconds()
            elif call.answered_time:
                time_diff = (current_time - call.answered_time).total_seconds()
            
            # Check if call is stuck in DIALING (older than 30 seconds)
            if call.status == CallStatus.DIALING.value and time_diff and time_diff > 30:
                logger.warning(f"Call {call.id} stuck in DIALING status for more than 30 seconds, marking as failed")
                call.status = CallStatus.FAILED.value
                call.end_time = current_time
                # Update agent status
                agent = db.query(Agent).filter(Agent.id == agent_id).first()
                if agent:
                    agent.status = AgentStatus.AVAILABLE.value
                # Update contact status if exists
                if call.contact_id:
                    from app.models.contact import Contact, ContactStatus
                    contact = db.query(Contact).filter(Contact.id == call.contact_id).first()
                    if contact:
                        contact.status = ContactStatus.FAILED
                db.commit()
                # Hang up the Asterisk call so the phone stops ringing
                try:
                    await dialer_service.hangup_call(call.call_unique_id)
                except Exception:
                    pass
                # Fallback: hang up ALL trunk channels (reliable when channel tracking fails)
                try:
                    await dialer_service.asterisk_service.hangup_trunk_channels()
                except Exception:
                    pass
                return {"call": None}
            # Check if call is stuck in RINGING (ringing for > 30 seconds without answer)
            elif call.status == CallStatus.RINGING.value and call.ring_time and not call.answered_time:
                ring_secs = (current_time - call.ring_time).total_seconds()
                if ring_secs > 30:
                    logger.warning(f"Call {call.id} stuck in RINGING for {ring_secs}s, marking as no answer")
                    call.status = CallStatus.NO_ANSWER.value
                    call.end_time = current_time
                    call.ring_duration = int(ring_secs)
                    agent = db.query(Agent).filter(Agent.id == agent_id).first()
                    if agent:
                        agent.status = AgentStatus.AVAILABLE.value
                    if call.contact_id:
                        from app.models.contact import Contact, ContactStatus
                        contact = db.query(Contact).filter(Contact.id == call.contact_id).first()
                        if contact:
                            contact.status = ContactStatus.NOT_ANSWERED
                    db.commit()
                    try:
                        await dialer_service.hangup_call(call.call_unique_id)
                    except Exception:
                        pass
                    try:
                        await dialer_service.asterisk_service.hangup_trunk_channels()
                    except Exception:
                        pass
                    return {"call": None}
            # Check if call is stuck in CONNECTED/ANSWERED (older than 2 hours)
            elif call.status in [CallStatus.CONNECTED.value, CallStatus.ANSWERED.value] and time_diff and time_diff > 7200:
                logger.warning(f"Call {call.id} stuck in {call.status} status for more than 2 hours, marking as ended")
                call.status = CallStatus.ENDED.value
                call.end_time = current_time
                # Update agent status
                agent = db.query(Agent).filter(Agent.id == agent_id).first()
                if agent:
                    agent.status = AgentStatus.AVAILABLE.value
                # Update contact status if exists
                if call.contact_id:
                    from app.models.contact import Contact, ContactStatus
                    contact = db.query(Contact).filter(Contact.id == call.contact_id).first()
                    if contact:
                        if call.answered_time and call.talk_duration and call.talk_duration > 0:
                            contact.status = ContactStatus.CONTACTED
                        else:
                            contact.status = ContactStatus.FAILED
                db.commit()
                return {"call": None}
            # Check if call is stuck in RINGING (ringing for more than 30 seconds)
            elif call.status == CallStatus.RINGING.value:
                # Use ring_time if available, otherwise fall back to start_time
                ring_start = call.ring_time or call.start_time
                if ring_start:
                    ring_secs = (current_time - ring_start).total_seconds()
                    if ring_secs > 30:
                        logger.warning(f"Call {call.id} ringing for {ring_secs:.0f}s (>30s), marking as no answer")
                        call.status = CallStatus.NO_ANSWER.value
                        call.end_time = current_time
                        # Update agent status
                        agent = db.query(Agent).filter(Agent.id == agent_id).first()
                        if agent:
                            agent.status = AgentStatus.AVAILABLE.value
                        # Update contact status if exists
                        if call.contact_id:
                            from app.models.contact import Contact, ContactStatus
                            contact = db.query(Contact).filter(Contact.id == call.contact_id).first()
                            if contact:
                                contact.status = ContactStatus.NOT_ANSWERED
                        db.commit()
                        # Hang up the Asterisk call
                        try:
                            await dialer_service.hangup_call(call.call_unique_id)
                        except Exception:
                            pass
                        return {"call": None}
        
        # Additional check: if call has end_time set, it's ended (even if status is wrong)
        if call and call.end_time:
            # Check if end_time is more than 2 seconds ago
            end_time = call.end_time
            if isinstance(end_time, datetime):
                # Ensure timezone-aware comparison
                if end_time.tzinfo is None:
                    end_time = end_time.replace(tzinfo=timezone.utc)
                time_diff = (datetime.now(timezone.utc) - end_time).total_seconds()
                if time_diff > 2:  # Ended more than 2 seconds ago
                    return {"call": None}
        
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
