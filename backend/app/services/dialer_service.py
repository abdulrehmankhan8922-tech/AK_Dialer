import asyncio
import uuid
import logging
from typing import Optional, Dict
from datetime import datetime
from app.core.config import settings
from app.models.call import Call, CallStatus, CallDirection
from app.services.asterisk_service import AsteriskService
from app.services.channel_tracker import channel_tracker

logger = logging.getLogger(__name__)


class DialerService:
    def __init__(self):
        self.asterisk_service = AsteriskService()
        self.active_calls: Dict[str, Call] = {}

    async def initiate_call(
        self,
        phone_number: str,
        agent_extension: str,
        campaign_id: Optional[int] = None,
        contact_id: Optional[int] = None
    ) -> Dict:
        """
        Initiate a call via Asterisk - CUSTOMER-FIRST DIALING (Vicidial Style)
        
        Matches dialplan format:
        - Channel: PJSIP/trunk/sip:{customer_number}@10.50.161.239
        - Context: from-internal
        - Exten: {agent_extension} (e.g., 8013 or 8014)
        - Variables: AGENT_EXTENSION={agent_extension}
        
        Flow:
        1. AMI Originate creates channel to customer (customer's phone rings)
        2. Dialplan at agent extension receives the customer channel
        3. When customer answers, Local channel auto-connects to agent
        4. Agent's softphone receives call (minimal/no ringing)
        5. All controls remain in web dialer
        """
        call_unique_id = str(uuid.uuid4())
        
        try:
            if settings.USE_MOCK_DIALER:
                # Mock call for testing
                return await self._mock_call(call_unique_id, phone_number, agent_extension)
            else:
                # Register call in channel tracker
                from app.services.channel_tracker import channel_tracker
                channel_tracker.register_call(call_unique_id)
                
                # Customer channel format: PJSIP/trunk/sip:{phone_number}@10.50.161.239
                # This matches the dialplan's expectation for AMI-originated calls
                customer_channel = f"{settings.ASTERISK_TRUNK}/sip:{phone_number}@10.50.161.239"
                
                # Variables to pass to the call
                variables = {
                    'CALLERID(num)': phone_number,
                    'CALLERID(name)': f'Dialer',
                    'CALL_UNIQUE_ID': call_unique_id,
                    'CAMPAIGN_ID': str(campaign_id) if campaign_id else '',
                    'CONTACT_ID': str(contact_id) if contact_id else '',
                    'CUSTOMER_NUMBER': phone_number,
                    'CUSTOMER_CHANNEL': customer_channel,
                    'AGENT_EXTENSION': agent_extension,  # Pass agent extension as variable
                }
                
                # Originate call matching dialplan format:
                # - Channel: PJSIP/trunk/sip:{phone_number}@10.50.161.239 (customer channel)
                # - Context: from-internal
                # - Exten: {agent_extension} (dialplan uses this to identify agent)
                # - Dialplan will: Detect AMI call → Wait for customer answer → Auto-connect to agent
                result = await self.asterisk_service.originate_call(
                    channel=customer_channel,  # PJSIP/trunk/sip:{phone_number}@10.50.161.239
                    context=settings.ASTERISK_CONTEXT,  # from-internal
                    exten=agent_extension,  # Agent extension (dialplan uses this)
                    priority=1,
                    caller_id=f"Dialer <{phone_number}>",
                    timeout=60000,  # 60 seconds timeout (matches dialplan)
                    variables=variables
                )
                
                if result.get("success"):
                    logger.info(f"Call {call_unique_id} originated: customer {phone_number} -> agent {agent_extension}")
                    return {
                        "call_unique_id": call_unique_id,
                        "status": CallStatus.DIALING,
                        "asterisk_channel": customer_channel,  # Primary channel is customer channel
                        "action_id": result.get("action_id"),
                        "success": True
                    }
                else:
                    channel_tracker.remove_call(call_unique_id)
                    return {
                        "call_unique_id": call_unique_id,
                        "status": CallStatus.FAILED,
                        "error": result.get("message", "Call failed"),
                        "success": False
                    }
        except Exception as e:
            logger.error(f"Error initiating call: {e}", exc_info=True)
            channel_tracker.remove_call(call_unique_id)
            return {
                "call_unique_id": call_unique_id,
                "status": CallStatus.FAILED,
                "error": str(e),
                "success": False
            }

    async def _mock_call(self, call_unique_id: str, phone_number: str, agent_extension: str) -> Dict:
        """Simulate a call for testing"""
        await asyncio.sleep(1)  # Simulate dialing
        return {
            "call_unique_id": call_unique_id,
            "status": CallStatus.RINGING,
            "phone_number": phone_number,
            "agent_extension": agent_extension,
            "success": True,
            "mock": True
        }

    async def hangup_call(self, call_unique_id: str) -> bool:
        """Hangup a call by call_unique_id or channel name - with multiple fallback methods"""
        try:
            if settings.USE_MOCK_DIALER:
                return True
            else:
                # Method 1: Try to get channels from tracker
                channels = channel_tracker.get_call_channels(call_unique_id)
                
                if channels:
                    # Hangup both channels if they exist
                    success = False
                    if channels.get('agent_channel'):
                        try:
                            agent_result = await self.asterisk_service.hangup_call(channels['agent_channel'])
                            success = success or agent_result
                        except Exception as e:
                            logger.warning(f"Failed to hangup agent channel {channels['agent_channel']}: {e}")
                    if channels.get('customer_channel'):
                        try:
                            customer_result = await self.asterisk_service.hangup_call(channels['customer_channel'])
                            success = success or customer_result
                        except Exception as e:
                            logger.warning(f"Failed to hangup customer channel {channels['customer_channel']}: {e}")
                    if success:
                        return True
                
                # Method 2: Try direct channel hangup if call_unique_id looks like a channel
                if call_unique_id.startswith('SIP/') or call_unique_id.startswith('Local/') or call_unique_id.startswith('PJSIP/'):
                    try:
                        return await self.asterisk_service.hangup_call(call_unique_id)
                    except Exception as e:
                        logger.warning(f"Failed to hangup channel directly {call_unique_id}: {e}")
                
                # Method 3: Try to find channels from database
                from app.core.database import SessionLocal
                from app.models.call import Call
                db = SessionLocal()
                try:
                    call = db.query(Call).filter(Call.call_unique_id == call_unique_id).first()
                    if call:
                        success = False
                        if call.agent_channel:
                            try:
                                result = await self.asterisk_service.hangup_call(call.agent_channel)
                                success = success or result
                            except Exception as e:
                                logger.warning(f"Failed to hangup agent channel from DB {call.agent_channel}: {e}")
                        if call.customer_channel:
                            try:
                                result = await self.asterisk_service.hangup_call(call.customer_channel)
                                success = success or result
                            except Exception as e:
                                logger.warning(f"Failed to hangup customer channel from DB {call.customer_channel}: {e}")
                        if call.freeswitch_channel:
                            try:
                                result = await self.asterisk_service.hangup_call(call.freeswitch_channel)
                                success = success or result
                            except Exception as e:
                                logger.warning(f"Failed to hangup freeswitch channel from DB {call.freeswitch_channel}: {e}")
                        if success:
                            return True
                finally:
                    db.close()
                
                # If all methods failed, log warning but don't fail completely
                logger.warning(f"Could not hangup call {call_unique_id} - all methods failed")
                return False
        except Exception as e:
            logger.error(f"Error hanging up call: {e}", exc_info=True)
            return False

    async def transfer_call(self, call_unique_id: str, target_extension: str) -> bool:
        """Transfer a call to another extension"""
        try:
            if settings.USE_MOCK_DIALER:
                return True
            else:
                # Get agent channel for transfer
                agent_channel = channel_tracker.get_agent_channel(call_unique_id)
                if not agent_channel:
                    logger.warning(f"Agent channel not found for call {call_unique_id}")
                    # Fallback to direct channel
                    if not call_unique_id.startswith('SIP/') and not call_unique_id.startswith('Local/'):
                        return False
                    agent_channel = call_unique_id
                
                return await self.asterisk_service.transfer_call(
                    channel=agent_channel,
                    exten=target_extension,
                    context=settings.ASTERISK_CONTEXT
                )
        except Exception as e:
            logger.error(f"Error transferring call: {e}", exc_info=True)
            return False

    async def park_call(self, call_unique_id: str) -> bool:
        """Park a call"""
        try:
            if settings.USE_MOCK_DIALER:
                return True
            else:
                # Get agent channel for parking
                agent_channel = channel_tracker.get_agent_channel(call_unique_id)
                if not agent_channel:
                    logger.warning(f"Agent channel not found for call {call_unique_id}")
                    if not call_unique_id.startswith('SIP/') and not call_unique_id.startswith('Local/'):
                        return False
                    agent_channel = call_unique_id
                
                return await self.asterisk_service.park_call(agent_channel)
        except Exception as e:
            logger.error(f"Error parking call: {e}", exc_info=True)
            return False
    
    async def start_recording(self, call_unique_id: str, file_path: str = None) -> bool:
        """Start recording a call"""
        try:
            if settings.USE_MOCK_DIALER:
                return True
            else:
                # Use agent channel for recording (records both sides when mixed)
                agent_channel = channel_tracker.get_agent_channel(call_unique_id)
                if not agent_channel:
                    logger.warning(f"Agent channel not found for call {call_unique_id}")
                    if not call_unique_id.startswith('SIP/') and not call_unique_id.startswith('Local/'):
                        return False
                    agent_channel = call_unique_id
                
                # Use provided file_path or generate one
                if not file_path:
                    file_path = f"/var/spool/asterisk/monitor/{call_unique_id}"
                
                return await self.asterisk_service.monitor_start(agent_channel, file_format="wav", mix=True)
        except Exception as e:
            logger.error(f"Error starting recording: {e}", exc_info=True)
            return False
    
    async def stop_recording(self, call_unique_id: str) -> bool:
        """Stop recording a call"""
        try:
            if settings.USE_MOCK_DIALER:
                return True
            else:
                # Use agent channel for recording
                agent_channel = channel_tracker.get_agent_channel(call_unique_id)
                if not agent_channel:
                    logger.warning(f"Agent channel not found for call {call_unique_id}")
                    if not call_unique_id.startswith('SIP/') and not call_unique_id.startswith('Local/'):
                        return False
                    agent_channel = call_unique_id
                
                return await self.asterisk_service.monitor_stop(agent_channel)
        except Exception as e:
            logger.error(f"Error stopping recording: {e}", exc_info=True)
            return False
    
    async def mute_call(self, call_unique_id: str) -> bool:
        """Mute a call"""
        try:
            if settings.USE_MOCK_DIALER:
                return True
            else:
                agent_channel = channel_tracker.get_agent_channel(call_unique_id)
                if not agent_channel:
                    logger.warning(f"Agent channel not found for call {call_unique_id}")
                    return False
                return await self.asterisk_service.mute_channel(agent_channel)
        except Exception as e:
            logger.error(f"Error muting call: {e}", exc_info=True)
            return False
    
    async def unmute_call(self, call_unique_id: str) -> bool:
        """Unmute a call"""
        try:
            if settings.USE_MOCK_DIALER:
                return True
            else:
                agent_channel = channel_tracker.get_agent_channel(call_unique_id)
                if not agent_channel:
                    logger.warning(f"Agent channel not found for call {call_unique_id}")
                    return False
                return await self.asterisk_service.unmute_channel(agent_channel)
        except Exception as e:
            logger.error(f"Error unmuting call: {e}", exc_info=True)
            return False
    
    async def hold_call(self, call_unique_id: str) -> bool:
        """Put a call on hold"""
        try:
            if settings.USE_MOCK_DIALER:
                return True
            else:
                agent_channel = channel_tracker.get_agent_channel(call_unique_id)
                if not agent_channel:
                    logger.warning(f"Agent channel not found for call {call_unique_id}")
                    return False
                return await self.asterisk_service.hold_channel(agent_channel)
        except Exception as e:
            logger.error(f"Error holding call: {e}", exc_info=True)
            return False
    
    async def unhold_call(self, call_unique_id: str) -> bool:
        """Take a call off hold"""
        try:
            if settings.USE_MOCK_DIALER:
                return True
            else:
                agent_channel = channel_tracker.get_agent_channel(call_unique_id)
                if not agent_channel:
                    logger.warning(f"Agent channel not found for call {call_unique_id}")
                    return False
                return await self.asterisk_service.unhold_channel(agent_channel)
        except Exception as e:
            logger.error(f"Error unholding call: {e}", exc_info=True)
            return False
