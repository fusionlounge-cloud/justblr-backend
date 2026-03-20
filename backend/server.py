from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone
import requests
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from twilio.rest import Client as TwilioClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Deepgram API key
DEEPGRAM_API_KEY = os.environ['DEEPGRAM_API_KEY']

# Twilio configuration (optional - will work without it but won't send SMS/WhatsApp)
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
TWILIO_WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', 'whatsapp:+14155238886')  # Twilio sandbox number

# Initialize Twilio client if credentials are available
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logger_twilio = logging.getLogger('twilio')
        logger_twilio.info("Twilio client initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Twilio client: {e}")

# Create the main app
app = FastAPI()

# Serve static files for downloads
STATIC_DIR = ROOT_DIR / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize scheduler for auto-execution
scheduler = AsyncIOScheduler()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===== AUTO-EXECUTION FUNCTIONS =====

async def execute_reminder_action(reminder_id: str):
    """Execute a reminder action automatically at scheduled time"""
    try:
        reminder = await db.reminders.find_one({"id": reminder_id})
        if not reminder:
            logger.warning(f"Reminder {reminder_id} not found for auto-execution")
            return
        
        if reminder.get('is_completed') or reminder.get('auto_execute_triggered'):
            logger.info(f"Reminder {reminder_id} already completed/triggered, skipping")
            return
        
        reminder_type = reminder.get('reminder_type')
        contact_phone = reminder.get('contact_phone', '')
        contact_name = reminder.get('contact_name', '')
        notes = reminder.get('notes', '')
        title = reminder.get('title', '')
        
        # Clean and fix phone number format
        if contact_phone:
            # Remove all non-digit characters except +
            cleaned = ''.join(c for c in contact_phone if c.isdigit() or c == '+')
            # If no country code, add +91 for India
            if cleaned and not cleaned.startswith('+'):
                cleaned = '+91' + cleaned
            contact_phone = cleaned
            logger.info(f"Cleaned phone number: {contact_phone}")
        
        # Log the execution
        execution_log = {
            "reminder_id": reminder_id,
            "reminder_type": reminder_type,
            "contact_phone": contact_phone,
            "executed_at": datetime.now(timezone.utc),
            "status": "triggered"
        }
        
        # Execute based on reminder type
        execution_result = None
        execution_success = False
        
        if reminder_type == 'sms' and contact_phone and twilio_client and TWILIO_PHONE_NUMBER:
            # Send SMS via Twilio
            try:
                message_body = notes if notes else f"Reminder: {title}"
                message = twilio_client.messages.create(
                    body=message_body,
                    from_=TWILIO_PHONE_NUMBER,
                    to=contact_phone
                )
                execution_result = {"sms_sid": message.sid, "status": "sent"}
                execution_log["status"] = "sms_sent"
                execution_log["message_sid"] = message.sid
                execution_success = True
                logger.info(f"SMS sent to {contact_phone} for reminder {reminder_id}, SID: {message.sid}")
            except Exception as e:
                execution_result = {"error": str(e), "status": "failed"}
                execution_log["status"] = "sms_failed"
                execution_log["error"] = str(e)
                logger.error(f"Failed to send SMS for reminder {reminder_id}: {str(e)}")
        
        elif reminder_type == 'whatsapp' and contact_phone and twilio_client:
            # Send WhatsApp message via Twilio
            try:
                message_body = notes if notes else f"Reminder: {title}"
                # Format phone number for WhatsApp (must include country code)
                whatsapp_to = f"whatsapp:{contact_phone}" if not contact_phone.startswith('whatsapp:') else contact_phone
                message = twilio_client.messages.create(
                    body=message_body,
                    from_=TWILIO_WHATSAPP_NUMBER,
                    to=whatsapp_to
                )
                execution_result = {"whatsapp_sid": message.sid, "status": "sent"}
                execution_log["status"] = "whatsapp_sent"
                execution_log["message_sid"] = message.sid
                logger.info(f"WhatsApp sent to {contact_phone} for reminder {reminder_id}, SID: {message.sid}")
            except Exception as e:
                execution_result = {"error": str(e), "status": "failed"}
                execution_log["status"] = "whatsapp_failed"
                execution_log["error"] = str(e)
                logger.error(f"Failed to send WhatsApp for reminder {reminder_id}: {str(e)}")
        
        elif reminder_type == 'call':
            # For calls, we can only trigger on mobile device
            execution_log["status"] = "call_pending"
            logger.info(f"Call reminder {reminder_id} marked as pending - requires mobile device")
        
        else:
            # For other types (meet, deskwork), just mark as triggered
            execution_log["status"] = "triggered"
        
        # ALWAYS mark as triggered to prevent rescheduling
        update_data = {
            "auto_execute_triggered": True,  # Always set to prevent rescheduling
            "triggered_at": datetime.now(timezone.utc),
            "execution_result": execution_result
        }
        
        # If SMS or WhatsApp was successfully sent, also mark as completed
        if execution_success:
            update_data["is_completed"] = True
            update_data["auto_execute"] = False  # Disable auto-execute after success
            logger.info(f"Reminder {reminder_id} marked as COMPLETED after successful {reminder_type}")
        
        await db.reminders.update_one(
            {"id": reminder_id},
            {"$set": update_data}
        )
        
        await db.execution_logs.insert_one(execution_log)
        logger.info(f"Auto-execution completed for reminder {reminder_id} ({reminder_type})")
        
    except Exception as e:
        logger.error(f"Error executing reminder {reminder_id}: {str(e)}")
        # Even on error, mark as triggered to prevent infinite rescheduling
        try:
            await db.reminders.update_one(
                {"id": reminder_id},
                {"$set": {"auto_execute_triggered": True, "execution_result": {"error": str(e)}}}
            )
        except:
            pass

