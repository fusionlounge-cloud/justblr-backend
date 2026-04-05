// Global contacts cache - persists during app session AND across restarts via AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONTACTS_STORAGE_KEY = 'justblr_contacts_cache';

let cachedContacts = null;
let cacheTimestamp = null;
let loadedFromStorage = false;

export const getContactsCache = () => {
  return cachedContacts;
};

export const setContactsCache = async (contacts) => {
  cachedContacts = contacts;
  cacheTimestamp = Date.now();
  loadedFromStorage = true;
  // Persist to AsyncStorage for next app launch
  try {
    await AsyncStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify({
      contacts,
      timestamp: cacheTimestamp,
    }));
  } catch (e) {
    // Storage write failed, in-memory cache still works
  }
};

export const isCacheValid = () => {
  return cachedContacts !== null && cachedContacts.length > 0;
};

// Load from AsyncStorage on first access (call once on app start)
export const loadCacheFromStorage = async () => {
  if (loadedFromStorage) return cachedContacts !== null && cachedContacts.length > 0;
  loadedFromStorage = true;
  try {
    const stored = await AsyncStorage.getItem(CONTACTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.contacts && parsed.contacts.length > 0) {
        cachedContacts = parsed.contacts;
        cacheTimestamp = parsed.timestamp;
        return true;
      }
    }
  } catch (e) {
    // Storage read failed
  }
  return false;
};

export const clearContactsCache = async () => {
  cachedContacts = null;
  cacheTimestamp = null;
  try {
    await AsyncStorage.removeItem(CONTACTS_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
};
