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
        Initiate a call via Asterisk
        This uses agent-first dialing: calls agent, then bridges to customer
        """
        call_unique_id = str(uuid.uuid4())
        
        try:
            if settings.USE_MOCK_DIALER:
                # Mock call for testing
                return await self._mock_call(call_unique_id, phone_number, agent_extension)
            else:
                # Register call in channel tracker
                channel_tracker.register_call(call_unique_id)
                
                # Real Asterisk call using agent-first dialing
                # Step 1: Originate call to agent extension first
                # The dialplan should then dial the customer number
                
                # Customer channel format: SIP/trunk_name/phone_number
                customer_channel = f"{settings.ASTERISK_TRUNK}/{phone_number}"
                
                # Variables to pass to the call
                variables = {
                    'CALLERID(num)': phone_number,
                    'CALLERID(name)': f'Agent {agent_extension}',
                    'CALL_UNIQUE_ID': call_unique_id,
                    'CAMPAIGN_ID': str(campaign_id) if campaign_id else '',
                    'CONTACT_ID': str(contact_id) if contact_id else '',
                    'CUSTOMER_NUMBER': phone_number,
                    'CUSTOMER_CHANNEL': customer_channel
                }
                
                # For agent-first dialing, we originate to the agent extension
                # The dialplan at that extension should handle dialing the customer
                # Alternative: Use Local channel to dial both
                
                # Using Local channel for better control:
                # Local/agent_ext@agent_context -> dials agent
                # Then dials customer when agent answers
                local_channel = f"Local/{agent_extension}@{settings.ASTERISK_CONTEXT}"
                
                # Originate call: This will ring agent first, then dial customer
                result = await self.asterisk_service.originate_call(
                    channel=customer_channel,  # Customer number to dial
                    context=settings.ASTERISK_CONTEXT,
                    exten=agent_extension,  # Agent extension to connect to
                    priority=1,
                    caller_id=f"Dialer <{phone_number}>",
                    timeout=30000,
                    variables=variables
                )
                
                if result.get("success"):
                    logger.info(f"Call {call_unique_id} originated: agent {agent_extension} -> {phone_number}")
                    return {
                        "call_unique_id": call_unique_id,
                        "status": CallStatus.DIALING,
                        "asterisk_channel": customer_channel,  # Primary channel
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
        """Hangup a call by call_unique_id or channel name"""
        try:
            if settings.USE_MOCK_DIALER:
                return True
            else:
                # Try to get channels from tracker
                channels = channel_tracker.get_call_channels(call_unique_id)
                
                if channels:
                    # Hangup both channels if they exist
                    success = True
                    if channels.get('agent_channel'):
                        agent_result = await self.asterisk_service.hangup_call(channels['agent_channel'])
                        success = success and agent_result
                    if channels.get('customer_channel'):
                        customer_result = await self.asterisk_service.hangup_call(channels['customer_channel'])
                        success = success and customer_result
                    return success
                else:
                    # Fallback: assume channel is passed directly
                    if not call_unique_id.startswith('SIP/') and not call_unique_id.startswith('Local/'):
                        # Assume it's a call_unique_id but not found in tracker
                        logger.warning(f"Call {call_unique_id} not found in channel tracker")
                        return False
                    # Direct channel hangup
                    return await self.asterisk_service.hangup_call(call_unique_id)
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
