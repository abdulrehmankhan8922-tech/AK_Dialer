from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_access_token
from typing import Optional

# Shared HTTP bearer security scheme - auto_error=False to handle missing tokens gracefully
security = HTTPBearer(auto_error=False)


async def get_current_agent_id(
	request: Request,
	credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> int:
	"""Extract agent_id from JWT token for protected routes"""
	if not credentials:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Not authenticated",
			headers={"WWW-Authenticate": "Bearer"},
		)
	
	token = credentials.credentials
	payload = decode_access_token(token)
	if not payload:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid token",
			headers={"WWW-Authenticate": "Bearer"},
		)
	
	agent_id = payload.get("agent_id")
	if agent_id is None:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid token",
			headers={"WWW-Authenticate": "Bearer"},
		)
	
	return agent_id

