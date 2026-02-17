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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { Audio } from 'expo-av';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Separator component for FlatList
const ContactSeparator = () => <View style={{ height: 1, backgroundColor: '#e9ecef', marginLeft: 72 }} />;

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
  
  // Contact picker state
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [allContactsData, setAllContactsData] = useState(null); // Store raw data for search

  // Pre-load contacts in background when screen opens
  useEffect(() => {
    const needsContacts = ['call', 'sms', 'whatsapp', 'meet'].includes(actionType);
    if (needsContacts && !contactsLoaded) {
      preloadContacts();
    }
  }, [actionType]);

  // Load ALL contacts but only display first 50 initially for speed
  const preloadContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please enable contacts permission in settings');
        return;
      }

      // Load ALL contacts
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });

      // Store raw data for searching
      setAllContactsData(data);

      // Format first 50 for initial display
      const formattedContacts = [];
      for (let i = 0; i < data.length && formattedContacts.length < 50; i++) {
        const contact = data[i];
        if (contact.phoneNumbers?.[0]?.number) {
          formattedContacts.push({
            id: `c${i}`,
            name: contact.name || 'Unknown',
            phoneNumber: contact.phoneNumbers[0].number,
          });
        }
      }

      setContacts(formattedContacts);
      setFilteredContacts(formattedContacts);
      setContactsLoaded(true);
    } catch (error) {
      console.error('Error preloading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts. Please try again.');
    }
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

  // Load device contacts - INSTANT if pre-loaded
  const loadContacts = async () => {
    // If contacts already loaded, just show the picker INSTANTLY
    if (contactsLoaded && contacts.length > 0) {
      setShowContactPicker(true);
      return;
    }
    
    // Otherwise load them now
    try {
      setLoadingContacts(true);
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant contact permissions to select contacts for your reminders.',
          [{ text: 'OK' }]
        );
        setLoadingContacts(false);
        return;
      }

      // Load ALL contacts
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });

      // Store raw data for searching
      setAllContactsData(data);

      // Format first 50 for initial display
      const formattedContacts = [];
      for (let i = 0; i < data.length && formattedContacts.length < 50; i++) {
        const contact = data[i];
        if (contact.phoneNumbers?.[0]?.number) {
          formattedContacts.push({
            id: `l${i}`,
            name: contact.name || 'Unknown',
            phoneNumber: contact.phoneNumbers[0].number,
          });
        }
      }
      
      setContacts(formattedContacts);
      setFilteredContacts(formattedContacts);
      setContactsLoaded(true);
      setShowContactPicker(true);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  // Filter contacts based on search - searches ALL contacts, not just displayed
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const query = searchQuery.toLowerCase();
      
      // Search in ALL contacts (raw data), not just displayed ones
      if (allContactsData) {
        const searchResults = [];
        for (let i = 0; i < allContactsData.length && searchResults.length < 50; i++) {
          const contact = allContactsData[i];
          const name = (contact.name || '').toLowerCase();
          const phone = contact.phoneNumbers?.[0]?.number || '';
          
          if (name.includes(query) || phone.includes(query)) {
            if (contact.phoneNumbers?.[0]?.number) {
              searchResults.push({
                id: `s${i}`,
                name: contact.name || 'Unknown',
                phoneNumber: contact.phoneNumbers[0].number,
              });
            }
          }
        }
        setFilteredContacts(searchResults);
      } else {
        // Fallback to filtering displayed contacts
        const filtered = contacts.filter(
          (contact) =>
            contact.name.toLowerCase().includes(query) ||
            contact.phoneNumber.includes(query)
        );
        setFilteredContacts(filtered);
      }
    }
  }, [searchQuery, contacts, allContactsData]);

  // Select a contact
  const selectContact = (contact) => {
    setContactName(contact.name);
    setContactPhone(contact.phoneNumber);
    setShowContactPicker(false);
    setSearchQuery('');
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

      // For WhatsApp/SMS/Call, offer to open app with message
      if (actionType === 'whatsapp' || actionType === 'sms' || actionType === 'call') {
        const message = `${reminderTitle}${content ? '\n\n' + content : ''}`;
        const phone = contactPhone?.replace(/\D/g, '') || '';
        
        let openButtonText = `Open ${actionName}`;
        if (actionType === 'call') openButtonText = 'Call Now';
        if (actionType === 'sms') openButtonText = 'Send SMS';
        if (actionType === 'whatsapp') openButtonText = 'Open WhatsApp';
        
        Alert.alert(
          'Success!',
          `${actionName} reminder created!${phone ? ` Open ${actionName} now?` : ''}`,
          [
            { text: 'Later', onPress: () => router.back() },
            {
              text: openButtonText,
              onPress: async () => {
                if (actionType === 'call') {
                  if (phone) {
                    await Linking.openURL(`tel:${phone}`);
                  } else {
                    await Linking.openURL('tel:');
                  }
                } else if (actionType === 'whatsapp') {
                  const url = phone 
                    ? `whatsapp-business://send?phone=${phone}&text=${encodeURIComponent(message)}`
                    : `whatsapp-business://send?text=${encodeURIComponent(message)}`;
                  await Linking.openURL(url);
                } else {
                  const url = phone
                    ? `sms:${phone}?body=${encodeURIComponent(message)}`
                    : `sms:?body=${encodeURIComponent(message)}`;
                  await Linking.openURL(url);
                }
                router.back();
              },
            },
          ]
        );
      } else {
        Alert.alert('Success', `${actionName} reminder created!`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
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
            <View style={styles.contactHeader}>
              <Text style={styles.label}>Contact (Optional)</Text>
              <TouchableOpacity
                style={styles.pickContactButton}
                onPress={loadContacts}
                disabled={loadingContacts}
              >
                {loadingContacts ? (
                  <ActivityIndicator size="small" color="#667eea" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={18} color="#667eea" />
                    <Text style={styles.pickContactText}>Pick Contact</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Contact name"
              value={contactName}
              onChangeText={setContactName}
            />
            <TextInput
              style={[styles.input, {marginTop: 12}]}
              placeholder="Phone number"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
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
              placeholder="Search contacts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
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
                <Ionicons name="people-outline" size={48} color="#adb5bd" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No contacts found' : 'No contacts available'}
                </Text>
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
