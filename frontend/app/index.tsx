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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Platform-specific notification import
let Notifications: any = null;
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
  // Configure notification handler (only on native)
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export default function DashboardScreen() {
  const router = useRouter();
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      requestNotificationPermissions();
    }
  }, []);

  const requestNotificationPermissions = async () => {
    if (!Notifications || Platform.OS === 'web') return;
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    setHasNotificationPermission(finalStatus === 'granted');
  };

  const openSocialApp = async (appName: string) => {
    const appUrls: { [key: string]: { ios: string; android: string; web: string } } = {
      instagram: {
        ios: 'instagram://app',
        android: 'instagram://app',
        web: 'https://www.instagram.com',
      },
      facebook: {
        ios: 'fb://profile',
        android: 'fb://page',
        web: 'https://www.facebook.com',
      },
      linkedin: {
        ios: 'linkedin://app',
        android: 'linkedin://app',
        web: 'https://www.linkedin.com',
      },
      whatsapp: {
        ios: 'whatsapp://app',
        android: 'whatsapp://send',
        web: 'https://web.whatsapp.com',
      },
      wechat: {
        ios: 'weixin://app',
        android: 'weixin://app',
        web: 'https://web.wechat.com',
      },
      alibaba: {
        ios: 'alibaba://app',
        android: 'alibaba://app',
        web: 'https://www.alibaba.com',
      },
    };

    const urls = appUrls[appName.toLowerCase()];
    if (!urls) return;

    try {
      let canOpen = false;
      if (Platform.OS === 'ios') {
        canOpen = await Linking.canOpenURL(urls.ios);
        if (canOpen) {
          await Linking.openURL(urls.ios);
        } else {
          await Linking.openURL(urls.web);
        }
      } else if (Platform.OS === 'android') {
        canOpen = await Linking.canOpenURL(urls.android);
        if (canOpen) {
          await Linking.openURL(urls.android);
        } else {
          await Linking.openURL(urls.web);
        }
      } else {
        await Linking.openURL(urls.web);
      }
    } catch (error) {
      Alert.alert('Error', `Could not open ${appName}`);
    }
  };

  const socialApps = [
    { name: 'Instagram', icon: 'logo-instagram', color: '#E4405F', key: 'instagram' },
    { name: 'Facebook', icon: 'logo-facebook', color: '#1877F2', key: 'facebook' },
    { name: 'LinkedIn', icon: 'logo-linkedin', color: '#0A66C2', key: 'linkedin' },
    { name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366', key: 'whatsapp' },
    { name: 'WeChat', icon: 'chatbubbles', color: '#09B83E', key: 'wechat' },
    { name: 'Alibaba', icon: 'storefront', color: '#FF6A00', key: 'alibaba' },
  ];

  const actionItems = [
    { name: 'Voice Reminder', icon: 'mic-circle', color: '#FF6B6B', route: '/voice-reminder' },
    { name: 'My Reminders', icon: 'alarm', color: '#4ECDC4', route: '/reminders' },
    { name: 'Voice Note', icon: 'recording', color: '#95E1D3', route: '/voice-note' },
    { name: 'My Notes', icon: 'document-text', color: '#FFA07A', route: '/notes' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Voice Assistant</Text>
          <Text style={styles.headerSubtitle}>Your Personal Helper</Text>
        </View>
        <TouchableOpacity
          style={styles.voiceButton}
          onPress={() => router.push('/voice-command')}
        >
          <Ionicons name="mic" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Action Center Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={24} color="#667eea" />
            <Text style={styles.sectionTitle}>Action Center</Text>
          </View>
          <View style={styles.grid}>
            {actionItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionCard, { borderLeftColor: item.color }]}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon as any} size={28} color={item.color} />
                </View>
                <Text style={styles.actionText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Social Media Hub Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="apps" size={24} color="#f093fb" />
            <Text style={styles.sectionTitle}>Social Media Hub</Text>
          </View>
          <View style={styles.socialGrid}>
            {socialApps.map((app, index) => (
              <TouchableOpacity
                key={index}
                style={styles.socialCard}
                onPress={() => openSocialApp(app.key)}
              >
                <View style={[styles.socialIcon, { backgroundColor: app.color }]}>
                  <Ionicons name={app.icon as any} size={32} color="#fff" />
                </View>
                <Text style={styles.socialText}>{app.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Voice Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="megaphone" size={24} color="#43e97b" />
            <Text style={styles.sectionTitle}>Voice Commands</Text>
          </View>
          <View style={styles.commandCard}>
            <Text style={styles.commandTitle}>Try saying:</Text>
            <Text style={styles.commandExample}>• "Open Instagram"</Text>
            <Text style={styles.commandExample}>• "Create a reminder to call John"</Text>
            <Text style={styles.commandExample}>• "Take a note"</Text>
            <Text style={styles.commandExample}>• "Open WhatsApp"</Text>
          </View>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2,
  },
  voiceButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginLeft: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  socialCard: {
    width: '31%',
    alignItems: 'center',
    marginBottom: 16,
  },
  socialIcon: {
    width: 70,
    height: 70,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  socialText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    textAlign: 'center',
  },
  commandCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  commandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
  },
  commandExample: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
    lineHeight: 20,
  },
});
