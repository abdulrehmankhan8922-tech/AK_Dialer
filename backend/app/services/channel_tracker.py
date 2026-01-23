"""
Channel Tracker Service
Maps call_unique_id to Asterisk channels for agent and customer
"""
from typing import Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class ChannelTracker:
    """Track Asterisk channels for calls"""
    
    def __init__(self):
        # Map call_unique_id -> (agent_channel, customer_channel, bridge_unique_id)
        self.call_channels: Dict[str, Dict[str, str]] = {}
        # Map channel -> call_unique_id (for reverse lookup)
        self.channel_to_call: Dict[str, str] = {}
        # Map Uniqueid -> call_unique_id
        self.uniqueid_to_call: Dict[str, str] = {}
    
    def register_call(self, call_unique_id: str):
        """Register a new call for tracking"""
        if call_unique_id not in self.call_channels:
            self.call_channels[call_unique_id] = {
                'agent_channel': None,
                'customer_channel': None,
                'bridge_unique_id': None,
                'agent_uniqueid': None,
                'customer_uniqueid': None
            }
            logger.debug(f"Registered call {call_unique_id} for channel tracking")
    
    def set_agent_channel(self, call_unique_id: str, channel: str, uniqueid: str = None):
        """Set agent channel for a call"""
        if call_unique_id in self.call_channels:
            self.call_channels[call_unique_id]['agent_channel'] = channel
            if uniqueid:
                self.call_channels[call_unique_id]['agent_uniqueid'] = uniqueid
                self.uniqueid_to_call[uniqueid] = call_unique_id
            self.channel_to_call[channel] = call_unique_id
            logger.debug(f"Set agent channel {channel} for call {call_unique_id}")
        else:
            logger.warning(f"Call {call_unique_id} not found in tracker")
    
    def set_customer_channel(self, call_unique_id: str, channel: str, uniqueid: str = None):
        """Set customer channel for a call"""
        if call_unique_id in self.call_channels:
            self.call_channels[call_unique_id]['customer_channel'] = channel
            if uniqueid:
                self.call_channels[call_unique_id]['customer_uniqueid'] = uniqueid
                self.uniqueid_to_call[uniqueid] = call_unique_id
            self.channel_to_call[channel] = call_unique_id
            logger.debug(f"Set customer channel {channel} for call {call_unique_id}")
        else:
            logger.warning(f"Call {call_unique_id} not found in tracker")
    
    def set_bridge(self, call_unique_id: str, bridge_unique_id: str):
        """Set bridge unique ID for a call"""
        if call_unique_id in self.call_channels:
            self.call_channels[call_unique_id]['bridge_unique_id'] = bridge_unique_id
            logger.debug(f"Set bridge {bridge_unique_id} for call {call_unique_id}")
    
    def get_call_channels(self, call_unique_id: str) -> Optional[Dict[str, str]]:
        """Get all channel info for a call"""
        return self.call_channels.get(call_unique_id)
    
    def get_call_from_channel(self, channel: str) -> Optional[str]:
        """Get call_unique_id from channel name"""
        return self.channel_to_call.get(channel)
    
    def get_call_from_uniqueid(self, uniqueid: str) -> Optional[str]:
        """Get call_unique_id from Asterisk uniqueid"""
        return self.uniqueid_to_call.get(uniqueid)
    
    def get_agent_channel(self, call_unique_id: str) -> Optional[str]:
        """Get agent channel for a call"""
        channels = self.call_channels.get(call_unique_id)
        return channels.get('agent_channel') if channels else None
    
    def get_customer_channel(self, call_unique_id: str) -> Optional[str]:
        """Get customer channel for a call"""
        channels = self.call_channels.get(call_unique_id)
        return channels.get('customer_channel') if channels else None
    
    def remove_call(self, call_unique_id: str):
        """Remove call from tracking"""
        if call_unique_id in self.call_channels:
            channels = self.call_channels[call_unique_id]
            
            # Remove from reverse mappings
            if channels.get('agent_channel'):
                self.channel_to_call.pop(channels['agent_channel'], None)
            if channels.get('customer_channel'):
                self.channel_to_call.pop(channels['customer_channel'], None)
            if channels.get('agent_uniqueid'):
                self.uniqueid_to_call.pop(channels['agent_uniqueid'], None)
            if channels.get('customer_uniqueid'):
                self.uniqueid_to_call.pop(channels['customer_uniqueid'], None)
            
            del self.call_channels[call_unique_id]
            logger.debug(f"Removed call {call_unique_id} from tracking")
    
    def get_all_active_calls(self) -> Dict[str, Dict[str, str]]:
        """Get all active calls being tracked"""
        return self.call_channels.copy()


# Global channel tracker instance
channel_tracker = ChannelTracker()