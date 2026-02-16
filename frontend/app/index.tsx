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

export default function DashboardScreen() {
  const router = useRouter();

  // Open Google Keep app
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
        // Fallback to web if app not installed
        await Linking.openURL(keepUrls.web);
      }
    } catch (error) {
      // If all fails, try web URL
      try {
        await Linking.openURL(keepUrls.web);
      } catch (webError) {
        Alert.alert('Google Keep', 'Could not open Google Keep. Please install the app or visit keep.google.com');
      }
    }
  };

  // Handle action button press
  const handleActionPress = (type, name) => {
    if (type === 'keepnotes') {
      openGoogleKeep();
    } else {
      router.push(`/action?type=${type}&name=${name}`);
    }
  };

  const openSocialApp = async (appName) => {
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
        ios: 'linkedin://',
        android: 'linkedin://',
        web: 'https://www.linkedin.com',
      },
      whatsapp: {
        ios: 'whatsapp-business://',
        android: 'whatsapp-business://',
        web: 'https://business.whatsapp.com',
      },
      wechat: {
        ios: 'weixin://',
        android: 'weixin://',
        web: 'https://web.wechat.com',
      },
      alibaba: {
        ios: 'https://m.alibaba.com',
        android: 'https://m.alibaba.com',
        web: 'https://www.alibaba.com',
      },
    };

    const urls = appUrls[appName.toLowerCase()];
    if (!urls) return;

    try {
      // Try to open native app first, fallback to web
      const urlToTry = Platform.OS === 'ios' ? urls.ios : Platform.OS === 'android' ? urls.android : urls.web;
      
      const canOpen = await Linking.canOpenURL(urlToTry);
      if (canOpen) {
        await Linking.openURL(urlToTry);
      } else {
        // Fallback to web if app not installed
        await Linking.openURL(urls.web);
      }
    } catch (error) {
      // If all fails, try web URL
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
    { name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366', key: 'whatsapp' },
    { name: 'WeChat', icon: 'chatbubbles', color: '#09B83E', key: 'wechat' },
    { name: 'Alibaba', icon: 'storefront', color: '#FF6A00', key: 'alibaba' },
  ];

  const actionTypes = [
    { name: 'Meet', icon: 'people', color: '#FF6B6B', type: 'meet' },
    { name: 'Call', icon: 'call', color: '#4ECDC4', type: 'call' },
    { name: 'SMS', icon: 'chatbubble', color: '#95E1D3', type: 'sms' },
    { name: 'WhatsApp Business', icon: 'logo-whatsapp', color: '#25D366', type: 'whatsapp' },
    { name: 'Deskwork', icon: 'laptop', color: '#A78BFA', type: 'deskwork' },
    { name: 'Keep Notes', icon: 'create', color: '#FFC107', type: 'keepnotes' },
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
        {/* Main Action Types */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={24} color="#667eea" />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Tap any action to use voice for reminders or notes
          </Text>
          <View style={styles.grid}>
            {actionTypes.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionCard, { borderLeftColor: item.color }]}
                onPress={() => handleActionPress(item.type, item.name)}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon} size={32} color={item.color} />
                </View>
                <Text style={styles.actionText}>{item.name}</Text>
                <Text style={styles.actionSubtext}>
                  {item.type === 'keepnotes' ? 'Open Google Keep' : 'Voice Reminder/Note'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* View All Button */}
        <View style={styles.section}>
          <View style={styles.viewAllContainer}>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/all-items')}
            >
              <Ionicons name="list" size={20} color="#667eea" />
              <Text style={styles.viewAllText}>View All Reminders & Notes</Text>
              <Ionicons name="chevron-forward" size={20} color="#667eea" />
            </TouchableOpacity>
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
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginLeft: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
    marginLeft: 32,
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
    alignItems: 'center',
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  actionSubtext: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  viewAllContainer: {
    marginTop: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#667eea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginLeft: 8,
    marginRight: 8,
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
