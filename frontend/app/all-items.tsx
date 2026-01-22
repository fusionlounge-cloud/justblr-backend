import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
  reminder_type: string;
  scheduled_time: string;
  is_completed: boolean;
  notes?: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updated_at: string;
}

const CATEGORIES = [
  { type: 'meet', name: 'Meet', icon: 'people', color: '#FF6B6B' },
  { type: 'call', name: 'Call', icon: 'call', color: '#4ECDC4' },
  { type: 'sms', name: 'SMS', icon: 'chatbubble', color: '#95E1D3' },
  { type: 'whatsapp', name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  { type: 'deskwork', name: 'Deskwork', icon: 'laptop', color: '#A78BFA' },
  { type: 'keepnotes', name: 'Keep Notes', icon: 'create', color: '#FFC107' },
];

export default function AllItemsScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAllItems();
  }, []);

  const fetchAllItems = async () => {
    try {
      setIsLoading(true);
      const [remindersRes, notesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/reminders`),
        axios.get(`${BACKEND_URL}/api/notes`),
      ]);

      setReminders(remindersRes.data);
      setNotes(notesRes.data);
    } catch (error) {
      console.error('Failed to fetch items:', error);
      Alert.alert('Error', 'Failed to load items');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteReminder = async (id: string) => {
    Alert.alert('Delete Reminder', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${BACKEND_URL}/api/reminders/${id}`);
            fetchAllItems();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete reminder');
          }
        },
      },
    ]);
  };

  const deleteNote = async (id: string) => {
    Alert.alert('Delete Note', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${BACKEND_URL}/api/notes/${id}`);
            fetchAllItems();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete note');
          }
        },
      },
    ]);
  };

  const completeReminder = async (id: string) => {
    try {
      await axios.put(`${BACKEND_URL}/api/reminders/${id}/complete`);
      fetchAllItems();
    } catch (error) {
      Alert.alert('Error', 'Failed to complete reminder');
    }
  };

  const getCategoryItems = (type: string) => {
    const categoryReminders = reminders.filter((r) => r.reminder_type === type);
    const categoryNotes = notes.filter((n) => n.tags.includes(type));
    return { reminders: categoryReminders, notes: categoryNotes };
  };

  const renderReminder = (reminder: Reminder, color: string) => (
    <View key={reminder.id} style={[styles.itemCard, { borderLeftColor: color }]}>
      <View style={styles.itemHeader}>
        <Ionicons name="alarm" size={20} color={color} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{reminder.title}</Text>
          {reminder.contact_name && (
            <Text style={styles.itemSubtext}>
              <Ionicons name="person" size={12} /> {reminder.contact_name}
            </Text>
          )}
          {reminder.notes && (
            <Text style={styles.itemNotes} numberOfLines={2}>
              {reminder.notes}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.itemActions}>
        {!reminder.is_completed && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#43e97b20' }]}
            onPress={() => completeReminder(reminder.id)}
          >
            <Ionicons name="checkmark" size={16} color="#43e97b" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#FF6B6B20' }]}
          onPress={() => deleteReminder(reminder.id)}
        >
          <Ionicons name="trash" size={16} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNote = (note: Note, color: string) => (
    <View key={note.id} style={[styles.itemCard, { borderLeftColor: color }]}>
      <View style={styles.itemHeader}>
        <Ionicons name="document-text" size={20} color={color} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{note.title}</Text>
          <Text style={styles.itemContent} numberOfLines={2}>
            {note.content}
          </Text>
          {note.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {note.tags.slice(0, 3).map((tag, idx) => (
                <Text key={idx} style={styles.tag}>
                  #{tag}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#FF6B6B20' }]}
          onPress={() => deleteNote(note.id)}
        >
          <Ionicons name="trash" size={16} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCategory = (category: typeof CATEGORIES[0]) => {
    const { reminders: categoryReminders, notes: categoryNotes } = getCategoryItems(category.type);
    const totalItems = categoryReminders.length + categoryNotes.length;

    if (totalItems === 0) return null;

    return (
      <View key={category.type} style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
            <Ionicons name={category.icon as any} size={24} color={category.color} />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={[styles.categoryTitle, { color: category.color }]}>{category.name}</Text>
            <Text style={styles.categoryCount}>
              {totalItems} item{totalItems !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {categoryReminders.map((reminder) => renderReminder(reminder, category.color))}
        {categoryNotes.map((note) => renderNote(note, category.color))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Items</Text>
        <TouchableOpacity onPress={fetchAllItems} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#667eea" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : reminders.length === 0 && notes.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="filing-outline" size={64} color="#adb5bd" />
          <Text style={styles.emptyText}>No items yet</Text>
          <Text style={styles.emptySubtext}>Create reminders or notes to see them here</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {CATEGORIES.map(renderCategory)}
          <View style={styles.bottomPadding} />
        </ScrollView>
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
  refreshButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  scrollView: {
    flex: 1,
  },
  categorySection: {
    padding: 16,
    paddingBottom: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 14,
    color: '#6c757d',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  itemSubtext: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  itemNotes: {
    fontSize: 14,
    color: '#495057',
    marginTop: 4,
  },
  itemContent: {
    fontSize: 14,
    color: '#495057',
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  tag: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6c757d',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#adb5bd',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 32,
  },
});
