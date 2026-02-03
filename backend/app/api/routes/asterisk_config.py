from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict
from app.core.database import get_db
from app.api.deps import get_current_agent_id
from app.models.agent import Agent
import os
import re
import subprocess
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/asterisk", tags=["asterisk-config"])

# Asterisk config file paths
PJSIP_CONF = "/etc/asterisk/pjsip.conf"
EXTENSIONS_CONF = "/etc/asterisk/extensions.conf"
MANAGER_CONF = "/etc/asterisk/manager.conf"
RTP_CONF = "/etc/asterisk/rtp.conf"


def check_admin(db: Session, agent_id: int):
    """Check if agent is admin"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent or agent.is_admin != 1:
        raise HTTPException(status_code=403, detail="Admin access required")
    return agent


class PJSIPEndpoint(BaseModel):
    extension: str
    password: str
    context: str = "from-internal"
    callerid: Optional[str] = None


class PJSIPEndpointResponse(BaseModel):
    extension: str
    password: str
    context: str
    callerid: Optional[str] = None
    registered: bool = False
    contact: Optional[str] = None


class DialplanEntry(BaseModel):
    context: str
    extension: str
    priority: int
    application: str
    appdata: str


class SIPTrunkConfig(BaseModel):
    server: str
    username: str
    password: str
    port: int = 5060


@router.get("/status")
async def get_asterisk_status(
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Get Asterisk service status"""
    check_admin(db, agent_id)
    
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "asterisk"],
            capture_output=True,
            text=True,
            timeout=5
        )
        is_running = result.stdout.strip() == "active"
        
        # Get version if running
        version = None
        if is_running:
            try:
                version_result = subprocess.run(
                    ["asterisk", "-rx", "core show version"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                version = version_result.stdout.strip().split('\n')[0] if version_result.returncode == 0 else None
            except:
                pass
        
        return {
            "running": is_running,
            "version": version
        }
    except Exception as e:
        logger.error(f"Error checking Asterisk status: {e}")
        return {"running": False, "version": None, "error": str(e)}


@router.get("/endpoints")
async def list_pjsip_endpoints(
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """List all PJSIP endpoints"""
    check_admin(db, agent_id)
    
    if not os.path.exists(PJSIP_CONF):
        return []
    
    endpoints = []
    current_endpoint = None
    
    try:
        with open(PJSIP_CONF, 'r') as f:
            lines = f.readlines()
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Check for endpoint section
            if line.startswith('[') and line.endswith(']') and not line.startswith('[transport'):
                section_name = line[1:-1]
                
                # Check if it's an endpoint (has type=endpoint)
                if i + 1 < len(lines):
                    next_lines = ''.join(lines[i:i+10])
                    if 'type=endpoint' in next_lines:
                        # Read endpoint config
                        endpoint_data = {}
                        j = i
                        while j < len(lines) and (j == i or not (lines[j].strip().startswith('[') and lines[j].strip().endswith(']'))):
                            config_line = lines[j].strip()
                            if '=' in config_line and not config_line.startswith(';'):
                                key, value = config_line.split('=', 1)
                                endpoint_data[key.strip()] = value.strip()
                            j += 1
                        
                        if endpoint_data.get('type') == 'endpoint':
                            extension = section_name
                            # Get password from auth section
                            password = ""
                            auth_section = endpoint_data.get('auth', extension)
                            
                            # Find auth section
                            for k in range(len(lines)):
                                if f'[{auth_section}]' in lines[k]:
                                    auth_lines = lines[k:k+10]
                                    for auth_line in auth_lines:
                                        if auth_line.strip().startswith('password='):
                                            password = auth_line.strip().split('=', 1)[1]
                                            break
                            
                            endpoints.append({
                                "extension": extension,
                                "password": password,
                                "context": endpoint_data.get('context', 'from-internal'),
                                "callerid": endpoint_data.get('callerid', '').replace('"', ''),
                                "registered": False,
                                "contact": None
                            })
        
        # Check registration status for each endpoint
        try:
            result = subprocess.run(
                ["asterisk", "-rx", "pjsip show endpoints"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                for endpoint in endpoints:
                    ext = endpoint['extension']
                    if f'Endpoint: {ext}' in result.stdout:
                        # Check if registered
                        if 'Available' in result.stdout or 'Contact:' in result.stdout:
                            endpoint['registered'] = True
                            # Try to get contact info
                            contact_result = subprocess.run(
                                ["asterisk", "-rx", f"pjsip show endpoint {ext}"],
                                capture_output=True,
                                text=True,
                                timeout=5
                            )
                            if 'Contact:' in contact_result.stdout:
                                for line in contact_result.stdout.split('\n'):
                                    if 'Contact:' in line and 'sip:' in line:
                                        endpoint['contact'] = line.split('sip:')[1].split()[0] if 'sip:' in line else None
                                        break
        except:
            pass
        
        return endpoints
    except Exception as e:
        logger.error(f"Error reading PJSIP config: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading config: {str(e)}")


@router.post("/endpoints")
async def create_pjsip_endpoint(
    endpoint: PJSIPEndpoint,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Create a new PJSIP endpoint"""
    check_admin(db, agent_id)
    
    if not os.path.exists(PJSIP_CONF):
        raise HTTPException(status_code=404, detail="PJSIP config file not found")
    
    try:
        # Read current config
        with open(PJSIP_CONF, 'r') as f:
            content = f.read()
        
        # Check if endpoint already exists
        if f'[{endpoint.extension}]' in content:
            raise HTTPException(status_code=400, detail=f"Endpoint {endpoint.extension} already exists")
        
        # Add endpoint configuration
        new_config = f"""

; Endpoint {endpoint.extension}
[{endpoint.extension}]
type=endpoint
context={endpoint.context}
disallow=all
allow=ulaw
allow=alaw
aors={endpoint.extension}
auth={endpoint.extension}
callerid={endpoint.callerid or f'Agent {endpoint.extension} <{endpoint.extension}>'}
transport=transport-udp

[{endpoint.extension}]
type=auth
auth_type=userpass
password={endpoint.password}
username={endpoint.extension}

[{endpoint.extension}]
type=aor
max_contacts=1
contact=
"""
        
        # Append to file
        with open(PJSIP_CONF, 'a') as f:
            f.write(new_config)
        
        # Reload PJSIP
        subprocess.run(["asterisk", "-rx", "module reload res_pjsip.so"], timeout=5)
        
        return {"success": True, "message": f"Endpoint {endpoint.extension} created"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating endpoint: {str(e)}")


@router.delete("/endpoints/{extension}")
async def delete_pjsip_endpoint(
    extension: str,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Delete a PJSIP endpoint"""
    check_admin(db, agent_id)
    
    if not os.path.exists(PJSIP_CONF):
        raise HTTPException(status_code=404, detail="PJSIP config file not found")
    
    try:
        with open(PJSIP_CONF, 'r') as f:
            lines = f.readlines()
        
        new_lines = []
        skip_section = False
        current_section = None
        
        for i, line in enumerate(lines):
            if line.strip().startswith('[') and line.strip().endswith(']'):
                section_name = line.strip()[1:-1]
                if section_name == extension:
                    skip_section = True
                    current_section = extension
                else:
                    skip_section = False
                    current_section = None
            
            if not skip_section:
                new_lines.append(line)
            elif line.strip() == '' and current_section == extension:
                # End of section
                skip_section = False
                current_section = None
        
        # Write back
        with open(PJSIP_CONF, 'w') as f:
            f.writelines(new_lines)
        
        # Reload PJSIP
        subprocess.run(["asterisk", "-rx", "module reload res_pjsip.so"], timeout=5)
        
        return {"success": True, "message": f"Endpoint {extension} deleted"}
    except Exception as e:
        logger.error(f"Error deleting endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting endpoint: {str(e)}")


@router.get("/dialplan")
async def get_dialplan(
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Get dialplan configuration"""
    check_admin(db, agent_id)
    
    if not os.path.exists(EXTENSIONS_CONF):
        return {"content": "", "error": "Dialplan file not found"}
    
    try:
        with open(EXTENSIONS_CONF, 'r') as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        logger.error(f"Error reading dialplan: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading dialplan: {str(e)}")


@router.post("/dialplan")
async def update_dialplan(
    content: Dict[str, str],
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Update dialplan configuration"""
    check_admin(db, agent_id)
    
    if not os.path.exists(EXTENSIONS_CONF):
        raise HTTPException(status_code=404, detail="Dialplan file not found")
    
    try:
        # Backup original
        subprocess.run(["cp", EXTENSIONS_CONF, f"{EXTENSIONS_CONF}.backup"], timeout=5)
        
        # Write new content
        with open(EXTENSIONS_CONF, 'w') as f:
            f.write(content.get('content', ''))
        
        # Reload dialplan
        subprocess.run(["asterisk", "-rx", "dialplan reload"], timeout=5)
        
        return {"success": True, "message": "Dialplan updated"}
    except Exception as e:
        logger.error(f"Error updating dialplan: {e}")
        # Restore backup
        try:
            subprocess.run(["cp", f"{EXTENSIONS_CONF}.backup", EXTENSIONS_CONF], timeout=5)
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Error updating dialplan: {str(e)}")


@router.get("/trunk")
async def get_trunk_config(
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Get SIP trunk configuration"""
    check_admin(db, agent_id)
    
    if not os.path.exists(PJSIP_CONF):
        return {"exists": False}
    
    try:
        with open(PJSIP_CONF, 'r') as f:
            content = f.read()
        
        # Extract trunk config
        trunk_config = {
            "exists": "trunk" in content,
            "server": "",
            "username": "",
            "password": "",
            "port": 5060
        }
        
        if trunk_config["exists"]:
            # Try to extract trunk info
            lines = content.split('\n')
            in_trunk_section = False
            for line in lines:
                if '[trunk]' in line:
                    in_trunk_section = True
                elif in_trunk_section and line.strip().startswith('[') and line.strip().endswith(']'):
                    break
                elif in_trunk_section:
                    if 'contact=sip:' in line:
                        # Extract server and port
                        match = re.search(r'sip:([^:]+):?(\d+)?', line)
                        if match:
                            trunk_config["server"] = match.group(1)
                            trunk_config["port"] = int(match.group(2)) if match.group(2) else 5060
                    elif 'username=' in line:
                        trunk_config["username"] = line.split('=', 1)[1].strip()
                    elif 'password=' in line:
                        trunk_config["password"] = line.split('=', 1)[1].strip()
        
        return trunk_config
    except Exception as e:
        logger.error(f"Error reading trunk config: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading trunk config: {str(e)}")


@router.post("/trunk")
async def update_trunk_config(
    config: SIPTrunkConfig,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Update SIP trunk configuration"""
    check_admin(db, agent_id)
    
    if not os.path.exists(PJSIP_CONF):
        raise HTTPException(status_code=404, detail="PJSIP config file not found")
    
    try:
        # Read current config
        with open(PJSIP_CONF, 'r') as f:
            content = f.read()
        
        # Backup
        subprocess.run(["cp", PJSIP_CONF, f"{PJSIP_CONF}.backup"], timeout=5)
        
        # Remove old trunk config if exists
        lines = content.split('\n')
        new_lines = []
        skip_trunk = False
        trunk_sections = ['[trunk]']
        
        for line in lines:
            if line.strip() in trunk_sections:
                skip_trunk = True
            elif skip_trunk and line.strip().startswith('[') and line.strip().endswith(']'):
                if line.strip() not in trunk_sections:
                    skip_trunk = False
            
            if not skip_trunk:
                new_lines.append(line)
        
        # Add new trunk config
        trunk_config = f"""

; SIP Trunk Configuration
[trunk]
type=endpoint
context=from-trunk
disallow=all
allow=ulaw
allow=alaw
aors=trunk
auth=trunk
outbound_auth=trunk
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
direct_media=no

[trunk]
type=auth
auth_type=userpass
password={config.password}
username={config.username}

[trunk]
type=aor
contact=sip:{config.server}:{config.port}
qualify_frequency=60
"""
        
        new_lines.append(trunk_config)
        
        # Write back
        with open(PJSIP_CONF, 'w') as f:
            f.write('\n'.join(new_lines))
        
        # Reload PJSIP
        subprocess.run(["asterisk", "-rx", "module reload res_pjsip.so"], timeout=5)
        
        return {"success": True, "message": "Trunk configuration updated"}
    except Exception as e:
        logger.error(f"Error updating trunk: {e}")
        # Restore backup
        try:
            subprocess.run(["cp", f"{PJSIP_CONF}.backup", PJSIP_CONF], timeout=5)
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Error updating trunk: {str(e)}")


@router.post("/reload")
async def reload_asterisk(
    module: Optional[str] = None,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Reload Asterisk configuration"""
    check_admin(db, agent_id)
    
    try:
        if module == "pjsip":
            subprocess.run(["asterisk", "-rx", "module reload res_pjsip.so"], timeout=5)
        elif module == "dialplan":
            subprocess.run(["asterisk", "-rx", "dialplan reload"], timeout=5)
        else:
            subprocess.run(["asterisk", "-rx", "core reload"], timeout=5)
        
        return {"success": True, "message": f"Asterisk {module or 'configuration'} reloaded"}
    except Exception as e:
        logger.error(f"Error reloading Asterisk: {e}")
        raise HTTPException(status_code=500, detail=f"Error reloading: {str(e)}")
