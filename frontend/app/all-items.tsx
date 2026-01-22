import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const SCREEN_WIDTH = Dimensions.get('window').width;
const CATEGORY_WIDTH = SCREEN_WIDTH * 0.85; // 85% of screen width

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
        <Ionicons name="alarm" size={18} color={color} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {reminder.title}
          </Text>
          {reminder.contact_name && (
            <Text style={styles.itemSubtext} numberOfLines={1}>
              <Ionicons name="person" size={11} /> {reminder.contact_name}
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
            <Ionicons name="checkmark" size={14} color="#43e97b" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#FF6B6B20' }]}
          onPress={() => deleteReminder(reminder.id)}
        >
          <Ionicons name="trash" size={14} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNote = (note: Note, color: string) => (
    <View key={note.id} style={[styles.itemCard, { borderLeftColor: color }]}>
      <View style={styles.itemHeader}>
        <Ionicons name="document-text" size={18} color={color} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {note.title}
          </Text>
          <Text style={styles.itemContent} numberOfLines={2}>
            {note.content}
          </Text>
          {note.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {note.tags.slice(0, 2).map((tag, idx) => (
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
          <Ionicons name="trash" size={14} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCategory = (category: typeof CATEGORIES[0]) => {
    const { reminders: categoryReminders, notes: categoryNotes } = getCategoryItems(category.type);
    const totalItems = categoryReminders.length + categoryNotes.length;

    return (
      <View key={category.type} style={styles.categoryColumn}>
        {/* Category Header */}
        <View style={[styles.categoryHeader, { backgroundColor: category.color }]}>
          <Ionicons name={category.icon as any} size={28} color="#fff" />
          <Text style={styles.categoryTitle}>{category.name}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryCount}>{totalItems}</Text>
          </View>
        </View>

        {/* Items List */}
        <ScrollView
          style={styles.itemsList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.itemsContent}
        >
          {totalItems === 0 ? (
            <View style={styles.emptyCategory}>
              <Ionicons name="folder-open-outline" size={40} color="#adb5bd" />
              <Text style={styles.emptyText}>No items</Text>
            </View>
          ) : (
            <>
              {categoryReminders.map((reminder) => renderReminder(reminder, category.color))}
              {categoryNotes.map((note) => renderNote(note, category.color))}
            </>
          )}
        </ScrollView>
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

      {/* Instruction */}
      <View style={styles.instructionBar}>
        <Ionicons name="arrow-forward" size={16} color="#6c757d" />
        <Text style={styles.instructionText}>Swipe left/right to see all categories</Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : reminders.length === 0 && notes.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="filing-outline" size={64} color="#adb5bd" />
          <Text style={styles.emptyMainText}>No items yet</Text>
          <Text style={styles.emptySubtext}>Create reminders or notes to see them here</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
          snapToInterval={CATEGORY_WIDTH}
          decelerationRate="fast"
        >
          {CATEGORIES.map(renderCategory)}
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
  instructionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 8,
  },
  instructionText: {
    fontSize: 13,
    color: '#6c757d',
    fontWeight: '500',
  },
  horizontalScroll: {
    flex: 1,
  },
  categoryColumn: {
    width: CATEGORY_WIDTH,
    marginHorizontal: (SCREEN_WIDTH - CATEGORY_WIDTH) / 2,
  },
  categoryHeader: {
    padding: 20,
    alignItems: 'center',
    borderRadius: 16,
    margin: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  itemsList: {
    flex: 1,
  },
  itemsContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
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
    marginLeft: 10,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 3,
  },
  itemSubtext: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 3,
  },
  itemNotes: {
    fontSize: 13,
    color: '#495057',
    marginTop: 3,
  },
  itemContent: {
    fontSize: 13,
    color: '#495057',
    marginTop: 3,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 5,
  },
  tag: {
    fontSize: 11,
    color: '#667eea',
    fontWeight: '600',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCategory: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyMainText: {
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
});