def schedule_reminder_execution(reminder_id: str, scheduled_time: datetime, auto_execute: bool):
    """Schedule a reminder for auto-execution"""
    if not auto_execute:
        return
    
    try:
        # Ensure scheduled_time is timezone-aware
        if scheduled_time.tzinfo is None:
            scheduled_time = scheduled_time.replace(tzinfo=timezone.utc)
        
        # Only schedule if it's in the future
        now = datetime.now(timezone.utc)
        if scheduled_time > now:
            job_id = f"reminder_{reminder_id}"
            
            # Remove existing job if any
            if scheduler.get_job(job_id):
                scheduler.remove_job(job_id)
            
            scheduler.add_job(
                execute_reminder_action,
                trigger=DateTrigger(run_date=scheduled_time),
                args=[reminder_id],
                id=job_id,
                replace_existing=True
            )
            logger.info(f"Scheduled auto-execution for reminder {reminder_id} at {scheduled_time}")
    except Exception as e:
        logger.error(f"Failed to schedule reminder {reminder_id}: {str(e)}")

# ===== MODELS =====

class STTResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transcribed_text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ReminderCreate(BaseModel):
    title: str
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    reminder_type: Literal["meet", "call", "sms", "whatsapp", "deskwork", "keepnotes"]
    scheduled_time: datetime
    notes: Optional[str] = None
    auto_execute: bool = False  # If true, auto-trigger at scheduled time
    device_id: Optional[str] = None  # For device-specific data

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    notes: Optional[str] = None
    auto_execute: Optional[bool] = None

class Reminder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    reminder_type: str
    scheduled_time: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_completed: bool = False
    auto_execute: bool = False
    auto_execute_triggered: bool = False
    triggered_at: Optional[datetime] = None
    device_id: Optional[str] = None  # For device-specific data

class VoiceCommandRequest(BaseModel):
    command: str

class VoiceCommandResponse(BaseModel):
    action: str
    parameters: dict
    message: str

class NoteCreate(BaseModel):
    title: str
    content: str
    tags: List[str] = []

class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    tags: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# ===== SYNC MODELS =====

