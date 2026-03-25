import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'justblr_auth_token';
const AUTH_USER_KEY = 'justblr_auth_user';
const DEVICE_ID_STORAGE_KEY = 'justblr_unique_device_id';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  device_id: string;
}

// Save auth data after login/register
export const saveAuthData = async (token: string, user: AuthUser) => {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  // Update device ID to the account's device_id for cross-device sync
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, user.device_id);
};

// Load saved auth data
export const loadAuthData = async (): Promise<{ token: string; user: AuthUser } | null> => {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    const userStr = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (token && userStr) {
      return { token, user: JSON.parse(userStr) };
    }
  } catch (e) {
    console.error('Failed to load auth data:', e);
  }
  return null;
};

// Clear auth data on logout
export const clearAuthData = async () => {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  await AsyncStorage.removeItem(AUTH_USER_KEY);
};

// Get current device ID (before login, this is the auto-generated one)
export const getCurrentDeviceId = async (): Promise<string> => {
  const id = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  return id || '';
};
