// Global contacts cache - persists during app session
let cachedContacts = null;
let cacheTimestamp = null;

export const getContactsCache = () => {
  return cachedContacts;
};

export const setContactsCache = (contacts) => {
  cachedContacts = contacts;
  cacheTimestamp = Date.now();
};

export const isCacheValid = () => {
  // Cache is valid for the entire session (no expiry)
  return cachedContacts !== null && cachedContacts.length > 0;
};

export const clearContactsCache = () => {
  cachedContacts = null;
  cacheTimestamp = null;
};
