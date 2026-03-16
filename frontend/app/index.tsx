import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Contacts from 'expo-contacts';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://justblr-dashboard.preview.emergentagent.com';
const JUSTBLR_LOGO = 'https://customer-assets.emergentagent.com/job_4fe0c0dc-be90-49c7-81d6-fef8f0af4f3b/artifacts/fzo9eg6q_Screenshot%202026-02-25%20at%201.15.23%E2%80%AFAM.png';

// Get or create device ID
const getDeviceId = async (): Promise<string> => {
  try {
    let deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) {
      // Generate unique device ID
      const installId = Constants.default?.installationId || '';
      deviceId = installId || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  } catch (e) {
    return `device_${Date.now()}`;
  }
};

// Quick Actions - all 6
const QUICK_ACTIONS = [
  { type: 'meet', name: 'Meet', icon: 'people', color: '#FF6B6B' },
  { type: 'call', name: 'Call', icon: 'call', color: '#4ECDC4' },
  { type: 'sms', name: 'SMS', icon: 'chatbubble', color: '#95E1D3' },
  { type: 'whatsapp', name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  { type: 'deskwork', name: 'Deskwork', icon: 'laptop', color: '#A78BFA' },
  { type: 'keepnotes', name: 'Notes', icon: 'create', color: '#FBBF24' },
];

// Reminder categories - 5 (no Notes)
const REMINDER_CATEGORIES = [
  { type: 'meet', name: 'Meet', icon: 'people', color: '#FF6B6B' },
  { type: 'call', name: 'Call', icon: 'call', color: '#4ECDC4' },
  { type: 'sms', name: 'SMS', icon: 'chatbubble', color: '#95E1D3' },
  { type: 'whatsapp', name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  { type: 'deskwork', name: 'Deskwork', icon: 'laptop', color: '#A78BFA' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  
  // Voice command states
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  
  // Link to Web states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [syncCode, setSyncCode] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  // Handle notification response - open WhatsApp/SMS when user taps notification
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      const actionType = data?.type;
      const phone = data?.phone;
      const notes = data?.notes || '';
      
      if (!phone) return;
      
      // Clean phone number
      let cleanPhone = phone.replace(/[^0-9+]/g, '');
      if (!cleanPhone.startsWith('+')) {
        cleanPhone = '+91' + cleanPhone;
      }
      
      try {
        if (actionType === 'whatsapp') {
          // Open WhatsApp with pre-filled message
          const message = encodeURIComponent(notes || 'Hello!');
          const phoneForWA = cleanPhone.replace('+', '');
          const waUrl = `whatsapp://send?phone=${phoneForWA}&text=${message}`;
          
          const canOpen = await Linking.canOpenURL(waUrl);
          if (canOpen) {
            await Linking.openURL(waUrl);
          } else {
            // Fallback to web WhatsApp
            await Linking.openURL(`https://wa.me/${phoneForWA}?text=${message}`);
          }
        } else if (actionType === 'sms') {
          // Open SMS app with pre-filled message
          const message = encodeURIComponent(notes || '');
          const smsUrl = Platform.OS === 'ios' 
            ? `sms:${cleanPhone}&body=${message}`
            : `sms:${cleanPhone}?body=${message}`;
          await Linking.openURL(smsUrl);
        } else if (actionType === 'call') {
          // Open phone dialer
          await Linking.openURL(`tel:${cleanPhone}`);
        }
      } catch (error) {
        console.log('Error opening app:', error);
        Alert.alert('Error', 'Could not open the app');
      }
    });
    
    return () => subscription.remove();
  }, []);

  // Refresh reminders when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchReminders();
    }, [])
  );

  // Auto-refresh when app comes from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchReminders();
      }
    });
    return () => subscription.remove();
  }, []);

  const fetchReminders = async (retryCount = 0) => {
    const MAX_RETRIES = 5;
    console.log('=== FETCH REMINDERS STARTED === Attempt:', retryCount + 1);
    
    try {
      setIsLoading(true);
      const deviceId = await getDeviceId();
      const url = `${BACKEND_URL}/api/reminders?device_id=${deviceId}`;
      
      console.log('Fetching from:', url);
      
      // Make the request
      const response = await axios.get(url, { 
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response data length:', response.data?.length);
      
      // Validate and set data
      if (response.data && Array.isArray(response.data)) {
        console.log('Setting', response.data.length, 'reminders');
        setReminders(response.data);
      } else {
        console.error('Invalid response format:', response.data);
        setReminders([]);
      }
    } catch (error: any) {
      console.error('Fetch error:', error?.message);
      
      // Retry on 404 or network errors with longer delays
      if (retryCount < MAX_RETRIES && (error?.response?.status === 404 || !error?.response)) {
        const delay = (retryCount + 1) * 3000; // 3s, 6s, 9s, 12s, 15s
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchReminders(retryCount + 1);
      }
      
      const errorMsg = error?.response?.data?.detail || error?.message || 'Network error';
      Alert.alert(
        'Connection Error', 
        `Could not load reminders.\n\nError: ${errorMsg}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => fetchReminders(0) }
        ]
      );
      setReminders([]);
    } finally {
      setIsLoading(false);
      console.log('=== FETCH REMINDERS ENDED ===');
    }
  };

  // Fetch reminders on component mount
  useEffect(() => {
    fetchReminders();
  }, []);

  // Voice Command Functions
  const startVoiceCommand = async () => {
    setShowVoiceModal(true);
    setVoiceStatus('Listening... Say a task like "Call", "SMS", "WhatsApp", "Meet", "Deskwork", or "Notes"');
    
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setVoiceRecording(recording);
      setIsVoiceListening(true);
    } catch (error) {
      console.error('Failed to start voice recording:', error);
      setVoiceStatus('Failed to start voice recording');
      setIsVoiceListening(false);
    }
  };

  const stopVoiceCommand = async () => {
    if (!voiceRecording) {
      setIsVoiceListening(false);
      return;
    }

    try {
      setIsVoiceListening(false);
      setVoiceProcessing(true);
      setVoiceStatus('Processing your voice command...');
      
      await voiceRecording.stopAndUnloadAsync();
      const uri = voiceRecording.getURI();

      if (uri) {
        const formData = new FormData();
        formData.append('audio_file', {
          uri: uri,
          type: 'audio/m4a',
          name: 'voice.m4a',
        } as any);

        const response = await axios.post(`${BACKEND_URL}/api/voice/stt`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        });

        const transcribedText = response.data.transcribed_text.toLowerCase();
        setVoiceStatus(`Heard: "${transcribedText}"`);
        
        // Parse the command and navigate to the appropriate task
        let matchedAction = null;
        
        if (transcribedText.includes('call') || transcribedText.includes('phone')) {
          matchedAction = { type: 'call', name: 'Call' };
        } else if (transcribedText.includes('sms') || transcribedText.includes('message') || transcribedText.includes('text')) {
          matchedAction = { type: 'sms', name: 'SMS' };
        } else if (transcribedText.includes('whatsapp') || transcribedText.includes('whats app') || transcribedText.includes('wa')) {
          matchedAction = { type: 'whatsapp', name: 'WhatsApp' };
        } else if (transcribedText.includes('meet') || transcribedText.includes('meeting')) {
          matchedAction = { type: 'meet', name: 'Meet' };
        } else if (transcribedText.includes('desk') || transcribedText.includes('work') || transcribedText.includes('task')) {
          matchedAction = { type: 'deskwork', name: 'Deskwork' };
        } else if (transcribedText.includes('note') || transcribedText.includes('keep')) {
          matchedAction = { type: 'keepnotes', name: 'Notes' };
        }

        if (matchedAction) {
          setVoiceStatus(`Opening ${matchedAction.name}...`);
          setTimeout(() => {
            setShowVoiceModal(false);
            setVoiceProcessing(false);
            handleActionPress(matchedAction.type, matchedAction.name);
          }, 1000);
        } else {
          setVoiceStatus(`Didn't understand. Try saying "Call", "SMS", "WhatsApp", "Meet", "Deskwork", or "Notes"`);
          setVoiceProcessing(false);
        }
      }

      setVoiceRecording(null);
    } catch (error) {
      console.error('Failed to process voice:', error);
      setVoiceStatus('Failed to process voice command. Try again.');
      setVoiceProcessing(false);
    }
  };

  const closeVoiceModal = () => {
    if (voiceRecording) {
      voiceRecording.stopAndUnloadAsync();
    }
    setShowVoiceModal(false);
    setIsVoiceListening(false);
    setVoiceProcessing(false);
    setVoiceRecording(null);
    setVoiceStatus('');
  };

  // Link to Web function
  const generateSyncCode = async () => {
    setSyncLoading(true);
    try {
      const deviceId = await getDeviceId();
      const response = await axios.post(`${BACKEND_URL}/api/sync/generate-code`, {
        device_id: deviceId
      });
      setSyncCode(response.data.sync_code);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate sync code');
    } finally {
      setSyncLoading(false);
    }
  };

  const openLinkModal = async () => {
    setShowLinkModal(true);
    await generateSyncCode();
  };

  // Sync contacts to cloud for web dashboard
  const syncContactsToCloud = async () => {
    setSyncLoading(true);
    try {
      const deviceId = await getDeviceId();
      
      // Get contacts from phone
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant contacts permission');
        setSyncLoading(false);
        return;
      }
      
      // Get total count first
      const { data: allContacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        pageSize: 50000, // Request all contacts at once
        pageOffset: 0,
      });
      
      // Format ALL contacts for sync (no limit)
      const contactsToSync = allContacts
        .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0)
        .map(c => ({
          name: c.name || 'Unknown',
          phone: c.phoneNumbers[0]?.number || '',
          email: c.emails?.[0]?.email || null
        }));
      
      // Upload in batches of 2000 for large contact lists
      const batchSize = 2000;
      let syncedCount = 0;
      
      for (let i = 0; i < contactsToSync.length; i += batchSize) {
        const batch = contactsToSync.slice(i, i + batchSize);
        const isFirstBatch = i === 0;
        
        await axios.post(`${BACKEND_URL}/api/sync/contacts`, {
          device_id: deviceId,
          contacts: batch,
          append: !isFirstBatch // First batch replaces, rest append
        });
        syncedCount += batch.length;
        
        // Show progress for large syncs
        if (contactsToSync.length > 5000) {
          console.log(`Synced ${syncedCount} of ${contactsToSync.length} contacts`);
        }
      }
      
      Alert.alert('Success', `${syncedCount} contacts synced to cloud!`);
    } catch (error) {
      console.log('Sync error:', error);
      Alert.alert('Error', 'Failed to sync contacts: ' + String(error));
    } finally {
      setSyncLoading(false);
    }
  };

  const openGoogleKeep = async () => {
    const keepUrls = {
      ios: 'comgooglekeep://',
      android: 'com.google.android.keep',
      web: 'https://keep.google.com',
    };
    try {
      if (Platform.OS === 'web') {
        await Linking.openURL(keepUrls.web);
      } else {
        const urlToTry = Platform.OS === 'ios' ? keepUrls.ios : `intent://#Intent;package=${keepUrls.android};end`;
        const canOpen = await Linking.canOpenURL(urlToTry);
        if (canOpen) {
          await Linking.openURL(urlToTry);
        } else {
          await Linking.openURL(keepUrls.web);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open Google Keep');
    }
  };

  const handleActionPress = (type, name) => {
    if (type === 'keepnotes') {
      openGoogleKeep();
    } else {
      router.push(`/action?type=${type}&name=${name}`);
    }
  };

  const getCategoryCount = (type) => {
    return reminders.filter(r => r.reminder_type === type).length;
  };

  const getCategoryReminders = (type) => {
    return reminders.filter(r => r.reminder_type === type);
  };

  const deleteReminder = async (id) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/reminders/${id}`);
      fetchReminders();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete');
    }
  };

  const bulkDelete = async () => {
    if (selectedItems.length === 0) return;
    
    Alert.alert(
      'Delete Selected',
      `Delete ${selectedItems.length} reminder(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(selectedItems.map(id => 
                axios.delete(`${BACKEND_URL}/api/reminders/${id}`)
              ));
              setSelectedItems([]);
              setBulkSelectMode(false);
              fetchReminders();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete some items');
            }
          }
        }
      ]
    );
  };

  const toggleItemSelection = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const selectAllInCategory = () => {
    if (!selectedCategory) return;
    const categoryReminders = getCategoryReminders(selectedCategory.type);
    const allIds = categoryReminders.map(r => r.id);
    setSelectedItems(allIds);
  };

  const executeAction = async (reminder) => {
    const phone = reminder.contact_phone?.replace(/[^\d+]/g, '') || '';
    const message = reminder.notes || '';
    
    try {
      if (reminder.reminder_type === 'call') {
        if (phone) {
          await Linking.openURL(`tel:${phone}`);
        } else {
          Alert.alert('No Phone', 'No phone number attached');
        }
      } else if (reminder.reminder_type === 'sms') {
        const url = phone 
          ? `sms:${phone}${message ? `?body=${encodeURIComponent(message)}` : ''}`
          : `sms:${message ? `?body=${encodeURIComponent(message)}` : ''}`;
        await Linking.openURL(url);
      } else if (reminder.reminder_type === 'whatsapp') {
        const url = phone 
          ? `whatsapp-business://send?phone=${phone}${message ? `&text=${encodeURIComponent(message)}` : ''}`
          : `whatsapp-business://send${message ? `?text=${encodeURIComponent(message)}` : ''}`;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          const fallback = phone 
            ? `whatsapp://send?phone=${phone}${message ? `&text=${encodeURIComponent(message)}` : ''}`
            : `whatsapp://send${message ? `?text=${encodeURIComponent(message)}` : ''}`;
          await Linking.openURL(fallback);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open app');
    }
  };

  const openSocialApp = async (appName) => {
    try {
      if (appName === 'whatsapp') {
        // Open WhatsApp Business app directly
        if (Platform.OS === 'web') {
          await Linking.openURL('https://business.whatsapp.com');
          return;
        }
        
        // For Android, directly launch WhatsApp Business using intent
        if (Platform.OS === 'android') {
          try {
            // Try to launch WhatsApp Business directly
            await Linking.sendIntent('android.intent.action.MAIN', [
              { key: 'package', value: 'com.whatsapp.w4b' }
            ]);
            return;
          } catch (intentError) {
            console.log('Intent failed, trying URL scheme');
          }
          
          // Fallback: try whatsapp-business URL scheme
          try {
            const canOpen = await Linking.canOpenURL('whatsapp://');
            if (canOpen) {
              await Linking.openURL('whatsapp://');
              return;
            }
          } catch (e) {
            console.log('WhatsApp URL scheme failed');
          }
        }
        
        // iOS fallback
        if (Platform.OS === 'ios') {
          await Linking.openURL('whatsapp://');
          return;
        }
        
        Alert.alert('WhatsApp Business', 'Please open WhatsApp Business manually');
        return;
      }

      const appUrls = {
        instagram: { ios: 'instagram://', android: 'com.instagram.android', web: 'https://instagram.com' },
        facebook: { ios: 'fb://', android: 'com.facebook.katana', web: 'https://facebook.com' },
        linkedin: { ios: 'linkedin://', android: 'com.linkedin.android', web: 'https://linkedin.com' },
        wechat: { ios: 'weixin://', android: 'com.tencent.mm', web: 'https://wechat.com' },
        alibaba: { ios: 'alibabaapp://', android: 'com.alibaba.intl.android.apps.poseidon', web: 'https://alibaba.com' },
      };

      const urls = appUrls[appName];
      if (!urls) return;

      if (Platform.OS === 'web') {
        await Linking.openURL(urls.web);
      } else if (Platform.OS === 'ios') {
        const canOpen = await Linking.canOpenURL(urls.ios);
        if (canOpen) {
          await Linking.openURL(urls.ios);
        } else {
          await Linking.openURL(urls.web);
        }
      } else {
        const urlToTry = `intent://#Intent;package=${urls.android};end`;
        const canOpen = await Linking.canOpenURL(urlToTry);
        if (canOpen) {
          await Linking.openURL(urlToTry);
        } else {
          await Linking.openURL(urls.web);
        }
      }
    } catch (error) {
      Alert.alert('Error', `Could not open ${appName}`);
    }
  };

  const socialApps = [
    { name: 'Instagram', icon: 'logo-instagram', color: '#E4405F', key: 'instagram' },
    { name: 'Facebook', icon: 'logo-facebook', color: '#1877F2', key: 'facebook' },
    { name: 'LinkedIn', icon: 'logo-linkedin', color: '#0A66C2', key: 'linkedin' },
    { name: 'WA Business', icon: 'logo-whatsapp', color: '#25D366', key: 'whatsapp' },
    { name: 'WeChat', icon: 'chatbubbles', color: '#09B83E', key: 'wechat' },
    { name: 'Alibaba', icon: 'storefront', color: '#FF6A00', key: 'alibaba' },
  ];

  const getActionLabel = (type) => {
    if (type === 'call') return 'CALL';
    if (type === 'sms') return 'SMS';
    if (type === 'whatsapp') return 'WA';
    return null;
  };

  // Detail view for selected category with bulk delete
  if (selectedCategory) {
    const categoryReminders = getCategoryReminders(selectedCategory.type);
    const actionLabel = getActionLabel(selectedCategory.type);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => {
            setSelectedCategory(null);
            setBulkSelectMode(false);
            setSelectedItems([]);
          }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#212529" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name={selectedCategory.icon} size={22} color={selectedCategory.color} />
            <Text style={styles.headerTitle}>{selectedCategory.name}</Text>
            <Text style={styles.headerCount}>({categoryReminders.length})</Text>
          </View>
          <TouchableOpacity 
            onPress={() => handleActionPress(selectedCategory.type, selectedCategory.name)}
            style={[styles.addBtn, { backgroundColor: selectedCategory.color }]}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bulk Actions Bar */}
        {categoryReminders.length > 0 && (
          <View style={styles.bulkBar}>
            <TouchableOpacity 
              style={styles.bulkToggle}
              onPress={() => {
                setBulkSelectMode(!bulkSelectMode);
                setSelectedItems([]);
              }}
            >
              <Ionicons name={bulkSelectMode ? "checkbox" : "checkbox-outline"} size={20} color="#667eea" />
              <Text style={styles.bulkToggleText}>{bulkSelectMode ? 'Cancel' : 'Select'}</Text>
            </TouchableOpacity>
            
            {bulkSelectMode && (
              <>
                <TouchableOpacity style={styles.bulkAction} onPress={selectAllInCategory}>
                  <Text style={styles.bulkActionText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.bulkAction, styles.bulkDelete, selectedItems.length === 0 && styles.disabled]}
                  onPress={bulkDelete}
                  disabled={selectedItems.length === 0}
                >
                  <Ionicons name="trash" size={16} color="#fff" />
                  <Text style={styles.bulkDeleteText}>Delete ({selectedItems.length})</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <ScrollView style={styles.detailContent}>
          {categoryReminders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name={selectedCategory.icon} size={48} color="#adb5bd" />
              <Text style={styles.emptyText}>No {selectedCategory.name} reminders</Text>
            </View>
          ) : (
            categoryReminders.map((reminder) => {
              // Display name: use contact_name if available, otherwise use title
              const displayName = reminder.contact_name || reminder.title || `${selectedCategory.name} Reminder`;
              
              return (
                <TouchableOpacity 
                  key={reminder.id} 
                  style={[
                    styles.compactReminderCard, 
                    { borderLeftColor: selectedCategory.color },
                    bulkSelectMode && selectedItems.includes(reminder.id) && styles.selectedCard
                  ]}
                  onPress={() => bulkSelectMode && toggleItemSelection(reminder.id)}
                  activeOpacity={bulkSelectMode ? 0.7 : 1}
                >
                  {bulkSelectMode && (
                    <View style={styles.checkbox}>
                      <Ionicons 
                        name={selectedItems.includes(reminder.id) ? "checkbox" : "square-outline"} 
                        size={20} 
                        color={selectedItems.includes(reminder.id) ? "#667eea" : "#adb5bd"} 
                      />
                    </View>
                  )}
                  
                  {/* Contact name only */}
                  <Text style={styles.compactName} numberOfLines={1}>{displayName}</Text>
                  
                  {/* Action buttons on the right: Action > Edit > Delete */}
                  {!bulkSelectMode && (
                    <View style={styles.compactActions}>
                      {actionLabel && (
                        <TouchableOpacity
                          style={[styles.compactActionBtn, { backgroundColor: selectedCategory.color }]}
                          onPress={() => executeAction(reminder)}
                        >
                          <Ionicons 
                            name={selectedCategory.type === 'call' ? 'call' : selectedCategory.type === 'sms' ? 'chatbubble' : 'logo-whatsapp'} 
                            size={16} 
                            color="#fff" 
                          />
                        </TouchableOpacity>
                      )}
                      {/* Edit button */}
                      <TouchableOpacity 
                        style={styles.compactEditBtn}
                        onPress={() => router.push(`/action?type=${reminder.reminder_type}&name=${selectedCategory.name}&edit=true&id=${reminder.id}&title=${encodeURIComponent(reminder.title || '')}&contact_name=${encodeURIComponent(reminder.contact_name || '')}&contact_phone=${encodeURIComponent(reminder.contact_phone || '')}&notes=${encodeURIComponent(reminder.notes || '')}`)}
                      >
                        <Ionicons name="create-outline" size={18} color="#667eea" />
                      </TouchableOpacity>
                      {/* Delete button */}
                      <TouchableOpacity 
                        style={styles.compactDeleteBtn}
                        onPress={() => deleteReminder(reminder.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main Dashboard
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Justblr Matrix</Text>
            <Text style={styles.subtitle}>Assistant ({reminders.length} reminders)</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.linkWebBtn}
              onPress={openLinkModal}
            >
              <Ionicons name="laptop-outline" size={20} color="#667eea" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.voiceCommandBtn}
              onPress={startVoiceCommand}
            >
              <Ionicons name="mic" size={22} color="#fff" />
            </TouchableOpacity>
            <Image 
              source={{ uri: JUSTBLR_LOGO }} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Link to Web Modal */}
        <Modal visible={showLinkModal} transparent animationType="fade">
          <View style={styles.voiceModalOverlay}>
            <View style={styles.voiceModalContent}>
              <TouchableOpacity style={styles.voiceModalClose} onPress={() => setShowLinkModal(false)}>
                <Ionicons name="close" size={24} color="#6c757d" />
              </TouchableOpacity>
              
              <View style={styles.linkIconContainer}>
                <Ionicons name="laptop-outline" size={48} color="#667eea" />
              </View>
              <Text style={styles.voiceModalTitle}>Link to Web</Text>
              <Text style={styles.linkDescription}>
                Enter this code on the web dashboard to sync your reminders and contacts
              </Text>
              
              {syncLoading ? (
                <ActivityIndicator size="large" color="#667eea" style={{ marginVertical: 20 }} />
              ) : (
                <View style={styles.syncCodeContainer}>
                  {syncCode.split('').map((digit, idx) => (
                    <View key={idx} style={styles.syncCodeDigit}>
                      <Text style={styles.syncCodeText}>{digit}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              <Text style={styles.linkHint}>Code expires in 1 hour</Text>
              
              <TouchableOpacity style={styles.linkRefreshBtn} onPress={generateSyncCode}>
                <Ionicons name="refresh" size={18} color="#667eea" />
                <Text style={styles.linkRefreshText}>Generate New Code</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.linkRefreshBtn, {marginTop: 12, backgroundColor: '#22c55e20'}]} onPress={syncContactsToCloud}>
                <Ionicons name="cloud-upload" size={18} color="#22c55e" />
                <Text style={[styles.linkRefreshText, {color: '#22c55e'}]}>Sync Contacts to Cloud</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Voice Command Modal */}
        <Modal visible={showVoiceModal} transparent animationType="fade">
          <View style={styles.voiceModalOverlay}>
            <View style={styles.voiceModalContent}>
              <TouchableOpacity style={styles.voiceModalClose} onPress={closeVoiceModal}>
                <Ionicons name="close" size={24} color="#6c757d" />
              </TouchableOpacity>
              
              <Image source={{ uri: JUSTBLR_LOGO }} style={styles.voiceModalLogo} resizeMode="contain" />
              <Text style={styles.voiceModalTitle}>Voice Command</Text>
              <Text style={styles.voiceModalStatus}>{voiceStatus}</Text>
              
              {voiceProcessing ? (
                <ActivityIndicator size="large" color="#667eea" style={{ marginVertical: 20 }} />
              ) : (
                <TouchableOpacity 
                  style={[styles.voiceModalBtn, isVoiceListening && styles.voiceModalBtnActive]}
                  onPress={isVoiceListening ? stopVoiceCommand : startVoiceCommand}
                >
                  <Ionicons name={isVoiceListening ? "stop" : "mic"} size={40} color="#fff" />
                </TouchableOpacity>
              )}
              
              <Text style={styles.voiceModalHint}>
                {isVoiceListening ? 'Tap to stop' : 'Tap to speak'}
              </Text>
              
              <View style={styles.voiceModalActions}>
                {QUICK_ACTIONS.map((action) => (
                  <View key={action.type} style={styles.voiceModalActionItem}>
                    <Ionicons name={action.icon} size={16} color={action.color} />
                    <Text style={styles.voiceModalActionText}>{action.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Modal>

        {/* Quick Actions - 6 icons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((item) => (
              <TouchableOpacity
                key={item.type}
                style={styles.quickActionItem}
                onPress={() => handleActionPress(item.type, item.name)}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={styles.quickActionText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* View All Reminders - 5 icons grid (no Notes) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>View All Reminders</Text>
          <View style={styles.reminderGrid}>
            {REMINDER_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.type}
                style={[styles.reminderGridItem, { borderColor: cat.color }]}
                onPress={() => setSelectedCategory(cat)}
              >
                <View style={[styles.reminderGridIcon, { backgroundColor: cat.color }]}>
                  <Ionicons name={cat.icon} size={18} color="#fff" />
                </View>
                <Text style={styles.reminderGridName}>{cat.name}</Text>
                <Text style={styles.reminderGridCount}>{getCategoryCount(cat.type)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Delegation Section */}
        <TouchableOpacity 
          style={styles.delegationCard}
          onPress={() => router.push('/delegation')}
        >
          <View style={styles.delegationIconWrap}>
            <Ionicons name="people" size={28} color="#fff" />
          </View>
          <View style={styles.delegationContent}>
            <Text style={styles.delegationTitle}>Task Delegation</Text>
            <Text style={styles.delegationSubtitle}>Assign & track employee tasks</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#667eea" />
        </TouchableOpacity>

        {/* Social Media Hub - Scrollable */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Media Hub</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.socialScroll}>
            {socialApps.map((app, index) => (
              <TouchableOpacity
                key={index}
                style={styles.socialItem}
                onPress={() => openSocialApp(app.key)}
              >
                <View style={[styles.socialIcon, { backgroundColor: app.color }]}>
                  <Ionicons name={app.icon} size={24} color="#fff" />
                </View>
                <Text style={styles.socialText}>{app.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Desktop Info */}
        <View style={styles.desktopInfo}>
          <Ionicons name="desktop" size={20} color="#6c757d" />
          <Text style={styles.desktopText}>
            Desktop: {Platform.OS === 'web' ? window.location.href : 'Open in browser'}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212529',
  },
  subtitle: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voiceCommandBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Voice Modal Styles
  voiceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceModalContent: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  voiceModalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  voiceModalLogo: {
    width: 60,
    height: 60,
    marginBottom: 12,
  },
  voiceModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 8,
  },
  voiceModalStatus: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 16,
    minHeight: 40,
  },
  voiceModalBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  voiceModalBtnActive: {
    backgroundColor: '#FF6B6B',
  },
  voiceModalHint: {
    fontSize: 12,
    color: '#adb5bd',
    marginBottom: 16,
  },
  voiceModalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  voiceModalActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  voiceModalActionText: {
    fontSize: 11,
    color: '#495057',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
  },
  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionItem: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  quickActionText: {
    fontSize: 11,
    color: '#495057',
    fontWeight: '500',
  },
  // Reminder Grid - 5 icons
  reminderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reminderGridItem: {
    width: '18%',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
  },
  reminderGridIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  reminderGridName: {
    fontSize: 9,
    fontWeight: '600',
    color: '#212529',
  },
  reminderGridCount: {
    fontSize: 10,
    color: '#6c757d',
    fontWeight: '700',
  },
  // Delegation Card
  delegationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  delegationIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  delegationContent: {
    flex: 1,
    marginLeft: 14,
  },
  delegationTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#212529',
  },
  delegationSubtitle: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 2,
  },
  // Social Media Scroll
  socialScroll: {
    marginLeft: -4,
  },
  socialItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  socialIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  socialText: {
    fontSize: 10,
    color: '#495057',
    fontWeight: '500',
  },
  // Desktop Info
  desktopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  desktopText: {
    fontSize: 11,
    color: '#6c757d',
  },
  // Detail View
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  headerCount: {
    fontSize: 14,
    color: '#6c757d',
  },
  backButton: {
    padding: 4,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Bulk Actions
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 12,
  },
  bulkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulkToggleText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '500',
  },
  bulkAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#e9ecef',
  },
  bulkActionText: {
    fontSize: 12,
    color: '#495057',
  },
  bulkDelete: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulkDeleteText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  // Detail Content
  detailContent: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#6c757d',
    marginTop: 12,
  },
  reminderCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  selectedCard: {
    backgroundColor: '#667eea10',
  },
  checkbox: {
    marginRight: 10,
    marginTop: 2,
  },
  // Compact reminder card for Call/SMS/WhatsApp
  compactReminderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
    marginLeft: 4,
  },
  compactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactEditBtn: {
    padding: 4,
  },
  compactDeleteBtn: {
    padding: 4,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
  },
  reminderDetail: {
    fontSize: 13,
    color: '#495057',
    marginTop: 2,
  },
  reminderPhone: {
    fontSize: 12,
    color: '#667eea',
    marginTop: 2,
  },
  reminderNotes: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
    fontStyle: 'italic',
  },
  reminderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  // Link to Web styles
  linkWebBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(102, 126, 234, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  linkIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(102, 126, 234, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  linkDescription: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  syncCodeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  syncCodeDigit: {
    width: 48,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  syncCodeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#667eea',
  },
  linkHint: {
    fontSize: 12,
    color: '#adb5bd',
    marginBottom: 16,
  },
  linkRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
  },
  linkRefreshText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
  },
});
