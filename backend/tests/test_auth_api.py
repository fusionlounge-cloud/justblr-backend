"""
Test Auth API Endpoints
- POST /api/auth/register - creates user with email, password (4-digit PIN), optional name
- POST /api/auth/login - authenticates with email and password
- POST /api/auth/register with duplicate email returns 400
- POST /api/auth/login with wrong password returns 401
- GET /api/auth/me with valid token returns user info
- POST /api/auth/logout invalidates token
- POST /api/reminders/migrate - migrates reminders from one device_id to another
"""
import pytest
import requests
import uuid
import time

# Use localhost for testing as per review request
BASE_URL = "http://localhost:8001"

class TestAuthRegister:
    """Test user registration endpoint"""
    
    def test_register_success(self):
        """POST /api/auth/register - creates user with email, password, optional name"""
        unique_email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "password": "5678",  # 4-digit PIN
            "name": "Test User 2"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "user" in data, "Response should contain 'user' field"
        assert "token" in data, "Response should contain 'token' field"
        assert "message" in data, "Response should contain 'message' field"
        
        user = data["user"]
        assert user["email"] == unique_email.lower(), "Email should be lowercase"
        assert user["name"] == "Test User 2", "Name should match"
        assert "device_id" in user, "User should have device_id"
        assert "id" in user, "User should have id"
        assert "created_at" in user, "User should have created_at"
        
        # Token should be a non-empty string
        assert isinstance(data["token"], str), "Token should be a string"
        assert len(data["token"]) > 0, "Token should not be empty"
        
        print(f"✓ Register success: {unique_email}, device_id: {user['device_id']}")
        
        # Store for cleanup
        return data
    
    def test_register_without_name(self):
        """POST /api/auth/register - name is optional"""
        unique_email = f"TEST_noname_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "password": "1234"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        user = data["user"]
        assert user["email"] == unique_email.lower()
        assert user.get("name") is None or user.get("name") == "", "Name should be None or empty"
        
        print(f"✓ Register without name success: {unique_email}")
    
    def test_register_duplicate_email_returns_400(self):
        """POST /api/auth/register with duplicate email returns 400"""
        unique_email = f"TEST_dup_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "password": "5678",
            "name": "First User"
        }
        
        # First registration should succeed
        response1 = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response1.status_code == 200, f"First registration failed: {response1.text}"
        
        # Second registration with same email should fail with 400
        payload2 = {
            "email": unique_email,  # Same email
            "password": "9999",
            "name": "Second User"
        }
        response2 = requests.post(f"{BASE_URL}/api/auth/register", json=payload2)
        
        assert response2.status_code == 400, f"Expected 400 for duplicate email, got {response2.status_code}: {response2.text}"
        
        data = response2.json()
        assert "detail" in data, "Error response should have 'detail' field"
        assert "already registered" in data["detail"].lower() or "already exists" in data["detail"].lower(), \
            f"Error message should mention duplicate: {data['detail']}"
        
        print(f"✓ Duplicate email correctly returns 400")


