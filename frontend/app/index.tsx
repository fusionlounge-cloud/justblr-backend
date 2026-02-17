import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const CATEGORIES = [
  { type: 'meet', name: 'Meet', icon: 'people', color: '#FF6B6B' },
  { type: 'call', name: 'Call', icon: 'call', color: '#4ECDC4' },
  { type: 'sms', name: 'SMS', icon: 'chatbubble', color: '#95E1D3' },
  { type: 'whatsapp', name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
  { type: 'deskwork', name: 'Deskwork', icon: 'laptop', color: '#A78BFA' },
  { type: 'keepnotes', name: 'Notes', icon: 'create', color: '#FBBF24' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    fetchReminders();
  }, []);

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
      const urlToTry = Platform.OS === 'ios' ? keepUrls.ios : 
        Platform.OS === 'android' ? `intent://#Intent;package=${keepUrls.android};end` : keepUrls.web;
      const canOpen = await Linking.canOpenURL(urlToTry);
      if (canOpen) {
        await Linking.openURL(urlToTry);
      } else {
        await Linking.openURL(keepUrls.web);
      }
    } catch (error) {
      try {
        await Linking.openURL(keepUrls.web);
      } catch (webError) {
        Alert.alert('Google Keep', 'Could not open Google Keep');
      }
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
    const appUrls = {
      instagram: {
        ios: 'instagram://',
        android: 'com.instagram.android',
        web: 'https://instagram.com',
      },
      facebook: {
        ios: 'fb://',
        android: 'com.facebook.katana',
        web: 'https://facebook.com',
      },
      linkedin: {
        ios: 'linkedin://',
        android: 'com.linkedin.android',
        web: 'https://linkedin.com',
      },
      whatsapp: {
        ios: 'whatsapp-business://',
        android: 'com.whatsapp.w4b',
        web: 'https://business.whatsapp.com',
      },
      wechat: {
        ios: 'weixin://',
        android: 'com.tencent.mm',
        web: 'https://wechat.com',
      },
      alibaba: {
        ios: 'alibabaapp://',
        android: 'com.alibaba.intl.android.apps.poseidon',
        web: 'https://alibaba.com',
      },
    };

    const urls = appUrls[appName];
    if (!urls) return;

    try {
      const urlToTry = Platform.OS === 'ios' ? urls.ios : 
        Platform.OS === 'android' ? `intent://#Intent;package=${urls.android};end` : urls.web;
      const canOpen = await Linking.canOpenURL(urlToTry);
      if (canOpen) {
        await Linking.openURL(urlToTry);
      } else {
        await Linking.openURL(urls.web);
      }
    } catch (error) {
      try {
        await Linking.openURL(urls.web);
      } catch (webError) {
        Alert.alert('Error', `Could not open ${appName}`);
      }
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

  // Detail view for selected category
  if (selectedCategory) {
    const categoryReminders = getCategoryReminders(selectedCategory.type);
    const actionLabel = getActionLabel(selectedCategory.type);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#212529" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name={selectedCategory.icon} size={22} color={selectedCategory.color} />
            <Text style={styles.headerTitle}>{selectedCategory.name}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => handleActionPress(selectedCategory.type, selectedCategory.name)}
            style={[styles.addBtn, { backgroundColor: selectedCategory.color }]}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.detailContent}>
          {categoryReminders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name={selectedCategory.icon} size={48} color="#adb5bd" />
              <Text style={styles.emptyText}>No {selectedCategory.name} reminders</Text>
            </View>
          ) : (
            categoryReminders.map((reminder) => (
              <View key={reminder.id} style={[styles.reminderCard, { borderLeftColor: selectedCategory.color }]}>
                <Text style={styles.reminderTitle}>{reminder.title}</Text>
                {reminder.contact_name && (
                  <Text style={styles.reminderDetail}>{reminder.contact_name} • {reminder.contact_phone}</Text>
                )}
                {reminder.notes && <Text style={styles.reminderNotes}>{reminder.notes}</Text>}
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
              </View>
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

        {/* Quick Actions - Smaller Icons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {CATEGORIES.map((item) => (
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

        {/* View All Reminders - Small Scrollable Icons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>View All Reminders</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reminderScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.type}
                style={[styles.reminderCategory, { borderColor: cat.color }]}
                onPress={() => setSelectedCategory(cat)}
              >
                <View style={[styles.reminderCategoryIcon, { backgroundColor: cat.color }]}>
                  <Ionicons name={cat.icon} size={18} color="#fff" />
                </View>
                <Text style={styles.reminderCategoryName}>{cat.name}</Text>
                <Text style={styles.reminderCategoryCount}>{getCategoryCount(cat.type)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
            Also available on desktop at this URL
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
  // Quick Actions - Smaller
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionItem: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickActionText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
  },
  // View All Reminders - Horizontal Scroll
  reminderScroll: {
    marginLeft: -4,
  },
  reminderCategory: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
  },
  reminderCategoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  reminderCategoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212529',
  },
  reminderCategoryCount: {
    fontSize: 11,
    color: '#6c757d',
  },
  // Social Media - Horizontal Scroll
  socialScroll: {
    marginLeft: -4,
  },
  socialItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  socialIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  socialText: {
    fontSize: 11,
    color: '#495057',
    fontWeight: '500',
  },
  // Desktop Info
  desktopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  desktopText: {
    fontSize: 13,
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
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
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
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  reminderDetail: {
    fontSize: 13,
    color: '#6c757d',
  },
  reminderNotes: {
    fontSize: 13,
    color: '#495057',
    marginTop: 6,
    fontStyle: 'italic',
  },
  reminderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
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
