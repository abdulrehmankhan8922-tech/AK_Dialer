from typing import Dict, Set
from fastapi import WebSocket
import json
import asyncio


class WebSocketManager:
    """Manage WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}  # agent_id -> websocket
        self.agent_sessions: Dict[int, str] = {}  # agent_id -> session_id

    async def connect(self, websocket: WebSocket, agent_id: int, session_id: str):
        await websocket.accept()
        self.active_connections[agent_id] = websocket
        self.agent_sessions[agent_id] = session_id

    def disconnect(self, agent_id: int):
        if agent_id in self.active_connections:
            del self.active_connections[agent_id]
        if agent_id in self.agent_sessions:
            del self.agent_sessions[agent_id]

    async def send_personal_message(self, message: dict, agent_id: int):
        if agent_id in self.active_connections:
            try:
                await self.active_connections[agent_id].send_json(message)
            except Exception as e:
                print(f"Error sending message to agent {agent_id}: {e}")

    async def broadcast(self, message: dict, exclude_agent_id: int = None):
        """Broadcast to all connected agents except one"""
        disconnected = []
        for agent_id, connection in self.active_connections.items():
            if agent_id == exclude_agent_id:
                continue
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to agent {agent_id}: {e}")
                disconnected.append(agent_id)
        
        # Clean up disconnected agents
        for agent_id in disconnected:
            self.disconnect(agent_id)

    async def send_call_update(self, agent_id: int, call_data: dict):
        """Send call status update to agent"""
        message = {
            "type": "call_update",
            "data": call_data
        }
        await self.send_personal_message(message, agent_id)

    async def send_stats_update(self, agent_id: int, stats: dict):
        """Send stats update to agent"""
        message = {
            "type": "stats_update",
            "data": stats
        }
        await self.send_personal_message(message, agent_id)

    async def send_agent_status_update(self, agent_id: int, status: str):
        """Send agent status update"""
        message = {
            "type": "agent_status",
            "data": {"status": status}
        }
        await self.send_personal_message(message, agent_id)


# Global WebSocket manager instance
websocket_manager = WebSocketManager()
