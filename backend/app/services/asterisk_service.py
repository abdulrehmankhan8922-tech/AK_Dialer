"""
Asterisk AMI (Asterisk Manager Interface) Service
Handles connection, authentication, and call control via AMI protocol
"""
import socket
import asyncio
import re
from typing import Optional, Dict, List
from app.core.config import settings


class AsteriskService:
    """Asterisk AMI integration for call control"""
    
    def __init__(self):
        self.host = settings.ASTERISK_HOST
        self.port = settings.ASTERISK_AMI_PORT
        self.username = settings.ASTERISK_AMI_USERNAME
        self.password = settings.ASTERISK_AMI_PASSWORD
        self.connection: Optional[socket.socket] = None
        self.connected = False
        self.reader_task: Optional[asyncio.Task] = None
        
    def _parse_ami_response(self, response: str) -> Dict[str, str]:
        """Parse AMI response into dictionary"""
        result = {}
        for line in response.strip().split('\r\n'):
            if ':' in line and not line.startswith('--'):
                key, value = line.split(':', 1)
                result[key.strip()] = value.strip()
        return result
    
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
            # Create TCP socket
            self.connection = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.connection.settimeout(10)
            self.connection.connect((self.host, self.port))
            
            # Read welcome message
            welcome = self.connection.recv(4096).decode('utf-8', errors='ignore')
            if 'Asterisk Call Manager' not in welcome:
                print(f"Unexpected welcome message: {welcome}")
                return False
            
            # Authenticate
            login_action = self._build_ami_action('Login', {
                'Username': self.username,
                'Secret': self.password
            })
            
            self.connection.send(login_action.encode('utf-8'))
            response = self.connection.recv(4096).decode('utf-8', errors='ignore')
            
            parsed = self._parse_ami_response(response)
            if parsed.get('Response') == 'Success':
                self.connected = True
                print(f"Connected to Asterisk AMI at {self.host}:{self.port}")
                return True
            else:
                print(f"AMI Authentication failed: {parsed.get('Message', 'Unknown error')}")
                return False
                
        except Exception as e:
            print(f"Asterisk AMI connection error: {e}")
            self.connected = False
            return False
    
    async def send_action(self, action: str, params: Dict[str, str] = None) -> Dict[str, str]:
        """Send AMI action and wait for response"""
        if not self.connected or not self.connection:
            if not await self.connect():
                return {"Response": "Error", "Message": "Not connected to Asterisk"}
        
        try:
            action_str = self._build_ami_action(action, params)
            self.connection.send(action_str.encode('utf-8'))
            
            # Read response (AMI responses end with \r\n\r\n)
            response = ""
            while True:
                data = self.connection.recv(4096).decode('utf-8', errors='ignore')
                response += data
                if '\r\n\r\n' in response:
                    break
            
            return self._parse_ami_response(response)
            
        except Exception as e:
            print(f"Error sending AMI action: {e}")
            self.connected = False
            return {"Response": "Error", "Message": str(e)}
    
    async def originate_call(
        self,
        channel: str,
        context: str,
        exten: str,
        priority: int = 1,
        caller_id: str = None,
        timeout: int = 30000,
        variables: Dict[str, str] = None
    ) -> Dict:
        """
        Originate a call using Asterisk AMI
        
        Args:
            channel: Channel to dial (e.g., "SIP/trunk_name/1234567890")
            context: Dialplan context (e.g., "from-internal")
            exten: Extension to connect to (agent extension)
            priority: Dialplan priority
            caller_id: Caller ID to display
            timeout: Call timeout in milliseconds
            variables: Channel variables to set
        """
        params = {
            'Channel': channel,
            'Context': context,
            'Exten': exten,
            'Priority': str(priority),
            'Timeout': str(timeout),
            'Async': 'true'  # Make call asynchronous
        }
        
        if caller_id:
            params['CallerID'] = caller_id
        
        if variables:
            var_list = []
            for key, value in variables.items():
                var_list.append(f"{key}={value}")
            params['Variable'] = '|'.join(var_list)
        
        response = await self.send_action('Originate', params)
        
        if response.get('Response') == 'Success':
            return {
                "success": True,
                "message": "Call originated successfully",
                "action_id": response.get('ActionID', ''),
                "response": response
            }
        else:
            return {
                "success": False,
                "message": response.get('Message', 'Unknown error'),
                "response": response
            }
    
    async def hangup_call(self, channel: str) -> bool:
        """Hangup a call by channel"""
        params = {'Channel': channel}
        response = await self.send_action('Hangup', params)
        return response.get('Response') == 'Success'
    
    async def transfer_call(self, channel: str, exten: str, context: str = "from-internal") -> bool:
        """Transfer a call to another extension"""
        params = {
            'Channel': channel,
            'Exten': exten,
            'Context': context,
            'Priority': '1'
        }
        response = await self.send_action('Redirect', params)
        return response.get('Response') == 'Success'
    
    async def park_call(self, channel: str, timeout: int = 30000) -> bool:
        """Park a call"""
        params = {
            'Channel': channel,
            'TimeoutChannel': f"Local/s@parked-calls",
            'Timeout': str(timeout)
        }
        response = await self.send_action('Park', params)
        return response.get('Response') == 'Success'
    
    async def get_channel_status(self, channel: str) -> Dict:
        """Get status of a channel"""
        params = {'Channel': channel}
        response = await self.send_action('Status', params)
        return response
    
    async def monitor_start(self, channel: str, file_format: str = "wav", mix: bool = True) -> bool:
        """Start monitoring/recording a channel"""
        params = {
            'Channel': channel,
            'File': f"/var/spool/asterisk/monitor/{channel}",
            'Format': file_format,
            'Mix': '1' if mix else '0'
        }
        response = await self.send_action('Monitor', params)
        return response.get('Response') == 'Success'
    
    async def monitor_stop(self, channel: str) -> bool:
        """Stop monitoring a channel"""
        params = {
            'Channel': channel
        }
        response = await self.send_action('StopMonitor', params)
        return response.get('Response') == 'Success'
    
    async def mute_channel(self, channel: str) -> bool:
        """Mute a channel"""
        params = {
            'Channel': channel,
            'Direction': 'both'  # Mute both directions
        }
        response = await self.send_action('MuteAudio', params)
        return response.get('Response') == 'Success'
    
    async def unmute_channel(self, channel: str) -> bool:
        """Unmute a channel"""
        params = {
            'Channel': channel,
            'Direction': 'both'  # Unmute both directions
        }
        response = await self.send_action('UnmuteAudio', params)
        return response.get('Response') == 'Success'
    
    async def hold_channel(self, channel: str) -> bool:
        """Put a channel on hold"""
        # Use Redirect to park the channel
        params = {
            'Channel': channel,
            'Context': 'default',
            'Exten': 'h',  # Hold extension
            'Priority': '1'
        }
        response = await self.send_action('Redirect', params)
        return response.get('Response') == 'Success'
    
    async def unhold_channel(self, channel: str) -> bool:
        """Take a channel off hold"""
        # Use Redirect back to the bridge
        params = {
            'Channel': channel,
            'Context': 'default',
            'Exten': 's',  # Return from hold
            'Priority': '1'
        }
        response = await self.send_action('Redirect', params)
        return response.get('Response') == 'Success'
    
    async def disconnect(self):
        """Disconnect from Asterisk AMI"""
        if self.connection:
            try:
                await self.send_action('Logoff')
            except:
                pass
            self.connection.close()
            self.connection = None
            self.connected = False
    
    def __del__(self):
        """Cleanup on deletion"""
        if self.connection:
            try:
                self.connection.close()
            except:
                pass