class Contact(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None

class ContactsSyncRequest(BaseModel):
    device_id: str
    contacts: List[Contact]
    append: bool = False  # If true, append to existing contacts instead of replacing

class SyncCodeRequest(BaseModel):
    device_id: str

class SyncCodeVerifyRequest(BaseModel):
    sync_code: str

class SyncCodeResponse(BaseModel):
    sync_code: str
    expires_in: int = 3600  # 1 hour

# ===== DELEGATION MODELS =====

class EmployeeCreate(BaseModel):
    name: str
    phone: str
    device_id: str  # Owner's device ID

class Employee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    device_id: str  # Owner's device ID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TaskCreate(BaseModel):
    employee_id: str
    description: str
    deadline: Optional[datetime] = None
    device_id: str  # Owner's device ID

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: Optional[str] = None
    employee_phone: Optional[str] = None
    description: str
    deadline: Optional[datetime] = None
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    is_overdue: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    device_id: str  # Owner's device ID
    sent_to_whatsapp: bool = False

class TaskUpdate(BaseModel):
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    is_completed: Optional[bool] = None

# ===== VOICE ENDPOINTS =====

@api_router.post("/voice/stt", response_model=STTResponse)
async def speech_to_text(audio_file: UploadFile = File(...)):
    """Convert speech to text using Deepgram (supports Indian accents)"""
    try:
        # Read audio file
        audio_content = await audio_file.read()
        
        # Deepgram API endpoint
        url = "https://api.deepgram.com/v1/listen"
        
        # Headers
        headers = {
            "Authorization": f"Token {DEEPGRAM_API_KEY}",
            "Content-Type": "audio/m4a"
        }
        
        # Parameters for Indian English
        params = {
            "model": "nova-2",
            "language": "en-IN",  # English - India
            "smart_format": "true",
            "punctuate": "true"
        }
        
        # Make request to Deepgram
        response = requests.post(url, headers=headers, params=params, data=audio_content, timeout=30)
        
        if response.status_code != 200:
            logger.error(f"Deepgram error: {response.text}")
            raise HTTPException(status_code=500, detail=f"Deepgram API error: {response.text}")
        
        result = response.json()
        
        # Extract transcribed text
        transcribed_text = ""
        if result.get("results") and result["results"].get("channels"):
            channels = result["results"]["channels"]
            if channels and len(channels) > 0:
                alternatives = channels[0].get("alternatives")
                if alternatives and len(alternatives) > 0:
                    transcribed_text = alternatives[0].get("transcript", "")
        
        if not transcribed_text:
            raise HTTPException(status_code=400, detail="No speech detected in audio")
        
        # Create response
        stt_response = STTResponse(transcribed_text=transcribed_text)
        
        # Save to database
        await db.transcriptions.insert_one(stt_response.dict())
        
        logger.info(f"Transcribed audio: {transcribed_text[:100]}...")
        return stt_response
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Deepgram request error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech-to-text request failed: {str(e)}")
    except Exception as e:
        logger.error(f"STT error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech-to-text failed: {str(e)}")

@api_router.post("/voice/command", response_model=VoiceCommandResponse)
async def process_voice_command(request: VoiceCommandRequest):
    """Process voice commands and extract actions"""
    try:
        command_lower = request.command.lower()
        
        # Parse voice commands
        if "open" in command_lower:
            apps = ["instagram", "facebook", "linkedin", "whatsapp", "wechat", "alibaba"]
            for app in apps:
                if app in command_lower:
                    return VoiceCommandResponse(
                        action="open_app",
                        parameters={"app_name": app},
                        message=f"Opening {app.capitalize()}"
                    )
        
        elif "remind" in command_lower or "reminder" in command_lower:
            # Extract reminder type
            reminder_type = "call"
            if "meet" in command_lower:
                reminder_type = "meet"
            elif "sms" in command_lower or "message" in command_lower:
                reminder_type = "sms"
            elif "whatsapp" in command_lower:
                reminder_type = "whatsapp"
            
            return VoiceCommandResponse(
                action="create_reminder",
                parameters={"type": reminder_type, "command": request.command},
                message=f"Creating {reminder_type} reminder"
            )
        
        else:
            return VoiceCommandResponse(
                action="unknown",
                parameters={},
                message="I didn't understand that command. Try 'Open Instagram' or 'Create a reminder'"
            )
            
    except Exception as e:
        logger.error(f"Command processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== REMINDER ENDPOINTS =====

class MigrateDeviceRequest(BaseModel):
    from_device_ids: List[str]
    to_device_id: str

@api_router.post("/reminders/migrate")
async def migrate_reminders(request: MigrateDeviceRequest):
    """Migrate reminders from old device IDs to new device ID"""
    try:
        result = await db.reminders.update_many(
            {"device_id": {"$in": request.from_device_ids}},
            {"$set": {"device_id": request.to_device_id}}
        )
        
        # Also migrate contacts
        await db.contacts.update_many(
            {"device_id": {"$in": request.from_device_ids}},
            {"$set": {"device_id": request.to_device_id}}
        )
        
        return {"message": f"Migrated {result.modified_count} reminders to {request.to_device_id}"}
    except Exception as e:
        logger.error(f"Migration error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/reminders", response_model=Reminder)
async def create_reminder(reminder: ReminderCreate):
    """Create a new reminder with optional auto-execution scheduling"""
    try:
        reminder_obj = Reminder(**reminder.dict())
        await db.reminders.insert_one(reminder_obj.dict())
        
        # Schedule auto-execution if enabled
        if reminder.auto_execute:
            schedule_reminder_execution(
                reminder_obj.id, 
                reminder.scheduled_time,
                reminder.auto_execute
            )
        
        logger.info(f"Created reminder: {reminder_obj.title} (auto_execute={reminder.auto_execute})")
        return reminder_obj
    except Exception as e:
        logger.error(f"Reminder creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reminders", response_model=List[Reminder])
async def get_reminders(completed: Optional[bool] = None, device_id: Optional[str] = None):
    """Get reminders filtered by device_id for data isolation"""
    try:
        query = {}
        if device_id:
            query["device_id"] = device_id
        if completed is not None:
            query["is_completed"] = completed
        
        reminders = await db.reminders.find(query).sort("scheduled_time", 1).to_list(1000)
        return [Reminder(**reminder) for reminder in reminders]
    except Exception as e:
        logger.error(f"Get reminders error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/reminders/{reminder_id}/complete")
async def complete_reminder(reminder_id: str):
    """Mark a reminder as completed"""
    try:
        result = await db.reminders.update_one(
            {"id": reminder_id},
            {"$set": {"is_completed": True}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Reminder not found")
        return {"message": "Reminder completed"}
    except Exception as e:
        logger.error(f"Complete reminder error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str):
    """Delete a reminder"""
    try:
        result = await db.reminders.delete_one({"id": reminder_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Reminder not found")
        return {"message": "Reminder deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete reminder error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, reminder_update: ReminderUpdate):
    """Update a reminder"""
    try:
        # Get existing reminder
        existing = await db.reminders.find_one({"id": reminder_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Reminder not found")
        
        # Build update dict with only provided fields
        update_data = {}
        for field, value in reminder_update.dict(exclude_unset=True).items():
            if value is not None:
                update_data[field] = value
        
        if not update_data:
            return Reminder(**existing)
        
        # Update in database
        result = await db.reminders.update_one(
            {"id": reminder_id},
            {"$set": update_data}
        )
        
        # Reschedule if scheduled_time or auto_execute changed
        if 'scheduled_time' in update_data or 'auto_execute' in update_data:
            new_scheduled_time = update_data.get('scheduled_time', existing.get('scheduled_time'))
            new_auto_execute = update_data.get('auto_execute', existing.get('auto_execute', False))
            
            # Remove existing job
            job_id = f"reminder_{reminder_id}"
            if scheduler.get_job(job_id):
                scheduler.remove_job(job_id)
            
            # Schedule new job if auto_execute is enabled
            if new_auto_execute and new_scheduled_time:
                schedule_reminder_execution(reminder_id, new_scheduled_time, True)
        
        # Get updated reminder
        updated = await db.reminders.find_one({"id": reminder_id})
        logger.info(f"Updated reminder: {reminder_id}")
        return Reminder(**updated)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update reminder error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== HEALTH CHECK =====

@api_router.post("/keep/sync")
async def sync_to_google_keep(note_id: str):
    """Sync a note to Google Keep (OAuth required)"""
    try:
        # Find note in database
        note = await db.notes.find_one({"id": note_id})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # TODO: Implement Google Keep OAuth and sync
        # For now, just mark as synced
        await db.notes.update_one(
            {"id": note_id},
            {"$set": {"synced_to_keep": True}}
        )
        
        return {"message": "Note synced to Google Keep (OAuth setup required)"}
    except Exception as e:
        logger.error(f"Keep sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/notes", response_model=List[Note])
async def get_notes():
    """Get all notes"""
    try:
        notes = await db.notes.find().sort("updated_at", -1).to_list(1000)
        return [Note(**note) for note in notes]
    except Exception as e:
        logger.error(f"Get notes error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/notes", response_model=Note)
async def create_note(note: NoteCreate):
    """Create a new note"""
    try:
        note_obj = Note(**note.dict())
        await db.notes.insert_one(note_obj.dict())
        logger.info(f"Created note: {note_obj.title}")
        return note_obj
    except Exception as e:
        logger.error(f"Note creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str):
    """Delete a note"""
    try:
        result = await db.notes.delete_one({"id": note_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"message": "Note deleted"}
    except Exception as e:
        logger.error(f"Delete note error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== SYNC ENDPOINTS (For Web-Mobile Sync) =====
import random
import string

@api_router.post("/sync/generate-code", response_model=SyncCodeResponse)
async def generate_sync_code(request: SyncCodeRequest):
    """Generate a 6-digit sync code for linking web to mobile"""
    try:
        # Generate 6-digit code
        sync_code = ''.join(random.choices(string.digits, k=6))
        
        # Store in database with expiration
        await db.sync_codes.delete_many({"device_id": request.device_id})  # Remove old codes
        await db.sync_codes.insert_one({
            "sync_code": sync_code,
            "device_id": request.device_id,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc).timestamp() + 3600  # 1 hour
        })
        
        return SyncCodeResponse(sync_code=sync_code, expires_in=3600)
    except Exception as e:
        logger.error(f"Generate sync code error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/sync/verify-code")
async def verify_sync_code(request: SyncCodeVerifyRequest):
    """Verify sync code and return device_id for web session"""
    try:
        # Find the sync code
        code_doc = await db.sync_codes.find_one({"sync_code": request.sync_code})
        
        if not code_doc:
            raise HTTPException(status_code=404, detail="Invalid sync code")
        
        # Check expiration
        if code_doc.get("expires_at", 0) < datetime.now(timezone.utc).timestamp():
            await db.sync_codes.delete_one({"sync_code": request.sync_code})
            raise HTTPException(status_code=400, detail="Sync code expired")
        
        device_id = code_doc.get("device_id")
        
        return {"device_id": device_id, "message": "Successfully linked"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify sync code error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/sync/contacts")
async def sync_contacts(request: ContactsSyncRequest):
    """Sync contacts from mobile to cloud"""
    try:
        # If not appending, delete existing contacts first
        if not request.append:
            await db.contacts.delete_many({"device_id": request.device_id})
        
        # Insert new contacts
        if request.contacts:
            contacts_to_insert = [
                {
                    "device_id": request.device_id,
                    "name": c.name,
                    "phone": c.phone,
                    "email": c.email,
                    "synced_at": datetime.now(timezone.utc)
                }
                for c in request.contacts
            ]
            await db.contacts.insert_many(contacts_to_insert)
        
        # Get total count after sync
        total_count = await db.contacts.count_documents({"device_id": request.device_id})
        
        return {"message": f"Synced {len(request.contacts)} contacts", "count": len(request.contacts), "total": total_count}
    except Exception as e:
        logger.error(f"Sync contacts error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/sync/contacts/{device_id}")
async def get_synced_contacts(device_id: str, search: Optional[str] = None, limit: int = 50000):
    """Get synced contacts for a device"""
    try:
        query = {"device_id": device_id}
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}}
            ]
        
        # Get total count first
        total_count = await db.contacts.count_documents({"device_id": device_id})
        
        contacts = await db.contacts.find(query, {"_id": 0}).limit(limit).to_list(limit)
        return {"contacts": contacts, "count": len(contacts), "total": total_count}
    except Exception as e:
        logger.error(f"Get contacts error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== TWILIO SMS/WHATSAPP ENDPOINTS =====

class TwilioConfigRequest(BaseModel):
    account_sid: str
    auth_token: str
    phone_number: str
    whatsapp_number: Optional[str] = None

class SendMessageRequest(BaseModel):
    to_phone: str
    message: str
    message_type: Literal["sms", "whatsapp"] = "sms"

@api_router.post("/twilio/configure")
async def configure_twilio(request: TwilioConfigRequest):
    """Configure Twilio credentials (stores in database for persistence)"""
    global twilio_client, TWILIO_PHONE_NUMBER, TWILIO_WHATSAPP_NUMBER
    try:
        # Test the credentials by initializing client
        test_client = TwilioClient(request.account_sid, request.auth_token)
        
        # Store in database for persistence
        await db.settings.update_one(
            {"key": "twilio_config"},
            {"$set": {
                "key": "twilio_config",
                "account_sid": request.account_sid,
                "auth_token": request.auth_token,
                "phone_number": request.phone_number,
                "whatsapp_number": request.whatsapp_number or "whatsapp:+14155238886",
                "updated_at": datetime.now(timezone.utc)
            }},
            upsert=True
        )
        
        # Update global variables
        twilio_client = test_client
        TWILIO_PHONE_NUMBER = request.phone_number
        TWILIO_WHATSAPP_NUMBER = request.whatsapp_number or "whatsapp:+14155238886"
        
        return {"message": "Twilio configured successfully", "phone_number": request.phone_number}
    except Exception as e:
        logger.error(f"Twilio configuration error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid Twilio credentials: {str(e)}")

@api_router.get("/twilio/status")
async def get_twilio_status():
    """Check if Twilio is configured"""
    is_configured = twilio_client is not None and TWILIO_PHONE_NUMBER is not None
    return {
        "configured": is_configured,
        "phone_number": TWILIO_PHONE_NUMBER if is_configured else None,
        "whatsapp_number": TWILIO_WHATSAPP_NUMBER if is_configured else None
    }

@api_router.post("/twilio/send")
async def send_message(request: SendMessageRequest):
    """Send SMS or WhatsApp message (for testing)"""
    if not twilio_client:
        raise HTTPException(status_code=400, detail="Twilio not configured. Please configure first.")
    
    try:
        if request.message_type == "sms":
            if not TWILIO_PHONE_NUMBER:
                raise HTTPException(status_code=400, detail="Twilio phone number not configured")
            message = twilio_client.messages.create(
                body=request.message,
                from_=TWILIO_PHONE_NUMBER,
                to=request.to_phone
            )
            return {"status": "sent", "type": "sms", "sid": message.sid}
        
        elif request.message_type == "whatsapp":
            whatsapp_to = f"whatsapp:{request.to_phone}" if not request.to_phone.startswith('whatsapp:') else request.to_phone
            message = twilio_client.messages.create(
                body=request.message,
                from_=TWILIO_WHATSAPP_NUMBER,
                to=whatsapp_to
            )
            return {"status": "sent", "type": "whatsapp", "sid": message.sid}
    
    except Exception as e:
        logger.error(f"Send message error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# ===== GOOGLE CONTACTS ENDPOINTS =====

# ===== DELEGATION/TASK ENDPOINTS =====

@api_router.post("/employees", response_model=Employee)
async def create_employee(employee: EmployeeCreate):
    """Add an employee from contacts"""
    try:
        new_employee = Employee(
            name=employee.name,
            phone=employee.phone,
            device_id=employee.device_id
        )
        await db.employees.insert_one(new_employee.model_dump())
        return new_employee
    except Exception as e:
        logger.error(f"Create employee error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/employees")
async def get_employees(device_id: str = None):
    """Get all employees for a device"""
    try:
        query = {}
        if device_id:
            query["device_id"] = device_id
        employees = await db.employees.find(query, {"_id": 0}).to_list(length=1000)
        return employees
    except Exception as e:
        logger.error(f"Get employees error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str):
    """Delete an employee"""
    try:
        result = await db.employees.delete_one({"id": employee_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Employee not found")
        # Also delete all tasks for this employee
        await db.tasks.delete_many({"employee_id": employee_id})
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete employee error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/tasks", response_model=Task)
async def create_task(task: TaskCreate):
    """Create a new task for an employee"""
    try:
        # Get employee details
        employee = await db.employees.find_one({"id": task.employee_id}, {"_id": 0})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        new_task = Task(
            employee_id=task.employee_id,
            employee_name=employee.get("name"),
            employee_phone=employee.get("phone"),
            description=task.description,
            deadline=task.deadline,
            device_id=task.device_id
        )
        await db.tasks.insert_one(new_task.model_dump())
        logger.info(f"Created task for employee {employee.get('name')}: {task.description}")
        return new_task
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create task error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/tasks")
async def get_tasks(device_id: str = None, employee_id: str = None, completed: bool = None):
    """Get tasks filtered by device_id for data isolation"""
    try:
        query = {}
        if device_id:
            query["device_id"] = device_id
        if employee_id:
            query["employee_id"] = employee_id
        if completed is not None:
            query["is_completed"] = completed
        
        tasks = await db.tasks.find(query, {"_id": 0}).to_list(length=1000)
        
        # Check for overdue tasks
        now = datetime.now(timezone.utc)
        for task in tasks:
            if task.get("deadline") and not task.get("is_completed"):
                deadline = task["deadline"]
                try:
                    if isinstance(deadline, str):
                        deadline = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                    # Make deadline timezone-aware if it's naive
                    if deadline.tzinfo is None:
                        deadline = deadline.replace(tzinfo=timezone.utc)
                    task["is_overdue"] = deadline < now
                except Exception as e:
                    logger.error(f"Deadline check error: {e}")
                    task["is_overdue"] = False
            else:
                task["is_overdue"] = False
        
        return tasks
    except Exception as e:
        logger.error(f"Get tasks error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, task_update: TaskUpdate):
    """Update a task"""
    try:
        update_data = {k: v for k, v in task_update.model_dump().items() if v is not None}
        if task_update.is_completed:
            update_data["completed_at"] = datetime.now(timezone.utc)
        
        result = await db.tasks.update_one(
            {"id": task_id},
            {"$set": update_data}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        
        updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
        return updated_task
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update task error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    """Delete a task"""
    try:
        result = await db.tasks.delete_one({"id": task_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"deleted": True}
    except Exception as e:
        logger.error(f"Delete task error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/tasks/bulk/completed")
async def delete_completed_tasks(device_id: str):
    """Delete all completed tasks for a device"""
    try:
        result = await db.tasks.delete_many({
            "device_id": device_id,
            "is_completed": True
        })
        return {"deleted_count": result.deleted_count}
    except Exception as e:
        logger.error(f"Delete completed tasks error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/tasks/{task_id}/send-whatsapp")
async def send_task_to_whatsapp(task_id: str):
    """Send task to employee via WhatsApp"""
    try:
        task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        phone = task.get("employee_phone")
        if not phone:
            raise HTTPException(status_code=400, detail="Employee phone number not available")
        
        # Format message
        deadline_str = ""
        if task.get("deadline"):
            deadline = task["deadline"]
            if isinstance(deadline, str):
                deadline = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
            deadline_str = f"\nDeadline: {deadline.strftime('%d %b %Y, %I:%M %p')}"
        
        message = f"📋 Task Assigned:\n\n{task['description']}{deadline_str}\n\n- Sent from Justblr Matrix"
        
        # Send via Twilio if configured
        if twilio_client and TWILIO_WHATSAPP_NUMBER:
            cleaned_phone = ''.join(c for c in phone if c.isdigit() or c == '+')
            if not cleaned_phone.startswith('+'):
                cleaned_phone = '+91' + cleaned_phone
            
            whatsapp_to = f"whatsapp:{cleaned_phone}"
            try:
                msg = twilio_client.messages.create(
                    body=message,
                    from_=TWILIO_WHATSAPP_NUMBER,
                    to=whatsapp_to
                )
                await db.tasks.update_one({"id": task_id}, {"$set": {"sent_to_whatsapp": True}})
                return {"status": "sent", "sid": msg.sid, "message": message}
            except Exception as e:
                logger.error(f"WhatsApp send error: {str(e)}")
                # Return message for manual sending
                return {"status": "manual", "phone": cleaned_phone, "message": message, "error": str(e)}
        else:
            # Return message for manual sending
            return {"status": "manual", "phone": phone, "message": message}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send task WhatsApp error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/tasks/report")
async def get_tasks_report(device_id: str, employee_id: str = None):
    """Generate a text report of tasks"""
    try:
        query = {"device_id": device_id}
        if employee_id:
            query["employee_id"] = employee_id
        
        tasks = await db.tasks.find(query, {"_id": 0}).to_list(length=1000)
        
        # Group tasks by employee
        employees_tasks = {}
        for task in tasks:
            emp_name = task.get("employee_name", "Unknown")
            if emp_name not in employees_tasks:
                employees_tasks[emp_name] = {"pending": [], "completed": [], "overdue": []}
            
            # Check if overdue
            now = datetime.now(timezone.utc)
            is_overdue = False
            if task.get("deadline") and not task.get("is_completed"):
                deadline = task["deadline"]
                try:
                    if isinstance(deadline, str):
                        deadline = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                    # Make deadline timezone-aware if it's naive
                    if deadline.tzinfo is None:
                        deadline = deadline.replace(tzinfo=timezone.utc)
                    is_overdue = deadline < now
                except Exception as e:
                    logger.error(f"Deadline comparison error: {e}")
                    is_overdue = False
            
            if task.get("is_completed"):
                employees_tasks[emp_name]["completed"].append(task)
            elif is_overdue:
                employees_tasks[emp_name]["overdue"].append(task)
            else:
                employees_tasks[emp_name]["pending"].append(task)
        
        # Generate report
        report = "📊 TASK REPORT\n" + "=" * 30 + "\n\n"
        
        task_num = 1
        for emp_name, tasks_data in employees_tasks.items():
            report += f"👤 {emp_name}\n"
            report += "-" * 20 + "\n"
            
            if tasks_data["overdue"]:
                report += "⚠️ OVERDUE:\n"
                for t in tasks_data["overdue"]:
                    report += f"  {task_num}. {t['description']}\n"
                    task_num += 1
            
            if tasks_data["pending"]:
                report += "📋 Pending:\n"
                for t in tasks_data["pending"]:
                    report += f"  {task_num}. {t['description']}\n"
                    task_num += 1
            
            if tasks_data["completed"]:
                report += "✅ Completed:\n"
                for t in tasks_data["completed"]:
                    report += f"  {task_num}. {t['description']}\n"
                    task_num += 1
            
            report += "\n"
        
        return {"report": report, "summary": {
            "total": len(tasks),
            "pending": sum(len(e["pending"]) for e in employees_tasks.values()),
            "completed": sum(len(e["completed"]) for e in employees_tasks.values()),
            "overdue": sum(len(e["overdue"]) for e in employees_tasks.values())
        }}
    except Exception as e:
        logger.error(f"Generate report error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/contacts/google")
async def get_google_contacts():
    """Get Google Contacts (OAuth required)"""
    try:
        # TODO: Implement Google Contacts OAuth
        # For now return message
        return {"message": "Google Contacts OAuth setup required", "contacts": []}
    except Exception as e:
        logger.error(f"Google Contacts error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== TRIGGERED REMINDERS ENDPOINT =====

@api_router.get("/reminders/triggered")
async def get_triggered_reminders():
    """Get reminders that have been auto-triggered and need execution on device"""
    try:
        triggered = await db.reminders.find({
            "auto_execute_triggered": True,
            "is_completed": False
        }).to_list(100)
        
        return [Reminder(**r) for r in triggered]
    except Exception as e:
        logger.error(f"Get triggered reminders error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/reminders/{reminder_id}/executed")
async def mark_reminder_executed(reminder_id: str):
    """Mark a reminder as executed (called after device performs the action)"""
    try:
        result = await db.reminders.update_one(
            {"id": reminder_id},
            {"$set": {"is_completed": True, "executed_at": datetime.now(timezone.utc)}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Reminder not found")
        return {"message": "Reminder marked as executed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mark executed error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== HEALTH CHECK =====

@api_router.get("/download/app")
async def download_app():
    """Download the app zip file"""
    file_path = ROOT_DIR / "static" / "justblr-matrix-app.zip"
    if file_path.exists():
        return FileResponse(
            path=str(file_path),
            filename="justblr-matrix-app.zip",
            media_type="application/zip"
        )
    raise HTTPException(status_code=404, detail="File not found")

@api_router.get("/")
async def root():
    return {"message": "Voice Assistant API is running", "version": "2.1.0", "scheduler": "enabled"}

@api_router.get("/health")
async def health_check():
    try:
        # Check MongoDB connection
        await db.command("ping")
        scheduler_status = "running" if scheduler.running else "stopped"
        return {"status": "healthy", "database": "connected", "voice": "deepgram", "scheduler": scheduler_status}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@api_router.get("/scan")
async def scan_qr():
    """Return QR code page for Expo Go scanning"""
    html = """
<!DOCTYPE html>
<html>
<head>
    <title>Scan with Expo Go</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #1a1a2e;
            color: white;
        }
        h1 { margin-bottom: 20px; font-size: 24px; }
        img { 
            background: white; 
            padding: 20px; 
            border-radius: 10px;
            margin: 20px;
        }
        p { color: #aaa; max-width: 400px; text-align: center; padding: 0 20px; }
    </style>
</head>
<body>
    <h1>Justblr Matrix</h1>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=exp://voice-first-hub.ngrok.io" alt="QR Code">
    <p>Open <b>Expo Go</b> app and scan this QR code</p>
</body>
</html>
"""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html)

# Serve web dashboard static files
WEB_BUILD_DIR = ROOT_DIR.parent / "web" / "build"

@api_router.get("/dashboard")
async def serve_dashboard():
    """Serve the web dashboard"""
    index_path = WEB_BUILD_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    raise HTTPException(status_code=404, detail="Web dashboard not built")

# ===== STATIC PAGES FOR PLAY STORE =====

@api_router.get("/privacy-policy")
async def privacy_policy():
    """Return privacy policy HTML"""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - Justblr Matrix</title>
    <style>
        body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #333; }
        h1 { color: #667eea; } h2 { color: #4a5568; margin-top: 30px; }
    </style>
</head>
<body>
    <h1>Privacy Policy</h1>
    <p>Last updated: March 2026</p>
    <h2>Introduction</h2>
    <p>Justblr Matrix is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information.</p>
    <h2>Information We Collect</h2>
    <p><strong>Contact Information:</strong> With your permission, we access your device contacts to help you create reminders.</p>
    <p><strong>Reminder Data:</strong> We store the reminders, tasks, and notes you create.</p>
    <p><strong>Device Information:</strong> We collect a unique device identifier to sync your data.</p>
    <h2>How We Use Your Information</h2>
    <ul><li>To provide and maintain our service</li><li>To sync your data across devices</li><li>To send scheduled notifications</li></ul>
    <h2>Data Storage and Security</h2>
    <p>Your data is stored on secure servers with appropriate security measures.</p>
    <h2>Your Rights</h2>
    <p>You can access, correct, or delete your data at any time through the app or by contacting us.</p>
    <h2>Contact Us</h2>
    <p>Email: support@justblrmatrix.com</p>
</body>
</html>"""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html)

@api_router.get("/delete-data")
async def delete_data():
    """Return data deletion request HTML"""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delete Your Data - Justblr Matrix</title>
    <style>
        body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #333; }
        h1 { color: #667eea; }
        .info-box { background: #f0f4ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Request Data Deletion</h1>
    <p>Justblr Matrix - Task Management App</p>
    <div class="info-box">
        <h3>What data we collect:</h3>
        <ul><li>Reminders and tasks you create</li><li>Contact names associated with reminders</li><li>Device identifier for syncing</li></ul>
    </div>
    <h2>How to Delete Your Data</h2>
    <h3>Option 1: Delete within the App</h3>
    <p>You can delete individual reminders and tasks directly in the app by swiping left on any item.</p>
    <h3>Option 2: Request Complete Data Deletion</h3>
    <p>To request deletion of all your data, email us at: <strong>support@justblrmatrix.com</strong></p>
    <p>Subject: Data Deletion Request</p>
    <h3>Data Retention</h3>
    <p>Upon receiving your request, we will delete all your data within 30 days.</p>
</body>
</html>"""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html)

@api_router.get("/app-icon")
async def get_app_icon():
    """Serve app icon for Play Store"""
    icon_path = ROOT_DIR.parent / "frontend" / "web" / "public" / "developer_icon_512.png"
    if icon_path.exists():
        return FileResponse(str(icon_path), media_type="image/png")
    raise HTTPException(status_code=404, detail="Icon not found")



# Include the router in the main app
app.include_router(api_router)

if WEB_BUILD_DIR.exists():
    app.mount("/api/web-static", StaticFiles(directory=str(WEB_BUILD_DIR), html=True), name="web_dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Start the scheduler on app startup"""
    scheduler.start()
    logger.info("Scheduler started")
    
    # Load Twilio config from database
    global twilio_client, TWILIO_PHONE_NUMBER, TWILIO_WHATSAPP_NUMBER
    try:
        twilio_config = await db.settings.find_one({"key": "twilio_config"})
        if twilio_config:
            twilio_client = TwilioClient(twilio_config["account_sid"], twilio_config["auth_token"])
            TWILIO_PHONE_NUMBER = twilio_config["phone_number"]
            TWILIO_WHATSAPP_NUMBER = twilio_config.get("whatsapp_number", "whatsapp:+14155238886")
            logger.info(f"Twilio loaded from database: {TWILIO_PHONE_NUMBER}")
    except Exception as e:
        logger.error(f"Failed to load Twilio config: {str(e)}")
    
    # Reschedule any pending auto-execute reminders from database
    try:
        pending = await db.reminders.find({
            "auto_execute": True,
            "is_completed": False,
            "auto_execute_triggered": {"$ne": True}
        }).to_list(1000)
        
        for reminder in pending:
            scheduled_time = reminder.get("scheduled_time")
            if scheduled_time:
                schedule_reminder_execution(reminder["id"], scheduled_time, True)
        
        logger.info(f"Rescheduled {len(pending)} pending reminders")
    except Exception as e:
        logger.error(f"Failed to reschedule reminders: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown scheduler and close database"""
    scheduler.shutdown()
    logger.info("Scheduler stopped")
    client.close()
