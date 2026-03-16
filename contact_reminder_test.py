#!/usr/bin/env python3
"""
Focused Backend API Testing for Voice Assistant App - Contact Integration
Specifically testing the review request requirements:
1. Health check endpoint
2. Create reminder with contact fields  
3. Get all reminders with contact information
4. Delete reminder
"""

import requests
import json
from datetime import datetime, timezone
import sys

# Backend URL from environment
BACKEND_URL = "https://matrix-task-sync.preview.emergentagent.com/api"

def test_specific_requirements():
    """Test the specific requirements from the review request"""
    
    print("=" * 60)
    print("🎯 VOICE ASSISTANT API - CONTACT INTEGRATION TEST")
    print("=" * 60)
    
    session = requests.Session()
    results = {"passed": 0, "failed": 0, "errors": []}
    created_reminder_id = None
    
    def log_test(name, success, message="", response=None):
        if success:
            results["passed"] += 1
            print(f"✅ {name}: PASSED")
            if message:
                print(f"   {message}")
        else:
            results["failed"] += 1
            print(f"❌ {name}: FAILED")
            print(f"   {message}")
            if response:
                print(f"   Response: {response.status_code} - {response.text[:200]}")
            results["errors"].append(f"{name}: {message}")
    
    # 1. Test Health Check Endpoint
    print("\n🔍 1. Testing Health Check Endpoint (GET /api/health)")
    try:
        response = session.get(f"{BACKEND_URL}/health")
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy" and data.get("database") == "connected":
                log_test("Health Check", True, f"Service healthy, database connected")
            else:
                log_test("Health Check", False, f"Unexpected health status: {data}")
        else:
            log_test("Health Check", False, f"Status code: {response.status_code}", response)
    except Exception as e:
        log_test("Health Check", False, f"Exception: {str(e)}")
    
    # 2. Test Create Reminder with Contact Information  
    print("\n🔍 2. Testing Create Reminder with Contact (POST /api/reminders)")
    
    # Exact test data from review request
    test_reminder = {
        "title": "Call John",
        "contact_name": "John Doe",
        "contact_phone": "+1234567890",
        "reminder_type": "call", 
        "scheduled_time": "2025-06-15T10:00:00Z",
        "notes": "Discuss project updates"
    }
    
    try:
        response = session.post(
            f"{BACKEND_URL}/reminders",
            json=test_reminder,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            created_reminder_id = data.get("id")
            
            # Verify all required fields are present
            required_fields = ["id", "title", "contact_name", "contact_phone", "reminder_type", "scheduled_time", "created_at", "is_completed"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                log_test("Create Reminder - Field Validation", False, f"Missing fields: {missing_fields}")
            else:
                # Verify contact information was stored correctly
                contact_name_match = data.get("contact_name") == test_reminder["contact_name"]
                contact_phone_match = data.get("contact_phone") == test_reminder["contact_phone"]
                title_match = data.get("title") == test_reminder["title"]
                type_match = data.get("reminder_type") == test_reminder["reminder_type"]
                
                if all([contact_name_match, contact_phone_match, title_match, type_match]):
                    log_test("Create Reminder with Contact", True, 
                           f"ID: {data['id']}, Contact: {data['contact_name']} ({data['contact_phone']})")
                else:
                    log_test("Create Reminder - Data Validation", False, 
                           f"Data mismatch - Name: {contact_name_match}, Phone: {contact_phone_match}, Title: {title_match}, Type: {type_match}")
        else:
            log_test("Create Reminder with Contact", False, f"Status code: {response.status_code}", response)
    except Exception as e:
        log_test("Create Reminder with Contact", False, f"Exception: {str(e)}")
    
    # 3. Test Get All Reminders
    print("\n🔍 3. Testing Get All Reminders (GET /api/reminders)")
    try:
        response = session.get(f"{BACKEND_URL}/reminders")
        
        if response.status_code == 200:
            data = response.json()
            
            if isinstance(data, list):
                # Find our created reminder
                created_reminder = None
                for reminder in data:
                    if reminder.get("id") == created_reminder_id:
                        created_reminder = reminder
                        break
                
                if created_reminder:
                    # Verify contact fields are properly retrieved
                    if (created_reminder.get("contact_name") == "John Doe" and 
                        created_reminder.get("contact_phone") == "+1234567890"):
                        log_test("Get Reminders - Contact Fields", True, 
                               f"Contact information correctly retrieved: {created_reminder['contact_name']} ({created_reminder['contact_phone']})")
                    else:
                        log_test("Get Reminders - Contact Fields", False, 
                               f"Contact information mismatch in retrieval: {created_reminder.get('contact_name')} ({created_reminder.get('contact_phone')})")
                    
                    log_test("Get All Reminders", True, f"Retrieved {len(data)} reminders, found created reminder")
                else:
                    log_test("Get All Reminders", False, "Created reminder not found in results")
            else:
                log_test("Get All Reminders", False, f"Expected list, got: {type(data)}", response)
        else:
            log_test("Get All Reminders", False, f"Status code: {response.status_code}", response)
    except Exception as e:
        log_test("Get All Reminders", False, f"Exception: {str(e)}")
    
    # 4. Test Delete Reminder
    print("\n🔍 4. Testing Delete Reminder (DELETE /api/reminders/{reminder_id})")
    if created_reminder_id:
        try:
            response = session.delete(f"{BACKEND_URL}/reminders/{created_reminder_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    # Verify reminder was actually deleted
                    get_response = session.get(f"{BACKEND_URL}/reminders")
                    if get_response.status_code == 200:
                        reminders = get_response.json()
                        deleted_reminder = next((r for r in reminders if r["id"] == created_reminder_id), None)
                        
                        if deleted_reminder is None:
                            log_test("Delete Reminder", True, f"Reminder successfully deleted: {data['message']}")
                        else:
                            log_test("Delete Reminder", False, "Reminder still exists after deletion")
                    else:
                        log_test("Delete Reminder - Verification", False, "Could not verify deletion")
                else:
                    log_test("Delete Reminder", False, "Invalid response format", response)
            else:
                log_test("Delete Reminder", False, f"Status code: {response.status_code}", response)
        except Exception as e:
            log_test("Delete Reminder", False, f"Exception: {str(e)}")
    else:
        log_test("Delete Reminder", False, "No reminder ID to delete")
    
    # 5. Additional Verification: Test CRUD operations work correctly
    print("\n🔍 5. Additional Verification: Multiple Contact Types")
    
    additional_reminders = [
        {
            "title": "SMS to Sarah",
            "contact_name": "Sarah Wilson", 
            "contact_phone": "+1555123456",
            "reminder_type": "sms",
            "scheduled_time": "2025-06-16T09:00:00Z"
        },
        {
            "title": "WhatsApp to Team",
            "contact_name": "Project Team",
            "contact_phone": "+1555987654", 
            "reminder_type": "whatsapp",
            "scheduled_time": "2025-06-17T14:00:00Z"
        }
    ]
    
    additional_ids = []
    for i, reminder_data in enumerate(additional_reminders):
        try:
            response = session.post(
                f"{BACKEND_URL}/reminders",
                json=reminder_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                additional_ids.append(data["id"])
                log_test(f"Create {reminder_data['reminder_type'].upper()} Reminder", True, 
                       f"Contact: {data.get('contact_name')} ({data.get('contact_phone')})")
            else:
                log_test(f"Create {reminder_data['reminder_type'].upper()} Reminder", False, 
                       f"Status: {response.status_code}", response)
        except Exception as e:
            log_test(f"Create {reminder_data['reminder_type'].upper()} Reminder", False, f"Exception: {str(e)}")
    
    # Clean up additional reminders
    for reminder_id in additional_ids:
        try:
            session.delete(f"{BACKEND_URL}/reminders/{reminder_id}")
        except:
            pass  # Cleanup, don't fail test if this doesn't work
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"🎯 CONTACT INTEGRATION TEST COMPLETED")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    
    if results['errors']:
        print(f"\n🚨 FAILED TESTS:")
        for error in results['errors']:
            print(f"   • {error}")
    else:
        print(f"\n🎉 ALL TESTS PASSED!")
        print(f"✓ Health check endpoint working")
        print(f"✓ Reminder creation with contact fields working")
        print(f"✓ Contact information properly stored and retrieved")
        print(f"✓ Reminder deletion working")
        print(f"✓ All CRUD operations working correctly")
    
    return results['failed'] == 0

if __name__ == "__main__":
    success = test_specific_requirements()
    sys.exit(0 if success else 1)