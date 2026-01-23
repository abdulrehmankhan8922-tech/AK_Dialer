"""
CDR (Call Detail Record) Processor
Processes CDR events from Asterisk and updates call records
"""
import logging
from typing import Dict, Optional
from datetime import datetime, timezone
from app.core.database import SessionLocal
from app.models.call import Call, CallStatus
from app.models.call_quality import CallQualityMetrics

logger = logging.getLogger(__name__)


class CDRProcessor:
    """Process CDR events and update call records"""
    
    async def process_cdr_event(self, cdr_data: Dict[str, str]) -> bool:
        """
        Process a CDR event from Asterisk
        CDR events contain: accountcode, src, dst, dcontext, channel, dstchannel,
        lastapp, lastdata, start, answer, end, duration, billsec, disposition,
        amaflags, uniqueid, userfield
        """
        try:
            db = SessionLocal()
            try:
                uniqueid = cdr_data.get('uniqueid', '')
                if not uniqueid:
                    logger.warning("CDR event missing uniqueid")
                    return False
                
                # Find call by uniqueid (mapped via channel_tracker)
                # For now, we'll try to find by call_unique_id pattern
                # In production, you'd maintain a mapping of uniqueid -> call_unique_id
                call = db.query(Call).filter(Call.call_unique_id.like(f"%{uniqueid}%")).first()
                
                if not call:
                    # Try to find by phone number and recent start time
                    src = cdr_data.get('src', '')
                    start_time_str = cdr_data.get('start', '')
                    if src and start_time_str:
                        try:
                            # Parse Asterisk datetime format: YYYY-MM-DD HH:MM:SS
                            start_time = datetime.strptime(start_time_str, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
                            # Find call within 5 minutes of CDR start time
                            call = db.query(Call).filter(
                                Call.phone_number == src,
                                Call.start_time >= start_time,
                                Call.start_time <= start_time.replace(second=start_time.second + 300)
                            ).order_by(Call.start_time.desc()).first()
                        except ValueError:
                            logger.warning(f"Failed to parse CDR start time: {start_time_str}")
                
                if not call:
                    logger.debug(f"Call not found for CDR uniqueid: {uniqueid}")
                    return False
                
                # Update call record with CDR data
                answer_time_str = cdr_data.get('answer', '')
                end_time_str = cdr_data.get('end', '')
                duration = cdr_data.get('duration', '0')
                billsec = cdr_data.get('billsec', '0')
                disposition = cdr_data.get('disposition', '')
                
                try:
                    if duration:
                        call.duration = int(duration)
                    if billsec:
                        call.billsec = int(billsec)
                    if disposition:
                        call.disposition = disposition
                    if end_time_str:
                        try:
                            end_time = datetime.strptime(end_time_str, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
                            call.end_time = end_time
                        except ValueError:
                            pass
                    
                    # Update status based on disposition
                    if disposition == 'ANSWERED':
                        call.status = CallStatus.ANSWERED.value
                    elif disposition in ['NO ANSWER', 'BUSY', 'CONGESTION']:
                        call.status = CallStatus.FAILED.value
                    elif disposition == 'ANSWERED':
                        call.status = CallStatus.ENDED.value
                    
                    db.commit()
                    logger.info(f"Updated call {call.id} with CDR data: duration={duration}, billsec={billsec}")
                    return True
                except (ValueError, TypeError) as e:
                    logger.error(f"Error parsing CDR data: {e}")
                    db.rollback()
                    return False
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error processing CDR event: {e}", exc_info=True)
            return False
    
    async def process_quality_metrics(self, call_id: int, metrics: Dict[str, float]) -> bool:
        """
        Process call quality metrics (jitter, packet loss, MOS score)
        """
        try:
            db = SessionLocal()
            try:
                call = db.query(Call).filter(Call.id == call_id).first()
                if not call:
                    logger.warning(f"Call {call_id} not found for quality metrics")
                    return False
                
                quality = CallQualityMetrics(
                    call_id=call_id,
                    jitter=metrics.get('jitter'),
                    packet_loss=metrics.get('packet_loss'),
                    mos_score=metrics.get('mos_score')
                )
                db.add(quality)
                db.commit()
                logger.info(f"Added quality metrics for call {call_id}")
                return True
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error processing quality metrics: {e}", exc_info=True)
            return False


# Global CDR processor instance
cdr_processor = CDRProcessor()
