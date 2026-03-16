import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : window.location.origin + '/api';

// Icons
const PhoneIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const MessageIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const LinkIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
const PlusIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const UserIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const RefreshIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
const LogoutIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const InboxIcon = () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>;
const MeetIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const LaptopIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;

function App() {
  const [isLinked, setIsLinked] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check if already linked (stored in localStorage)
    const storedDeviceId = localStorage.getItem('justblr_device_id');
    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
      setIsLinked(true);
    }
    setLoading(false);
  }, []);

  const handleLink = (linkedDeviceId) => {
    localStorage.setItem('justblr_device_id', linkedDeviceId);
    setDeviceId(linkedDeviceId);
    setIsLinked(true);
  };

  const handleUnlink = () => {
    localStorage.removeItem('justblr_device_id');
    setDeviceId(null);
    setIsLinked(false);
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="app">
      {isLinked ? (
        <Dashboard deviceId={deviceId} onUnlink={handleUnlink} />
      ) : (
        <LinkScreen onLink={handleLink} />
      )}
    </div>
  );
}

// Link Screen Component
function LinkScreen({ onLink }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);

  const handleCodeChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const syncCode = code.join('');
    if (syncCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/sync/verify-code`, {
        sync_code: syncCode
      });
      
      if (response.data.device_id) {
        onLink(response.data.device_id);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="link-screen">
      <div className="link-card">
        <div className="link-icon">
          <LinkIcon />
        </div>
        <h2 className="link-title">Link Your Mobile</h2>
        <p className="link-subtitle">
          Enter the 6-digit code from your Justblr Matrix mobile app to sync your reminders and contacts
        </p>
        
        <div className="code-input-group">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              className="code-input"
              value={digit}
              onChange={e => handleCodeChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              maxLength={1}
            />
          ))}
        </div>

        <button 
          className="link-button" 
          onClick={handleSubmit}
          disabled={loading || code.some(d => !d)}
        >
          {loading ? 'Verifying...' : 'Link Device'}
        </button>

        {error && <p className="link-error">{error}</p>}

        <div className="link-instructions">
          <h4>How to get the code:</h4>
          <ol>
            <li>Open Justblr Matrix app on your phone</li>
            <li>Go to Settings (gear icon)</li>
            <li>Tap "Link to Web"</li>
            <li>Enter the 6-digit code shown</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// Dashboard Component
function Dashboard({ deviceId, onUnlink }) {
  const [reminders, setReminders] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState(null); // null = all, or 'call', 'sms', 'whatsapp'

  useEffect(() => {
    fetchData();
  }, [deviceId]);

  const fetchData = async () => {
    try {
      const [remindersRes, contactsRes] = await Promise.all([
        axios.get(`${API_URL}/reminders?device_id=${deviceId}`),
        axios.get(`${API_URL}/sync/contacts/${deviceId}`)
      ]);
      setReminders(remindersRes.data || []);
      setContacts(contactsRes.data?.contacts || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteReminder = async (id) => {
    if (!window.confirm('Delete this reminder?')) return;
    try {
      await axios.delete(`${API_URL}/reminders/${id}`);
      setReminders(reminders.filter(r => r.id !== id));
    } catch (err) {
      alert('Failed to delete');
    }
  };

  // Open WhatsApp Desktop App (uses whatsapp:// protocol)
  const openWhatsApp = (phone, message, contactName) => {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone.startsWith('91') && cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const encodedMsg = encodeURIComponent(message || 'Hello!');
    
    // Use whatsapp:// protocol for desktop app
    const url = `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`;
    window.location.href = url;
  };

  // Open SMS (will use default mail client or show alert)
  const openSMS = (phone, message) => {
    alert(`SMS to ${phone}: ${message}\n\nNote: SMS can only be sent from mobile device.`);
  };

  const stats = {
    total: reminders.length,
    call: reminders.filter(r => r.reminder_type === 'call').length,
    sms: reminders.filter(r => r.reminder_type === 'sms').length,
    whatsapp: reminders.filter(r => r.reminder_type === 'whatsapp').length,
    meet: reminders.filter(r => r.reminder_type === 'meet').length,
    deskwork: reminders.filter(r => r.reminder_type === 'deskwork').length
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="dashboard">
      <div className="header">
        <div className="header-left">
          <h1>Justblr Matrix</h1>
          <p>Web Dashboard - Synced with mobile</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshIcon /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={onUnlink}>
            <LogoutIcon /> Unlink
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className={`stat-card ${filterType === null ? 'active' : ''}`} onClick={() => setFilterType(null)} style={{cursor: 'pointer'}}>
          <div className="stat-icon total"><InboxIcon /></div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total Reminders</p>
          </div>
        </div>
        <div className={`stat-card ${filterType === 'call' ? 'active' : ''}`} onClick={() => setFilterType('call')} style={{cursor: 'pointer'}}>
          <div className="stat-icon call"><PhoneIcon /></div>
          <div className="stat-info">
            <h3>{stats.call}</h3>
            <p>Call Reminders</p>
          </div>
        </div>
        <div className={`stat-card ${filterType === 'sms' ? 'active' : ''}`} onClick={() => setFilterType('sms')} style={{cursor: 'pointer'}}>
          <div className="stat-icon sms"><MessageIcon /></div>
          <div className="stat-info">
            <h3>{stats.sms}</h3>
            <p>SMS Reminders</p>
          </div>
        </div>
        <div className={`stat-card ${filterType === 'whatsapp' ? 'active' : ''}`} onClick={() => setFilterType('whatsapp')} style={{cursor: 'pointer'}}>
          <div className="stat-icon whatsapp"><MessageIcon /></div>
          <div className="stat-info">
            <h3>{stats.whatsapp}</h3>
            <p>WhatsApp Reminders</p>
          </div>
        </div>
        <div className={`stat-card ${filterType === 'meet' ? 'active' : ''}`} onClick={() => setFilterType('meet')} style={{cursor: 'pointer'}}>
          <div className="stat-icon meet"><MeetIcon /></div>
          <div className="stat-info">
            <h3>{stats.meet}</h3>
            <p>Meet Reminders</p>
          </div>
        </div>
        <div className={`stat-card ${filterType === 'deskwork' ? 'active' : ''}`} onClick={() => setFilterType('deskwork')} style={{cursor: 'pointer'}}>
          <div className="stat-icon deskwork"><LaptopIcon /></div>
          <div className="stat-info">
            <h3>{stats.deskwork}</h3>
            <p>Deskwork Reminders</p>
          </div>
        </div>
      </div>

      {filterType && (
        <div style={{marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{color: '#a1a1aa'}}>Showing: {filterType.toUpperCase()} reminders</span>
          <button className="btn btn-secondary" onClick={() => setFilterType(null)} style={{padding: '4px 12px', fontSize: 12}}>
            Clear Filter
          </button>
        </div>
      )}

      <div className="main-content">
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title">Your Reminders</h2>
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              <PlusIcon /> New Reminder
            </button>
          </div>

          {showForm && (
            <CreateReminderForm 
              deviceId={deviceId} 
              contacts={contacts}
              onCreated={() => { fetchData(); setShowForm(false); }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {reminders.length === 0 ? (
            <div className="empty-state">
              <InboxIcon />
              <h3>No reminders yet</h3>
              <p>Create your first reminder or sync from mobile</p>
            </div>
          ) : (
            <div className="reminder-list">
              {reminders
                .filter(r => filterType ? r.reminder_type === filterType : true)
                .map(reminder => (
                <div key={reminder.id} className="reminder-card">
                  <div className="reminder-header">
                    <div className="reminder-type">
                      <span className={`type-badge ${reminder.reminder_type}`}>
                        {reminder.reminder_type}
                      </span>
                    </div>
                    <div className="reminder-actions">
                      {reminder.reminder_type === 'whatsapp' && reminder.contact_phone && (
                        <button 
                          className="btn btn-primary"
                          onClick={() => openWhatsApp(reminder.contact_phone, reminder.notes || reminder.title)}
                          title="Open WhatsApp"
                          style={{padding: '6px 12px', marginRight: 8}}
                        >
                          Send WhatsApp
                        </button>
                      )}
                      {reminder.reminder_type === 'call' && reminder.contact_phone && (
                        <button 
                          className="btn btn-secondary"
                          onClick={() => window.open(`tel:${reminder.contact_phone}`, '_blank')}
                          title="Call"
                          style={{padding: '6px 12px', marginRight: 8}}
                        >
                          Call
                        </button>
                      )}
                      <button 
                        className="btn btn-danger"
                        onClick={() => deleteReminder(reminder.id)}
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  <div className="reminder-title">{reminder.title}</div>
                  {reminder.contact_name && (
                    <div className="reminder-contact">
                      <UserIcon /> {reminder.contact_name}
                      {reminder.contact_phone && ` • ${reminder.contact_phone}`}
                    </div>
                  )}
                  <div className="reminder-time">
                    <ClockIcon /> {formatDate(reminder.scheduled_time)}
                  </div>
                  {reminder.notes && (
                    <div style={{marginTop: 8, padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 13, color: '#a1a1aa'}}>
                      {reminder.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title">Synced Contacts</h2>
          </div>
          {contacts.length === 0 ? (
            <div className="empty-state">
              <UserIcon style={{ width: 48, height: 48 }} />
              <h3>No contacts synced</h3>
              <p>Sync contacts from your mobile app</p>
            </div>
          ) : (
            <div className="reminder-list">
              {contacts.slice(0, 20).map((contact, idx) => (
                <div key={idx} className="reminder-card">
                  <div className="reminder-title">{contact.name}</div>
                  <div className="reminder-contact">
                    <PhoneIcon /> {contact.phone}
                  </div>
                </div>
              ))}
              {contacts.length > 20 && (
                <p style={{ textAlign: 'center', color: '#71717a', padding: 16 }}>
                  +{contacts.length - 20} more contacts
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Create Reminder Form
function CreateReminderForm({ deviceId, contacts, onCreated, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    reminder_type: 'call',
    contact_name: '',
    contact_phone: '',
    scheduled_time: '',
    notes: '',
    auto_execute: false
  });
  const [contactSearch, setContactSearch] = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const [loading, setLoading] = useState(false);

  const types = [
    { id: 'call', label: 'Call' },
    { id: 'sms', label: 'SMS' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'meet', label: 'Meet' },
    { id: 'deskwork', label: 'Deskwork' }
  ];

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone.includes(contactSearch)
  ).slice(0, 10);

  const selectContact = (contact) => {
    setFormData({
      ...formData,
      contact_name: contact.name,
      contact_phone: contact.phone
    });
    setContactSearch(contact.name);
    setShowContacts(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.scheduled_time) {
      alert('Please fill title and schedule time');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/reminders`, {
        ...formData,
        device_id: deviceId
      });
      onCreated();
    } catch (err) {
      alert('Failed to create reminder: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="create-form" onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 16 }}>
      <div className="form-group">
        <label>Reminder Type</label>
        <div className="type-selector">
          {types.map(type => (
            <button
              key={type.id}
              type="button"
              className={`type-option ${formData.reminder_type === type.id ? 'selected' : ''}`}
              onClick={() => setFormData({ ...formData, reminder_type: type.id })}
            >
              {type.id === 'call' && <PhoneIcon />}
              {type.id === 'sms' && <MessageIcon />}
              {type.id === 'whatsapp' && <MessageIcon />}
              {type.id === 'meet' && <UserIcon />}
              {type.id === 'deskwork' && <ClockIcon />}
              <span>{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Title</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g., Call John about project"
          value={formData.title}
          onChange={e => setFormData({ ...formData, title: e.target.value })}
        />
      </div>

      <div className="form-group contact-picker">
        <label>Contact</label>
        <input
          type="text"
          className="form-input"
          placeholder="Search contact..."
          value={contactSearch}
          onChange={e => { setContactSearch(e.target.value); setShowContacts(true); }}
          onFocus={() => setShowContacts(true)}
        />
        {showContacts && filteredContacts.length > 0 && (
          <div className="contact-search-results">
            {filteredContacts.map((contact, idx) => (
              <div key={idx} className="contact-item" onClick={() => selectContact(contact)}>
                <div className="contact-name">{contact.name}</div>
                <div className="contact-phone">{contact.phone}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Phone (optional)</label>
        <input
          type="tel"
          className="form-input"
          placeholder="+91 98765 43210"
          value={formData.contact_phone}
          onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Schedule Time</label>
        <input
          type="datetime-local"
          className="form-input"
          value={formData.scheduled_time}
          onChange={e => setFormData({ ...formData, scheduled_time: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Notes (optional)</label>
        <textarea
          className="form-textarea"
          placeholder="Add notes..."
          value={formData.notes}
          onChange={e => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Reminder'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default App;
