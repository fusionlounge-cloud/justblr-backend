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
  reminder_type: string;
  scheduled_time: string;
  is_completed: boolean;
}

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updated_at: string;
}

type Item = (Reminder | Note) & { itemType: 'reminder' | 'note' };

export default function AllItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'reminders' | 'notes'>('all');

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

      const remindersWithType: Item[] = remindersRes.data.map((r: Reminder) => ({
        ...r,
        itemType: 'reminder' as const,
      }));

      const notesWithType: Item[] = notesRes.data.map((n: Note) => ({
        ...n,
        itemType: 'note' as const,
      }));

      const combined = [...remindersWithType, ...notesWithType].sort((a, b) => {
        const dateA = 'updated_at' in a ? new Date(a.updated_at) : new Date(a.scheduled_time);
        const dateB = 'updated_at' in b ? new Date(b.updated_at) : new Date(b.scheduled_time);
        return dateB.getTime() - dateA.getTime();
      });

      setItems(combined);
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

  const getTypeColor = (type: string) => {
    switch (type) {
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
      default:
        return '#667eea';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
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
      default:
        return 'flash';
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'reminders') return item.itemType === 'reminder';
    if (filter === 'notes') return item.itemType === 'note';
    return true;
  });

  const renderItem = ({ item }: { item: Item }) => {
    if (item.itemType === 'reminder') {
      const reminder = item as Reminder;
      return (
        <View style={[styles.card, { borderLeftColor: getTypeColor(reminder.reminder_type) }]}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBadge}>
              <Ionicons
                name={getTypeIcon(reminder.reminder_type) as any}
                size={20}
                color={getTypeColor(reminder.reminder_type)}
              />
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.typeRow}>
                <Text style={[styles.typeBadge, { color: getTypeColor(reminder.reminder_type) }]}>
                  {reminder.reminder_type.toUpperCase()}
                </Text>
                <Text style={styles.itemType}>Reminder</Text>
              </View>
              <Text style={styles.cardTitle}>{reminder.title}</Text>
              {reminder.contact_name && (
                <Text style={styles.cardSubtext}>
                  <Ionicons name="person" size={12} /> {reminder.contact_name}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.cardActions}>
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
    } else {
      const note = item as Note;
      const noteType = note.tags.find((t) =>
        ['meet', 'call', 'sms', 'whatsapp', 'deskwork'].includes(t)
      );
      return (
        <View style={[styles.card, { borderLeftColor: getTypeColor(noteType || 'note') }]}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBadge}>
              <Ionicons name="document-text" size={20} color={getTypeColor(noteType || 'note')} />
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.typeRow}>
                {noteType && (
                  <Text style={[styles.typeBadge, { color: getTypeColor(noteType) }]}>
                    {noteType.toUpperCase()}
                  </Text>
                )}
                <Text style={styles.itemType}>Note</Text>
              </View>
              <Text style={styles.cardTitle}>{note.title}</Text>
              <Text style={styles.cardContent} numberOfLines={2}>
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
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FF6B6B20' }]}
              onPress={() => deleteNote(note.id)}
            >
              <Ionicons name="trash" size={16} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Items</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'reminders' && styles.filterBtnActive]}
          onPress={() => setFilter('reminders')}
        >
          <Text style={[styles.filterText, filter === 'reminders' && styles.filterTextActive]}>
            Reminders
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'notes' && styles.filterBtnActive]}
          onPress={() => setFilter('notes')}
        >
          <Text style={[styles.filterText, filter === 'notes' && styles.filterTextActive]}>
            Notes
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="filing-outline" size={64} color="#adb5bd" />
          <Text style={styles.emptyText}>No items found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.itemType}-${item.id}`}
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
  placeholder: {
    width: 40,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    gap: 12,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#667eea',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  typeBadge: {
    fontSize: 10,
    fontWeight: '700',
  },
  itemType: {
    fontSize: 11,
    color: '#6c757d',
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 14,
    color: '#6c757d',
  },
  cardContent: {
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
  cardActions: {
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
    color: '#6c757d',
    marginTop: 16,
  },
});
