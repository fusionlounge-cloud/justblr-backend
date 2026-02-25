"""
Backend API Tests for Voice Assistant - Reminders CRUD
Tests reminder creation, retrieval, and deletion
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://voice-first-hub.preview.emergentagent.com').rstrip('/')


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_check(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✓ Health check passed: {data}")
    
    def test_root_endpoint(self):
        """Test root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        print(f"✓ Root endpoint passed: {data}")


class TestRemindersCRUD:
    """Reminders CRUD operation tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_ids = []
    
    def test_get_all_reminders(self):
        """Test getting all reminders"""
        response = requests.get(f"{BASE_URL}/api/reminders")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get all reminders: {len(data)} reminders found")
    
    def test_create_meet_reminder(self):
        """Test creating a meet reminder"""
        payload = {
            "title": "TEST_Meeting with John",
            "contact_name": "John Doe",
            "contact_phone": "+919876543210",
            "reminder_type": "meet",
            "scheduled_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "notes": "Discuss project updates"
        }
        response = requests.post(f"{BASE_URL}/api/reminders", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Data assertions
        assert "id" in data
        assert data["title"] == payload["title"]
        assert data["contact_name"] == payload["contact_name"]
        assert data["contact_phone"] == payload["contact_phone"]
        assert data["reminder_type"] == "meet"
        assert data["notes"] == payload["notes"]
        assert data["is_completed"] == False
        
        # Verify GET returns the created reminder
        reminder_id = data["id"]
        get_response = requests.get(f"{BASE_URL}/api/reminders")
        assert get_response.status_code == 200
        all_reminders = get_response.json()
        created_reminder = next((r for r in all_reminders if r["id"] == reminder_id), None)
        assert created_reminder is not None
        assert created_reminder["title"] == payload["title"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reminders/{reminder_id}")
        print(f"✓ Create meet reminder passed: {reminder_id}")
    
    def test_create_call_reminder_with_plus_phone(self):
        """Test phone numbers with + prefix are preserved"""
        payload = {
            "title": "TEST_Call Reminder +Phone",
            "contact_name": "Rajesh Kumar",
            "contact_phone": "+919241770282",
            "reminder_type": "call",
            "scheduled_time": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
        }
        response = requests.post(f"{BASE_URL}/api/reminders", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Critical check: + prefix must be preserved
        assert data["contact_phone"] == "+919241770282"
        assert data["contact_phone"].startswith("+")
        
        reminder_id = data["id"]
        
        # Verify GET also returns + prefix
        get_response = requests.get(f"{BASE_URL}/api/reminders")
        all_reminders = get_response.json()
        created_reminder = next((r for r in all_reminders if r["id"] == reminder_id), None)
        assert created_reminder["contact_phone"] == "+919241770282"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reminders/{reminder_id}")
        print(f"✓ Phone number with + prefix preserved: {data['contact_phone']}")
    
    def test_create_sms_reminder(self):
        """Test creating an SMS reminder"""
        payload = {
            "title": "TEST_SMS Reminder",
            "contact_name": "SMS Contact",
            "contact_phone": "9844882328",
            "reminder_type": "sms",
            "scheduled_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "notes": "Send document"
        }
        response = requests.post(f"{BASE_URL}/api/reminders", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["reminder_type"] == "sms"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reminders/{data['id']}")
        print(f"✓ SMS reminder created and deleted")
    
    def test_create_whatsapp_reminder(self):
        """Test creating a WhatsApp reminder"""
        payload = {
            "title": "TEST_WhatsApp Reminder",
            "contact_name": "WhatsApp Contact",
            "contact_phone": "+919845659234",
            "reminder_type": "whatsapp",
            "scheduled_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        }
        response = requests.post(f"{BASE_URL}/api/reminders", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["reminder_type"] == "whatsapp"
        assert data["contact_phone"] == "+919845659234"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reminders/{data['id']}")
        print(f"✓ WhatsApp reminder with +phone created")
    
    def test_create_deskwork_reminder(self):
        """Test creating a deskwork reminder (no contact)"""
        payload = {
            "title": "TEST_Deskwork Task",
            "reminder_type": "deskwork",
            "scheduled_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "notes": "Complete report"
        }
        response = requests.post(f"{BASE_URL}/api/reminders", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["reminder_type"] == "deskwork"
        assert data["contact_name"] is None
        assert data["contact_phone"] is None
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reminders/{data['id']}")
        print(f"✓ Deskwork reminder (no contact) created")
    
    def test_delete_reminder(self):
        """Test deleting a reminder"""
        # First create a reminder
        payload = {
            "title": "TEST_To Be Deleted",
            "reminder_type": "meet",
            "scheduled_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        }
        create_response = requests.post(f"{BASE_URL}/api/reminders", json=payload)
        assert create_response.status_code == 200
        reminder_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/reminders/{reminder_id}")
        assert delete_response.status_code == 200
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/reminders")
        all_reminders = get_response.json()
        deleted_reminder = next((r for r in all_reminders if r["id"] == reminder_id), None)
        assert deleted_reminder is None
        print(f"✓ Delete reminder verified - not found after deletion")
    
    def test_delete_non_existent_reminder(self):
        """Test deleting a non-existent reminder returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/reminders/{fake_id}")
        assert response.status_code == 404
        print(f"✓ Delete non-existent reminder returns 404")
    
    def test_complete_reminder(self):
        """Test marking a reminder as completed"""
        # Create reminder
        payload = {
            "title": "TEST_Complete This",
            "reminder_type": "call",
            "scheduled_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        }
        create_response = requests.post(f"{BASE_URL}/api/reminders", json=payload)
        reminder_id = create_response.json()["id"]
        
        # Mark as complete
        complete_response = requests.put(f"{BASE_URL}/api/reminders/{reminder_id}/complete")
        assert complete_response.status_code == 200
        
        # Verify it's completed - filter by completed status
        get_response = requests.get(f"{BASE_URL}/api/reminders?completed=true")
        all_completed = get_response.json()
        completed_reminder = next((r for r in all_completed if r["id"] == reminder_id), None)
        assert completed_reminder is not None
        assert completed_reminder["is_completed"] == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reminders/{reminder_id}")
        print(f"✓ Complete reminder verified")


class TestNotesAPI:
    """Notes endpoints tests"""
    
    def test_get_notes(self):
        """Test getting all notes"""
        response = requests.get(f"{BASE_URL}/api/notes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get notes: {len(data)} notes found")
    
    def test_create_and_delete_note(self):
        """Test creating and deleting a note"""
        payload = {
            "title": "TEST_Note",
            "content": "Test content",
            "tags": ["test", "automated"]
        }
        create_response = requests.post(f"{BASE_URL}/api/notes", json=payload)
        assert create_response.status_code == 200
        note_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/notes/{note_id}")
        assert delete_response.status_code == 200
        print(f"✓ Note created and deleted")


class TestVoiceEndpoints:
    """Voice-related endpoints tests"""
    
    def test_voice_command_open_app(self):
        """Test voice command for opening an app"""
        payload = {"command": "open instagram"}
        response = requests.post(f"{BASE_URL}/api/voice/command", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "open_app"
        assert data["parameters"]["app_name"] == "instagram"
        print(f"✓ Voice command 'open instagram': {data['message']}")
    
    def test_voice_command_create_reminder(self):
        """Test voice command for creating reminder"""
        payload = {"command": "remind me to call John tomorrow"}
        response = requests.post(f"{BASE_URL}/api/voice/command", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "create_reminder"
        assert data["parameters"]["type"] == "call"
        print(f"✓ Voice command reminder: {data['message']}")
    
    def test_voice_command_whatsapp_reminder(self):
        """Test voice command for WhatsApp reminder"""
        payload = {"command": "remind me to whatsapp Sarah"}
        response = requests.post(f"{BASE_URL}/api/voice/command", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "create_reminder"
        assert data["parameters"]["type"] == "whatsapp"
        print(f"✓ Voice command WhatsApp: {data['message']}")
    
    def test_voice_command_unknown(self):
        """Test voice command with unknown intent"""
        payload = {"command": "play music"}
        response = requests.post(f"{BASE_URL}/api/voice/command", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "unknown"
        print(f"✓ Unknown voice command handled: {data['message']}")


class TestGoogleContacts:
    """Google Contacts endpoint tests"""
    
    def test_google_contacts_placeholder(self):
        """Test Google Contacts endpoint (OAuth not implemented)"""
        response = requests.get(f"{BASE_URL}/api/contacts/google")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "contacts" in data
        print(f"✓ Google Contacts endpoint: {data['message']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