class TestAuthLogin:
    """Test user login endpoint"""
    
    @pytest.fixture
    def registered_user(self):
        """Create a user for login tests"""
        unique_email = f"TEST_login_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "password": "5678",
            "name": "Login Test User"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200, f"Setup failed: {response.text}"
        return {"email": unique_email, "password": "5678", "data": response.json()}
    
    def test_login_success(self, registered_user):
        """POST /api/auth/login - authenticates with email and password"""
        payload = {
            "email": registered_user["email"],
            "password": registered_user["password"]
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user' field"
        assert "token" in data, "Response should contain 'token' field"
        assert "message" in data, "Response should contain 'message' field"
        
        user = data["user"]
        assert user["email"] == registered_user["email"].lower()
        assert "device_id" in user
        assert "id" in user
        
        # Token should be valid
        assert isinstance(data["token"], str)
        assert len(data["token"]) > 0
        
        print(f"✓ Login success: {registered_user['email']}")
    
    def test_login_wrong_password_returns_401(self, registered_user):
        """POST /api/auth/login with wrong password returns 401"""
        payload = {
            "email": registered_user["email"],
            "password": "0000"  # Wrong password
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 401, f"Expected 401 for wrong password, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Error response should have 'detail' field"
        
        print(f"✓ Wrong password correctly returns 401")
    
    def test_login_nonexistent_email_returns_401(self):
        """POST /api/auth/login with non-existent email returns 401"""
        payload = {
            "email": f"nonexistent_{uuid.uuid4().hex[:8]}@example.com",
            "password": "5678"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 401, f"Expected 401 for non-existent email, got {response.status_code}: {response.text}"
        
        print(f"✓ Non-existent email correctly returns 401")


class TestAuthMe:
    """Test GET /api/auth/me endpoint"""
    
    @pytest.fixture
    def authenticated_user(self):
        """Create and login a user"""
        unique_email = f"TEST_me_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "password": "5678",
            "name": "Me Test User"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200, f"Setup failed: {response.text}"
        data = response.json()
        return {"email": unique_email, "token": data["token"], "user": data["user"]}
    
    def test_get_me_with_valid_token(self, authenticated_user):
        """GET /api/auth/me with valid token returns user info"""
        headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["email"] == authenticated_user["email"].lower()
        assert data["id"] == authenticated_user["user"]["id"]
        assert data["device_id"] == authenticated_user["user"]["device_id"]
        
        print(f"✓ GET /api/auth/me returns correct user info")
    
    def test_get_me_without_token_returns_401(self):
        """GET /api/auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}: {response.text}"
        
        print(f"✓ GET /api/auth/me without token returns 401")
    
    def test_get_me_with_invalid_token_returns_401(self):
        """GET /api/auth/me with invalid token returns 401"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 401, f"Expected 401 with invalid token, got {response.status_code}: {response.text}"
        
        print(f"✓ GET /api/auth/me with invalid token returns 401")


class TestAuthLogout:
    """Test POST /api/auth/logout endpoint"""
    
    @pytest.fixture
    def authenticated_user(self):
        """Create and login a user"""
        unique_email = f"TEST_logout_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "password": "5678",
            "name": "Logout Test User"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200, f"Setup failed: {response.text}"
        data = response.json()
        return {"email": unique_email, "token": data["token"], "user": data["user"]}
    
    def test_logout_invalidates_token(self, authenticated_user):
        """POST /api/auth/logout invalidates token"""
        headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
        
        # First verify token works
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_response.status_code == 200, "Token should work before logout"
        
        # Logout
        logout_response = requests.post(f"{BASE_URL}/api/auth/logout", headers=headers)
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.text}"
        
        data = logout_response.json()
        assert "message" in data, "Logout response should have message"
        
        # Verify token no longer works
        me_response2 = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_response2.status_code == 401, f"Token should be invalid after logout, got {me_response2.status_code}"
        
        print(f"✓ Logout successfully invalidates token")
    
    def test_logout_without_token_returns_401(self):
        """POST /api/auth/logout without token returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/logout")
        
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}: {response.text}"
        
        print(f"✓ Logout without token returns 401")


class TestRemindersMigrate:
    """Test POST /api/reminders/migrate endpoint"""
    
    def test_migrate_reminders_success(self):
        """POST /api/reminders/migrate - migrates reminders from old device_id to new device_id"""
        # Create a reminder with a specific device_id
        old_device_id = f"TEST_old_device_{uuid.uuid4().hex[:8]}"
        new_device_id = f"TEST_new_device_{uuid.uuid4().hex[:8]}"
        
        # Create a reminder with old device_id
        reminder_payload = {
            "title": "TEST Migration Reminder",
            "reminder_type": "call",
            "scheduled_time": "2026-04-01T10:00:00Z",
            "device_id": old_device_id,
            "auto_execute": False
        }
        create_response = requests.post(f"{BASE_URL}/api/reminders", json=reminder_payload)
        assert create_response.status_code == 200, f"Failed to create reminder: {create_response.text}"
        reminder_id = create_response.json()["id"]
        
        # Verify reminder exists with old device_id
        get_response = requests.get(f"{BASE_URL}/api/reminders?device_id={old_device_id}")
        assert get_response.status_code == 200
        reminders = get_response.json()
        assert any(r["id"] == reminder_id for r in reminders), "Reminder should exist with old device_id"
        
        # Migrate reminders
        migrate_payload = {
            "from_device_ids": [old_device_id],
            "to_device_id": new_device_id
        }
        migrate_response = requests.post(f"{BASE_URL}/api/reminders/migrate", json=migrate_payload)
        
        assert migrate_response.status_code == 200, f"Migration failed: {migrate_response.text}"
        
        data = migrate_response.json()
        assert "message" in data, "Response should have message"
        assert "migrated" in data["message"].lower() or str(data.get("modified_count", 0)) in data["message"], \
            f"Message should mention migration: {data['message']}"
        
        # Verify reminder now has new device_id
        get_new_response = requests.get(f"{BASE_URL}/api/reminders?device_id={new_device_id}")
        assert get_new_response.status_code == 200
        new_reminders = get_new_response.json()
        assert any(r["id"] == reminder_id for r in new_reminders), "Reminder should exist with new device_id"
        
        # Verify reminder no longer has old device_id
        get_old_response = requests.get(f"{BASE_URL}/api/reminders?device_id={old_device_id}")
        old_reminders = get_old_response.json()
        assert not any(r["id"] == reminder_id for r in old_reminders), "Reminder should not exist with old device_id"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reminders/{reminder_id}")
        
        print(f"✓ Migration successful: {old_device_id} -> {new_device_id}")
    
    def test_migrate_multiple_device_ids(self):
        """POST /api/reminders/migrate - can migrate from multiple device_ids"""
        old_device_id_1 = f"TEST_multi_1_{uuid.uuid4().hex[:8]}"
        old_device_id_2 = f"TEST_multi_2_{uuid.uuid4().hex[:8]}"
        new_device_id = f"TEST_multi_new_{uuid.uuid4().hex[:8]}"
        
        # Create reminders with different old device_ids
        reminder1 = requests.post(f"{BASE_URL}/api/reminders", json={
            "title": "TEST Multi Reminder 1",
            "reminder_type": "sms",
            "scheduled_time": "2026-04-01T10:00:00Z",
            "device_id": old_device_id_1
        }).json()
        
        reminder2 = requests.post(f"{BASE_URL}/api/reminders", json={
            "title": "TEST Multi Reminder 2",
            "reminder_type": "call",
            "scheduled_time": "2026-04-01T11:00:00Z",
            "device_id": old_device_id_2
        }).json()
        
        # Migrate from both old device_ids
        migrate_payload = {
            "from_device_ids": [old_device_id_1, old_device_id_2],
            "to_device_id": new_device_id
        }
        migrate_response = requests.post(f"{BASE_URL}/api/reminders/migrate", json=migrate_payload)
        
        assert migrate_response.status_code == 200, f"Migration failed: {migrate_response.text}"
        
        # Verify both reminders now have new device_id
        get_response = requests.get(f"{BASE_URL}/api/reminders?device_id={new_device_id}")
        new_reminders = get_response.json()
        reminder_ids = [r["id"] for r in new_reminders]
        
        assert reminder1["id"] in reminder_ids, "Reminder 1 should be migrated"
        assert reminder2["id"] in reminder_ids, "Reminder 2 should be migrated"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reminders/{reminder1['id']}")
        requests.delete(f"{BASE_URL}/api/reminders/{reminder2['id']}")
        
        print(f"✓ Multi-device migration successful")


class TestAuthWithProvidedCredentials:
    """Test with the provided test credentials"""
    
    def test_register_with_provided_credentials(self):
        """Test registration with provided test credentials"""
        # First check if user already exists by trying to login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testuser2@example.com",
            "password": "5678"
        })
        
        if login_response.status_code == 200:
            print("✓ User testuser2@example.com already exists, login successful")
            return login_response.json()
        
        # If not exists, register
        payload = {
            "email": "testuser2@example.com",
            "password": "5678",
            "name": "Test User 2"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Could be 200 (new) or 400 (already exists)
        if response.status_code == 200:
            data = response.json()
            assert data["user"]["email"] == "testuser2@example.com"
            print(f"✓ Registered testuser2@example.com successfully")
            return data
        elif response.status_code == 400:
            print(f"✓ User testuser2@example.com already exists (400)")
            # Try login instead
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "testuser2@example.com",
                "password": "5678"
            })
            assert login_response.status_code == 200, f"Login failed: {login_response.text}"
            return login_response.json()
        else:
            pytest.fail(f"Unexpected status: {response.status_code}: {response.text}")


# Cleanup fixture to remove TEST_ prefixed users after tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Note: MongoDB cleanup would require direct DB access
    # For now, test data with TEST_ prefix remains but doesn't affect production
    print("\n✓ Test session completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
