import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
  RefreshControl,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { BackHandler } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import DateTimePicker from '@react-native-community/datetimepicker';

// HARDCODED URL to ensure it works
const BACKEND_URL = 'https://remind-sync-app.preview.emergentagent.com';

// Get device ID for data isolation - use same key as main screen
const getDeviceId = async () => {
  try {
    let deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await AsyncStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  } catch (error) {
    return `device_${Date.now()}`;
  }
};

interface Employee {
  id: string;
  name: string;
  phone: string;
}

interface Task {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_phone: string;
  description: string;
  deadline?: string;
  is_completed: boolean;
  is_overdue: boolean;
  created_at: string;
  sent_to_whatsapp: boolean;
}

export default function DelegationScreen() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showEditTaskTime, setShowEditTaskTime] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  
  // Form states
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeePhone, setNewEmployeePhone] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Contacts
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  
  // Report
  const [reportText, setReportText] = useState('');
  const [reportSummary, setReportSummary] = useState<any>(null);

  // Back handler
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      
      const onBackPress = () => {
        if (selectedEmployee) {
          setSelectedEmployee(null);
          return true;
        }
        router.push('/');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [router, selectedEmployee])
  );

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const deviceId = await getDeviceId();
      
      const [employeesRes, tasksRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/employees?device_id=${deviceId}`, { timeout: 30000 }),
        axios.get(`${BACKEND_URL}/api/tasks?device_id=${deviceId}`, { timeout: 30000 }),
      ]);
      
      setEmployees(employeesRes.data || []);
      setTasks(tasksRes.data || []);
    } catch (error: any) {
      console.error('Load data error:', error);
      Alert.alert('Error', 'Failed to load data. Pull down to refresh.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Load contacts
  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow access to contacts');
        return;
      }
      
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });
      
      const formatted = data
        .filter(c => c.name && c.phoneNumbers && c.phoneNumbers.length > 0)
        .map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phoneNumbers?.[0]?.number || '',
        }));
      
      setContacts(formatted);
      setShowContactPicker(true);
    } catch (error) {
      console.error('Load contacts error:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  const selectContact = (contact: any) => {
    setNewEmployeeName(contact.name);
    setNewEmployeePhone(contact.phone);
    setShowContactPicker(false);
  };

  // Add employee
  const addEmployee = async () => {
    if (!newEmployeeName.trim() || !newEmployeePhone.trim()) {
      Alert.alert('Error', 'Please enter name and phone number');
      return;
    }
    
    try {
      const deviceId = await getDeviceId();
      const response = await axios.post(`${BACKEND_URL}/api/employees`, {
        name: newEmployeeName.trim(),
        phone: newEmployeePhone.trim(),
        device_id: deviceId,
      });
      
      setEmployees([...employees, response.data]);
      setShowAddEmployee(false);
      setNewEmployeeName('');
      setNewEmployeePhone('');
      Alert.alert('Success', 'Employee added');
    } catch (error: any) {
      console.error('Add employee error:', error);
      Alert.alert('Error', 'Failed to add employee');
    }
  };

  // Delete employee
  const deleteEmployee = async (employeeId: string) => {
    Alert.alert(
      'Delete Employee',
      'This will also delete all tasks for this employee. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${BACKEND_URL}/api/employees/${employeeId}`);
              setEmployees(employees.filter(e => e.id !== employeeId));
              setTasks(tasks.filter(t => t.employee_id !== employeeId));
              if (selectedEmployee?.id === employeeId) {
                setSelectedEmployee(null);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete employee');
            }
          },
        },
      ]
    );
  };

  // Add task
  const addTask = async () => {
    if (!selectedEmployee || !newTaskDescription.trim()) {
      Alert.alert('Error', 'Please enter task description');
      return;
    }
    
    try {
      const deviceId = await getDeviceId();
      const response = await axios.post(`${BACKEND_URL}/api/tasks`, {
        employee_id: selectedEmployee.id,
        description: newTaskDescription.trim(),
        deadline: newTaskDeadline?.toISOString(),
        device_id: deviceId,
      });
      
      setTasks([...tasks, response.data]);
      setShowAddTask(false);
      setNewTaskDescription('');
      setNewTaskDeadline(null);
      Alert.alert('Success', 'Task added');
    } catch (error: any) {
      console.error('Add task error:', error);
      Alert.alert('Error', 'Failed to add task');
    }
  };

  // Toggle task completion
  const toggleTaskComplete = async (task: Task) => {
    try {
      const response = await axios.put(`${BACKEND_URL}/api/tasks/${task.id}`, {
        is_completed: !task.is_completed,
      });
      
      setTasks(tasks.map(t => t.id === task.id ? response.data : t));
    } catch (error) {
      Alert.alert('Error', 'Failed to update task');
    }
  };

  // Delete task
  const deleteTask = async (taskId: string) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/tasks/${taskId}`);
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete task');
    }
  };

  // Edit task deadline
  const openEditTaskTime = (task: any) => {
    setEditingTask(task);
    setNewTaskDeadline(task.deadline ? new Date(task.deadline) : new Date());
    setShowEditTaskTime(true);
  };

  const saveTaskDeadline = async () => {
    if (!editingTask || !newTaskDeadline) return;
    try {
      await axios.put(`${BACKEND_URL}/api/tasks/${editingTask.id}`, {
        deadline: newTaskDeadline.toISOString(),
      });
      // Update local state
      setTasks(tasks.map(t => 
        t.id === editingTask.id 
          ? { ...t, deadline: newTaskDeadline.toISOString() } 
          : t
      ));
      setShowEditTaskTime(false);
      setEditingTask(null);
      Alert.alert('Success', 'Task deadline updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update deadline');
    }
  };

  // Delete completed tasks
  const deleteCompletedTasks = async () => {
    const completedCount = tasks.filter(t => t.is_completed && t.employee_id === selectedEmployee?.id).length;
    if (completedCount === 0) {
      Alert.alert('No Tasks', 'No completed tasks to delete');
      return;
    }
    
    Alert.alert(
      'Delete Completed',
      `Delete ${completedCount} completed task(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deviceId = await getDeviceId();
              await axios.delete(`${BACKEND_URL}/api/tasks/bulk/completed?device_id=${deviceId}`);
              setTasks(tasks.filter(t => !t.is_completed));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete tasks');
            }
          },
        },
      ]
    );
  };

  // Send task to WhatsApp - Always open WhatsApp directly
  const sendToWhatsApp = async (task: Task) => {
    try {
      // Format the message
      let deadlineStr = "";
      if (task.deadline) {
        const deadline = new Date(task.deadline);
        deadlineStr = `\nDeadline: ${deadline.toLocaleString()}`;
      }
      
      const message = `📋 Task Assigned:\n\n${task.description}${deadlineStr}\n\n- Sent from Justblr Matrix`;
      
      // Get phone number
      let phone = task.employee_phone || '';
      phone = phone.replace(/[^0-9+]/g, '');
      if (!phone.startsWith('+')) {
        phone = '+91' + phone;
      }
      
      // Open WhatsApp directly with pre-filled message
      const encodedMessage = encodeURIComponent(message);
      const url = `whatsapp://send?phone=${phone}&text=${encodedMessage}`;
      
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        // Mark as sent
        setTasks(tasks.map(t => t.id === task.id ? { ...t, sent_to_whatsapp: true } : t));
        // Update backend
        try {
          await axios.put(`${BACKEND_URL}/api/tasks/${task.id}`, { sent_to_whatsapp: true });
        } catch (e) {
          console.log('Failed to update sent status');
        }
      } else {
        Alert.alert('WhatsApp Not Found', 'Please install WhatsApp');
      }
    } catch (error: any) {
      console.error('Send WhatsApp error:', error);
      Alert.alert('Error', 'Failed to open WhatsApp');
    }
  };

  // Generate and show report
  const generateReport = async () => {
    try {
      const deviceId = await getDeviceId();
      const response = await axios.get(
        `${BACKEND_URL}/api/tasks/report?device_id=${deviceId}${selectedEmployee ? `&employee_id=${selectedEmployee.id}` : ''}`
      );
      
      setReportText(response.data.report);
      setReportSummary(response.data.summary);
      setShowReport(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report');
    }
  };

  // Send report to WhatsApp
  const sendReportToWhatsApp = async () => {
    if (!selectedEmployee || !reportText) return;
    
    const phone = selectedEmployee.phone.replace(/[^0-9+]/g, '');
    const message = encodeURIComponent(reportText);
    const url = `whatsapp://send?phone=${phone}&text=${message}`;
    
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp Not Found', 'Please install WhatsApp');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open WhatsApp');
    }
  };

  // Get tasks for selected employee
  const employeeTasks = selectedEmployee
    ? tasks.filter(t => t.employee_id === selectedEmployee.id)
    : [];
  const pendingTasks = employeeTasks.filter(t => !t.is_completed);
  const completedTasks = employeeTasks.filter(t => t.is_completed);
  const overdueTasks = pendingTasks.filter(t => t.is_overdue);

  // Render employee item
  const renderEmployeeItem = ({ item }: { item: Employee }) => {
    const empTasks = tasks.filter(t => t.employee_id === item.id);
    const pendingCount = empTasks.filter(t => !t.is_completed).length;
    const overdueCount = empTasks.filter(t => t.is_overdue && !t.is_completed).length;
    
    return (
      <TouchableOpacity
        style={styles.employeeCard}
        onPress={() => setSelectedEmployee(item)}
        onLongPress={() => deleteEmployee(item.id)}
      >
        <View style={styles.employeeInfo}>
          <View style={styles.employeeAvatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.employeeDetails}>
            <Text style={styles.employeeName}>{item.name}</Text>
            <Text style={styles.employeePhone}>{item.phone}</Text>
          </View>
        </View>
        <View style={styles.taskBadges}>
          {overdueCount > 0 && (
            <View style={[styles.badge, styles.badgeOverdue]}>
              <Text style={styles.badgeText}>{overdueCount} overdue</Text>
            </View>
          )}
          {pendingCount > 0 && (
            <View style={[styles.badge, styles.badgePending]}>
              <Text style={styles.badgeText}>{pendingCount} pending</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={24} color="#999" />
      </TouchableOpacity>
    );
  };

  // Render task item
  const renderTaskItem = ({ item }: { item: Task }) => (
    <View style={[styles.taskCard, item.is_overdue && !item.is_completed && styles.taskOverdue]}>
      <TouchableOpacity
        style={styles.taskCheckbox}
        onPress={() => toggleTaskComplete(item)}
      >
        <Ionicons
          name={item.is_completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={item.is_completed ? '#22c55e' : item.is_overdue ? '#ef4444' : '#667eea'}
        />
      </TouchableOpacity>
      <View style={styles.taskContent}>
        <Text style={[styles.taskDescription, item.is_completed && styles.taskCompleted]}>
          {item.description}
        </Text>
        {item.deadline && (
          <Text style={[styles.taskDeadline, item.is_overdue && !item.is_completed && styles.deadlineOverdue]}>
            Due: {new Date(item.deadline).toLocaleString()}
          </Text>
        )}
      </View>
      <View style={styles.taskActions}>
        {!item.is_completed && (
          <TouchableOpacity
            style={styles.whatsappBtn}
            onPress={() => sendToWhatsApp(item)}
          >
            <Ionicons
              name="logo-whatsapp"
              size={22}
              color={item.sent_to_whatsapp ? '#999' : '#25D366'}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.editTimeBtn}
          onPress={() => openEditTaskTime(item)}
        >
          <Ionicons name="time-outline" size={20} color="#667eea" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => deleteTask(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Contact picker modal
  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone.includes(contactSearch)
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Employee detail view
  if (selectedEmployee) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedEmployee(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{selectedEmployee.name}</Text>
            <Text style={styles.headerSubtitle}>{pendingTasks.length} pending tasks</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={generateReport}>
              <Ionicons name="document-text-outline" size={22} color="#667eea" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={deleteCompletedTasks}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#fef2f2' }]}>
            <Text style={[styles.statNumber, { color: '#ef4444' }]}>{overdueTasks.length}</Text>
            <Text style={styles.statLabel}>Overdue</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{pendingTasks.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.statNumber, { color: '#22c55e' }]}>{completedTasks.length}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>

        {/* Task list */}
        <FlatList
          data={[...pendingTasks.sort((a, b) => (b.is_overdue ? 1 : 0) - (a.is_overdue ? 1 : 0)), ...completedTasks]}
          renderItem={renderTaskItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No tasks yet</Text>
            </View>
          }
        />

        {/* Add task button */}
        <TouchableOpacity style={styles.fab} onPress={() => setShowAddTask(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Add Task Modal */}
        <Modal visible={showAddTask} animationType="slide" transparent>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={[styles.modalContent, { marginBottom: 50 }]}>
              <Text style={styles.modalTitle}>Add Task</Text>
              <TextInput
                style={styles.input}
                placeholder="Task description"
                value={newTaskDescription}
                onChangeText={setNewTaskDescription}
                multiline
              />
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#667eea" />
                <Text style={styles.datePickerText}>
                  {newTaskDeadline ? newTaskDeadline.toLocaleString() : 'Set deadline (optional)'}
                </Text>
              </TouchableOpacity>
              
              {showDatePicker && (
                <DateTimePicker
                  value={newTaskDeadline || new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) {
                      setNewTaskDeadline(date);
                      setShowTimePicker(true);
                    }
                  }}
                />
              )}
              
              {showTimePicker && (
                <DateTimePicker
                  value={newTaskDeadline || new Date()}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    setShowTimePicker(false);
                    if (date) setNewTaskDeadline(date);
                  }}
                />
              )}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => {
                    setShowAddTask(false);
                    setNewTaskDescription('');
                    setNewTaskDeadline(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={addTask}>
                  <Text style={styles.submitBtnText}>Add Task</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Edit Task Time Modal */}
        <Modal visible={showEditTaskTime} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { marginBottom: 50 }]}>
              <Text style={styles.modalTitle}>Edit Deadline</Text>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#667eea" />
                <Text style={styles.datePickerText}>
                  {newTaskDeadline ? newTaskDeadline.toLocaleString() : 'Set deadline'}
                </Text>
              </TouchableOpacity>
              
              {showDatePicker && (
                <DateTimePicker
                  value={newTaskDeadline || new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) {
                      setNewTaskDeadline(date);
                      setShowTimePicker(true);
                    }
                  }}
                />
              )}
              
              {showTimePicker && (
                <DateTimePicker
                  value={newTaskDeadline || new Date()}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    setShowTimePicker(false);
                    if (date) setNewTaskDeadline(date);
                  }}
                />
              )}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => {
                    setShowEditTaskTime(false);
                    setEditingTask(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={saveTaskDeadline}>
                  <Text style={styles.submitBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Report Modal */}
        <Modal visible={showReport} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Task Report</Text>
              {reportSummary && (
                <View style={styles.reportSummary}>
                  <Text style={styles.summaryText}>Total: {reportSummary.total}</Text>
                  <Text style={styles.summaryText}>Pending: {reportSummary.pending}</Text>
                  <Text style={[styles.summaryText, { color: '#ef4444' }]}>Overdue: {reportSummary.overdue}</Text>
                  <Text style={[styles.summaryText, { color: '#22c55e' }]}>Completed: {reportSummary.completed}</Text>
                </View>
              )}
              <ScrollView style={styles.reportScroll}>
                <Text style={styles.reportText}>{reportText}</Text>
              </ScrollView>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setShowReport(false)}
                >
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.whatsappSendBtn]}
                  onPress={sendReportToWhatsApp}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}> Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Main employee list view
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Delegation</Text>
          <Text style={styles.headerSubtitle}>{employees.length} employees</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={generateReport}>
          <Ionicons name="document-text-outline" size={22} color="#667eea" />
        </TouchableOpacity>
      </View>

      {/* Employee list */}
      <FlatList
        data={employees}
        renderItem={renderEmployeeItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No employees yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add employees from your contacts</Text>
          </View>
        }
      />

      {/* Add employee button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddEmployee(true)}>
        <Ionicons name="person-add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add Employee Modal */}
      <Modal visible={showAddEmployee} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Employee/Person</Text>
            <TouchableOpacity
              style={styles.contactPickerBtn}
              onPress={loadContacts}
              disabled={loadingContacts}
            >
              {loadingContacts ? (
                <ActivityIndicator size="small" color="#667eea" />
              ) : (
                <>
                  <Ionicons name="people" size={20} color="#667eea" />
                  <Text style={styles.contactPickerText}>Pick from Contacts</Text>
                </>
              )}
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Employee name"
              value={newEmployeeName}
              onChangeText={setNewEmployeeName}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              value={newEmployeePhone}
              onChangeText={setNewEmployeePhone}
              keyboardType="phone-pad"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setShowAddEmployee(false);
                  setNewEmployeeName('');
                  setNewEmployeePhone('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={addEmployee}>
                <Text style={styles.submitBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Contact Picker Modal */}
      <Modal visible={showContactPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Select Contact</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts..."
              value={contactSearch}
              onChangeText={setContactSearch}
            />
            <FlatList
              data={filteredContacts.slice(0, 100)}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.contactItem} onPress={() => selectContact(item)}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.contactName}>{item.name}</Text>
                    <Text style={styles.contactPhone}>{item.phone}</Text>
                  </View>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn, { marginTop: 10 }]}
              onPress={() => {
                setShowContactPicker(false);
                setContactSearch('');
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReport} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Task Report - All Employees</Text>
            {reportSummary && (
              <View style={styles.reportSummary}>
                <Text style={styles.summaryText}>Total: {reportSummary.total}</Text>
                <Text style={styles.summaryText}>Pending: {reportSummary.pending}</Text>
                <Text style={[styles.summaryText, { color: '#ef4444' }]}>Overdue: {reportSummary.overdue}</Text>
                <Text style={[styles.summaryText, { color: '#22c55e' }]}>Completed: {reportSummary.completed}</Text>
              </View>
            )}
            <ScrollView style={styles.reportScroll}>
              <Text style={styles.reportText}>{reportText}</Text>
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn, { marginTop: 10 }]}
              onPress={() => setShowReport(false)}
            >
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    padding: 8,
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  employeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  employeeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  employeeDetails: {
    marginLeft: 12,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  employeePhone: {
    fontSize: 14,
    color: '#666',
  },
  taskBadges: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeOverdue: {
    backgroundColor: '#fef2f2',
  },
  badgePending: {
    backgroundColor: '#fef3c7',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  taskOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  taskCheckbox: {
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskDescription: {
    fontSize: 16,
    color: '#333',
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  taskDeadline: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  deadlineOverdue: {
    color: '#ef4444',
    fontWeight: '600',
  },
  taskActions: {
    flexDirection: 'row',
    gap: 12,
  },
  whatsappBtn: {
    padding: 4,
  },
  deleteBtn: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  contactPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#667eea',
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  contactPickerText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '500',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  datePickerText: {
    color: '#666',
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelBtn: {
    backgroundColor: '#f5f5f5',
  },
  cancelBtnText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#667eea',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  whatsappSendBtn: {
    backgroundColor: '#25D366',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactName: {
    fontSize: 16,
    color: '#333',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
  },
  reportSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
    justifyContent: 'center',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  reportScroll: {
    maxHeight: 300,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  reportText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#333',
  },
});
