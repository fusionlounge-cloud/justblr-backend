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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { Audio } from 'expo-av';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

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
  
  // Contact autocomplete state
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactsPermission, setContactsPermission] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [contactsCount, setContactsCount] = useState(0);

  // Request permission and load ALL contacts on mount
  useEffect(() => {
    const loadAllContacts = async () => {
      const needsContacts = ['call', 'sms', 'whatsapp', 'meet'].includes(actionType);
      if (!needsContacts) {
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
        
        // Load ALL contacts with all name fields
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.FirstName,
            Contacts.Fields.LastName,
            Contacts.Fields.MiddleName,
            Contacts.Fields.PhoneNumbers,
          ],
        });
        
        // Format contacts with searchable text
        const formatted = [];
        data.forEach((contact, idx) => {
          // Build display name
          const displayName = contact.name || 
            [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' ').trim() ||
            'Unknown';
          
          // Build searchable text (all name parts)
          const searchText = [
            contact.name,
            contact.firstName,
            contact.lastName,
            contact.middleName,
          ].filter(Boolean).join(' ').toLowerCase();
          
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            contact.phoneNumbers.forEach((phone, pIdx) => {
              if (phone.number && phone.number.trim()) {
                formatted.push({
                  id: `c${idx}p${pIdx}`,
                  name: displayName,
                  searchText: searchText,
                  phoneNumber: phone.number.trim(),
                  phoneDigits: phone.number.replace(/\D/g, ''),
                });
              }
            });
          }
        });
        
        setAllContacts(formatted);
        setContactsCount(formatted.length);
        
      } catch (error) {
        console.error('Error loading contacts:', error);
        Alert.alert('Error', 'Failed to load contacts: ' + error.message);
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
    
    // Search in name and phone
    const filtered = allContacts.filter(c => {
      // Check if name contains query
      if (c.searchText && c.searchText.includes(query)) return true;
      if (c.name.toLowerCase().includes(query)) return true;
      
      // Check if phone contains query (digits only)
      if (queryDigits && c.phoneDigits && c.phoneDigits.includes(queryDigits)) return true;
      
      return false;
    }).slice(0, 20);
    
    setContactSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  }, [contactName, allContacts, contactPhone]);

  // Select a contact from suggestions
  const selectContact = (contact) => {
    setContactName(contact.name);
    setContactPhone(contact.phoneNumber);
    setShowSuggestions(false);
    setContactSuggestions([]);
  };

  const getColor = () => {
    switch (actionType) {
      case 'meet':
        return '#FF6B6B';
      case 'call':
        return '#4ECDC4';
      case 'sms':
        return '#95E1D3';
      case 'whatsapp':
        return '#25D366';
      case 'deskwork':
        return '#A78BFA';
      case 'keepnotes':
        return '#FFC107';
      default:
        return '#667eea';
    }
  };

  const getIcon = () => {
    switch (actionType) {
      case 'meet':
        return 'people';
      case 'call':
        return 'call';
      case 'sms':
        return 'chatbubble';
      case 'whatsapp':
        return 'logo-whatsapp';
      case 'deskwork':
        return 'laptop';
      case 'keepnotes':
        return 'create';
      default:
        return 'flash';
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
        // @ts-ignore - React Native requires this format for file uploads
        formData.append('audio_file', {
          uri: uri,
          type: 'audio/m4a',
          name: 'voice.m4a',
        });

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

  const saveReminder = async () => {
    const reminderTitle = title.trim() || `${actionName} Reminder`;

    try {
      const scheduledTime = new Date(Date.now() + 3600000);

      await axios.post(`${BACKEND_URL}/api/reminders`, {
        title: reminderTitle,
        contact_name: contactName || undefined,
        contact_phone: contactPhone || undefined,
        reminder_type: actionType,
        scheduled_time: scheduledTime.toISOString(),
        notes: content || undefined,
      });

      // Just save and go back - no prompts
      Alert.alert('Saved!', `${actionName} reminder created.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to create reminder:', error);
      Alert.alert('Error', 'Failed to create reminder');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
              onPress={
                isRecording && recordingField === 'title'
                  ? stopVoiceInput
                  : () => startVoiceInput('title')
              }
              disabled={isProcessing || (isRecording && recordingField !== 'title')}
            >
              {isProcessing && recordingField === 'title' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={isRecording && recordingField === 'title' ? 'stop' : 'mic'}
                  size={24}
                  color="#fff"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {actionType !== 'deskwork' && actionType !== 'keepnotes' && (
          <View style={styles.section}>
            <View style={styles.contactLabelRow}>
              <Text style={styles.label}>Contact (Optional)</Text>
              {loadingContacts ? (
                <Text style={styles.contactStatus}>Loading contacts...</Text>
              ) : contactsCount > 0 ? (
                <Text style={styles.contactStatus}>{contactsCount} contacts</Text>
              ) : null}
            </View>
            <View style={styles.contactInputWrapper}>
              <TextInput
                style={styles.input}
                placeholder={loadingContacts ? "Loading contacts..." : "Type name to search..."}
                value={contactName}
                onChangeText={(text) => {
                  setContactName(text);
                  if (contactPhone && text !== contactName) {
                    setContactPhone('');
                  }
                }}
                onFocus={() => contactSuggestions.length > 0 && setShowSuggestions(true)}
                editable={!loadingContacts}
              />
              {loadingContacts && (
                <ActivityIndicator size="small" color="#667eea" style={styles.contactLoader} />
              )}
            </View>
            
            {/* Contact Suggestions Dropdown */}
            {showSuggestions && contactSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {contactSuggestions.map((contact) => (
                  <TouchableOpacity
                    key={contact.id}
                    style={styles.suggestionItem}
                    onPress={() => selectContact(contact)}
                  >
                    <View style={styles.suggestionAvatar}>
                      <Text style={styles.suggestionAvatarText}>
                        {contact.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.suggestionInfo}>
                      <Text style={styles.suggestionName}>{contact.name}</Text>
                      <Text style={styles.suggestionPhone}>{contact.phoneNumber}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
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
              onPress={
                isRecording && recordingField === 'content'
                  ? stopVoiceInput
                  : () => startVoiceInput('content')
              }
              disabled={isProcessing || (isRecording && recordingField !== 'content')}
            >
              {isProcessing && recordingField === 'content' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={isRecording && recordingField === 'content' ? 'stop' : 'mic'}
                  size={24}
                  color="#fff"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              🎤 Recording... Speak now! Tap mic when done
            </Text>
          </View>
        )}

        {isProcessing && (
          <View style={[styles.recordingIndicator, {backgroundColor: '#667eea20'}]}>
            <ActivityIndicator size="small" color="#667eea" />
            <Text style={[styles.recordingText, {color: '#667eea'}]}>
              Processing your voice... Please wait
            </Text>
          </View>
        )}
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  contactLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactStatus: {
    fontSize: 12,
    color: '#6c757d',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FF6B6B20',
    borderRadius: 12,
    marginTop: 16,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B6B',
    marginRight: 12,
  },
  recordingText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  // Contact autocomplete styles
  contactInputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactLoader: {
    position: 'absolute',
    right: 16,
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    maxHeight: 250,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
  },
  suggestionPhone: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 2,
  },
  selectedContact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#43e97b15',
    borderRadius: 8,
    gap: 8,
  },
  selectedContactText: {
    color: '#212529',
    fontSize: 14,
  },
});
