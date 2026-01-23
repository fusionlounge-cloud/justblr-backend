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

export default function ActionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const actionType = params.type as string;
  const actionName = params.name as string;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
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
      Alert.alert('Error', 'Failed to start voice recording. Please check microphone permissions.');
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
    } catch (error: any) {
      console.error('Failed to process voice:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to process voice input';
      Alert.alert('Voice Error', errorMsg);
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

      Alert.alert('Success', `${actionName} reminder created successfully!`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to create reminder:', error);
      Alert.alert('Error', 'Failed to create reminder');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name=\"arrow-back\" size={24} color=\"#212529\" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name={getIcon() as any} size={24} color={getColor()} />
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
                <ActivityIndicator size=\"small\" color=\"#fff\" />
              ) : (
                <Ionicons
                  name={isRecording && recordingField === 'title' ? 'stop' : 'mic'}
                  size={24}
                  color=\"#fff\"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {actionType !== 'deskwork' && actionType !== 'keepnotes' && (
          <View style={styles.section}>
            <Text style={styles.label}>Contact (Optional)</Text>
            <View style={styles.contactContainer}>
              <TextInput
                style={styles.input}
                placeholder=\"Contact name\"
                value={contactName}
                onChangeText={setContactName}
              />
              <TextInput
                style={styles.input}
                placeholder=\"Phone number\"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType=\"phone-pad\"
              />
              <TouchableOpacity style={styles.contactButton} onPress={pickContact}>
                <Ionicons name=\"person-add\" size={20} color={getColor()} />
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
              placeholder=\"Add any additional details...\"
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
                <ActivityIndicator size=\"small\" color=\"#fff\" />
              ) : (
                <Ionicons
                  name={isRecording && recordingField === 'content' ? 'stop' : 'mic'}
                  size={24}
                  color=\"#fff\"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: getColor() + '20' }]}>
          <Ionicons name=\"time\" size={20} color={getColor()} />
          <Text style={styles.infoText}>
            Reminder will trigger in 1 hour
          </Text>
        </View>

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
