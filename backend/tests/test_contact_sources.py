"""
Test suite for contact sources and delegation tab contact picker fix
Tests the new /api/sync/contact-sources endpoint and /api/sync/contacts/{device_id} endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://reminder-hub-182.preview.emergentagent.com')

class TestContactSources:
    """Tests for GET /api/sync/contact-sources endpoint"""
    
    def test_contact_sources_returns_list(self):
        """GET /api/sync/contact-sources should return list of device_ids with counts"""
        response = requests.get(f"{BASE_URL}/api/sync/contact-sources")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Should have at least one source (android_42912ae0fb5aeb68 with 41805 contacts)
        assert len(data) > 0, "Should have at least one contact source"
        
        # Each item should have device_id and count
        for source in data:
            assert "device_id" in source, "Each source should have device_id"
            assert "count" in source, "Each source should have count"
            assert isinstance(source["count"], int), "Count should be an integer"
    
    def test_contact_sources_sorted_by_count(self):
        """Contact sources should be sorted by count descending"""
        response = requests.get(f"{BASE_URL}/api/sync/contact-sources")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 1:
            # Verify sorted by count descending
            for i in range(len(data) - 1):
                assert data[i]["count"] >= data[i+1]["count"], "Sources should be sorted by count descending"
    
    def test_contact_sources_has_android_device(self):
        """Should have the android_42912ae0fb5aeb68 device with 41805 contacts"""
        response = requests.get(f"{BASE_URL}/api/sync/contact-sources")
        assert response.status_code == 200
        
        data = response.json()
        android_source = next((s for s in data if s["device_id"] == "android_42912ae0fb5aeb68"), None)
        
        assert android_source is not None, "Should have android_42912ae0fb5aeb68 device"
        assert android_source["count"] == 41805, f"Expected 41805 contacts, got {android_source['count']}"


class TestContactsByDeviceId:
    """Tests for GET /api/sync/contacts/{device_id} endpoint"""
    
    def test_get_contacts_for_device(self):
        """GET /api/sync/contacts/{device_id} should return contacts for that device"""
        device_id = "android_42912ae0fb5aeb68"
        response = requests.get(f"{BASE_URL}/api/sync/contacts/{device_id}?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "contacts" in data, "Response should have contacts field"
        assert "count" in data, "Response should have count field"
        assert "total" in data, "Response should have total field"
        
        # Verify contacts structure
        contacts = data["contacts"]
        assert isinstance(contacts, list), "Contacts should be a list"
        assert len(contacts) <= 10, "Should respect limit parameter"
        
        # Each contact should have name and phone
        for contact in contacts:
            assert "name" in contact, "Contact should have name"
            assert "phone" in contact, "Contact should have phone"
            assert "device_id" in contact, "Contact should have device_id"
            assert contact["device_id"] == device_id, "Contact device_id should match"
    
    def test_get_contacts_total_count(self):
        """Total count should be 41805 for android device"""
        device_id = "android_42912ae0fb5aeb68"
        response = requests.get(f"{BASE_URL}/api/sync/contacts/{device_id}?limit=1")
        assert response.status_code == 200
        
        data = response.json()
        assert data["total"] == 41805, f"Expected total 41805, got {data['total']}"
    
    def test_get_contacts_search(self):
        """Search parameter should filter contacts by name or phone"""
        device_id = "android_42912ae0fb5aeb68"
        # Search for a name that exists in the contacts
        response = requests.get(f"{BASE_URL}/api/sync/contacts/{device_id}?search=Noor&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        contacts = data["contacts"]
        
        # All returned contacts should match the search term
        for contact in contacts:
            name_match = "noor" in (contact.get("name") or "").lower()
            phone_match = "noor" in (contact.get("phone") or "").lower()
            assert name_match or phone_match, f"Contact {contact} should match search term 'Noor'"
    
    def test_get_contacts_nonexistent_device(self):
        """Should return empty list for non-existent device_id"""
        device_id = "nonexistent_device_12345"
        response = requests.get(f"{BASE_URL}/api/sync/contacts/{device_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["contacts"] == [], "Should return empty contacts list"
        assert data["total"] == 0, "Total should be 0"


class TestDashboardEndpoint:
    """Tests for GET /api/dashboard endpoint"""
    
    def test_dashboard_serves_html(self):
        """GET /api/dashboard should serve HTML content"""
        response = requests.get(f"{BASE_URL}/api/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected HTML content type, got {content_type}"
    
    def test_dashboard_contains_contact_sources_code(self):
        """Dashboard HTML should contain contact-sources auto-discovery code"""
        response = requests.get(f"{BASE_URL}/api/dashboard")
        assert response.status_code == 200
        
        html = response.text
        # Check for the auto-discovery code
        assert "/sync/contact-sources" in html, "Dashboard should reference contact-sources endpoint"
        assert "loadContacts" in html, "Dashboard should have loadContacts function"
        assert "justblr_contact_device_id" in html, "Dashboard should store contact device_id in localStorage"
    
    def test_dashboard_contains_delegation_tab(self):
        """Dashboard should have delegation tab with contact picker"""
        response = requests.get(f"{BASE_URL}/api/dashboard")
        assert response.status_code == 200
        
        html = response.text
        assert "delegation" in html.lower(), "Dashboard should have delegation tab"
        assert "renderDelegationTab" in html, "Dashboard should have renderDelegationTab function"
        assert "Contacts loaded" in html, "Dashboard should show contacts loaded banner"


class TestAuthAndLogin:
    """Tests for dashboard login flow with test credentials"""
    
    def test_login_with_test_credentials(self):
        """Login with dashtest@example.com and PIN 1234"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "dashtest@example.com", "password": "1234"}
        )
        
        # If user doesn't exist, create it
        if response.status_code == 401:
            # Register the user first
            reg_response = requests.post(
                f"{BASE_URL}/api/auth/register",
                json={"email": "dashtest@example.com", "password": "1234", "name": "Dashboard Tester"}
            )
            assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
            
            # Now login
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": "dashtest@example.com", "password": "1234"}
            )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should have user"
        assert "token" in data, "Response should have token"
        assert data["user"]["email"] == "dashtest@example.com", "Email should match"
        
        return data
    
    def test_get_employees_for_device(self):
        """Get employees for the logged-in user's device_id"""
        # First login to get device_id
        login_data = self.test_login_with_test_credentials()
        device_id = login_data["user"]["device_id"]
        
        response = requests.get(f"{BASE_URL}/api/employees?device_id={device_id}")
        assert response.status_code == 200
        
        # New user will have 0 employees - this is expected
        data = response.json()
        assert isinstance(data, list), "Should return list of employees"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
