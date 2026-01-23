from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_access_token

# Shared HTTP bearer security scheme
security = HTTPBearer()


async def get_current_agent_id(
	request: Request,
	credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
	"""Extract agent_id from JWT token for protected routes"""
	token = credentials.credentials
	payload = decode_access_token(token)
	if not payload:
		raise HTTPException(status_code=401, detail="Invalid token")
	agent_id = payload.get("agent_id")
	if agent_id is None:
		raise HTTPException(status_code=401, detail="Invalid token")
	return agent_id

