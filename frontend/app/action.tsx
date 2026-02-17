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
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsPermission, setContactsPermission] = useState(false);

  // Request permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      const needsContacts = ['call', 'sms', 'whatsapp', 'meet'].includes(actionType);
      if (needsContacts) {
        const { status } = await Contacts.requestPermissionsAsync();
        setContactsPermission(status === 'granted');
      }
    };
    checkPermission();
  }, [actionType]);

  // Search contacts when user types in contact name field
  const searchContacts = async (query) => {
    if (!contactsPermission || query.length < 2) {
      setContactSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingContacts(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        name: query,
        pageSize: 10,
      });

      const results = [];
      for (let i = 0; i < data.length && results.length < 10; i++) {
        const contact = data[i];
        if (contact.phoneNumbers?.[0]?.number) {
          results.push({
            id: `c${i}`,
            name: contact.name || 'Unknown',
            phoneNumber: contact.phoneNumbers[0].number,
          });
        }
      }
      setContactSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Debounced search when contactName changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (contactName.length >= 2 && !contactPhone) {
        searchContacts(contactName);
      } else {
        setContactSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [contactName]);

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
            <Text style={styles.label}>Contact (Optional)</Text>
            <View style={styles.contactInputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Type contact name to search..."
                value={contactName}
                onChangeText={(text) => {
                  setContactName(text);
                  if (contactPhone && text !== contactName) {
                    setContactPhone(''); // Clear phone if user changes name
                  }
                }}
                onFocus={() => contactSuggestions.length > 0 && setShowSuggestions(true)}
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

      {/* Contact Picker Modal */}
      <Modal
        visible={showContactPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowContactPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Contact</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowContactPicker(false);
                setSearchQuery('');
              }}
            >
              <Ionicons name="close" size={24} color="#212529" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#6c757d" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Type name to search..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {loadingContacts && (
              <ActivityIndicator size="small" color="#667eea" />
            )}
            {searchQuery.length > 0 && !loadingContacts && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#6c757d" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => selectContact(item)}
              >
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{item.name}</Text>
                  <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#adb5bd" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name={searchQuery.length < 2 ? "search" : "people-outline"} size={48} color="#adb5bd" />
                <Text style={styles.emptyText}>
                  {searchQuery.length < 2 
                    ? 'Type at least 2 characters to search' 
                    : loadingContacts 
                      ? 'Searching...' 
                      : 'No contacts found'}
                </Text>
                {searchQuery.length < 2 && (
                  <Text style={[styles.emptyText, {fontSize: 13, marginTop: 8}]}>
                    Example: "John" or "Mom"
                  </Text>
                )}
              </View>
            }
            ItemSeparatorComponent={ContactSeparator}
            contentContainerStyle={filteredContacts.length === 0 && styles.emptyList}
          />
        </SafeAreaView>
      </Modal>
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
  // Contact picker styles
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  pickContactText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  modalCloseButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#212529',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 14,
    color: '#6c757d',
  },
  separator: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginLeft: 72,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
  },
  emptyList: {
    flex: 1,
  },
});
