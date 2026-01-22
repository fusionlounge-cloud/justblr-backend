import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import * as Contacts from 'expo-contacts';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type ActionMode = 'reminder' | 'note' | null;

export default function ActionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const actionType = params.type as string; // meet, call, sms, whatsapp, deskwork
  const actionName = params.name as string;

  const [mode, setMode] = useState<ActionMode>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [tags, setTags] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingField, setRecordingField] = useState<'title' | 'content'>('title');

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

  const startVoiceInput = async (field: 'title' | 'content') => {
    try {
      setRecordingField(field);
      setIsRecording(true);

      // Check if running on web - use Web Speech API
      if (Platform.OS === 'web') {
        console.log('Starting Web Speech Recognition...');
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
          Alert.alert('Not Supported', 'Speech recognition is not supported in this browser. Please use Chrome or Safari.');
          setIsRecording(false);
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-IN'; // English - India for South Indian accents

        recognition.onstart = () => {
          console.log('Voice recognition started. Please speak...');
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          console.log('Transcript:', transcript);
          if (field === 'title') {
            setTitle(transcript);
          } else {
            setContent((prev) => (prev ? prev + ' ' + transcript : transcript));
          }
          setIsRecording(false);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          let errorMsg = 'Speech recognition failed';
          if (event.error === 'not-allowed') {
            errorMsg = 'Microphone permission denied. Please allow microphone access in browser settings.';
          } else if (event.error === 'no-speech') {
            errorMsg = 'No speech detected. Please try again and speak clearly.';
          }
          Alert.alert('Error', errorMsg);
          setIsRecording(false);
        };

        recognition.onend = () => {
          console.log('Voice recognition ended');
          setIsRecording(false);
        };

        recognition.start();
      } else {
        // Mobile - use expo-av to record audio
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        setRecording(recording);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start voice recording');
      setIsRecording(false);
    }
  };

  const stopVoiceInput = async () => {
    // Web handles stop automatically, only handle mobile recordings
    if (!recording || Platform.OS === 'web') {
      setIsRecording(false);
      return;
    }

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        setIsProcessing(true);
        
        // For mobile, we still need to send to backend
        // But show a message that it requires API setup
        Alert.alert(
          'Voice Recognition',
          'Voice recognition on mobile requires additional API setup. Please type your text for now or use web version for voice input.',
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
      }

      setRecording(null);
    } catch (error) {
      console.error('Failed to process voice:', error);
      Alert.alert('Error', 'Failed to process voice input');
    } finally {
      setIsProcessing(false);
    }
  };

  const pickContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Contact access is required to pick a contact');
        return;
      }

      Alert.alert(
        'Pick Contact',
        'Contact picker will be shown here. For now, manually enter contact details.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Contact picker error:', error);
      Alert.alert('Error', 'Failed to access contacts');
    }
  };

  const saveReminder = async () => {
    // Title is now optional - if empty, use action type as title
    const reminderTitle = title.trim() || `${actionName} Reminder`;

    try {
      const scheduledTime = new Date(Date.now() + 3600000); // 1 hour from now

      await axios.post(`${BACKEND_URL}/api/reminders`, {
        title: reminderTitle,
        contact_name: contactName || undefined,
        contact_phone: contactPhone || undefined,
        reminder_type: actionType,
        scheduled_time: scheduledTime.toISOString(),
        notes: content || undefined,
      });

      Alert.alert('Success', `${actionName} reminder created successfully!`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to create reminder:', error);
      Alert.alert('Error', 'Failed to create reminder');
    }
  };

  const saveNote = async () => {
    if (!title.trim() && !content.trim()) {
      Alert.alert('Error', 'Please provide at least a title or content');
      return;
    }

    try {
      const tagArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      // Add action type as a tag
      tagArray.push(actionType);

      await axios.post(`${BACKEND_URL}/api/notes`, {
        title: title || `${actionName} Note`,
        content: content,
        tags: tagArray,
      });

      Alert.alert('Success', `${actionName} note saved successfully!`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to save note:', error);
      Alert.alert('Error', 'Failed to save note');
    }
  };

  const handleSave = () => {
    if (mode === 'reminder') {
      saveReminder();
    } else if (mode === 'note') {
      saveNote();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name={getIcon() as any} size={24} color={getColor()} />
          <Text style={styles.headerTitle}>{actionName}</Text>
        </View>
        {mode && (
          <TouchableOpacity onPress={handleSave} style={[styles.saveButton, { backgroundColor: getColor() }]}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        )}
        {!mode && <View style={styles.placeholder} />}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Mode Selection */}
        {!mode && (
          <View style={styles.modeSection}>
            <Text style={styles.modeTitle}>What would you like to create?</Text>
            <TouchableOpacity
              style={[styles.modeCard, { borderColor: getColor() }]}
              onPress={() => setMode('reminder')}
            >
              <Ionicons name="alarm" size={40} color={getColor()} />
              <Text style={styles.modeCardTitle}>Reminder</Text>
              <Text style={styles.modeCardDesc}>Set a voice reminder for this {actionName.toLowerCase()}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeCard, { borderColor: getColor() }]}
              onPress={() => setMode('note')}
            >
              <Ionicons name="document-text" size={40} color={getColor()} />
              <Text style={styles.modeCardTitle}>Note</Text>
              <Text style={styles.modeCardDesc}>Write a voice note for this {actionName.toLowerCase()}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reminder Form */}
        {mode === 'reminder' && (
          <View>
            <View style={styles.section}>
              <Text style={styles.label}>What to remind? (Optional)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={`E.g., ${actionName} with John about project`}
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

            {actionType !== 'deskwork' && (
              <View style={styles.section}>
                <Text style={styles.label}>Contact (Optional)</Text>
                <View style={styles.contactContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Contact name"
                    value={contactName}
                    onChangeText={setContactName}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone number"
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    keyboardType="phone-pad"
                  />
                  <TouchableOpacity style={styles.contactButton} onPress={pickContact}>
                    <Ionicons name="person-add" size={20} color={getColor()} />
                    <Text style={[styles.contactButtonText, { color: getColor() }]}>Pick from Contacts</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Additional Notes (Optional)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="Add any additional details..."
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

            <View style={[styles.infoCard, { backgroundColor: getColor() + '20' }]}>
              <Ionicons name="time" size={20} color={getColor()} />
              <Text style={styles.infoText}>
                Reminder will trigger in 1 hour
              </Text>
            </View>
          </View>
        )}

        {/* Note Form */}
        {mode === 'note' && (
          <View>
            <View style={styles.section}>
              <Text style={styles.label}>Title</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={`${actionName} note title...`}
                  value={title}
                  onChangeText={setTitle}
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

            <View style={styles.section}>
              <Text style={styles.label}>Content</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.contentInput]}
                  placeholder="Start typing or use voice..."
                  value={content}
                  onChangeText={setContent}
                  multiline
                  numberOfLines={10}
                  textAlignVertical="top"
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

            <View style={styles.section}>
              <Text style={styles.label}>Tags (comma separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="work, urgent, important..."
                value={tags}
                onChangeText={setTags}
              />
            </View>

            <View style={[styles.infoCard, { backgroundColor: getColor() + '20' }]}>
              <Ionicons name="information-circle" size={20} color={getColor()} />
              <Text style={styles.infoText}>
                Note will be tagged with '{actionType}' automatically
              </Text>
            </View>
          </View>
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              Recording {recordingField}... Tap mic to stop
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
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  modeSection: {
    marginTop: 20,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 24,
    textAlign: 'center',
  },
  modeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#212529',
    marginTop: 16,
    marginBottom: 8,
  },
  modeCardDesc: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
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
  contentInput: {
    height: 200,
    textAlignVertical: 'top',
  },
  contactContainer: {
    gap: 12,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  contactButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#495057',
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
});
