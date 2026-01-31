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
from app.models.call import Call, CallStatus
from app.models.agent import Agent, AgentStatus
from app.services.channel_tracker import channel_tracker
from app.services.websocket_manager import websocket_manager
from app.services.cdr_processor import cdr_processor
from datetime import datetime

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
    
    async def _handle_newchannel(self, event: Dict[str, str]):
        """Handle Newchannel event"""
        channel = event.get('Channel', '')
        uniqueid = event.get('Uniqueid', '')
        context = event.get('Context', '')
        exten = event.get('Exten', '')
        
        logger.debug(f"Newchannel: {channel} (Uniqueid: {uniqueid})")
        
        # Check if this channel is related to a tracked call
        # For now, we'll match by extension or context
        
        # Try to find call by uniqueid if it was set earlier
        call_unique_id = channel_tracker.get_call_from_uniqueid(uniqueid)
        if call_unique_id:
            # Determine if this is agent or customer channel
            # Agent channels usually come from internal context
            if 'internal' in context.lower() or exten:
                channel_tracker.set_agent_channel(call_unique_id, channel, uniqueid)
            else:
                channel_tracker.set_customer_channel(call_unique_id, channel, uniqueid)
    
    async def _handle_newstate(self, event: Dict[str, str]):
        """Handle Newstate event (channel state changes)"""
        channel = event.get('Channel', '')
        state = event.get('ChannelState', '')
        uniqueid = event.get('Uniqueid', '')
        
        call_unique_id = channel_tracker.get_call_from_channel(channel) or channel_tracker.get_call_from_uniqueid(uniqueid)
        
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
                call.end_time = datetime.utcnow()
                
                if call.start_time:
                    duration = (call.end_time - call.start_time).total_seconds()
                    call.duration = int(duration)
                
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
                    db.commit()
                    
                    if call.agent_id:
                        await websocket_manager.send_call_update(call.agent_id, {
                            "call_id": call.id,
                            "status": call.status,
                            "phone_number": call.phone_number
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
        """Handle DialBegin event"""
        # Dial attempt started
        channel = event.get('Channel', '')
        destination = event.get('Destination', '')
        
        call_unique_id = channel_tracker.get_call_from_channel(channel)
        if call_unique_id:
            logger.debug(f"Dial begin: {channel} -> {destination}")
    
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
                                "phone_number": call.phone_number
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
