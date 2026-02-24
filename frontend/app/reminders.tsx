import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Reminder {
  id: string;
  title: string;
  contact_name?: string;
  contact_phone?: string;
  reminder_type: string;
  scheduled_time: string;
  notes?: string;
  is_completed: boolean;
}

export default function RemindersScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    fetchReminders();
  }, [showCompleted]);

  const fetchReminders = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/reminders`, {
        params: { completed: showCompleted ? true : undefined },
      });
      setReminders(response.data);
    } catch (error) {
      console.error('Failed to fetch reminders:', error);
      Alert.alert('Error', 'Failed to load reminders');
    } finally {
      setIsLoading(false);
    }
  };

  const completeReminder = async (id: string) => {
    try {
      await axios.put(`${BACKEND_URL}/api/reminders/${id}/complete`);
      fetchReminders();
    } catch (error) {
      console.error('Failed to complete reminder:', error);
      Alert.alert('Error', 'Failed to complete reminder');
    }
  };

  const deleteReminder = async (id: string) => {
    Alert.alert('Delete Reminder', 'Are you sure you want to delete this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${BACKEND_URL}/api/reminders/${id}`);
            fetchReminders();
          } catch (error) {
            console.error('Failed to delete reminder:', error);
            Alert.alert('Error', 'Failed to delete reminder');
          }
        },
      },
    ]);
  };

  const getReminderIcon = (type: string) => {
    switch (type) {
      case 'call':
        return 'call';
      case 'meet':
        return 'people';
      case 'sms':
        return 'chatbubble';
      case 'whatsapp':
        return 'logo-whatsapp';
      default:
        return 'alarm';
    }
  };

  const getReminderColor = (type: string) => {
    switch (type) {
      case 'call':
        return '#4ECDC4';
      case 'meet':
        return '#FF6B6B';
      case 'sms':
        return '#95E1D3';
      case 'whatsapp':
        return '#25D366';
      default:
        return '#667eea';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
      return `in ${diffDays} days`;
    } else if (diffHours > 1) {
      return `in ${diffHours} hours`;
    } else if (diffMs > 0) {
      return 'soon';
    } else {
      return 'overdue';
    }
  };

  const renderReminder = ({ item }: { item: Reminder }) => (
    <View style={[styles.reminderCard, { borderLeftColor: getReminderColor(item.reminder_type) }]}>
      <View style={styles.reminderHeader}>
        <View style={styles.reminderIcon}>
          <Ionicons
            name={getReminderIcon(item.reminder_type) as any}
            size={24}
            color={getReminderColor(item.reminder_type)}
          />
        </View>
        <View style={styles.reminderInfo}>
          <Text style={styles.reminderTitle}>{item.title}</Text>
          {item.contact_name && (
            <Text style={styles.reminderContact}>
              <Ionicons name="person" size={12} /> {item.contact_name}
              {item.contact_phone && ` • ${item.contact_phone}`}
            </Text>
          )}
          <Text style={styles.reminderTime}>
            <Ionicons name="time" size={12} /> {formatDate(item.scheduled_time)}
          </Text>
        </View>
      </View>

      {item.notes && <Text style={styles.reminderNotes}>{item.notes}</Text>}

      <View style={styles.reminderActions}>
        {!item.is_completed && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#43e97b20' }]}
            onPress={() => completeReminder(item.id)}
          >
            <Ionicons name="checkmark-circle" size={20} color="#43e97b" />
            <Text style={[styles.actionButtonText, { color: '#43e97b' }]}>Complete</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#FF6B6B20' }]}
          onPress={() => deleteReminder(item.id)}
        >
          <Ionicons name="trash" size={20} color="#FF6B6B" />
          <Text style={[styles.actionButtonText, { color: '#FF6B6B' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reminders</Text>
        <TouchableOpacity onPress={() => router.push('/voice-reminder')} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter Toggle */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, !showCompleted && styles.filterButtonActive]}
          onPress={() => setShowCompleted(false)}
        >
          <Text style={[styles.filterText, !showCompleted && styles.filterTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, showCompleted && styles.filterButtonActive]}
          onPress={() => setShowCompleted(true)}
        >
          <Text style={[styles.filterText, showCompleted && styles.filterTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reminders List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : reminders.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alarm-outline" size={64} color="#adb5bd" />
          <Text style={styles.emptyText}>
            {showCompleted ? 'No completed reminders' : 'No active reminders'}
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/voice-reminder')}
          >
            <Text style={styles.createButtonText}>Create Reminder</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reminders}
          renderItem={renderReminder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    gap: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#667eea',
  },
  filterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  reminderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  reminderHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  reminderContact: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  reminderTime: {
    fontSize: 14,
    color: '#6c757d',
  },
  reminderNotes: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 12,
    paddingLeft: 60,
  },
  reminderActions: {
    flexDirection: 'row',
    gap: 12,
    paddingLeft: 60,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#6c757d',
    marginTop: 16,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
