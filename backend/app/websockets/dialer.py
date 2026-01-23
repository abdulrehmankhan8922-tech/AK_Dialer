from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from app.services.websocket_manager import websocket_manager
from app.core.security import decode_access_token
from typing import Optional

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    """WebSocket endpoint for real-time updates"""
    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return
    
    # Decode token
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=1008, reason="Invalid token")
        return
    
    agent_id = payload.get("agent_id")
    session_id = payload.get("session_id")
    
    if not agent_id:
        await websocket.close(code=1008, reason="Invalid token")
        return
    
    # Connect
    await websocket_manager.connect(websocket, agent_id, session_id)
    
    try:
        # Send initial connection confirmation
        await websocket_manager.send_personal_message(
            {
                "type": "connected",
                "message": "WebSocket connected successfully"
            },
            agent_id
        )
        
        # Keep connection alive
        while True:
            # Receive any messages from client
            data = await websocket.receive_text()
            # Echo back or handle client messages
            await websocket_manager.send_personal_message(
                {
                    "type": "echo",
                    "data": data
                },
                agent_id
            )
            
    except WebSocketDisconnect:
        websocket_manager.disconnect(agent_id)
        print(f"Agent {agent_id} disconnected")
