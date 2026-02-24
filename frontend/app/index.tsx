import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import { Audio } from 'expo-av';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const JUSTBLR_LOGO = 'https://static.prod-images.emergentagent.com/jobs/4fe0c0dc-be90-49c7-81d6-fef8f0af4f3b/images/789c5274ebf6b7813a10d0e107288f0266dcb1e344fe23eb9d1fa49575b9d93f.png';

// Quick Actions - all 6
const QUICK_ACTIONS = [
  { type: 'meet', name: 'Meet', icon: 'people', color: '#FF6B6B' },
  { type: 'call', name: 'Call', icon: 'call', color: '#4ECDC4' },
  { type: 'sms', name: 'SMS', icon: 'chatbubble', color: '#95E1D3' },
  { type: 'whatsapp', name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  { type: 'deskwork', name: 'Deskwork', icon: 'laptop', color: '#A78BFA' },
  { type: 'keepnotes', name: 'Notes', icon: 'create', color: '#FBBF24' },
];

// Reminder categories - 5 (no Notes)
const REMINDER_CATEGORIES = [
  { type: 'meet', name: 'Meet', icon: 'people', color: '#FF6B6B' },
  { type: 'call', name: 'Call', icon: 'call', color: '#4ECDC4' },
  { type: 'sms', name: 'SMS', icon: 'chatbubble', color: '#95E1D3' },
  { type: 'whatsapp', name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  { type: 'deskwork', name: 'Deskwork', icon: 'laptop', color: '#A78BFA' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);

  // Refresh reminders when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchReminders();
    }, [])
  );

  const fetchReminders = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/reminders`);
      setReminders(response.data || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openGoogleKeep = async () => {
    const keepUrls = {
      ios: 'comgooglekeep://',
      android: 'com.google.android.keep',
      web: 'https://keep.google.com',
    };
    try {
      if (Platform.OS === 'web') {
        await Linking.openURL(keepUrls.web);
      } else {
        const urlToTry = Platform.OS === 'ios' ? keepUrls.ios : `intent://#Intent;package=${keepUrls.android};end`;
        const canOpen = await Linking.canOpenURL(urlToTry);
        if (canOpen) {
          await Linking.openURL(urlToTry);
        } else {
          await Linking.openURL(keepUrls.web);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open Google Keep');
    }
  };

  const handleActionPress = (type, name) => {
    if (type === 'keepnotes') {
      openGoogleKeep();
    } else {
      router.push(`/action?type=${type}&name=${name}`);
    }
  };

  const getCategoryCount = (type) => {
    return reminders.filter(r => r.reminder_type === type).length;
  };

  const getCategoryReminders = (type) => {
    return reminders.filter(r => r.reminder_type === type);
  };

  const deleteReminder = async (id) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/reminders/${id}`);
      fetchReminders();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete');
    }
  };

  const bulkDelete = async () => {
    if (selectedItems.length === 0) return;
    
    Alert.alert(
      'Delete Selected',
      `Delete ${selectedItems.length} reminder(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(selectedItems.map(id => 
                axios.delete(`${BACKEND_URL}/api/reminders/${id}`)
              ));
              setSelectedItems([]);
              setBulkSelectMode(false);
              fetchReminders();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete some items');
            }
          }
        }
      ]
    );
  };

  const toggleItemSelection = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const selectAllInCategory = () => {
    if (!selectedCategory) return;
    const categoryReminders = getCategoryReminders(selectedCategory.type);
    const allIds = categoryReminders.map(r => r.id);
    setSelectedItems(allIds);
  };

  const executeAction = async (reminder) => {
    const phone = reminder.contact_phone?.replace(/[^\d+]/g, '') || '';
    const message = reminder.notes || '';
    
    try {
      if (reminder.reminder_type === 'call') {
        if (phone) {
          await Linking.openURL(`tel:${phone}`);
        } else {
          Alert.alert('No Phone', 'No phone number attached');
        }
      } else if (reminder.reminder_type === 'sms') {
        const url = phone 
          ? `sms:${phone}${message ? `?body=${encodeURIComponent(message)}` : ''}`
          : `sms:${message ? `?body=${encodeURIComponent(message)}` : ''}`;
        await Linking.openURL(url);
      } else if (reminder.reminder_type === 'whatsapp') {
        const url = phone 
          ? `whatsapp-business://send?phone=${phone}${message ? `&text=${encodeURIComponent(message)}` : ''}`
          : `whatsapp-business://send${message ? `?text=${encodeURIComponent(message)}` : ''}`;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          const fallback = phone 
            ? `whatsapp://send?phone=${phone}${message ? `&text=${encodeURIComponent(message)}` : ''}`
            : `whatsapp://send${message ? `?text=${encodeURIComponent(message)}` : ''}`;
          await Linking.openURL(fallback);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open app');
    }
  };

  const openSocialApp = async (appName) => {
    try {
      if (appName === 'whatsapp') {
        // Use the same URL scheme that works in reminders
        if (Platform.OS === 'web') {
          await Linking.openURL('https://business.whatsapp.com');
        } else {
          // Try WhatsApp Business first (same as reminders)
          const waBusinessUrl = 'whatsapp-business://';
          const canOpenBusiness = await Linking.canOpenURL(waBusinessUrl);
          if (canOpenBusiness) {
            await Linking.openURL(waBusinessUrl);
          } else {
            // Fall back to regular WhatsApp
            const waUrl = 'whatsapp://';
            const canOpenWa = await Linking.canOpenURL(waUrl);
            if (canOpenWa) {
              await Linking.openURL(waUrl);
            } else {
              await Linking.openURL('https://business.whatsapp.com');
            }
          }
        }
        return;
      }

      const appUrls = {
        instagram: { ios: 'instagram://', android: 'com.instagram.android', web: 'https://instagram.com' },
        facebook: { ios: 'fb://', android: 'com.facebook.katana', web: 'https://facebook.com' },
        linkedin: { ios: 'linkedin://', android: 'com.linkedin.android', web: 'https://linkedin.com' },
        wechat: { ios: 'weixin://', android: 'com.tencent.mm', web: 'https://wechat.com' },
        alibaba: { ios: 'alibabaapp://', android: 'com.alibaba.intl.android.apps.poseidon', web: 'https://alibaba.com' },
      };

      const urls = appUrls[appName];
      if (!urls) return;

      if (Platform.OS === 'web') {
        await Linking.openURL(urls.web);
      } else if (Platform.OS === 'ios') {
        const canOpen = await Linking.canOpenURL(urls.ios);
        if (canOpen) {
          await Linking.openURL(urls.ios);
        } else {
          await Linking.openURL(urls.web);
        }
      } else {
        const urlToTry = `intent://#Intent;package=${urls.android};end`;
        const canOpen = await Linking.canOpenURL(urlToTry);
        if (canOpen) {
          await Linking.openURL(urlToTry);
        } else {
          await Linking.openURL(urls.web);
        }
      }
    } catch (error) {
      Alert.alert('Error', `Could not open ${appName}`);
    }
  };

  const socialApps = [
    { name: 'Instagram', icon: 'logo-instagram', color: '#E4405F', key: 'instagram' },
    { name: 'Facebook', icon: 'logo-facebook', color: '#1877F2', key: 'facebook' },
    { name: 'LinkedIn', icon: 'logo-linkedin', color: '#0A66C2', key: 'linkedin' },
    { name: 'WA Business', icon: 'logo-whatsapp', color: '#25D366', key: 'whatsapp' },
    { name: 'WeChat', icon: 'chatbubbles', color: '#09B83E', key: 'wechat' },
    { name: 'Alibaba', icon: 'storefront', color: '#FF6A00', key: 'alibaba' },
  ];

  const getActionLabel = (type) => {
    if (type === 'call') return 'CALL';
    if (type === 'sms') return 'SMS';
    if (type === 'whatsapp') return 'WA';
    return null;
  };

  // Detail view for selected category with bulk delete
  if (selectedCategory) {
    const categoryReminders = getCategoryReminders(selectedCategory.type);
    const actionLabel = getActionLabel(selectedCategory.type);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => {
            setSelectedCategory(null);
            setBulkSelectMode(false);
            setSelectedItems([]);
          }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#212529" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name={selectedCategory.icon} size={22} color={selectedCategory.color} />
            <Text style={styles.headerTitle}>{selectedCategory.name}</Text>
            <Text style={styles.headerCount}>({categoryReminders.length})</Text>
          </View>
          <TouchableOpacity 
            onPress={() => handleActionPress(selectedCategory.type, selectedCategory.name)}
            style={[styles.addBtn, { backgroundColor: selectedCategory.color }]}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bulk Actions Bar */}
        {categoryReminders.length > 0 && (
          <View style={styles.bulkBar}>
            <TouchableOpacity 
              style={styles.bulkToggle}
              onPress={() => {
                setBulkSelectMode(!bulkSelectMode);
                setSelectedItems([]);
              }}
            >
              <Ionicons name={bulkSelectMode ? "checkbox" : "checkbox-outline"} size={20} color="#667eea" />
              <Text style={styles.bulkToggleText}>{bulkSelectMode ? 'Cancel' : 'Select'}</Text>
            </TouchableOpacity>
            
            {bulkSelectMode && (
              <>
                <TouchableOpacity style={styles.bulkAction} onPress={selectAllInCategory}>
                  <Text style={styles.bulkActionText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.bulkAction, styles.bulkDelete, selectedItems.length === 0 && styles.disabled]}
                  onPress={bulkDelete}
                  disabled={selectedItems.length === 0}
                >
                  <Ionicons name="trash" size={16} color="#fff" />
                  <Text style={styles.bulkDeleteText}>Delete ({selectedItems.length})</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <ScrollView style={styles.detailContent}>
          {categoryReminders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name={selectedCategory.icon} size={48} color="#adb5bd" />
              <Text style={styles.emptyText}>No {selectedCategory.name} reminders</Text>
            </View>
          ) : (
            categoryReminders.map((reminder) => (
              <TouchableOpacity 
                key={reminder.id} 
                style={[
                  styles.reminderCard, 
                  { borderLeftColor: selectedCategory.color },
                  bulkSelectMode && selectedItems.includes(reminder.id) && styles.selectedCard
                ]}
                onPress={() => bulkSelectMode && toggleItemSelection(reminder.id)}
                activeOpacity={bulkSelectMode ? 0.7 : 1}
              >
                {bulkSelectMode && (
                  <View style={styles.checkbox}>
                    <Ionicons 
                      name={selectedItems.includes(reminder.id) ? "checkbox" : "square-outline"} 
                      size={22} 
                      color={selectedItems.includes(reminder.id) ? "#667eea" : "#adb5bd"} 
                    />
                  </View>
                )}
                <View style={styles.reminderContent}>
                  <Text style={styles.reminderTitle}>{reminder.title}</Text>
                  {reminder.contact_name && (
                    <Text style={styles.reminderDetail}>{reminder.contact_name}</Text>
                  )}
                  {reminder.contact_phone && (
                    <Text style={styles.reminderPhone}>{reminder.contact_phone}</Text>
                  )}
                  {reminder.notes && <Text style={styles.reminderNotes}>{reminder.notes}</Text>}
                  
                  {!bulkSelectMode && (
                    <View style={styles.reminderActions}>
                      {actionLabel && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: selectedCategory.color }]}
                          onPress={() => executeAction(reminder)}
                        >
                          <Text style={styles.actionBtnText}>{actionLabel}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => deleteReminder(reminder.id)}>
                        <Ionicons name="trash" size={18} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main Dashboard
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Voice Assistant</Text>
            <Text style={styles.subtitle}>Your Personal Helper</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#fff" />
          </View>
        </View>

        {/* Quick Actions - 6 icons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((item) => (
              <TouchableOpacity
                key={item.type}
                style={styles.quickActionItem}
                onPress={() => handleActionPress(item.type, item.name)}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={styles.quickActionText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* View All Reminders - 5 icons grid (no Notes) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>View All Reminders</Text>
          <View style={styles.reminderGrid}>
            {REMINDER_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.type}
                style={[styles.reminderGridItem, { borderColor: cat.color }]}
                onPress={() => setSelectedCategory(cat)}
              >
                <View style={[styles.reminderGridIcon, { backgroundColor: cat.color }]}>
                  <Ionicons name={cat.icon} size={18} color="#fff" />
                </View>
                <Text style={styles.reminderGridName}>{cat.name}</Text>
                <Text style={styles.reminderGridCount}>{getCategoryCount(cat.type)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Social Media Hub - Scrollable */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Media Hub</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.socialScroll}>
            {socialApps.map((app, index) => (
              <TouchableOpacity
                key={index}
                style={styles.socialItem}
                onPress={() => openSocialApp(app.key)}
              >
                <View style={[styles.socialIcon, { backgroundColor: app.color }]}>
                  <Ionicons name={app.icon} size={24} color="#fff" />
                </View>
                <Text style={styles.socialText}>{app.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Desktop Info */}
        <View style={styles.desktopInfo}>
          <Ionicons name="desktop" size={20} color="#6c757d" />
          <Text style={styles.desktopText}>
            Desktop: {Platform.OS === 'web' ? window.location.href : 'Open in browser'}
          </Text>
        </View>

        <View style={{ height: 40 }} />
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
  },
  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionItem: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  quickActionText: {
    fontSize: 11,
    color: '#495057',
    fontWeight: '500',
  },
  // Reminder Grid - 5 icons
  reminderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reminderGridItem: {
    width: '18%',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
  },
  reminderGridIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  reminderGridName: {
    fontSize: 9,
    fontWeight: '600',
    color: '#212529',
  },
  reminderGridCount: {
    fontSize: 10,
    color: '#6c757d',
    fontWeight: '700',
  },
  // Social Media Scroll
  socialScroll: {
    marginLeft: -4,
  },
  socialItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  socialIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  socialText: {
    fontSize: 10,
    color: '#495057',
    fontWeight: '500',
  },
  // Desktop Info
  desktopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  desktopText: {
    fontSize: 11,
    color: '#6c757d',
  },
  // Detail View
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  headerCount: {
    fontSize: 14,
    color: '#6c757d',
  },
  backButton: {
    padding: 4,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Bulk Actions
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 12,
  },
  bulkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulkToggleText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '500',
  },
  bulkAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#e9ecef',
  },
  bulkActionText: {
    fontSize: 12,
    color: '#495057',
  },
  bulkDelete: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulkDeleteText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  // Detail Content
  detailContent: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#6c757d',
    marginTop: 12,
  },
  reminderCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  selectedCard: {
    backgroundColor: '#667eea10',
  },
  checkbox: {
    marginRight: 10,
    marginTop: 2,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
  },
  reminderDetail: {
    fontSize: 13,
    color: '#495057',
    marginTop: 2,
  },
  reminderPhone: {
    fontSize: 12,
    color: '#667eea',
    marginTop: 2,
  },
  reminderNotes: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
    fontStyle: 'italic',
  },
  reminderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
});
