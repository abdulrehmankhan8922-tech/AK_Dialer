import asyncio
import socket
from typing import Optional, Dict
from app.core.config import settings


class FreeSwitchService:
    """FreeSWITCH Event Socket Library integration"""
    
    def __init__(self):
        self.host = settings.FREESWITCH_HOST
        self.port = settings.FREESWITCH_PORT
        self.password = settings.FREESWITCH_PASSWORD
        self.connections: Dict[str, socket.socket] = {}

    async def connect(self) -> Optional[socket.socket]:
        """Connect to FreeSWITCH ESL"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((self.host, self.port))
            
            # Authenticate
            auth_response = sock.recv(1024).decode()
            if "auth/request" in auth_response:
                sock.send(f"auth {self.password}\n\n".encode())
                auth_result = sock.recv(1024).decode()
                if "OK" in auth_result:
                    return sock
            return None
        except Exception as e:
            print(f"FreeSWITCH connection error: {e}")
            return None

    async def send_command(self, command: str, call_uuid: Optional[str] = None) -> str:
        """Send command to FreeSWITCH"""
        sock = await self.connect()
        if not sock:
            return "ERROR: Connection failed"

        try:
            if call_uuid:
                full_command = f"bgapi uuid_transfer {call_uuid} {command}\n\n"
            else:
                full_command = f"{command}\n\n"
            
            sock.send(full_command.encode())
            response = sock.recv(4096).decode()
            return response
        except Exception as e:
            return f"ERROR: {str(e)}"
        finally:
            if sock:
                sock.close()

    async def make_call(
        self,
        phone_number: str,
        agent_extension: str,
        call_unique_id: str
    ) -> Dict:
        """Make an outbound call"""
        # Originate call: agent_extension -> phone_number
        originate_string = (
            f"originate {{origination_uuid={call_unique_id}}}"
            f"user/{agent_extension} {phone_number} XML default"
        )
        
        result = await self.send_command(originate_string)
        
        return {
            "channel": call_unique_id,
            "result": result,
            "success": "OK" in result
        }

    async def hangup_call(self, call_unique_id: str) -> bool:
        """Hangup a call by UUID"""
        result = await self.send_command(f"uuid_kill {call_unique_id}")
        return "OK" in result

    async def transfer_call(self, call_unique_id: str, target_extension: str) -> bool:
        """Transfer call to another extension"""
        result = await self.send_command(f"user/{target_extension}", call_unique_id)
        return "OK" in result

    async def park_call(self, call_unique_id: str) -> bool:
        """Park a call"""
        result = await self.send_command(f"uuid_park {call_unique_id}")
        return "OK" in result
