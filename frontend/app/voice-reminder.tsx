import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { Audio } from 'expo-av';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function VoiceReminderScreen() {
  const router = useRouter();
  const [reminderType, setReminderType] = useState<'meet' | 'call' | 'sms' | 'whatsapp'>('call');
  const [title, setTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduledTime, setScheduledTime] = useState<Date>(new Date(Date.now() + 3600000));
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const reminderTypes = [
    { type: 'call' as const, icon: 'call', label: 'Call', color: '#4ECDC4' },
    { type: 'meet' as const, icon: 'people', label: 'Meet', color: '#FF6B6B' },
    { type: 'sms' as const, icon: 'chatbubble', label: 'SMS', color: '#95E1D3' },
    { type: 'whatsapp' as const, icon: 'logo-whatsapp', label: 'WhatsApp', color: '#25D366' },
  ];

  const pickContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Contact access is required to pick a contact');
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      if (data.length > 0) {
        // For simplicity, picking first contact. In production, show a picker
        Alert.alert(
          'Pick Contact',
          'Contact picker will be shown here. For now, manually enter contact details.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Contact picker error:', error);
      Alert.alert('Error', 'Failed to access contacts');
    }
  };

  const startVoiceInput = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start voice recording');
    }
  };

  const stopVoiceInput = async () => {
    if (!recording) return;

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
          name: 'reminder.m4a',
        } as any);

        const response = await axios.post(`${BACKEND_URL}/api/voice/stt`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const transcribedText = response.data.transcribed_text;
        setTitle(transcribedText);
      }

      setRecording(null);
    } catch (error) {
      console.error('Failed to process voice:', error);
      Alert.alert('Error', 'Failed to process voice input');
    } finally {
      setIsProcessing(false);
    }
  };

  const createReminder = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please provide a reminder title');
      return;
    }

    try {
      // Create reminder in backend
      await axios.post(`${BACKEND_URL}/api/reminders`, {
        title,
        contact_name: contactName || undefined,
        contact_phone: contactPhone || undefined,
        reminder_type: reminderType,
        scheduled_time: scheduledTime.toISOString(),
        notes: notes || undefined,
      });

      // Note: Notifications disabled - expo-notifications was removed to fix UI blocking issues
      // TODO: Re-enable notifications with proper platform checks in future

      Alert.alert('Success', 'Reminder created successfully!', [
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
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Reminder</Text>
        <TouchableOpacity onPress={createReminder} style={styles.saveButton}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Reminder Type Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Reminder Type</Text>
          <View style={styles.typeGrid}>
            {reminderTypes.map((type) => (
              <TouchableOpacity
                key={type.type}
                style={[
                  styles.typeCard,
                  reminderType === type.type && {
                    backgroundColor: type.color + '20',
                    borderColor: type.color,
                  },
                ]}
                onPress={() => setReminderType(type.type)}
              >
                <Ionicons name={type.icon as any} size={28} color={type.color} />
                <Text style={styles.typeLabel}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Title with Voice Input */}
        <View style={styles.section}>
          <Text style={styles.label}>What to remind?</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="E.g., Call John about meeting"
              value={title}
              onChangeText={setTitle}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.voiceMicButton,
                isRecording && { backgroundColor: '#FF6B6B' },
              ]}
              onPress={isRecording ? stopVoiceInput : startVoiceInput}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name={isRecording ? 'stop' : 'mic'} size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Contact Info */}
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
              <Ionicons name="person-add" size={20} color="#667eea" />
              <Text style={styles.contactButtonText}>Pick from Contacts</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Add any additional details..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Time Info */}
        <View style={styles.infoCard}>
          <Ionicons name="time" size={20} color="#667eea" />
          <Text style={styles.infoText}>
            Reminder will trigger in 1 hour (Customize time coming soon)
          </Text>
        </View>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#667eea',
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
  typeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeCard: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  voiceMicButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
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
    borderColor: '#667eea',
    borderStyle: 'dashed',
  },
  contactButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#667eea20',
    borderRadius: 12,
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#495057',
  },
});
