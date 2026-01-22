import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function VoiceCommandScreen() {
  const router = useRouter();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [commandResult, setCommandResult] = useState<any>(null);
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    requestAudioPermissions();
  }, []);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const requestAudioPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone access is required for voice commands');
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  const startRecording = async () => {
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
      setTranscribedText('');
      setCommandResult(null);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        setIsProcessing(true);
        await processVoiceCommand(uri);
      }

      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to process recording');
    } finally {
      setIsProcessing(false);
    }
  };

  const processVoiceCommand = async (audioUri: string) => {
    try {
      // Create FormData for audio upload
      const formData = new FormData();
      formData.append('audio_file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'voice_command.m4a',
      } as any);

      // Step 1: Transcribe audio
      const transcribeResponse = await axios.post(
        `${BACKEND_URL}/api/voice/stt`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const transcribedText = transcribeResponse.data.transcribed_text;
      setTranscribedText(transcribedText);

      // Step 2: Process command
      const commandResponse = await axios.post(`${BACKEND_URL}/api/voice/command`, {
        command: transcribedText,
      });

      setCommandResult(commandResponse.data);

      // Step 3: Execute action based on command
      const { action, parameters } = commandResponse.data;

      if (action === 'open_app') {
        Alert.alert('Opening App', `Opening ${parameters.app_name}...`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else if (action === 'create_reminder') {
        Alert.alert('Create Reminder', 'Would you like to create this reminder?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes', onPress: () => router.push('/voice-reminder') },
        ]);
      } else if (action === 'create_note') {
        Alert.alert('Create Note', 'Would you like to create this note?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes', onPress: () => router.push('/voice-note') },
        ]);
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      Alert.alert('Error', 'Failed to process voice command. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Command</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Voice Visualizer */}
        <View style={styles.visualizerContainer}>
          <Animated.View
            style={[
              styles.recordButton,
              {
                transform: [{ scale: pulseAnim }],
                backgroundColor: isRecording ? '#FF6B6B' : '#667eea',
              },
            ]}
          >
            <TouchableOpacity
              onPress={isRecording ? stopRecording : startRecording}
              style={styles.recordButtonInner}
              disabled={isProcessing}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={60}
                color="#fff"
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Status Text */}
        <Text style={styles.statusText}>
          {isRecording
            ? 'Listening... Tap to stop'
            : isProcessing
            ? 'Processing your command...'
            : 'Tap to speak a command'}
        </Text>

        {/* Processing Indicator */}
        {isProcessing && <ActivityIndicator size="large" color="#667eea" />}

        {/* Transcribed Text */}
        {transcribedText !== '' && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>You said:</Text>
            <Text style={styles.resultText}>{transcribedText}</Text>
          </View>
        )}

        {/* Command Result */}
        {commandResult && (
          <View style={[styles.resultCard, { borderLeftColor: '#43e97b' }]}>
            <Text style={styles.resultLabel}>Action:</Text>
            <Text style={styles.resultText}>{commandResult.message}</Text>
          </View>
        )}

        {/* Voice Commands Help */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Voice Commands:</Text>
          <Text style={styles.helpText}>• "Open [App Name]"</Text>
          <Text style={styles.helpText}>• "Create a reminder to [action]"</Text>
          <Text style={styles.helpText}>• "Take a note"</Text>
          <Text style={styles.helpText}>• "Remind me to call [name]"</Text>
        </View>
      </View>
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  visualizerContainer: {
    marginTop: 40,
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  recordButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 24,
    textAlign: 'center',
  },
  resultCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6c757d',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 16,
    color: '#212529',
    lineHeight: 24,
  },
  helpCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 'auto',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 6,
    lineHeight: 20,
  },
});
