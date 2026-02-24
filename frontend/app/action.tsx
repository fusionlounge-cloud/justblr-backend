import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { Audio } from 'expo-av';
import axios from 'axios';
import { getContactsCache, setContactsCache, isCacheValid } from '../utils/contactsCache';
import DateTimePicker from '@react-native-community/datetimepicker';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Conditional notification import to avoid Expo Go errors
let Notifications: typeof import('expo-notifications') | null = null;
try {
  if (Platform.OS !== 'web') {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (e) {
  console.log('Notifications not available');
}

export default function ActionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const actionType = String(params.type || '');
  const actionName = String(params.name || '');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingField, setRecordingField] = useState('title');
  
  // Scheduling state - Default to tomorrow 4:30 PM
  const getDefaultScheduleTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(16, 30, 0, 0); // 4:30 PM
    return tomorrow;
  };
  const [scheduledTime, setScheduledTime] = useState(getDefaultScheduleTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [autoExecute, setAutoExecute] = useState(true); // ON by default
  const [notifyMe, setNotifyMe] = useState(true);
  
  // Date picker input states
  const [pickerDateStr, setPickerDateStr] = useState('');
  const [pickerTimeStr, setPickerTimeStr] = useState('');
  
  // Contact autocomplete state
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactsPermission, setContactsPermission] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [contactsCount, setContactsCount] = useState(0);
  
  // Native picker mode (for Android - shows date first, then time)
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  // Initialize picker values when modal opens
  useEffect(() => {
    if (showDatePicker) {
      const year = scheduledTime.getFullYear();
      const month = String(scheduledTime.getMonth() + 1).padStart(2, '0');
      const day = String(scheduledTime.getDate()).padStart(2, '0');
      const hours = String(scheduledTime.getHours()).padStart(2, '0');
      const minutes = String(scheduledTime.getMinutes()).padStart(2, '0');
      setPickerDateStr(`${year}-${month}-${day}`);
      setPickerTimeStr(`${hours}:${minutes}`);
      setPickerMode('date'); // Start with date picker on mobile
    }
  }, [showDatePicker]);

  // Request notification permissions
  useEffect(() => {
    const requestNotificationPermissions = async () => {
      if (Platform.OS === 'web' || !Notifications) return;
      
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('Notification permission not granted');
        }
      } catch (error) {
        console.log('Notification permissions not available');
      }
    };
    requestNotificationPermissions();
  }, []);

  // Request permission and load contacts (with in-memory caching)
  useEffect(() => {
    const loadAllContacts = async () => {
      const needsContacts = ['call', 'sms', 'whatsapp', 'meet'].includes(actionType);
      if (!needsContacts) {
        setLoadingContacts(false);
        return;
      }
      
      // Contacts don't work on web
      if (Platform.OS === 'web') {
        setLoadingContacts(false);
        setContactsCount(0);
        return;
      }
      
      // Check if contacts are already cached in memory
      if (isCacheValid()) {
        const cached = getContactsCache();
        setAllContacts(cached);
        setContactsCount(cached.length);
        setContactsPermission(true);
        setLoadingContacts(false);
        return;
      }
      
      setLoadingContacts(true);
      
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        setContactsPermission(status === 'granted');
        
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Contact permission is required to pick contacts');
          setLoadingContacts(false);
          return;
        }
        
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.FirstName,
            Contacts.Fields.LastName,
            Contacts.Fields.MiddleName,
            Contacts.Fields.PhoneNumbers,
          ],
        });
        
        const formatted = [];
        data.forEach((contact, idx) => {
          const displayName = contact.name || 
            [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' ').trim() ||
            'Unknown';
          
          const searchText = [
            contact.name,
            contact.firstName,
            contact.lastName,
            contact.middleName,
          ].filter(Boolean).join(' ').toLowerCase();
          
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            contact.phoneNumbers.forEach((phone, pIdx) => {
              if (phone.number && phone.number.trim()) {
                const originalPhone = phone.number.trim();
                formatted.push({
                  id: `c${idx}p${pIdx}`,
                  name: displayName,
                  searchText: searchText,
                  phoneNumber: originalPhone,
                  phoneDigits: originalPhone.replace(/[^\d+]/g, ''),
                });
              }
            });
          }
        });
        
        setContactsCache(formatted);
        setAllContacts(formatted);
        setContactsCount(formatted.length);
        
      } catch (error) {
        console.error('Error loading contacts:', error);
      } finally {
        setLoadingContacts(false);
      }
    };
    
    loadAllContacts();
  }, [actionType]);

  // Filter contacts - improved search
  useEffect(() => {
    if (contactName.length < 1 || contactPhone) {
      setContactSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    const query = contactName.toLowerCase().trim();
    const queryDigits = query.replace(/\D/g, '');
    
    const filtered = allContacts.filter(c => {
      if (c.searchText && c.searchText.includes(query)) return true;
      if (c.name.toLowerCase().includes(query)) return true;
      if (queryDigits && c.phoneDigits && c.phoneDigits.includes(queryDigits)) return true;
      return false;
    }).slice(0, 20);
    
    setContactSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  }, [contactName, allContacts, contactPhone]);

  const selectContact = (contact) => {
    setContactName(contact.name);
    setContactPhone(contact.phoneNumber);
    setShowSuggestions(false);
    setContactSuggestions([]);
  };

  const getColor = () => {
    switch (actionType) {
      case 'meet': return '#FF6B6B';
      case 'call': return '#4ECDC4';
      case 'sms': return '#95E1D3';
      case 'whatsapp': return '#25D366';
      case 'deskwork': return '#A78BFA';
      case 'keepnotes': return '#FFC107';
      default: return '#667eea';
    }
  };

  const getIcon = () => {
    switch (actionType) {
      case 'meet': return 'people';
      case 'call': return 'call';
      case 'sms': return 'chatbubble';
      case 'whatsapp': return 'logo-whatsapp';
      case 'deskwork': return 'laptop';
      case 'keepnotes': return 'create';
      default: return 'flash';
    }
  };

  const startVoiceInput = async (field) => {
    try {
      setRecordingField(field);
      setIsRecording(true);

      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start voice recording');
      setIsRecording(false);
    }
  };

  const stopVoiceInput = async () => {
    if (!recording) {
      setIsRecording(false);
      return;
    }

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        setIsProcessing(true);
        
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

        const transcribedText = response.data.transcribed_text;

        if (recordingField === 'title') {
          setTitle(transcribedText);
        } else {
          setContent((prev) => (prev ? prev + ' ' + transcribedText : transcribedText));
        }
      }

      setRecording(null);
    } catch (error) {
      console.error('Failed to process voice:', error);
      const errorMsg = error?.response?.data?.detail || 'Failed to process voice input';
      Alert.alert('Voice Error', errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Schedule local notification
  const scheduleNotification = async (reminderTitle: string, reminderTime: Date) => {
    if (Platform.OS === 'web' || !notifyMe || !Notifications) return;
    
    try {
      const trigger = new Date(reminderTime);
      
      // Only schedule if it's in the future
      if (trigger.getTime() > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${actionName} Reminder`,
            body: reminderTitle || `Time for your ${actionName.toLowerCase()}!`,
            data: { type: actionType, contact: contactName },
            sound: true,
          },
          trigger,
        });
        console.log('Notification scheduled for:', trigger);
      }
    } catch (error) {
      console.log('Notification scheduling not available:', error);
    }
  };

  const saveReminder = async () => {
    const reminderTitle = title.trim() || `${actionName} Reminder`;

    try {
      const response = await axios.post(`${BACKEND_URL}/api/reminders`, {
        title: reminderTitle,
        contact_name: contactName || undefined,
        contact_phone: contactPhone || undefined,
        reminder_type: actionType,
        scheduled_time: scheduledTime.toISOString(),
        notes: content || undefined,
        auto_execute: autoExecute,
      });

      console.log('Save response:', response.data);

      // Schedule local notification
      if (notifyMe) {
        await scheduleNotification(reminderTitle, scheduledTime);
      }

      Alert.alert('Saved!', `${actionName} reminder created for ${formatDateTime(scheduledTime)}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to create reminder:', error);
      Alert.alert('Error', 'Failed to create reminder. Please try again.');
    }
  };

  // Date/Time formatting
  const formatDateTime = (date: Date) => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    return `${date.toLocaleDateString()} at ${timeStr}`;
  };

  // Quick time presets
  const quickTimePresets = [
    { label: 'In 30 min', getValue: () => new Date(Date.now() + 30 * 60000) },
    { label: 'In 1 hour', getValue: () => new Date(Date.now() + 60 * 60000) },
    { label: 'In 2 hours', getValue: () => new Date(Date.now() + 2 * 60 * 60000) },
    { label: 'Tomorrow 9 AM', getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }},
    { label: 'Tomorrow 6 PM', getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
      return d;
    }},
  ];

  // Custom date/time picker for web
  const applyDateTime = () => {
    try {
      const newDate = new Date(`${pickerDateStr}T${pickerTimeStr}`);
      if (!isNaN(newDate.getTime())) {
        setScheduledTime(newDate);
        setShowDatePicker(false);
      } else {
        Alert.alert('Invalid Date', 'Please enter a valid date and time');
      }
    } catch (e) {
      Alert.alert('Invalid Date', 'Please enter a valid date and time');
    }
  };
  
  const WebDateTimePicker = () => {
    return (
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date & Time</Text>
            
            <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.dateTimeInput}
              value={pickerDateStr}
              onChangeText={setPickerDateStr}
              placeholder="2026-02-25"
              keyboardType="default"
            />
            
            <Text style={styles.inputLabel}>Time (HH:MM)</Text>
            <TextInput
              style={styles.dateTimeInput}
              value={pickerTimeStr}
              onChangeText={setPickerTimeStr}
              placeholder="16:30"
              keyboardType="default"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: getColor() }]}
                onPress={applyDateTime}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#212529" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name={getIcon()} size={24} color={getColor()} />
            <Text style={styles.headerTitle}>{actionName}</Text>
          </View>
          <TouchableOpacity onPress={saveReminder} style={[styles.saveButton, { backgroundColor: getColor() }]}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title Input - Only show for non-call/sms/whatsapp actions */}
          {!['call', 'sms', 'whatsapp'].includes(actionType) && (
            <View style={styles.section}>
              <Text style={styles.label}>What to remind? (Optional)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={`E.g., ${actionName} with John`}
                  value={title}
                  onChangeText={setTitle}
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.voiceButton,
                    isRecording && recordingField === 'title' && { backgroundColor: '#FF6B6B' },
                  ]}
                  onPress={isRecording && recordingField === 'title' ? stopVoiceInput : () => startVoiceInput('title')}
                  disabled={isProcessing || (isRecording && recordingField !== 'title')}
                >
                  {isProcessing && recordingField === 'title' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name={isRecording && recordingField === 'title' ? 'stop' : 'mic'} size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Contact Input */}
          {actionType !== 'deskwork' && actionType !== 'keepnotes' && (
            <View style={styles.section}>
              <View style={styles.contactLabelRow}>
                <Text style={styles.label}>Contact (Optional)</Text>
                {Platform.OS === 'web' ? (
                  <Text style={styles.contactStatus}>Enter manually on web</Text>
                ) : loadingContacts ? (
                  <Text style={styles.contactStatus}>Loading contacts...</Text>
                ) : contactsCount > 0 ? (
                  <Text style={styles.contactStatus}>{contactsCount} contacts</Text>
                ) : null}
              </View>
              <View style={styles.contactInputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={Platform.OS === 'web' ? "Enter name" : loadingContacts ? "Loading contacts..." : "Type name to search..."}
                  value={contactName}
                  onChangeText={(text) => {
                    setContactName(text);
                    if (contactPhone && text !== contactName) {
                      setContactPhone('');
                    }
                  }}
                  onFocus={() => contactSuggestions.length > 0 && setShowSuggestions(true)}
                  editable={!loadingContacts || Platform.OS === 'web'}
                />
                {loadingContacts && Platform.OS !== 'web' && (
                  <ActivityIndicator size="small" color="#667eea" style={styles.contactLoader} />
                )}
              </View>
              
              {Platform.OS === 'web' && (
                <TextInput
                  style={[styles.input, { marginTop: 10 }]}
                  placeholder="Enter phone number (with +country code)"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                />
              )}
              
              {showSuggestions && contactSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView style={styles.suggestionsList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {contactSuggestions.map((contact) => (
                      <TouchableOpacity
                        key={contact.id}
                        style={styles.suggestionItem}
                        onPress={() => selectContact(contact)}
                      >
                        <View style={styles.suggestionAvatar}>
                          <Text style={styles.suggestionAvatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.suggestionInfo}>
                          <Text style={styles.suggestionName}>{contact.name}</Text>
                          <Text style={styles.suggestionPhone}>{contact.phoneNumber}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              
              {contactPhone ? (
                <View style={styles.selectedContact}>
                  <Ionicons name="checkmark-circle" size={18} color="#43e97b" />
                  <Text style={styles.selectedContactText}>{contactPhone}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Schedule Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Schedule</Text>
            
            {/* Current scheduled time */}
            <TouchableOpacity 
              style={styles.scheduledTimeCard}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={24} color={getColor()} />
              <View style={styles.scheduledTimeInfo}>
                <Text style={styles.scheduledTimeText}>{formatDateTime(scheduledTime)}</Text>
                <Text style={styles.scheduledTimeHint}>Tap to change</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#adb5bd" />
            </TouchableOpacity>

            {/* Quick presets */}
            <Text style={styles.quickPresetsLabel}>Quick presets:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
              {quickTimePresets.map((preset, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.presetChip, scheduledTime.getTime() === preset.getValue().getTime() && { backgroundColor: getColor() + '30', borderColor: getColor() }]}
                  onPress={() => setScheduledTime(preset.getValue())}
                >
                  <Text style={[styles.presetChipText, scheduledTime.getTime() === preset.getValue().getTime() && { color: getColor() }]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Auto-Execute Toggle */}
          {['call', 'sms', 'whatsapp'].includes(actionType) && (
            <View style={styles.section}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Ionicons name="flash" size={22} color={getColor()} />
                  <View style={styles.toggleTextContainer}>
                    <Text style={styles.toggleLabel}>Auto-Execute</Text>
                    <Text style={styles.toggleHint}>Automatically trigger {actionType} at scheduled time</Text>
                  </View>
                </View>
                <Switch
                  value={autoExecute}
                  onValueChange={setAutoExecute}
                  trackColor={{ false: '#e9ecef', true: getColor() + '60' }}
                  thumbColor={autoExecute ? getColor() : '#f4f3f4'}
                />
              </View>
            </View>
          )}

          {/* Notification Toggle */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="notifications" size={22} color="#667eea" />
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleLabel}>Notify Me</Text>
                  <Text style={styles.toggleHint}>Get a notification at scheduled time</Text>
                </View>
              </View>
              <Switch
                value={notifyMe}
                onValueChange={setNotifyMe}
                trackColor={{ false: '#e9ecef', true: '#667eea60' }}
                thumbColor={notifyMe ? '#667eea' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Notes Input */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Additional details..."
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={4}
              />
              <TouchableOpacity
                style={[
                  styles.voiceButton,
                  isRecording && recordingField === 'content' && { backgroundColor: '#FF6B6B' },
                ]}
                onPress={isRecording && recordingField === 'content' ? stopVoiceInput : () => startVoiceInput('content')}
                disabled={isProcessing || (isRecording && recordingField !== 'content')}
              >
                {isProcessing && recordingField === 'content' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name={isRecording && recordingField === 'content' ? 'stop' : 'mic'} size={24} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording... Tap mic when done</Text>
            </View>
          )}

          {isProcessing && (
            <View style={[styles.recordingIndicator, {backgroundColor: '#667eea20'}]}>
              <ActivityIndicator size="small" color="#667eea" />
              <Text style={[styles.recordingText, {color: '#667eea'}]}>Processing voice...</Text>
            </View>
          )}
          
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Date/Time Picker Modal */}
        {Platform.OS === 'web' && <WebDateTimePicker />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  keyboardAvoid: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: { padding: 8 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#212529' },
  saveButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  content: { flex: 1, padding: 20 },
  section: { marginBottom: 24 },
  contactLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  contactStatus: { fontSize: 12, color: '#6c757d' },
  label: { fontSize: 16, fontWeight: '700', color: '#212529', marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start' },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#212529',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  voiceButton: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center', marginLeft: 12,
  },
  notesInput: { height: 100, textAlignVertical: 'top' },
  recordingIndicator: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#FF6B6B20', borderRadius: 12, marginTop: 16,
  },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF6B6B', marginRight: 12 },
  recordingText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#FF6B6B' },
  contactInputWrapper: { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  contactLoader: { position: 'absolute', right: 16 },
  suggestionsContainer: {
    backgroundColor: '#fff', borderRadius: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#e9ecef', maxHeight: 300, overflow: 'hidden', zIndex: 1000, elevation: 5,
  },
  suggestionsList: { maxHeight: 300 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestionAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#667eea',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  suggestionAvatarText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: 15, fontWeight: '600', color: '#212529' },
  suggestionPhone: { fontSize: 13, color: '#6c757d', marginTop: 2 },
  selectedContact: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8,
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#43e97b15', borderRadius: 8, gap: 8,
  },
  selectedContactText: { color: '#212529', fontSize: 14 },
  // Schedule styles
  scheduledTimeCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e9ecef', gap: 12,
  },
  scheduledTimeInfo: { flex: 1 },
  scheduledTimeText: { fontSize: 16, fontWeight: '600', color: '#212529' },
  scheduledTimeHint: { fontSize: 12, color: '#6c757d', marginTop: 2 },
  quickPresetsLabel: { fontSize: 13, color: '#6c757d', marginTop: 12, marginBottom: 8 },
  presetsScroll: { marginHorizontal: -4 },
  presetChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9ecef', marginHorizontal: 4,
  },
  presetChipText: { fontSize: 13, color: '#495057', fontWeight: '500' },
  // Toggle styles
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e9ecef',
  },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  toggleTextContainer: { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#212529' },
  toggleHint: { fontSize: 12, color: '#6c757d', marginTop: 2 },
  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#212529', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f8f9fa' },
  confirmButton: { backgroundColor: '#667eea' },
  cancelButtonText: { color: '#6c757d', fontWeight: '600' },
  confirmButtonText: { color: '#fff', fontWeight: '600' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#495057', marginBottom: 8, marginTop: 8 },
  dateTimeInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#212529',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 8,
  },
});
