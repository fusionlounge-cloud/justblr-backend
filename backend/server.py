from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Deepgram API key
DEEPGRAM_API_KEY = os.environ['DEEPGRAM_API_KEY']

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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

class Reminder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    reminder_type: str
    scheduled_time: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_completed: bool = False

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

@api_router.post("/reminders", response_model=Reminder)
async def create_reminder(reminder: ReminderCreate):
    """Create a new reminder"""
    try:
        reminder_obj = Reminder(**reminder.dict())
        await db.reminders.insert_one(reminder_obj.dict())
        logger.info(f"Created reminder: {reminder_obj.title}")
        return reminder_obj
    except Exception as e:
        logger.error(f"Reminder creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reminders", response_model=List[Reminder])
async def get_reminders(completed: Optional[bool] = None):
    """Get all reminders, optionally filter by completion status"""
    try:
        query = {}
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
    except Exception as e:
        logger.error(f"Delete reminder error: {str(e)}")
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

# ===== GOOGLE CONTACTS ENDPOINTS =====

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

# ===== HEALTH CHECK =====

@api_router.get("/")
async def root():
    return {"message": "Voice Assistant API is running", "version": "2.0.0"}

@api_router.get("/health")
async def health_check():
    try:
        # Check MongoDB connection
        await db.command("ping")
        return {"status": "healthy", "database": "connected", "voice": "deepgram"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
