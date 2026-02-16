#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Voice Assistant API
Tests all endpoints including Voice APIs, Reminders, Notes, and Health checks
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import io
import os
from pathlib import Path

# Backend URL from frontend .env
BACKEND_URL = "https://productivity-voice-1.preview.emergentagent.com/api"

class VoiceAssistantTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }
        
    def log_result(self, test_name, success, message="", response=None):
        """Log test results"""
        if success:
            self.test_results["passed"] += 1
            print(f"✅ {test_name}: PASSED")
            if message:
                print(f"   {message}")
        else:
            self.test_results["failed"] += 1
            print(f"❌ {test_name}: FAILED")
            print(f"   {message}")
            if response:
                print(f"   Response: {response.status_code} - {response.text}")
            self.test_results["errors"].append(f"{test_name}: {message}")
    
    def test_health_endpoints(self):
        """Test health check endpoints"""
        print("\n=== TESTING HEALTH ENDPOINTS ===")
        
        # Test root endpoint
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Voice Assistant API" in data["message"]:
                    self.log_result("Root endpoint", True, f"Message: {data['message']}")
                else:
                    self.log_result("Root endpoint", False, "Invalid response format", response)
            else:
                self.log_result("Root endpoint", False, f"Status code: {response.status_code}", response)
        except Exception as e:
            self.log_result("Root endpoint", False, f"Exception: {str(e)}")
        
        # Test health check
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("Health check", True, f"Status: {data}")
                else:
                    self.log_result("Health check", False, "Service not healthy", response)
            else:
                self.log_result("Health check", False, f"Status code: {response.status_code}", response)
        except Exception as e:
            self.log_result("Health check", False, f"Exception: {str(e)}")
    
    def test_reminders_crud(self):
        """Test Reminders CRUD operations"""
        print("\n=== TESTING REMINDERS API ===")
        
        # Test data for different reminder types
        test_reminders = [
            {
                "title": "Call Sarah about project meeting",
                "reminder_type": "call",
                "scheduled_time": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
                "contact_name": "Sarah Johnson",
                "contact_phone": "+1234567890",
                "notes": "Discuss Q4 project timeline"
            },
            {
                "title": "Meet with team for standup",
                "reminder_type": "meet",
                "scheduled_time": (datetime.utcnow() + timedelta(days=1)).isoformat(),
                "contact_name": "Development Team",
                "notes": "Daily standup meeting"
            },
            {
                "title": "Send SMS to mom",
                "reminder_type": "sms",
                "scheduled_time": (datetime.utcnow() + timedelta(hours=3)).isoformat(),
                "contact_name": "Mom",
                "contact_phone": "+1987654321"
            },
            {
                "title": "WhatsApp message to John",
                "reminder_type": "whatsapp",
                "scheduled_time": (datetime.utcnow() + timedelta(hours=4)).isoformat(),
                "contact_name": "John Smith",
                "contact_phone": "+1122334455",
                "notes": "Ask about weekend plans"
            }
        ]
        
        created_reminder_ids = []
        
        # Test creating reminders
        for i, reminder_data in enumerate(test_reminders):
            try:
                response = self.session.post(
                    f"{self.base_url}/reminders",
                    json=reminder_data,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if "id" in data and data["title"] == reminder_data["title"]:
                        created_reminder_ids.append(data["id"])
                        self.log_result(f"Create reminder {i+1} ({reminder_data['reminder_type']})", True, 
                                      f"ID: {data['id']}")
                    else:
                        self.log_result(f"Create reminder {i+1}", False, "Invalid response format", response)
                else:
                    self.log_result(f"Create reminder {i+1}", False, f"Status: {response.status_code}", response)
            except Exception as e:
                self.log_result(f"Create reminder {i+1}", False, f"Exception: {str(e)}")
        
        # Test getting all reminders
        try:
            response = self.session.get(f"{self.base_url}/reminders")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) >= len(created_reminder_ids):
                    self.log_result("Get all reminders", True, f"Found {len(data)} reminders")
                else:
                    self.log_result("Get all reminders", False, f"Expected list, got: {type(data)}", response)
            else:
                self.log_result("Get all reminders", False, f"Status: {response.status_code}", response)
        except Exception as e:
            self.log_result("Get all reminders", False, f"Exception: {str(e)}")
        
        # Test completing a reminder
        if created_reminder_ids:
            try:
                reminder_id = created_reminder_ids[0]
                response = self.session.put(f"{self.base_url}/reminders/{reminder_id}/complete")
                if response.status_code == 200:
                    data = response.json()
                    if "message" in data:
                        self.log_result("Complete reminder", True, f"Message: {data['message']}")
                    else:
                        self.log_result("Complete reminder", False, "Invalid response format", response)
                else:
                    self.log_result("Complete reminder", False, f"Status: {response.status_code}", response)
            except Exception as e:
                self.log_result("Complete reminder", False, f"Exception: {str(e)}")
        
        # Test getting completed reminders
        try:
            response = self.session.get(f"{self.base_url}/reminders?completed=true")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    completed_count = len([r for r in data if r.get("is_completed", False)])
                    self.log_result("Get completed reminders", True, f"Found {completed_count} completed reminders")
                else:
                    self.log_result("Get completed reminders", False, "Expected list", response)
            else:
                self.log_result("Get completed reminders", False, f"Status: {response.status_code}", response)
        except Exception as e:
            self.log_result("Get completed reminders", False, f"Exception: {str(e)}")
        
        # Test deleting a reminder
        if len(created_reminder_ids) > 1:
            try:
                reminder_id = created_reminder_ids[1]
                response = self.session.delete(f"{self.base_url}/reminders/{reminder_id}")
                if response.status_code == 200:
                    data = response.json()
                    if "message" in data:
                        self.log_result("Delete reminder", True, f"Message: {data['message']}")
                    else:
                        self.log_result("Delete reminder", False, "Invalid response format", response)
                else:
                    self.log_result("Delete reminder", False, f"Status: {response.status_code}", response)
            except Exception as e:
                self.log_result("Delete reminder", False, f"Exception: {str(e)}")
        
        # Test edge cases
        self.test_reminder_edge_cases()
    
    def test_reminder_edge_cases(self):
        """Test reminder edge cases"""
        print("\n--- Testing Reminder Edge Cases ---")
        
        # Test reminder without optional fields
        minimal_reminder = {
            "title": "Minimal reminder test",
            "reminder_type": "call",
            "scheduled_time": (datetime.utcnow() + timedelta(hours=1)).isoformat()
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/reminders",
                json=minimal_reminder,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                self.log_result("Minimal reminder creation", True, "Created without optional fields")
            else:
                self.log_result("Minimal reminder creation", False, f"Status: {response.status_code}", response)
        except Exception as e:
            self.log_result("Minimal reminder creation", False, f"Exception: {str(e)}")
        
        # Test invalid reminder type
        invalid_reminder = {
            "title": "Invalid type test",
            "reminder_type": "invalid_type",
            "scheduled_time": (datetime.utcnow() + timedelta(hours=1)).isoformat()
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/reminders",
                json=invalid_reminder,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 422:  # Validation error expected
                self.log_result("Invalid reminder type validation", True, "Correctly rejected invalid type")
            else:
                self.log_result("Invalid reminder type validation", False, 
                              f"Expected 422, got {response.status_code}", response)
        except Exception as e:
            self.log_result("Invalid reminder type validation", False, f"Exception: {str(e)}")
        
        # Test completing non-existent reminder
        fake_id = str(uuid.uuid4())
        try:
            response = self.session.put(f"{self.base_url}/reminders/{fake_id}/complete")
            if response.status_code == 404:
                self.log_result("Complete non-existent reminder", True, "Correctly returned 404")
            else:
                self.log_result("Complete non-existent reminder", False, 
                              f"Expected 404, got {response.status_code}", response)
        except Exception as e:
            self.log_result("Complete non-existent reminder", False, f"Exception: {str(e)}")
    
    def test_notes_crud(self):
        """Test Notes CRUD operations"""
        print("\n=== TESTING NOTES API ===")
        
        # Test data for notes
        test_notes = [
            {
                "title": "Meeting Notes - Q4 Planning",
                "content": "Discussed project timelines, resource allocation, and key deliverables for Q4. Need to follow up on budget approval.",
                "tags": ["meeting", "planning", "q4", "budget"]
            },
            {
                "title": "Shopping List",
                "content": "Milk, Bread, Eggs, Apples, Chicken, Rice",
                "tags": ["shopping", "groceries"]
            },
            {
                "title": "Book Recommendations",
                "content": "1. Clean Code by Robert Martin\n2. The Pragmatic Programmer\n3. Design Patterns",
                "tags": ["books", "programming", "learning"]
            }
        ]
        
        created_note_ids = []
        
        # Test creating notes
        for i, note_data in enumerate(test_notes):
            try:
                response = self.session.post(
                    f"{self.base_url}/notes",
                    json=note_data,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if "id" in data and data["title"] == note_data["title"]:
                        created_note_ids.append(data["id"])
                        self.log_result(f"Create note {i+1}", True, f"ID: {data['id']}")
                    else:
                        self.log_result(f"Create note {i+1}", False, "Invalid response format", response)
                else:
                    self.log_result(f"Create note {i+1}", False, f"Status: {response.status_code}", response)
            except Exception as e:
                self.log_result(f"Create note {i+1}", False, f"Exception: {str(e)}")
        
        # Test getting all notes
        try:
            response = self.session.get(f"{self.base_url}/notes")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) >= len(created_note_ids):
                    self.log_result("Get all notes", True, f"Found {len(data)} notes")
                else:
                    self.log_result("Get all notes", False, f"Expected list, got: {type(data)}", response)
            else:
                self.log_result("Get all notes", False, f"Status: {response.status_code}", response)
        except Exception as e:
            self.log_result("Get all notes", False, f"Exception: {str(e)}")
        
        # Test updating a note
        if created_note_ids:
            try:
                note_id = created_note_ids[0]
                updated_note = {
                    "title": "Updated Meeting Notes - Q4 Planning",
                    "content": "UPDATED: Discussed project timelines, resource allocation, and key deliverables for Q4. Budget approved!",
                    "tags": ["meeting", "planning", "q4", "budget", "approved"]
                }
                
                response = self.session.put(
                    f"{self.base_url}/notes/{note_id}",
                    json=updated_note,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data["title"] == updated_note["title"]:
                        self.log_result("Update note", True, f"Updated title: {data['title']}")
                    else:
                        self.log_result("Update note", False, "Title not updated correctly", response)
                else:
                    self.log_result("Update note", False, f"Status: {response.status_code}", response)
            except Exception as e:
                self.log_result("Update note", False, f"Exception: {str(e)}")
        
        # Test deleting a note
        if len(created_note_ids) > 1:
            try:
                note_id = created_note_ids[1]
                response = self.session.delete(f"{self.base_url}/notes/{note_id}")
                if response.status_code == 200:
                    data = response.json()
                    if "message" in data:
                        self.log_result("Delete note", True, f"Message: {data['message']}")
                    else:
                        self.log_result("Delete note", False, "Invalid response format", response)
                else:
                    self.log_result("Delete note", False, f"Status: {response.status_code}", response)
            except Exception as e:
                self.log_result("Delete note", False, f"Exception: {str(e)}")
        
        # Test edge cases
        self.test_notes_edge_cases()
    
    def test_notes_edge_cases(self):
        """Test notes edge cases"""
        print("\n--- Testing Notes Edge Cases ---")
        
        # Test note with empty tags
        note_empty_tags = {
            "title": "Note with empty tags",
            "content": "This note has no tags",
            "tags": []
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/notes",
                json=note_empty_tags,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                self.log_result("Note with empty tags", True, "Created with empty tags array")
            else:
                self.log_result("Note with empty tags", False, f"Status: {response.status_code}", response)
        except Exception as e:
            self.log_result("Note with empty tags", False, f"Exception: {str(e)}")
        
        # Test deleting non-existent note
        fake_id = str(uuid.uuid4())
        try:
            response = self.session.delete(f"{self.base_url}/notes/{fake_id}")
            if response.status_code == 404:
                self.log_result("Delete non-existent note", True, "Correctly returned 404")
            else:
                self.log_result("Delete non-existent note", False, 
                              f"Expected 404, got {response.status_code}", response)
        except Exception as e:
            self.log_result("Delete non-existent note", False, f"Exception: {str(e)}")
    
    def test_voice_commands(self):
        """Test voice command processing"""
        print("\n=== TESTING VOICE COMMAND PROCESSING ===")
        
        # Test commands
        test_commands = [
            {
                "command": "Open Instagram",
                "expected_action": "open_app",
                "expected_params": {"app_name": "instagram"}
            },
            {
                "command": "open facebook",
                "expected_action": "open_app", 
                "expected_params": {"app_name": "facebook"}
            },
            {
                "command": "Remind me to call John",
                "expected_action": "create_reminder",
                "expected_params": {"type": "call"}
            },
            {
                "command": "remind me to meet with sarah",
                "expected_action": "create_reminder",
                "expected_params": {"type": "meet"}
            },
            {
                "command": "send sms to mom",
                "expected_action": "create_reminder",
                "expected_params": {"type": "sms"}
            },
            {
                "command": "whatsapp message to john",
                "expected_action": "create_reminder",
                "expected_params": {"type": "whatsapp"}
            },
            {
                "command": "Take a note",
                "expected_action": "create_note"
            },
            {
                "command": "write something down",
                "expected_action": "create_note"
            },
            {
                "command": "play some music",
                "expected_action": "unknown"
            }
        ]
        
        for i, test_case in enumerate(test_commands):
            try:
                response = self.session.post(
                    f"{self.base_url}/voice/command",
                    json={"command": test_case["command"]},
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("action") == test_case["expected_action"]:
                        # Check parameters if specified
                        if "expected_params" in test_case:
                            params_match = True
                            for key, value in test_case["expected_params"].items():
                                if data.get("parameters", {}).get(key) != value:
                                    params_match = False
                                    break
                            
                            if params_match:
                                self.log_result(f"Voice command {i+1}: '{test_case['command']}'", True, 
                                              f"Action: {data['action']}, Params: {data.get('parameters', {})}")
                            else:
                                self.log_result(f"Voice command {i+1}", False, 
                                              f"Parameter mismatch. Expected: {test_case['expected_params']}, Got: {data.get('parameters', {})}")
                        else:
                            self.log_result(f"Voice command {i+1}: '{test_case['command']}'", True, 
                                          f"Action: {data['action']}")
                    else:
                        self.log_result(f"Voice command {i+1}", False, 
                                      f"Expected action: {test_case['expected_action']}, Got: {data.get('action')}", response)
                else:
                    self.log_result(f"Voice command {i+1}", False, f"Status: {response.status_code}", response)
            except Exception as e:
                self.log_result(f"Voice command {i+1}", False, f"Exception: {str(e)}")
    
    def test_voice_tts(self):
        """Test Text-to-Speech API"""
        print("\n=== TESTING TEXT-TO-SPEECH API ===")
        
        # Test TTS with default voice
        tts_request = {
            "text": "Hello, this is a test of the text to speech functionality.",
            "voice_id": "21m00Tcm4TlvDq8ikWAM"
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/voice/tts",
                json=tts_request,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "audio_base64" in data and "id" in data:
                    # Check if audio data is base64 encoded
                    import base64
                    try:
                        base64.b64decode(data["audio_base64"])
                        self.log_result("TTS API", True, f"Generated audio for: '{tts_request['text'][:30]}...'")
                    except Exception:
                        self.log_result("TTS API", False, "Invalid base64 audio data")
                else:
                    self.log_result("TTS API", False, "Missing required fields in response", response)
            else:
                self.log_result("TTS API", False, f"Status: {response.status_code}", response)
        except Exception as e:
            self.log_result("TTS API", False, f"Exception: {str(e)}")
    
    def test_voice_stt(self):
        """Test Speech-to-Text API (Note: This requires actual audio file)"""
        print("\n=== TESTING SPEECH-TO-TEXT API ===")
        
        # Note: STT requires actual audio file upload
        # For now, we'll test the endpoint availability and error handling
        try:
            # Test with no file
            response = self.session.post(f"{self.base_url}/voice/stt")
            if response.status_code == 422:  # Validation error expected
                self.log_result("STT API validation", True, "Correctly requires audio file")
            else:
                self.log_result("STT API validation", False, 
                              f"Expected 422 for missing file, got {response.status_code}", response)
        except Exception as e:
            self.log_result("STT API validation", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests"""
        print("🎤 VOICE ASSISTANT API TESTING STARTED")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Run all test suites
        self.test_health_endpoints()
        self.test_reminders_crud()
        self.test_notes_crud()
        self.test_voice_commands()
        self.test_voice_tts()
        self.test_voice_stt()
        
        # Print summary
        print("\n" + "=" * 60)
        print("🎤 VOICE ASSISTANT API TESTING COMPLETED")
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        
        if self.test_results['errors']:
            print("\n🚨 FAILED TESTS:")
            for error in self.test_results['errors']:
                print(f"   • {error}")
        
        return self.test_results

if __name__ == "__main__":
    tester = VoiceAssistantTester()
    results = tester.run_all_tests()