"""
AMI Event Listener Service
Listens to Asterisk AMI events and routes them to appropriate handlers
"""
import asyncio
import socket
import re
import logging
from typing import Dict, Optional, Callable, Any
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.call import Call, CallStatus, CallDirection
from app.models.agent import Agent, AgentStatus
import uuid
from app.services.channel_tracker import channel_tracker
from app.services.websocket_manager import websocket_manager
from app.services.cdr_processor import cdr_processor
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class AMIEventListener:
    """Listen to AMI events and handle them"""
    
    def __init__(self):
        self.host = settings.ASTERISK_HOST
        self.port = settings.ASTERISK_AMI_PORT
        self.username = settings.ASTERISK_AMI_USERNAME
        self.password = settings.ASTERISK_AMI_PASSWORD
        self.connection: Optional[socket.socket] = None
        self.connected = False
        self.listener_task: Optional[asyncio.Task] = None
        self.running = False
        self.event_handlers: Dict[str, Callable] = {
            'Newchannel': self._handle_newchannel,
            'Newstate': self._handle_newstate,
            'Hangup': self._handle_hangup,
            'Bridge': self._handle_bridge,
            'BridgeEnter': self._handle_bridge_enter,
            'BridgeLeave': self._handle_bridge_leave,
            'Newexten': self._handle_newexten,
            'DialBegin': self._handle_dial_begin,
            'DialEnd': self._handle_dial_end,
            'Cdr': self._handle_cdr,
            'VarSet': self._handle_varset,  # For quality metrics if available
        }
    
    def _parse_ami_event(self, event_data: str) -> Dict[str, str]:
        """Parse AMI event into dictionary"""
        event = {}
        for line in event_data.strip().split('\r\n'):
            if ':' in line and not line.startswith('--'):
                key, value = line.split(':', 1)
                event[key.strip()] = value.strip()
        return event
    
    def _build_ami_action(self, action: str, params: Dict[str, str] = None) -> str:
        """Build AMI action string"""
        action_str = f"Action: {action}\r\n"
        if params:
            for key, value in params.items():
                action_str += f"{key}: {value}\r\n"
        action_str += "\r\n"
        return action_str
    
    async def connect(self) -> bool:
        """Connect to Asterisk AMI"""
        try:
            if self.connected and self.connection:
                return True
            
            # Use thread executor for blocking socket operations to avoid blocking event loop
            loop = asyncio.get_event_loop()
            self.connection = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.connection.settimeout(5)  # 5 second timeout
            
            # Run blocking connect in thread executor with timeout
            try:
                await asyncio.wait_for(
                    loop.run_in_executor(None, self.connection.connect, (self.host, self.port)),
                    timeout=10.0  # 10 second async timeout
                )
            except asyncio.TimeoutError:
                logger.error(f"AMI connection timeout to {self.host}:{self.port}")
                if self.connection:
                    try:
                        self.connection.close()
                    except:
                        pass
                    self.connection = None
                return False
            except Exception as e:
                logger.error(f"AMI connection error: {e}")
                if self.connection:
                    try:
                        self.connection.close()
                    except:
                        pass
                    self.connection = None
                return False
            
            # Read welcome message (non-blocking)
            welcome = await loop.run_in_executor(None, lambda: self.connection.recv(4096).decode('utf-8', errors='ignore'))
            if 'Asterisk Call Manager' not in welcome:
                logger.warning(f"Unexpected welcome message: {welcome[:100]}")
                return False
            
            # Authenticate
            login_action = self._build_ami_action('Login', {
                'Username': self.username,
                'Secret': self.password
            })
            
            await loop.run_in_executor(None, lambda: self.connection.send(login_action.encode('utf-8')))
            response = await loop.run_in_executor(None, lambda: self.connection.recv(4096).decode('utf-8', errors='ignore'))
            
            parsed = self._parse_ami_event(response)
            if parsed.get('Response') == 'Success':
                self.connected = True
                logger.info(f"Connected to Asterisk AMI at {self.host}:{self.port}")
                
                # Subscribe to all events
                subscribe_action = self._build_ami_action('Events', {
                    'EventMask': 'on'  # Enable all events
                })
                await loop.run_in_executor(None, lambda: self.connection.send(subscribe_action.encode('utf-8')))
                # Don't wait for response, just send it
                
                return True
            else:
                logger.error(f"AMI Authentication failed: {parsed.get('Message', 'Unknown error')}")
                self.connected = False
                return False
                
        except Exception as e:
            logger.error(f"Asterisk AMI connection error: {e}")
            self.connected = False
            return False
    
    async def start_listening(self):
        """Start listening to AMI events - completely non-blocking"""
        if self.running:
            logger.warning("AMI event listener already running")
            return
        
        self.running = True
        logger.info("Starting AMI event listener (will connect in background)")
        
        # Start connection retry loop in background - don't wait for it
        self.listener_task = asyncio.create_task(self._connection_and_event_loop())
    
    async def _connection_and_event_loop(self):
        """Connect and then start event loop - runs in background"""
        max_retries = 5
        retry_count = 0
        
        while self.running and retry_count < max_retries:
            try:
                # Try to connect with short timeout
                connected = await asyncio.wait_for(self.connect(), timeout=10.0)
                if connected:
                    logger.info("AMI connected successfully, starting event listener")
                    # Start the actual event loop
                    await self._event_loop()
                    break
                else:
                    retry_count += 1
                    if retry_count < max_retries:
                        logger.warning(f"AMI connection failed, retrying in 10s (attempt {retry_count}/{max_retries})...")
                        await asyncio.sleep(10)
                    else:
                        logger.error("AMI connection failed after max retries, giving up")
                        self.running = False
                        break
            except asyncio.TimeoutError:
                retry_count += 1
                if retry_count < max_retries:
                    logger.warning(f"AMI connection timeout, retrying in 10s (attempt {retry_count}/{max_retries})...")
                    await asyncio.sleep(10)
                else:
                    logger.error("AMI connection timeout after max retries, giving up")
                    self.running = False
                    break
            except Exception as e:
                logger.error(f"AMI connection error: {e}, retrying in 10s...")
                retry_count += 1
                if retry_count < max_retries:
                    await asyncio.sleep(10)
                else:
                    logger.error("AMI connection failed after max retries, giving up")
                    self.running = False
                    break
    
    async def stop_listening(self):
        """Stop listening to AMI events"""
        self.running = False
        if self.listener_task:
            self.listener_task.cancel()
            try:
                await self.listener_task
            except asyncio.CancelledError:
                pass
        
        if self.connection:
            try:
                await self.disconnect()
            except:
                pass
        
        logger.info("AMI event listener stopped")
    
    async def _event_loop(self):
        """Main event loop for reading AMI events"""
        buffer = ""
        
        while self.running:
            try:
                if not self.connected:
                    await asyncio.sleep(5)
                    await self.connect()
                    if not self.connected:
                        continue
                
                # Read data from socket (non-blocking with timeout)
                try:
                    self.connection.settimeout(1.0)
                    loop = asyncio.get_event_loop()
                    data = await loop.run_in_executor(None, lambda: self.connection.recv(4096).decode('utf-8', errors='ignore'))
                    if not data:
                        # Connection closed
                        self.connected = False
                        await asyncio.sleep(5)
                        continue
                    
                    buffer += data
                    
                    # Process complete events (events end with \r\n\r\n)
                    while '\r\n\r\n' in buffer:
                        event_data, buffer = buffer.split('\r\n\r\n', 1)
                        if event_data.strip():
                            await self._process_event(event_data)
                
                except socket.timeout:
                    # No data available, continue
                    continue
                except Exception as e:
                    logger.error(f"Error reading AMI events: {e}")
                    self.connected = False
                    await asyncio.sleep(5)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in AMI event loop: {e}")
                await asyncio.sleep(5)
    
    async def _process_event(self, event_data: str):
        """Process a single AMI event"""
        try:
            event = self._parse_ami_event(event_data)
            event_type = event.get('Event', '')
            
            # Skip response messages
            if event_type in ['', 'Response', 'Ping', 'Pong']:
                return
            
            logger.debug(f"Received AMI event: {event_type}")
            
            # Call appropriate handler
            handler = self.event_handlers.get(event_type)
            if handler:
                await handler(event)
            else:
                logger.debug(f"No handler for event type: {event_type}")
        
        except Exception as e:
            logger.error(f"Error processing AMI event: {e}")
    
    def _extract_extension_from_channel(self, channel: str) -> Optional[str]:
        """Extract extension number from channel name (e.g., PJSIP/8013-00000001 -> 8013)"""
        # Match patterns like PJSIP/8013-xxxxx or SIP/8013-xxxxx
        match = re.search(r'(?:PJSIP|SIP)/(\d+)(?:-|$)', channel)
        if match:
            return match.group(1)
        return None
    
    def _is_trunk_channel(self, channel: str) -> bool:
        """Check if channel is from trunk (e.g., PJSIP/trunk-xxxxx)"""
        return 'trunk' in channel.lower() or 'PJSIP/trunk' in channel or 'SIP/trunk' in channel
    
    def _is_inbound_call(self, channel: str, context: str, caller_id_num: str) -> bool:
        """Determine if this is an inbound call based on channel, context, and caller ID"""
        # Inbound calls come from trunk
        if self._is_trunk_channel(channel):
            return True
        # Inbound calls have from-trunk context
        if context == 'from-trunk' or 'trunk' in context.lower():
            return True
        # For channels that don't have clear context, check if it's not an extension channel
        # and has a caller ID (inbound calls have caller ID from external)
        if not self._extract_extension_from_channel(channel) and caller_id_num:
            # If it's not an extension and has caller ID, likely inbound
            return True
        return False
    
    def _extract_phone_number_from_channel(self, channel: str, context: str, exten: str) -> Optional[str]:
        """Extract phone number from channel or context"""
        # For outbound calls, the number might be in exten
        if exten and exten not in ['8013', '8014', '9000']:  # Not an internal extension
            # Remove + prefix if present
            return exten.lstrip('+')
        # For inbound calls, might be in caller ID or channel
        return None
    
    async def _handle_newchannel(self, event: Dict[str, str]):
        """Handle Newchannel event - auto-detect and create call records"""
        channel = event.get('Channel', '')
        uniqueid = event.get('Uniqueid', '')
        context = event.get('Context', '')
        exten = event.get('Exten', '')
        caller_id_num = event.get('CallerIDNum', '')
        caller_id_name = event.get('CallerIDName', '')
        
        logger.debug(f"Newchannel: {channel} (Uniqueid: {uniqueid}, Context: {context}, Exten: {exten})")
        
        # Check if this channel is already tracked
        call_unique_id = channel_tracker.get_call_from_uniqueid(uniqueid)
        
        # If not tracked, try to auto-detect and create call record
        if not call_unique_id:
            db = SessionLocal()
            try:
                agent = None
                direction = None
                phone_number = None
                
                # Detect inbound calls (from trunk) - check multiple indicators
                is_inbound = self._is_inbound_call(channel, context, caller_id_num)
                
                if is_inbound:
                    direction = CallDirection.INBOUND
                    # For inbound, phone number is usually in CallerIDNum (caller's number)
                    phone_number = caller_id_num or exten
                    # Find agent by extension that will receive the call (from dialplan routing)
                    # Default to 8013 for now, but we'll update when we see the Dial event
                    agent = db.query(Agent).filter(Agent.phone_extension == '8013').first()
                    if not agent:
                        # Try 8014 as fallback
                        agent = db.query(Agent).filter(Agent.phone_extension == '8014').first()
                
                # Detect outbound calls (from internal extensions)
                # Only if NOT already identified as inbound and has extension in channel
                elif context == 'from-internal' or 'internal' in context.lower():
                    # Check if this might be an extension channel for an inbound call
                    # (when Asterisk dials the extension, it creates a new channel)
                    extension = self._extract_extension_from_channel(channel)
                    
                    # If this is an extension channel but we already have an inbound call being dialed,
                    # don't create a new call - it's part of the inbound call flow
                    if extension:
                        # Check if there's an active inbound call that might be dialing this extension
                        # We'll handle this in DialBegin event instead
                        # For now, only create outbound if we're sure it's outbound
                        # Outbound calls have the dialed number in exten, not an extension number
                        if exten and exten not in ['8013', '8014', '9000'] and not exten.startswith('+'):
                            direction = CallDirection.OUTBOUND
                            # Find agent by extension
                            agent = db.query(Agent).filter(Agent.phone_extension == extension).first()
                            # Phone number is the dialed number
                            phone_number = exten.lstrip('+')
                        else:
                            # This might be an extension channel for an inbound call, skip creating call here
                            # The DialBegin event will handle associating it with the inbound call
                            direction = None
                            agent = None
                            phone_number = None
                    else:
                        direction = CallDirection.OUTBOUND
                        # Extract extension from channel if possible
                        extension = self._extract_extension_from_channel(channel)
                        if extension:
                            agent = db.query(Agent).filter(Agent.phone_extension == extension).first()
                        # Phone number is usually in exten (the dialed number)
                        phone_number = self._extract_phone_number_from_channel(channel, context, exten)
                        if not phone_number and exten:
                            phone_number = exten.lstrip('+')
                
                # Only create call record if we have enough info
                if direction and phone_number and agent:
                    call_unique_id = str(uuid.uuid4())
                    call = Call(
                        agent_id=agent.id,
                        phone_number=phone_number,
                        direction=direction.value,
                        status=CallStatus.DIALING.value,
                        call_unique_id=call_unique_id,
                        start_time=datetime.now(timezone.utc)
                    )
                    db.add(call)
                    db.commit()
                    db.refresh(call)
                    
                    # Register in channel tracker
                    channel_tracker.register_call(call_unique_id)
                    
                    # Determine if this is agent or customer channel
                    if direction == CallDirection.INBOUND:
                        # Inbound: trunk channel is customer, extension channel is agent
                        call.customer_channel = channel
                        channel_tracker.set_customer_channel(call_unique_id, channel, uniqueid)
                    else:
                        # Outbound: extension channel is agent
                        call.agent_channel = channel
                        channel_tracker.set_agent_channel(call_unique_id, channel, uniqueid)
                    
                    db.commit()
                    db.refresh(call)
                    
                    # Send WebSocket update
                    await websocket_manager.send_call_update(agent.id, {
                        "call_id": call.id,
                        "status": call.status,
                        "phone_number": call.phone_number,
                        "direction": call.direction
                    })
                    
                    # Send incoming call notification for inbound calls
                    if direction == CallDirection.INBOUND:
                        await websocket_manager.send_personal_message({
                            "type": "incoming_call",
                            "data": {
                                "call_id": call.id,
                                "phone_number": call.phone_number,
                                "direction": call.direction
                            }
                        }, agent.id)
                    
                    logger.info(f"Auto-created call record: {call_unique_id} for {direction.value} call from {phone_number} to agent {agent.phone_extension}")
                
            except Exception as e:
                logger.error(f"Error auto-creating call record: {e}")
                db.rollback()
            finally:
                db.close()
        
        # If call is already tracked, just update channel mapping
        if call_unique_id:
            db = SessionLocal()
            try:
                call = db.query(Call).filter(Call.call_unique_id == call_unique_id).first()
                if call:
                    # Determine if this is agent or customer channel
                    if 'internal' in context.lower() or self._extract_extension_from_channel(channel):
                        call.agent_channel = channel
                        channel_tracker.set_agent_channel(call_unique_id, channel, uniqueid)
                    else:
                        call.customer_channel = channel
                        channel_tracker.set_customer_channel(call_unique_id, channel, uniqueid)
                    db.commit()
            except Exception as e:
                logger.error(f"Error updating channel in database: {e}")
                db.rollback()
            finally:
                db.close()
    
    async def _handle_newstate(self, event: Dict[str, str]):
        """Handle Newstate event (channel state changes)"""
        channel = event.get('Channel', '')
        state = event.get('ChannelState', '')
        uniqueid = event.get('Uniqueid', '')
        
        call_unique_id = channel_tracker.get_call_from_channel(channel) or channel_tracker.get_call_from_uniqueid(uniqueid)
        
        # If not tracked, try to auto-detect (similar to Newchannel)
        if not call_unique_id:
            # Try to find existing call by uniqueid in database
            db = SessionLocal()
            try:
                call = db.query(Call).filter(Call.customer_channel == channel).first()
                if not call:
                    call = db.query(Call).filter(Call.agent_channel == channel).first()
                if call and call.call_unique_id:
                    call_unique_id = call.call_unique_id
                    channel_tracker.register_call(call_unique_id)
                    # Update channel mapping
                    if 'PJSIP' in channel or 'SIP' in channel:
                        extension = self._extract_extension_from_channel(channel)
                        if extension:
                            channel_tracker.set_agent_channel(call_unique_id, channel, uniqueid)
                        else:
                            channel_tracker.set_customer_channel(call_unique_id, channel, uniqueid)
            except Exception as e:
                logger.debug(f"Could not find call for channel {channel}: {e}")
            finally:
                db.close()
        
        if not call_unique_id:
            return
        
        db = SessionLocal()
        try:
            call = db.query(Call).filter(Call.call_unique_id == call_unique_id).first()
            if not call:
                return
            
            # Map Asterisk channel states to call status
            # 0 = Down, 1 = Reserved, 2 = OffHook, 3 = Dialing, 4 = Ring, 5 = Ringing, 6 = Up
            state_map = {
                '3': CallStatus.DIALING,
                '4': CallStatus.RINGING,
                '5': CallStatus.RINGING,
                '6': CallStatus.CONNECTED,
            }
            
            new_status = state_map.get(state)
            if new_status and call.status != new_status.value:
                old_status = call.status
                call.status = new_status.value
                
                # Track ring time (when call starts ringing)
                if new_status == CallStatus.RINGING and not call.ring_time:
                    call.ring_time = datetime.now(timezone.utc)
                
                # Track answered time (when call is connected/answered)
                if new_status == CallStatus.CONNECTED and not call.answered_time:
                    call.answered_time = datetime.now(timezone.utc)
                    # Calculate ring duration
                    if call.ring_time:
                        ring_duration = (call.answered_time - call.ring_time).total_seconds()
                        call.ring_duration = int(ring_duration)
                
                # Update agent status
                if call.agent_id:
                    agent = db.query(Agent).filter(Agent.id == call.agent_id).first()
                    if agent:
                        if new_status == CallStatus.CONNECTED:
                            agent.status = AgentStatus.IN_CALL.value
                        elif new_status == CallStatus.ENDED:
                            agent.status = AgentStatus.AVAILABLE.value
                
                db.commit()
                
                # Send WebSocket update
                if call.agent_id:
                    await websocket_manager.send_call_update(call.agent_id, {
                        "call_id": call.id,
                        "status": call.status,
                        "phone_number": call.phone_number,
                        "direction": call.direction,
                        "old_status": old_status
                    })
                    
                    logger.info(f"Call {call_unique_id} status changed: {old_status} -> {call.status}")
        
        except Exception as e:
            logger.error(f"Error handling Newstate event: {e}")
            db.rollback()
        finally:
            db.close()
    
    async def _handle_hangup(self, event: Dict[str, str]):
        """Handle Hangup event"""
        channel = event.get('Channel', '')
        uniqueid = event.get('Uniqueid', '')
        cause = event.get('Cause', '')
        cause_txt = event.get('Cause-txt', '')
        
        call_unique_id = channel_tracker.get_call_from_channel(channel) or channel_tracker.get_call_from_uniqueid(uniqueid)
        
        if not call_unique_id:
            return
        
        db = SessionLocal()
        try:
            call = db.query(Call).filter(Call.call_unique_id == call_unique_id).first()
            if not call:
                # Clean up tracking even if call not found
                channel_tracker.remove_call(call_unique_id)
                return
            
            # Update call status
            if call.status not in [CallStatus.ENDED.value, CallStatus.FAILED.value]:
                call.status = CallStatus.ENDED.value
                call.end_time = datetime.now(timezone.utc)
                
                # Calculate durations
                if call.start_time:
                    duration = (call.end_time - call.start_time).total_seconds()
                    call.duration = int(duration)
                
                # Calculate talk duration (answered to end)
                if call.answered_time:
                    talk_duration = (call.end_time - call.answered_time).total_seconds()
                    call.talk_duration = int(talk_duration)
                elif call.ring_time and not call.answered_time:
                    # Call ended without being answered - ring duration is from ring to end
                    ring_duration = (call.end_time - call.ring_time).total_seconds()
                    call.ring_duration = int(ring_duration)
                
                # Map cause codes to call status
                cause_code = int(cause) if cause.isdigit() else 0
                if cause_code == 16:  # Normal clearing
                    call.status = CallStatus.ENDED.value
                elif cause_code == 17:  # User busy
                    call.status = CallStatus.BUSY.value
                elif cause_code == 18:  # No user response
                    call.status = CallStatus.NO_ANSWER.value
                elif cause_code > 0:
                    call.status = CallStatus.FAILED.value
                
                # Update agent status
                if call.agent_id:
                    agent = db.query(Agent).filter(Agent.id == call.agent_id).first()
                    if agent:
                        agent.status = AgentStatus.AVAILABLE.value
                
                db.commit()
                
                # Send WebSocket update
                if call.agent_id:
                    await websocket_manager.send_call_update(call.agent_id, {
                        "call_id": call.id,
                        "status": call.status,
                        "phone_number": call.phone_number,
                        "direction": call.direction,
                        "duration": call.duration
                    })
                    await websocket_manager.send_agent_status_update(call.agent_id, "available")
                
                logger.info(f"Call {call_unique_id} ended: {cause_txt} (Cause: {cause})")
            
            # Clean up tracking
            channel_tracker.remove_call(call_unique_id)
        
        except Exception as e:
            logger.error(f"Error handling Hangup event: {e}")
            db.rollback()
        finally:
            db.close()
    
    async def _handle_bridge(self, event: Dict[str, str]):
        """Handle Bridge event"""
        bridge_unique_id = event.get('BridgeUniqueid', '')
        bridge_type = event.get('BridgeType', '')
        
        # Try to find call by bridge
        # This is tricky, we'll use channel1 and channel2
        channel1 = event.get('Channel1', '')
        channel2 = event.get('Channel2', '')
        
        call_unique_id = channel_tracker.get_call_from_channel(channel1) or channel_tracker.get_call_from_channel(channel2)
        
        if call_unique_id:
            channel_tracker.set_bridge(call_unique_id, bridge_unique_id)
            
            # Update call status to connected
            db = SessionLocal()
            try:
                call = db.query(Call).filter(Call.call_unique_id == call_unique_id).first()
                if call and call.status != CallStatus.CONNECTED.value:
                    call.status = CallStatus.CONNECTED.value
                    # Track answered time when call is bridged
                    if not call.answered_time:
                        call.answered_time = datetime.now(timezone.utc)
                        # Calculate ring duration
                        if call.ring_time:
                            ring_duration = (call.answered_time - call.ring_time).total_seconds()
                            call.ring_duration = int(ring_duration)
                    db.commit()
                    
                    if call.agent_id:
                        await websocket_manager.send_call_update(call.agent_id, {
                            "call_id": call.id,
                            "status": call.status,
                            "phone_number": call.phone_number,
                            "direction": call.direction
                        })
            except Exception as e:
                logger.error(f"Error handling Bridge event: {e}")
                db.rollback()
            finally:
                db.close()
    
    async def _handle_bridge_enter(self, event: Dict[str, str]):
        """Handle BridgeEnter event"""
        # Similar to Bridge, call is connected
        await self._handle_bridge(event)
    
    async def _handle_bridge_leave(self, event: Dict[str, str]):
        """Handle BridgeLeave event"""
        # One party left the bridge, call ending soon
        pass
    
    async def _handle_newexten(self, event: Dict[str, str]):
        """Handle Newexten event"""
        # Extension executed in dialplan
        pass
    
    async def _handle_dial_begin(self, event: Dict[str, str]):
        """Handle DialBegin event - helps track inbound calls to extensions"""
        channel = event.get('Channel', '')
        destination = event.get('Destination', '')
        dial_string = event.get('DialString', '')
        
        logger.debug(f"Dial begin: {channel} -> {destination} (DialString: {dial_string})")
        
        # Extract extension from destination (e.g., PJSIP/8013-xxxxx -> 8013)
        extension = self._extract_extension_from_channel(destination)
        
        # For inbound calls, find the call by customer channel (the trunk channel)
        call_unique_id = channel_tracker.get_call_from_channel(channel)
        
        # If not found by channel, try to find by uniqueid or check if this is an inbound call
        if not call_unique_id:
            # Check if channel is a trunk channel (inbound call)
            if self._is_trunk_channel(channel):
                # Try to find existing inbound call by customer channel
                db = SessionLocal()
                try:
                    call = db.query(Call).filter(
                        Call.customer_channel == channel,
                        Call.direction == CallDirection.INBOUND.value
                    ).order_by(Call.start_time.desc()).first()
                    if call and call.call_unique_id:
                        call_unique_id = call.call_unique_id
                        channel_tracker.register_call(call_unique_id)
                        channel_tracker.set_customer_channel(call_unique_id, channel, None)
                except Exception as e:
                    logger.error(f"Error finding inbound call: {e}")
                finally:
                    db.close()
        
        if call_unique_id and extension:
            db = SessionLocal()
            try:
                call = db.query(Call).filter(Call.call_unique_id == call_unique_id).first()
                if call:
                    # Update direction to INBOUND if it was incorrectly set
                    if call.direction != CallDirection.INBOUND.value:
                        call.direction = CallDirection.INBOUND.value
                        logger.info(f"Corrected call direction to INBOUND for {call_unique_id}")
                    
                    # Find agent by extension
                    agent = db.query(Agent).filter(Agent.phone_extension == extension).first()
                    if agent:
                        # Update call with correct agent if different
                        if call.agent_id != agent.id:
                            call.agent_id = agent.id
                            logger.info(f"Updated inbound call {call_unique_id} to agent {extension}")
                        
                        # Update status to RINGING if not already
                        if call.status not in [CallStatus.RINGING.value, CallStatus.CONNECTED.value, CallStatus.ANSWERED.value]:
                            call.status = CallStatus.RINGING.value
                            if not call.ring_time:
                                call.ring_time = datetime.now(timezone.utc)
                        
                        db.commit()
                        
                        # Send WebSocket update with proper direction
                        await websocket_manager.send_call_update(agent.id, {
                            "call_id": call.id,
                            "status": call.status,
                            "phone_number": call.phone_number,
                            "direction": CallDirection.INBOUND.value
                        })
                        
                        # Send incoming call notification
                        await websocket_manager.send_personal_message({
                            "type": "incoming_call",
                            "data": {
                                "call_id": call.id,
                                "phone_number": call.phone_number,
                                "direction": CallDirection.INBOUND.value,
                                "status": call.status
                            }
                        }, agent.id)
                        
                        logger.info(f"Inbound call {call_unique_id} ringing agent {extension}")
            except Exception as e:
                logger.error(f"Error handling DialBegin: {e}")
                db.rollback()
            finally:
                db.close()
        
        # Also track the destination channel (agent channel)
        if call_unique_id and destination:
            # Destination is usually the agent channel for inbound calls
            if extension:
                db = SessionLocal()
                try:
                    call = db.query(Call).filter(Call.call_unique_id == call_unique_id).first()
                    if call:
                        call.agent_channel = destination
                        db.commit()
                except Exception as e:
                    logger.error(f"Error updating agent channel: {e}")
                    db.rollback()
                finally:
                    db.close()
                channel_tracker.set_agent_channel(call_unique_id, destination, None)
    
    async def _handle_dial_end(self, event: Dict[str, str]):
        """Handle DialEnd event"""
        # Dial attempt completed
        channel = event.get('Channel', '')
        destination = event.get('Destination', '')
        dial_status = event.get('DialStatus', '')
        
        call_unique_id = channel_tracker.get_call_from_channel(channel)
        if call_unique_id:
            logger.debug(f"Dial end: {channel} -> {destination}, Status: {dial_status}")
            
            if dial_status == 'ANSWER':
                # Update call status to answered
                db = SessionLocal()
                try:
                    call = db.query(Call).filter(Call.call_unique_id == call_unique_id).first()
                    if call:
                        call.status = CallStatus.ANSWERED.value
                        db.commit()
                        
                        if call.agent_id:
                            await websocket_manager.send_call_update(call.agent_id, {
                                "call_id": call.id,
                                "status": call.status,
                                "phone_number": call.phone_number,
                                "direction": call.direction
                            })
                except Exception as e:
                    logger.error(f"Error handling DialEnd event: {e}")
                    db.rollback()
                finally:
                    db.close()
    
    async def _handle_cdr(self, event: Dict[str, str]):
        """Handle CDR event from Asterisk"""
        try:
            await cdr_processor.process_cdr_event(event)
        except Exception as e:
            logger.error(f"Error handling CDR event: {e}")
    
    async def _handle_varset(self, event: Dict[str, str]):
        """Handle VarSet event (may contain quality metrics)"""
        # Check if this is a quality metric variable
        variable = event.get('Variable', '')
        value = event.get('Value', '')
        channel = event.get('Channel', '')
        
        if variable in ['RTCPJITTER', 'RTCPLOSS', 'RTCPMOS']:
            try:
                # Try to find call from channel
                call_unique_id = channel_tracker.get_call_from_channel(channel)
                if call_unique_id:
                    db = SessionLocal()
                    try:
                        call = db.query(Call).filter(Call.call_unique_id == call_unique_id).first()
                        if call:
                            metrics = {}
                            if variable == 'RTCPJITTER':
                                metrics['jitter'] = float(value) if value else None
                            elif variable == 'RTCPLOSS':
                                metrics['packet_loss'] = float(value) if value else None
                            elif variable == 'RTCPMOS':
                                metrics['mos_score'] = float(value) if value else None
                            
                            if metrics:
                                await cdr_processor.process_quality_metrics(call.id, metrics)
                    finally:
                        db.close()
            except (ValueError, TypeError) as e:
                logger.debug(f"Error parsing quality metric {variable}={value}: {e}")
    
    async def disconnect(self):
        """Disconnect from AMI"""
        if self.connection:
            try:
                # Set socket to non-blocking for quick shutdown
                self.connection.settimeout(0.1)
                logout_action = self._build_ami_action('Logoff')
                self.connection.send(logout_action.encode('utf-8'))
            except:
                pass
            try:
                self.connection.close()
            except:
                pass
            self.connection = None
            self.connected = False
            logger.info("Disconnected from Asterisk AMI")


# Global AMI event listener instance
ami_event_listener = AMIEventListener()
