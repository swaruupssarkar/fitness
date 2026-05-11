/* --- Social - Rooms, profiles, follows, chat, plan copy ------- */
const Social = (() => {
  const ROOM_LANGUAGES = [
    'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Assamese', 'Aymara', 'Azerbaijani',
    'Bambara', 'Basque', 'Belarusian', 'Bengali', 'Bhojpuri', 'Bosnian', 'Bulgarian', 'Burmese',
    'Catalan', 'Cebuano', 'Chichewa', 'Chinese (Cantonese)', 'Chinese (Mandarin)', 'Corsican',
    'Croatian', 'Czech', 'Danish', 'Dhivehi', 'Dogri', 'Dutch', 'English', 'Esperanto', 'Estonian',
    'Ewe', 'Filipino', 'Finnish', 'French', 'Frisian', 'Galician', 'Georgian', 'German', 'Greek',
    'Guarani', 'Gujarati', 'Haitian Creole', 'Hausa', 'Hawaiian', 'Hebrew', 'Hindi', 'Hmong',
    'Hungarian', 'Icelandic', 'Igbo', 'Ilocano', 'Indonesian', 'Irish', 'Italian', 'Japanese',
    'Javanese', 'Kannada', 'Kazakh', 'Khmer', 'Kinyarwanda', 'Konkani', 'Korean', 'Krio', 'Kurdish',
    'Kyrgyz', 'Lao', 'Latin', 'Latvian', 'Lingala', 'Lithuanian', 'Luganda', 'Luxembourgish',
    'Macedonian', 'Maithili', 'Malagasy', 'Malay', 'Malayalam', 'Maltese', 'Maori', 'Marathi',
    'Meiteilon', 'Mizo', 'Mongolian', 'Nepali', 'Norwegian', 'Odia', 'Oromo', 'Pashto', 'Persian',
    'Polish', 'Portuguese', 'Punjabi', 'Quechua', 'Romanian', 'Russian', 'Samoan', 'Sanskrit',
    'Scots Gaelic', 'Serbian', 'Sesotho', 'Shona', 'Sindhi', 'Sinhala', 'Slovak', 'Slovenian',
    'Somali', 'Spanish', 'Sundanese', 'Swahili', 'Swedish', 'Tajik', 'Tamil', 'Tatar', 'Telugu',
    'Thai', 'Tigrinya', 'Tsonga', 'Turkish', 'Turkmen', 'Twi', 'Ukrainian', 'Urdu', 'Uyghur',
    'Uzbek', 'Vietnamese', 'Welsh', 'Xhosa', 'Yiddish', 'Yoruba', 'Zulu'
  ];
  const MAX_ROOM_LIMIT = 50;
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
      // To support strict firewalls, add a TURN server here:
      // { urls: 'turn:YOUR_TURN_SERVER', username: '...', credential: '...' }
    ]
  };
  const ROOM_HEARTBEAT_MS = 15000;
  const ROOM_STALE_MS = 45000;
  const ROOM_EXIT_STORAGE_KEY = 'fittrack:pendingRoomExit';

  const state = {
    user: null,
    query: '',
    mutualQuery: '',
    roomSort: 'Active',
    profiles: [],
    rooms: [],
    following: new Set(),
    followers: new Set(),
    roomMembers: [],
    roomMessages: [],
    dmMessages: [],
    selectedProfileUid: null,
    selectedRoomId: null,
    activeChatUid: null,
    watchedRoomId: null,
    watchedChatId: null,
    joinedRoomId: null,
    currentRoomId: null,
    roomAudioStarted: false,
    micOn: true,
    localStream: null,
    peerConnections: new Map(),
    candidateIds: new Map(),
    showCreateRoom: false,
    showRoomSettings: false,
    openRoomInfoId: null,
    fullPlanProfileUid: null,
    searchTimer: null,
    roomPresenceTimer: null,
    roomMembersLoaded: false,
    roomExitPending: null,
    lifecycleBound: false,
    unsubs: [],
    activeRoomUnsubs: [],
    activeChatUnsubs: [],
    rtcUnsubs: [],
    typingStatus: {}, // chatId -> { uid: timestamp }
    lastRenderedChatUid: null,
    mobileChatOpen: false,
    micPermission: 'prompt', // 'granted', 'denied', 'prompt'
    roomLoadTimeout: null,
    roomNotFound: false,
    heartbeatFailures: 0,
    };
  function db() { return Auth.getDb(); }
  function now() { return Date.now(); }
  function currentUid() { return Auth.getUser()?.uid || null; }

  function clearUnsubs(listName) {
    state[listName].forEach(unsub => {
      try { unsub(); } catch (e) { console.warn('Social unsubscribe failed', e); }
    });
    state[listName] = [];
  }

  function bindPageLifecycleEvents() {
    if (state.lifecycleBound) return;
    state.lifecycleBound = true;
    window.addEventListener('pagehide', leaveCurrentRoomForPageExit);
    window.addEventListener('beforeunload', leaveCurrentRoomForPageExit);
  }

  function renderIfActive() {
    const route = location.hash.slice(1) || 'dashboard';
    const view = route.split(/[/?]/)[0] || 'dashboard';
    if (view === 'rooms') renderRooms();
    if (view === 'room') renderRoomPage();
    if (view === 'chat') renderChat();
    if (view === 'profile') renderProfile();
    if (view === 'dashboard' && typeof App !== 'undefined') App.showView('dashboard', true);
  }

  function icon(name) {
    const icons = {
      search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
      plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      room: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 10.5V7a5 5 0 0 0-10 0v3.5"/><rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 16h.01"/><path d="M12 16h.01"/><path d="M16 16h.01"/></svg>',
      chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
      mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>',
      micOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 2 20 20"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><path d="M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M19 10v2a7 7 0 0 1-.78 3.22"/><path d="M5 10v2a7 7 0 0 0 10 6.32"/><path d="M12 19v3"/></svg>',
      phoneOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 2 20 20"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.63 2.6"/><path d="M14.05 14.05a12 12 0 0 0 3.63 1.21 2 2 0 0 1 1.72 2v1.1"/></svg>',
      signal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 20V4"/></svg>',
      userX: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5"/><path d="m22 8-5 5"/></svg>',
      copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5 17.5 17.5"/><path d="m21 21-3-3"/><path d="m6 6-3-3"/><path d="m18 21 3-3"/><path d="m3 6 3-3"/><path d="m10 8 6 6"/><path d="m8 10 6 6"/></svg>',
      send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
      phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.63 2.6a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.57-1.57a2 2 0 0 1 2.11-.45c.83.3 1.7.51 2.6.63A2 2 0 0 1 22 16.92Z"/></svg>',
      grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
      list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>',
      settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.73l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.73v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/></svg>',
      dots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
      x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
      chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
      note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>',
      globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20"/></svg>',
      crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/></svg>',
    };
    return icons[name] || '';
  }

  function initials(name) {
    return String(name || 'FT').split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'FT';
  }

  function usernameFor(profile) {
    if (profile.username) return profile.username;
    const clean = String(profile.displayName || 'member').toLowerCase().replace(/[^a-z0-9]+/g, '');
    return `@${clean || 'member'}`;
  }

  function usernameKey(value) {
    return String(value || 'fittrack').toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'fittrack';
  }

  function usernameFromKey(key) {
    return `@${usernameKey(key)}`;
  }

  function avatar(profile, cls = '') {
    const name = profile?.displayName || profile?.name || 'Member';
    const photo = profile?.photoURL || '';
    // Real presence: online if updatedAt was in the last 2 minutes
    const isOnline = profile?.updatedAt && (now() - profile.updatedAt < 120000);
    return `
      <span class="social-avatar ${cls}">
        ${photo ? `<img src="${esc(photo)}" alt="${esc(name)}">` : `<span>${esc(initials(name))}</span>`}
        ${isOnline ? '<i class="social-online-dot"></i>' : ''}
      </span>`;
  }

  function userProfile() {
    if (!state.user) return null;
    const existing = state.profiles.find(p => p.uid === state.user.uid);
    if (existing) return existing;
    return {
      uid: state.user.uid,
      displayName: state.user.displayName || 'You',
      photoURL: state.user.photoURL || '',
      followersCount: 0,
      followingCount: 0,
      activePlan: planSnapshot(Plans.getActivePlan()),
      updatedAt: now(),
    };
  }

  function allProfiles() {
    const seen = new Set();
    const items = [];
    const own = userProfile();
    if (own) {
      seen.add(own.uid);
      items.push(own);
    }
    state.profiles.forEach(profile => {
      if (!seen.has(profile.uid)) {
        seen.add(profile.uid);
        items.push(profile);
      }
    });
    return items;
  }

  function allRooms() {
    return [...state.rooms];
  }

  function activeHostRoom() {
    const uid = currentUid();
    if (!uid) return null;
    return allRooms().find(room => room.hostUid === uid && (room.status || 'active') === 'active') || null;
  }

  function normalizeLanguage(value) {
    return String(value || '').trim().toLowerCase();
  }

  function selectedLanguage(value) {
    const key = normalizeLanguage(value);
    return ROOM_LANGUAGES.find(language => normalizeLanguage(language) === key) || '';
  }

  function roomLanguage(room) {
    return room?.language || 'English';
  }

  function roomCount(room) {
    if (!room) return 0;
    if (state.watchedRoomId === room.id && state.roomMembersLoaded) {
      return activeRoomMembers(room).length;
    }
    const ids = Array.isArray(room.currentParticipantIds) ? room.currentParticipantIds.length : 0;
    const watched = state.watchedRoomId === room.id ? state.roomMembers.length : 0;
    return Math.max(Number(room.participantCount) || 0, ids, watched);
  }

  function isRoomLocked(room) {
    if (!room || isRoomJoined(room)) return false;
    return roomCount(room) >= (room.maxPeople || 10);
  }

  function renderLanguageOptions() {
    return ROOM_LANGUAGES.map(language => `<option value="${esc(language)}"></option>`).join('');
  }

  function roomRouteId() {
    const match = String(location.hash || '').match(/^#room\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function roomUrl(roomId) {
    return `${location.origin}${location.pathname}${location.search}#room/${encodeURIComponent(roomId)}`;
  }

  function openRoomTab(roomId, tab) {
    const target = roomUrl(roomId);
    if (tab && !tab.closed) {
      tab.location.href = target;
      return;
    }
    const opened = window.open(target, '_blank', 'noopener');
    if (!opened) {
      location.hash = `#room/${encodeURIComponent(roomId)}`;
    }
  }

  function roomById(roomId) {
    return allRooms().find(room => room.id === roomId) || null;
  }

  function roomParticipantIds(room) {
    const ids = new Set(Array.isArray(room?.currentParticipantIds) ? room.currentParticipantIds.filter(Boolean) : []);
    if (room?.id && state.watchedRoomId === room.id) {
      activeRoomMembers(room).forEach(member => {
        if (member.uid) ids.add(member.uid);
      });
    }
    if (!ids.size && room?.hostUid) ids.add(room.hostUid);
    return [...ids];
  }

  function roomMemberStamp(member) {
    return Number(member?.updatedAt) || Number(member?.joinedAt) || 0;
  }

  function isFreshRoomMember(member) {
    const stamp = roomMemberStamp(member);
    return !stamp || now() - stamp <= ROOM_STALE_MS;
  }

  function activeRoomMembers(room) {
    if (!room || state.watchedRoomId !== room.id) return [];
    return state.roomMembers.filter(isFreshRoomMember);
  }

  function removeRoomLocally(roomId) {
    state.rooms = state.rooms.filter(room => room.id !== roomId);
    if (state.selectedRoomId === roomId) state.selectedRoomId = null;
    if (state.watchedRoomId === roomId) {
      state.watchedRoomId = null;
      state.roomMembersLoaded = false;
      stopRoomPresence();
    }
    if (state.currentRoomId === roomId) state.currentRoomId = null;
    if (state.joinedRoomId === roomId) state.joinedRoomId = null;
  }

  function updateRoomLocally(roomId, patch) {
    state.rooms = state.rooms.map(room => room.id === roomId ? { ...room, ...patch } : room);
    if (state.watchedRoomId === roomId) {
      state.roomMembers = state.roomMembers
        .filter(member => patch.currentParticipantIds?.includes(member.uid) ?? true)
        .map(member => member.uid === patch.hostUid ? { ...member, role: 'Host' } : member);
    }
  }

  function selectorValue(value) {
    return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&');
  }

  function isFollowing(uid) {
    return state.following.has(uid);
  }

  function isMutual(profile) {
    if (!profile || profile.uid === currentUid()) return false;
    return state.following.has(profile.uid) && state.followers.has(profile.uid);
  }

  function visibleProfiles() {
    const q = state.query.trim();
    return allProfiles().filter(profile => {
      if (!q) return true;
      return matchesProfileQuery(profile, q);
    });
  }

  function visibleRooms() {
    const q = state.query.trim().toLowerCase();
    const rooms = allRooms().filter(room => {
      if ((room.status || 'active') !== 'active') return false;
      if (!q) return true;
      return [room.topic, room.hostName, roomLanguage(room)].join(' ').toLowerCase().includes(q);
    });
    return sortRooms(rooms);
  }

  function selectedProfile() {
    const profiles = allProfiles();
    const uid = state.selectedProfileUid;
    return profiles.find(p => p.uid === uid) ||
      profiles.find(p => p.uid === currentUid()) ||
      null;
  }

  function selectedRoom() {
    const rooms = visibleRooms();
    const id = state.selectedRoomId;
    return rooms.find(room => room.id === id) || rooms[0] || null;
  }

  function isRoomJoined(room) {
    const uid = currentUid();
    if (!room || !uid) return false;
    if (room.hostUid === uid || state.joinedRoomId === room.id) return true;
    if (Array.isArray(room.currentParticipantIds) && room.currentParticipantIds.includes(uid)) return true;
    return state.watchedRoomId === room.id && state.roomMembers.some(member => member.uid === uid);
  }

  function sortRooms(rooms) {
    const sorted = [...rooms];
    if (state.roomSort === 'Capacity') {
      sorted.sort((a, b) => (b.maxPeople || 0) - (a.maxPeople || 0));
      return sorted;
    }
    if (state.roomSort === 'Newest') {
      sorted.sort((a, b) => (timestampValue(b.createdAt) || 0) - (timestampValue(a.createdAt) || 0));
      return sorted;
    }
    sorted.sort((a, b) =>
      (b.participantCount || 0) - (a.participantCount || 0) ||
      (timestampValue(b.updatedAt) || timestampValue(b.createdAt) || 0) - (timestampValue(a.updatedAt) || timestampValue(a.createdAt) || 0)
    );
    return sorted;
  }

  function timestampValue(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    return 0;
  }

  function roomCreatorName(room) {
    return room.createdByName || room.creatorName || room.hostName || 'Member';
  }

  function formatRoomCreatedAt(room) {
    const value = timestampValue(room?.createdAt);
    if (!value) return 'Unknown time';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  function planSnapshot(plan) {
    if (!plan) return null;
    return {
      id: plan.id || '',
      name: plan.name || 'Workout Plan',
      startDate: plan.startDate || null,
      days: JSON.parse(JSON.stringify(plan.days || [])).map(day => ({
        name: day.name || 'Training Day',
        weekDay: day.weekDay === undefined ? null : day.weekDay,
        exercises: (day.exercises || []).map(ex => ({
          name: ex.name || '',
          defaultSets: parseInt(ex.defaultSets, 10) || 3,
          defaultReps: ex.defaultReps || 8,
        })).filter(ex => ex.name),
      })).filter(day => day.exercises.length),
    };
  }

  function searchTokens(name, email) {
    const source = `${name || ''} ${email || ''}`.toLowerCase().replace(/[^a-z0-9@. ]+/g, ' ');
    const tokens = new Set();
    source.split(/\s+/).filter(Boolean).forEach(part => {
      for (let i = 1; i <= Math.min(part.length, 12); i++) tokens.add(part.slice(0, i));
    });
    return [...tokens].slice(0, 80);
  }

  function searchNeedles(value) {
    const clean = String(value || '').toLowerCase().replace(/[^a-z0-9@. ]+/g, ' ').trim();
    const compact = clean.replace(/\s+/g, '');
    return [clean, compact].filter(Boolean);
  }

  function profileSearchText(profile) {
    return [
      profile.displayName,
      profile.displayNameLower,
      usernameFor(profile),
      profile.emailLower,
      profile.activePlan?.name,
      ...(Array.isArray(profile.searchTokens) ? profile.searchTokens : []),
    ].join(' ').toLowerCase();
  }

  function matchesProfileQuery(profile, query) {
    const text = profileSearchText(profile);
    const compactText = text.replace(/[^a-z0-9@.]+/g, '');
    return searchNeedles(query).some(needle => text.includes(needle) || compactText.includes(needle));
  }

  async function syncOwnProfile() {
    const me = Auth.getUser();
    if (!me) return;
    const ref = db().collection('social_profiles').doc(me.uid);
    const snap = await ref.get();
    const displayName = me.displayName || 'FitTrack Member';
    const reservedUsername = await reserveUniqueUsername(me.uid, snap.data()?.username || displayName);
    const payload = {
      uid: me.uid,
      displayName,
      displayNameLower: displayName.toLowerCase(),
      emailLower: (me.email || '').toLowerCase(),
      photoURL: me.photoURL || '',
      username: reservedUsername.username,
      usernameKey: reservedUsername.key,
      searchTokens: searchTokens(displayName, me.email),
      activePlan: planSnapshot(Plans.getActivePlan()),
      updatedAt: now(),
    };
    if (!snap.exists) {
      await ref.set({ ...payload, followersCount: 0, followingCount: 0, createdAt: now() });
      return;
    }
    await ref.set(payload, { merge: true });
  }

  async function reserveUniqueUsername(uid, preferred) {
    const base = usernameKey(preferred);
    for (let i = 0; i < 50; i++) {
      const key = i === 0 ? base : `${base}${i + 1}`;
      const username = usernameFromKey(key);
      const existingProfiles = await db().collection('social_profiles').where('username', '==', username).limit(1).get();
      const legacyTaken = !existingProfiles.empty && existingProfiles.docs[0].id !== uid;
      if (legacyTaken) continue;

      const usernameRef = db().collection('social_usernames').doc(key);
      const claimed = await db().runTransaction(async tx => {
        const usernameSnap = await tx.get(usernameRef);
        if (usernameSnap.exists && usernameSnap.data().uid !== uid) return false;
        tx.set(usernameRef, { uid, username, usernameKey: key, updatedAt: now() }, { merge: true });
        return true;
      });
      if (claimed) return { username, key };
    }
    throw new Error('Could not reserve a unique username.');
  }

  function watchProfiles() {
    // 1. Heartbeat to keep user marked as "online"
    const uid = currentUid();
    const heartbeat = () => {
      if (!uid) return;
      db().collection('social_profiles').doc(uid).set({
        updatedAt: now()
      }, { merge: true });
    };
    heartbeat(); // Run once immediately
    const heartbeatTimer = setInterval(heartbeat, 60000); // Every 60s
    state.unsubs.push(() => clearInterval(heartbeatTimer));

    // 2. Watch all profiles for status updates
    const unsub = db().collection('social_profiles').limit(60).onSnapshot(snap => {
      state.profiles = snap.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
      renderIfActive();
    }, err => {
      console.warn('Social profiles listener failed', err);
    });
    state.unsubs.push(unsub);
  }

  function watchFollows() {
    const uid = currentUid();
    if (!uid) return;
    const followingUnsub = db().collection('social_follows').where('followerUid', '==', uid).onSnapshot(snap => {
      state.following = new Set(snap.docs.map(doc => doc.data().followingUid));
      renderIfActive();
    }, err => console.warn('Following listener failed', err));
    const followersUnsub = db().collection('social_follows').where('followingUid', '==', uid).onSnapshot(snap => {
      state.followers = new Set(snap.docs.map(doc => doc.data().followerUid));
      renderIfActive();
    }, err => console.warn('Followers listener failed', err));
    state.unsubs.push(followingUnsub, followersUnsub);
  }

  function watchRooms() {
    const unsub = db().collection('social_rooms').limit(MAX_ROOM_LIMIT).onSnapshot(snap => {
      state.rooms = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      renderIfActive();
    }, err => console.warn('Rooms listener failed', err));
    state.unsubs.push(unsub);
  }

  function chatIdFor(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
  }

  async function init(user) {
    bindPageLifecycleEvents();
    clearUnsubs('unsubs');
    clearUnsubs('activeRoomUnsubs');
    clearUnsubs('activeChatUnsubs');
    stopRoomPresence();
    stopRoomAudio();
    state.user = user || null;
    state.profiles = [];
    state.rooms = [];
    state.following = new Set();
    state.followers = new Set();
    state.roomMembers = [];
    state.roomMessages = [];
    state.dmMessages = [];
    state.watchedRoomId = null;
    state.watchedChatId = null;
    state.mobileChatOpen = false;
    state.joinedRoomId = null;
    state.currentRoomId = null;
    state.roomMembersLoaded = false;
    state.roomExitPending = null;
    if (!user) {
      renderIfActive();
      return;
    }
    try {
      await syncOwnProfile();
      await flushPendingRoomExit(user.uid);
      watchProfiles();
      watchFollows();
      watchRooms();
    } catch (err) {
      console.warn('Social init failed', err);
    }
  }

  function ensureRoomWatch(room) {
    if (!room || !currentUid()) {
      if (state.watchedRoomId) {
        clearUnsubs('activeRoomUnsubs');
        state.watchedRoomId = null;
        state.roomMembersLoaded = false;
        stopRoomPresence();
      }
      return;
    }
    if (state.watchedRoomId === room.id) return;
    clearUnsubs('activeRoomUnsubs');
    stopRoomPresence();
    state.watchedRoomId = room.id;
    state.roomMembers = [];
    state.roomMessages = [];
    state.roomMembersLoaded = false;
    startRoomPresence(room);
    const roomRef = db().collection('social_rooms').doc(room.id);
    state.activeRoomUnsubs.push(roomRef.collection('members').onSnapshot(snap => {
      state.roomMembers = snap.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
      state.roomMembersLoaded = true;
      if (state.currentRoomId === room.id) syncRoomPeers(room);
      if (roomRouteId() === room.id && currentUid() && !state.roomMembers.some(member => member.uid === currentUid())) {
        stopRoomAudio();
        stopRoomPresence();
        state.joinedRoomId = null;
      }
      renderIfActive();
    }, err => console.warn('Room members listener failed', err)));
    state.activeRoomUnsubs.push(roomRef.collection('messages').orderBy('createdAt', 'asc').limit(50).onSnapshot(snap => {
      state.roomMessages = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      renderIfActive();
    }, err => console.warn('Room messages listener failed', err)));
  }

  function stopRoomPresence() {
    if (state.roomPresenceTimer) {
      clearInterval(state.roomPresenceTimer);
      state.roomPresenceTimer = null;
    }
  }

  function startRoomPresence(room) {
    stopRoomPresence();
    if (!room || !currentUid() || !isRoomJoined(room)) return;
    touchRoomMember(room.id);
    state.roomPresenceTimer = setInterval(() => {
      const activeRoom = roomById(room.id);
      if (!activeRoom || !isRoomJoined(activeRoom) || state.currentRoomId !== room.id) {
        stopRoomPresence();
        return;
      }
      touchRoomMember(room.id);
    }, ROOM_HEARTBEAT_MS);
  }

  function touchRoomMember(roomId) {
    const uid = currentUid();
    if (!uid || !roomId) return;
    db().collection('social_rooms').doc(roomId).collection('members').doc(uid).set({
      uid,
      updatedAt: now(),
    }, { merge: true }).then(() => {
      state.heartbeatFailures = 0;
    }).catch(err => {
      console.warn('Room presence update failed', err);
      state.heartbeatFailures++;
      if (state.heartbeatFailures === 3) {
        App.toast('Connection unstable. You might appear offline to others.', 'error', 5000);
      }
    });
  }

  function rememberPendingRoomExit(room, uid) {
    if (!room?.id || !uid) return;
    try {
      localStorage.setItem(ROOM_EXIT_STORAGE_KEY, JSON.stringify({
        roomId: room.id,
        uid,
        host: room.hostUid === uid,
        at: now(),
      }));
    } catch (err) {
      console.warn('Could not store room exit state', err);
    }
  }

  function forgetPendingRoomExit(roomId = '') {
    try {
      if (!roomId) {
        localStorage.removeItem(ROOM_EXIT_STORAGE_KEY);
        return;
      }
      const pending = JSON.parse(localStorage.getItem(ROOM_EXIT_STORAGE_KEY) || 'null');
      if (pending?.roomId === roomId) localStorage.removeItem(ROOM_EXIT_STORAGE_KEY);
    } catch (err) {
      localStorage.removeItem(ROOM_EXIT_STORAGE_KEY);
    }
  }

  async function flushPendingRoomExit(uid) {
    let pending = null;
    try {
      pending = JSON.parse(localStorage.getItem(ROOM_EXIT_STORAGE_KEY) || 'null');
    } catch (err) {
      forgetPendingRoomExit();
      return;
    }
    if (!pending?.roomId || pending.uid !== uid) return;
    if (now() - (Number(pending.at) || 0) > 24 * 60 * 60 * 1000) {
      forgetPendingRoomExit();
      return;
    }
    const roomRef = db().collection('social_rooms').doc(pending.roomId);
    try {
      if (pending.host) {
        const batch = db().batch();
        batch.delete(roomRef.collection('members').doc(uid));
        batch.delete(roomRef);
        batch.delete(db().collection('social_room_hosts').doc(uid));
        await batch.commit();
      } else {
        await db().runTransaction(async tx => {
          const roomSnap = await tx.get(roomRef);
          const memberRef = roomRef.collection('members').doc(uid);
          const memberSnap = await tx.get(memberRef);
          if (memberSnap.exists) tx.delete(memberRef);
          if (!roomSnap.exists) return;
          const roomData = roomSnap.data();
          const participantIds = Array.isArray(roomData.currentParticipantIds) ? roomData.currentParticipantIds : [];
          if (!participantIds.includes(uid)) return;
          const remainingIds = participantIds.filter(id => id && id !== uid);
          if (!remainingIds.length) {
            tx.delete(roomRef);
            return;
          }
          tx.set(roomRef, {
            participantCount: remainingIds.length,
            currentParticipantIds: remainingIds,
            updatedAt: now(),
          }, { merge: true });
        });
      }
      forgetPendingRoomExit(pending.roomId);
    } catch (err) {
      console.warn('Pending room exit cleanup failed', err);
    }
  }

  function ensureChatWatch(profile) {
    if (!profile || !currentUid() || !isMutual(profile)) {
      if (state.watchedChatId) {
        clearUnsubs('activeChatUnsubs');
        state.watchedChatId = null;
      }
      return;
    }
    const chatId = chatIdFor(currentUid(), profile.uid);
    if (state.watchedChatId === chatId) return;
    clearUnsubs('activeChatUnsubs');
    state.watchedChatId = chatId;
    state.dmMessages = [];
    const chatRef = db().collection('social_chats').doc(chatId);

    // Watch for typing status
    state.activeChatUnsubs.push(chatRef.onSnapshot(doc => {
      const data = doc.data();
      if (data && data.typing) {
        state.typingStatus[chatId] = data.typing;
        renderIfActive();
      }
    }));

    // Watch and mark messages as seen
    state.activeChatUnsubs.push(chatRef.collection('messages')
      .orderBy('createdAt', 'asc').limit(60).onSnapshot(snap => {
        const messages = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        state.dmMessages = messages;

        // Mark incoming 'sent' messages as 'seen'
        const me = currentUid();
        messages.forEach(msg => {
          if (msg.senderUid !== me && msg.status === 'sent') {
            chatRef.collection('messages').doc(msg.id).update({ status: 'seen' });
          }
        });

        renderIfActive();
      }, err => console.warn('Direct chat listener failed', err)));
  }

  function renderRooms() {
    const el = document.getElementById('view-rooms');
    if (!el) return;
    el.innerHTML = `
      <div class="social-shell">
        ${renderTopbar('Rooms')}
        <div class="social-rooms-only">
          ${renderRoomsBody()}
        </div>
        ${state.showCreateRoom ? renderCreateRoomModal() : ''}
        ${state.fullPlanProfileUid ? renderFullPlanModal() : ''}
      </div>`;
    bindRoomEvents(el);
  }

  function renderRoomsBody() {
    const rooms = visibleRooms();
    const room = selectedRoom();
    const people = state.query.trim()
      ? visibleProfiles().slice(0, 8)
      : [];
    state.selectedRoomId = room?.id || null;
    return `
      ${state.query.trim() ? renderPeopleResults(people) : ''}
      <section class="social-panel social-room-list-panel social-room-list-panel-wide">
        <div class="social-panel-head social-room-list-head">
          <h2><span>${icon('room')}</span> Live Rooms</h2>
          <div class="social-room-head-tools">
            <label class="social-sort">Sort:
              <select id="social-room-sort" aria-label="Sort rooms">
                ${['Active', 'Newest', 'Capacity'].map(item => `<option${state.roomSort === item ? ' selected' : ''}>${item}</option>`).join('')}
              </select>
            </label>
          </div>
        </div>
        ${rooms.length
          ? `<div class="social-room-card-grid">${rooms.map(item => renderRoomCard(item, room?.id === item.id)).join('')}</div>`
          : renderEmptyState(
              state.query.trim() ? 'No real rooms found' : 'No live rooms yet',
              state.query.trim() ? 'Try a different room topic or person name.' : 'Create the first real room for your community.',
              state.user ? 'Create Room' : 'Sign In',
              state.user ? 'data-open-room-modal' : 'data-social-signin'
            )}
      </section>`;
  }

  function refreshRoomsBody(el = document.getElementById('view-rooms')) {
    const body = el?.querySelector('.social-rooms-only');
    if (!body) {
      renderRooms();
      return;
    }
    body.innerHTML = renderRoomsBody();
    bindRoomBodyEvents(el);
  }

  function renderRoomPage() {
    const el = document.getElementById('view-room');
    if (!el) return;
    const roomId = roomRouteId();
    const room   = roomById(roomId);
    state.currentRoomId = roomId;
    state.selectedRoomId = roomId;

    if (!state.user) {
      el.innerHTML = `
        <div class="voice-room-shell voice-room-empty">
          <div class="social-empty-state">
            <strong>Sign in to join this room</strong>
            <p>Voice rooms need your FitTrack account before the mic can connect.</p>
            <button class="social-empty-action" type="button" data-social-signin>Sign In</button>
          </div>
        </div>`;
      bindSharedEvents(el);
      return;
    }

    if (!room) {
      if (state.roomNotFound) {
        el.innerHTML = `
          <div class="voice-room-shell voice-room-empty">
            <div class="social-empty-state">
              <strong>Room not found</strong>
              <p>This room may have been closed by the host or the link is invalid.</p>
              <button class="social-empty-action" type="button" data-nav-rooms>Back to Rooms</button>
            </div>
          </div>`;
      } else {
        el.innerHTML = `
          <div class="voice-room-shell voice-room-empty">
            <div class="social-empty-state">
              <strong>Loading room...</strong>
              <p>Connecting to FitTrack social network...</p>
              <button class="social-empty-action" type="button" data-nav-rooms>Back to Rooms</button>
            </div>
          </div>`;
        if (!state.roomLoadTimeout) {
          state.roomLoadTimeout = setTimeout(() => {
            state.roomLoadTimeout = null;
            if (!roomById(roomId)) {
              state.roomNotFound = true;
              renderRoomPage();
            }
          }, 8000);
        }
      }
      bindSharedEvents(el);
      return;
    }

    // Room found, clear loading states
    if (state.roomLoadTimeout) { clearTimeout(state.roomLoadTimeout); state.roomLoadTimeout = null; }
    state.roomNotFound = false;

    checkMicPermission();

    ensureRoomWatch(room);
    const members = state.watchedRoomId === room.id && state.roomMembersLoaded
      ? activeRoomMembers(room)
      : (state.roomMembers.length ? activeRoomMembers(room) : roomParticipants(room));
    const isHost = room.hostUid === currentUid();
    const joined = isRoomJoined(room);
    const count = roomCount(room) || members.length;
    const max = room.maxPeople || 10;
    const locked = isRoomLocked(room);
    const voiceEnabled = room.voiceEnabled !== false;
    const chatEnabled = room.chatEnabled !== false;
    const micLive = state.roomAudioStarted && state.micOn;
    const micBlocked = state.micPermission === 'denied';
    const micTitle = micBlocked ? 'Microphone is blocked by your browser' : (voiceEnabled ? (micLive ? 'Mute mic' : 'Unmute mic') : 'Voice is disabled for this room');
    const hangupTitle = isHost ? 'End room' : 'Leave room';
    const showingSettings = isHost && state.showRoomSettings;

    if (locked) {
      el.innerHTML = `
        <div class="voice-room-shell voice-room-empty">
          <div class="voice-locked-state">
            <span class="voice-locked-icon">${icon('room')}</span>
            <strong>Room locked</strong>
            <p>${esc(room.topic || 'This room')} is full at ${count} / ${max}. Wait for someone to leave or choose another live room.</p>
            <button class="social-empty-action" type="button" data-nav-rooms>Back to Rooms</button>
          </div>
        </div>`;
      bindSharedEvents(el);
      return;
    }

    el.innerHTML = `
      <div class="voice-room-shell${showingSettings ? ' is-settings-open' : ' is-info-open'}">
        <main class="voice-room-stage">
          <div class="voice-stage-glow" aria-hidden="true"></div>
          ${micBlocked ? `<div class="voice-mic-warning">
            ${icon('micOff')} <span>Mic access blocked. Click the lock icon in your browser address bar to allow.</span>
          </div>` : ''}
          <div class="voice-room-controls" aria-label="Room controls">
            <button class="voice-control${micLive ? ' active' : ' muted'}${voiceEnabled ? '' : ' disabled'}${micBlocked ? ' blocked' : ''}" type="button" ${voiceEnabled ? 'data-room-mic' : 'disabled'} title="${micTitle}" aria-label="${micTitle}">${micLive ? icon('mic') : icon('micOff')}</button>
            <button class="voice-control hangup" type="button" data-room-hangup title="${hangupTitle}" aria-label="${hangupTitle}">${icon('phoneOff')}</button>
          </div>

          <div class="voice-member-strip">
            ${members.map(member => renderVoiceMember(member, room, isHost)).join('')}
          </div>
        </main>

        <aside class="voice-room-panel">
          <div class="voice-panel-tabs">
            <button class="${showingSettings ? '' : 'active'}" type="button" data-room-chat title="Chat" aria-label="Chat">${icon('chat')}</button>
            ${isHost ? `<button class="${showingSettings ? 'active' : ''}" type="button" data-room-settings title="Room settings" aria-label="Room settings">${icon('settings')}</button>` : ''}
          </div>
          ${showingSettings ? renderRoomSettings(room, count) : `
            <section class="voice-room-info">
              <div class="voice-room-info-head">
                <h2>Room Info</h2>
                <span class="voice-info-icon">${icon('info')}</span>
              </div>
              <div class="voice-room-info-row">
                <span class="voice-row-icon icon-purple">${icon('note')}</span>
                <p><strong>Topic:</strong> ${esc(room.topic || 'Room')}</p>
              </div>
              <div class="voice-room-info-row">
                <span class="voice-row-icon icon-blue">${icon('globe')}</span>
                <p><strong>Language:</strong> ${esc(roomLanguage(room))}</p>
              </div>
              <div class="voice-room-info-row">
                <span class="voice-row-icon icon-gold">${icon('crown')}</span>
                <p><strong>Host:</strong> ${esc(room.hostName || 'Member')}</p>
              </div>
              <div class="voice-room-info-row">
                <span class="voice-row-icon icon-green">${icon('people')}</span>
                <p><strong>Limit:</strong> ${count} / ${max}</p>
              </div>
            </section>
          `}
          <div class="voice-room-chat">
            ${chatEnabled
              ? (state.roomMessages.length ? state.roomMessages.map(msg => renderRoomMessage(msg)).join('') : '<div class="social-empty-thread">No room messages yet.</div>')
              : '<div class="social-empty-thread">Chat is disabled for this room.</div>'}
          </div>
          <form class="voice-message-form" id="social-room-message-form">
            <input class="input" id="social-room-message-input" placeholder="${chatEnabled ? 'Type a message...' : 'Chat disabled'}" ${chatEnabled ? '' : 'disabled'}>
            <button class="social-send-btn" type="submit" aria-label="Send room message" ${chatEnabled ? '' : 'disabled'}>${icon('send')}</button>
          </form>
        </aside>
      </div>`;
    bindRoomPageEvents(el, room);
    scrollRoomThreadToEnd();
  }

  function scrollRoomThreadToEnd() {
    requestAnimationFrame(() => {
      const thread = document.querySelector('.voice-room-chat');
      if (thread) thread.scrollTop = thread.scrollHeight;
    });
  }

  function renderVoiceMember(member, room, isHost) {
    const own = member.uid === currentUid();
    const host = member.uid === room.hostUid || member.role === 'Host';
    return `
      <article class="voice-member-card${own ? ' self' : ''}${member.micOn === false ? ' muted' : ''}">
        ${avatar(member, 'social-avatar-lg voice-avatar')}
        <div>
          <strong>${esc(member.displayName || 'Member')}</strong>
          <span>${host ? 'Host' : own ? 'You' : 'Member'}</span>
        </div>
        <i>${member.micOn === false ? icon('micOff') : icon('mic')}</i>
        ${isHost && !host && !own ? `<button type="button" data-kick-member="${esc(member.uid)}" title="Kick member">${icon('userX')}</button>` : ''}
      </article>`;
  }

  function renderRoomSettings(room, count) {
    const minLimit = Math.max(2, count || 1);
    return `
      <section class="voice-room-settings">
        <h2>Settings</h2>
        <form id="voice-room-settings-form">
          <div class="form-group">
            <label for="voice-room-title">Title</label>
            <input class="input" id="voice-room-title" maxlength="80" value="${esc(room.topic || '')}" required>
          </div>
          <div class="form-group">
            <label for="voice-room-language">Language</label>
            <input class="input" id="voice-room-language" list="voice-room-language-list" value="${esc(roomLanguage(room))}" autocomplete="off" required>
            <datalist id="voice-room-language-list">
              ${renderLanguageOptions()}
            </datalist>
          </div>
          <div class="form-group">
            <label for="voice-room-limit">People limit</label>
            <input class="input" id="voice-room-limit" type="number" min="${minLimit}" max="50" value="${esc(room.maxPeople || 10)}" required>
          </div>
          <button class="voice-settings-save" type="submit">Save Settings</button>
        </form>
      </section>`;
  }

  function renderProfile() {
    const el = document.getElementById('view-profile');
    if (!el) return;
    const profile = selectedProfile();
    if (!profile) {
      el.innerHTML = `
        <div class="social-shell social-profile-page">
          <div class="social-profile-page-head">
            <button type="button" class="social-back-btn" data-back-rooms>‹ Rooms</button>
            <h1>Profile</h1>
          </div>
          ${renderEmptyState(
            state.user ? 'Profile not found' : 'Sign in to view profiles',
            state.user ? 'Search for a registered FitTrack member from Rooms.' : 'Profiles are only available for real signed-in members.',
            state.user ? 'Back to Rooms' : 'Sign In',
            state.user ? 'data-back-rooms' : 'data-social-signin'
          )}
        </div>`;
      bindProfileEvents(el);
      return;
    }
    state.selectedProfileUid = profile.uid;
    el.innerHTML = `
      <div class="social-shell social-profile-page">
        <div class="social-profile-page-head">
          <button type="button" class="social-back-btn" data-back-rooms>‹ Rooms</button>
          <h1>Profile</h1>
        </div>
        <div class="social-profile-page-grid">
          ${renderProfileCard(profile)}
          ${renderProfilePlanDetail(profile)}
        </div>
        ${state.fullPlanProfileUid ? renderFullPlanModal() : ''}
      </div>`;
    bindProfileEvents(el);
  }

  function renderPeopleResults(people) {
    return `
      <section class="social-panel social-people-results">
        <div class="social-panel-head">
          <h2><span>${icon('people')}</span> People</h2>
          <small>${people.length} result${people.length === 1 ? '' : 's'}</small>
        </div>
        ${people.length ? `
          <div class="social-person-grid">
            ${people.map(profile => `
              <button type="button" class="social-person-result" data-open-profile="${esc(profile.uid)}" aria-label="Open ${esc(profile.displayName || 'member')} profile">
                ${avatar(profile)}
                <span>
                  <strong>${esc(profile.displayName || 'Member')}</strong>
                  <small>${esc(usernameFor(profile))}</small>
                </span>
                <em>${esc(profile.activePlan?.name || 'No public plan')}</em>
              </button>
            `).join('')}
          </div>
        ` : renderEmptyState('No real people found', 'Only registered FitTrack members appear here. Try another name or username.')}
      </section>`;
  }

  function renderChat() {
    const el = document.getElementById('view-chat');
    if (!el) return;
    const mutuals = mutualProfiles();
    const mobile = isMobileChat();
    const selectedProfile = mutuals.find(p => p.uid === state.activeChatUid) || null;
    const profile = mobile
      ? state.mobileChatOpen ? selectedProfile : null
      : selectedProfile || mutuals[0] || null;
    state.activeChatUid = profile?.uid || null;
    state.selectedProfileUid = profile?.uid || null;
    ensureChatWatch(profile);

    // If already rendered the shell AND same chat, just update the thread and list to keep focus
    const shell = el.querySelector('.social-shell');
    if (shell && state.lastRenderedChatUid === profile?.uid && !mobile) {
      const thread = el.querySelector('.social-dm-thread');
      if (thread && profile) thread.innerHTML = renderDirectMessages(profile);
      const railList = el.querySelector('.social-chat-rail-list');
      if (railList) railList.innerHTML = renderChatListItems(mutuals);
      scrollDirectThreadToEnd();
      return;
    }

    state.lastRenderedChatUid = profile?.uid;

    if (mobile) {
      el.innerHTML = profile ? renderMobileChatDetail(profile) : renderMobileChatList();
      bindChatEvents(el);
      if (profile) scrollDirectThreadToEnd();
      return;
    }

    el.innerHTML = `
      <div class="social-shell">
        ${renderTopbar('Chat')}
        <div class="social-chat-workspace">
          ${renderChatRail(true)}
          ${profile ? `
            <section class="social-panel social-dm-panel">
              <div class="social-dm-head">
                <div>${avatar(profile, 'social-avatar-lg')}</div>
                <div>
                  <h2>
                    <button class="social-dm-profile-link" type="button" data-open-profile="${esc(profile.uid)}">
                      ${esc(profile.displayName || 'Member')}
                    </button>
                  </h2>
                  <p>Mutual chat</p>
                </div>
              </div>
              <div class="social-dm-thread">
                ${renderDirectMessages(profile)}
              </div>
              <form class="social-message-form" id="social-direct-form">
                <input class="input" id="social-direct-input" placeholder="Message..." autocomplete="off">
                <button class="social-send-btn" type="submit" aria-label="Send direct message">${icon('send')}</button>
              </form>
            </section>
          ` : `
            <section class="social-panel social-dm-panel social-dm-empty-panel">
              ${renderEmptyState(
                state.user ? 'No mutual chats yet' : 'Sign in to chat',
                state.user ? 'Follow someone, and once they follow you back, your chat will unlock here.' : 'Chats only work between real signed-in members.',
                state.user ? 'Find People' : 'Sign In',
                state.user ? 'data-nav-rooms' : 'data-social-signin'
              )}
            </section>
          `}
        </div>
        ${state.fullPlanProfileUid ? renderFullPlanModal() : ''}
      </div>`;
    bindChatEvents(el);
    scrollDirectThreadToEnd();
  }

  function isMobileChat() {
    return window.matchMedia?.('(max-width: 768px)').matches ||
      window.innerWidth <= 768 ||
      document.documentElement.clientWidth <= 768;
  }

  function renderMobileChatList() {
    const people = mutualProfiles();
    return `
      <div class="social-shell social-mobile-chat-list">
        <div class="social-mobile-chat-head">
          <h1>Chat</h1>
        </div>
        <section class="social-panel social-chat-rail social-chat-rail-full">
          <div class="social-panel-head">
            <h2>Mutual Friends</h2>
            <small>${people.length}</small>
          </div>
          <label class="social-rail-search">
            <span>${icon('search')}</span>
            <input type="search" id="social-mutual-search" value="${esc(state.mutualQuery)}" placeholder="Search mutual friends">
          </label>
          <div class="social-chat-list">
            ${renderChatListItems(people)}
          </div>
        </section>
        ${state.fullPlanProfileUid ? renderFullPlanModal() : ''}
      </div>`;
  }

  function renderMobileChatDetail(profile) {
    const isOnline = profile?.updatedAt && (now() - profile.updatedAt < 120000);
    return `
      <div class="social-shell social-mobile-chat-detail">
        <section class="social-panel social-dm-panel social-dm-mobile-panel">
          <div class="social-dm-head social-mobile-dm-head">
            <button class="social-mobile-chat-back" type="button" data-chat-back aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            ${avatar(profile, 'social-avatar-sm')}
            <div class="social-mobile-dm-info">
              <strong>${esc(profile.displayName || 'Member')}</strong>
              <span class="${isOnline ? 'dm-status-online' : 'dm-status-offline'}">${isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div class="social-mobile-dm-actions">
              <button class="social-dm-icon-btn" type="button" aria-label="Call">${icon('phone')}</button>
              <button class="social-dm-icon-btn" type="button" aria-label="More">${icon('dots')}</button>
            </div>
          </div>
          <div class="social-dm-date-sep"><span>Today</span></div>
          <div class="social-dm-thread">
            ${renderDirectMessages(profile)}
          </div>
          <form class="social-message-form" id="social-direct-form">
            <button class="social-dm-attach-btn" type="button" aria-label="Attach">${icon('plus')}</button>
            <input class="input" id="social-direct-input" placeholder="Type a message..." autocomplete="off">
            <button class="social-send-btn" type="submit" aria-label="Send">${icon('send')}</button>
          </form>
        </section>
        ${state.fullPlanProfileUid ? renderFullPlanModal() : ''}
      </div>`;
  }

  function renderTopbar(title) {
    const isRooms = title === 'Rooms';
    if (!isRooms) {
      return `
        <div class="social-topbar">
          <h1 class="social-title">${esc(title)}</h1>
        </div>`;
    }
    const searchValue = isRooms ? state.query : state.mutualQuery;
    const searchPlaceholder = isRooms ? 'Search rooms or people' : 'Search mutual friends';
    return `
      <div class="social-topbar">
        <h1 class="social-title">${esc(title)}</h1>
        <label class="social-global-search">
          <span>${icon('search')}</span>
          <input id="social-search" type="search" value="${esc(searchValue)}" placeholder="${esc(searchPlaceholder)}" autocomplete="off">
        </label>
        ${isRooms ? `
          <button class="social-create-btn" id="social-create-room" type="button">${icon('plus')} Create Room</button>
        ` : ''}
      </div>`;
  }

  function renderChatListItems(people) {
    return people.length ? people.map(profile => `
      <button class="social-chat-person${state.activeChatUid === profile.uid ? ' active' : ''}" type="button" data-open-chat="${esc(profile.uid)}">
        ${avatar(profile)}
        <span class="social-chat-copy">
          <strong>${esc(profile.displayName || 'Member')}</strong>
          <small>Open chat</small>
        </span>
        <span class="social-chat-meta">
          <small>Mutual</small>
        </span>
      </button>
    `).join('') : renderEmptyState('No mutuals', 'Mutual chats appear after both people follow each other.');
  }

  function renderChatRail(isFull = false) {
    const people = mutualProfiles().slice(0, isFull ? 8 : 4);
    return `
      <aside class="social-panel social-chat-rail ${isFull ? 'social-chat-rail-full' : ''}">
        <div class="social-panel-head">
          <h2>Mutual Chats</h2>
          <small>${people.length}</small>
        </div>
        <label class="social-rail-search">
          <span>${icon('search')}</span>
          <input type="search" id="social-mutual-search" value="${esc(state.mutualQuery)}" placeholder="Search mutual friends">
        </label>
        <div class="social-chat-list">
          ${renderChatListItems(people)}
        </div>
      </aside>`;
  }

  function refreshChatRail(root) {
    const isFull = !!root.querySelector('.social-chat-rail-full');
    const people = mutualProfiles().slice(0, isFull ? 8 : 4);
    const count = root.querySelector('.social-chat-rail .social-panel-head small');
    const list = root.querySelector('.social-chat-list');
    if (count) count.textContent = people.length;
    if (!list) return;
    const scrollTop = list.scrollTop;
    list.innerHTML = renderChatListItems(people);
    list.scrollTop = scrollTop;
    list.querySelectorAll('[data-open-chat]').forEach(btn => {
      btn.addEventListener('click', () => startChat(btn.dataset.openChat, true));
    });
  }

  function mutualProfiles() {
    const q = state.mutualQuery.trim().toLowerCase();
    return allProfiles()
      .filter(profile => profile.uid !== currentUid() && isMutual(profile))
      .filter(profile => {
        if (!q) return true;
        return [profile.displayName, usernameFor(profile), profile.activePlan?.name]
          .join(' ').toLowerCase().includes(q);
      });
  }

  function roomParticipants(room) {
    const profiles = allProfiles();
    const ids = Array.isArray(room.currentParticipantIds) ? room.currentParticipantIds : [];
    const people = ids
      .map(uid => profiles.find(profile => profile.uid === uid))
      .filter(Boolean)
      .slice(0, 4);
    if (!people.length && room.hostUid) {
      people.push({
        uid: room.hostUid,
        displayName: room.hostName || 'Host',
        photoURL: room.hostPhoto || '',
        online: true,
      });
    }
    return people;
  }

  function renderEmptyState(title, body, actionLabel = '', actionAttr = '') {
    return `
      <div class="social-empty-state">
        <strong>${esc(title)}</strong>
        <p>${esc(body)}</p>
        ${actionLabel ? `<button class="social-empty-action" type="button" ${actionAttr}>${esc(actionLabel)}</button>` : ''}
      </div>`;
  }

  function renderRoomCard(room, active) {
    const count = roomCount(room);
    const max = room.maxPeople || 10;
    const joined = isRoomJoined(room);
    const locked = isRoomLocked(room);
    const avatars = roomParticipants(room).slice(0, 3);
    const emptySlots = Math.max(0, Math.min(3, max || 3) - avatars.length);
    const infoOpen = state.openRoomInfoId === room.id;
    return `
      <article class="social-room-card${active ? ' active' : ''}${locked ? ' locked' : ''}" data-select-room="${esc(room.id)}">
        <div class="social-room-card-head">
          <span class="social-room-card-icon">${icon('room')}</span>
          <div>
            <h3>${esc(room.topic || 'Untitled Room')}</h3>
            <p><strong>${esc(roomLanguage(room))}</strong> <span>Host: ${esc(room.hostName || 'Member')}</span></p>
          </div>
          <button class="social-room-card-tools" type="button" data-room-info="${esc(room.id)}" aria-expanded="${infoOpen}" aria-label="Room details">${icon('dots')}</button>
        </div>
        ${infoOpen ? renderRoomInfoPopover(room) : ''}
        <div class="social-room-card-stage">
          ${avatars.map(profile => `
            <div class="social-room-card-member">
              ${avatar(profile, 'social-avatar-card')}
              <span>${icon('mic')} ${esc(profile.uid === room.hostUid ? 'Host' : 'Member')}</span>
            </div>
          `).join('')}
          ${Array.from({ length: emptySlots }).map(() => '<div class="social-room-card-empty" aria-hidden="true"></div>').join('')}
        </div>
        <div class="social-room-card-foot">
          <span class="social-tag">${count} / ${max}</span>
          ${locked
            ? `<span class="social-card-join is-locked" aria-label="Room locked">${icon('room')} Room locked</span>`
            : `<button class="social-card-join" type="button" data-join-room="${esc(room.id)}">${icon('phone')} ${joined ? 'Open room' : 'Join and talk now!'}</button>`}
        </div>
      </article>`;
  }

  function renderRoomInfoPopover(room) {
    return `
      <div class="social-room-info-popover" role="dialog" aria-label="Room details">
        <button class="social-room-info-close" type="button" data-room-info-close aria-label="Close room details">${icon('x')}</button>
        <strong>Room details</strong>
        <dl>
          <div>
            <dt>Created by</dt>
            <dd>${esc(roomCreatorName(room))}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>${esc(formatRoomCreatedAt(room))}</dd>
          </div>
        </dl>
      </div>`;
  }

  function renderProfileCard(profile) {
    const self = profile.uid === currentUid();
    const mutual = isMutual(profile);
    const following = isFollowing(profile.uid);
    return `
      <section class="social-panel social-profile-card">
        <div class="social-profile-head">
          ${avatar(profile, 'social-avatar-xl')}
          <div>
            <h2>${esc(profile.displayName || 'Member')}</h2>
            <p>${esc(usernameFor(profile))}</p>
          </div>
        </div>
        <div class="social-stats">
          <div><span>Followers</span><strong>${formatCount(profile.followersCount || 0)}</strong></div>
          <div><span>Following</span><strong>${formatCount(profile.followingCount || 0)}</strong></div>
          <div class="social-mutual-pill">${icon('people')} ${mutual ? 'Mutual' : 'Profile'}</div>
        </div>
        <div class="social-profile-actions">
          ${self ? '<button class="social-primary-action" type="button" data-nav-plans>Edit Plan</button>' :
            `<button class="social-primary-action" type="button" data-follow="${esc(profile.uid)}">${following ? 'Following' : 'Follow'}</button>`}
          <button class="social-secondary-action" type="button" data-start-chat="${esc(profile.uid)}" ${mutual && !self ? '' : 'disabled'}>${icon('chat')} Chat</button>
        </div>
      </section>`;
  }

  function formatCount(value) {
    const n = Number(value) || 0;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
  }

  function renderProfilePlanDetail(profile) {
    const plan = profile.activePlan;
    if (!plan || !Array.isArray(plan.days) || !plan.days.length) {
      return `
        <section class="social-panel social-profile-plan-detail">
          <h2>Workout Plan</h2>
          <p>No public active plan yet.</p>
        </section>`;
    }
    return `
      <section class="social-panel social-profile-plan-detail">
        <div class="social-profile-plan-head">
          <div>
            <h2>${esc(plan.name || 'Workout Plan')}</h2>
            <p>${esc(profile.displayName || 'Member')}'s current active plan</p>
          </div>
          <button class="social-copy-plan" type="button" data-copy-plan="${esc(profile.uid)}">${icon('copy')} Copy Plan</button>
        </div>
        <div class="social-profile-plan-days">
          ${(plan.days || []).map(day => `
            <article>
              <h3>${esc(day.name || 'Training Day')} <span>${esc(shortWeekday(day.weekDay))}</span></h3>
              ${(day.exercises || []).map(ex => `
                <div><span>${esc(ex.name)}</span><strong>${esc(ex.defaultSets || 3)} x ${esc(ex.defaultReps || 8)}</strong></div>
              `).join('')}
            </article>
          `).join('')}
        </div>
      </section>`;
  }

  function shortWeekday(value) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return value === null || value === undefined || value === '' ? 'Day' : (names[Number(value)] || 'Day');
  }

  function renderRoomMessage(msg) {
    const own = msg.senderUid && msg.senderUid === currentUid();
    return `
      <div class="social-room-msg${own ? ' own' : ''}">
        <span>${esc(msg.senderName || 'Member')}</span>
        <p>${esc(msg.text || '')}</p>
      </div>`;
  }

  function renderDirectMessages(profile) {
    const messages = state.dmMessages;
    const typing = state.typingStatus[state.watchedChatId];
    const isOtherTyping = typing && typing[profile.uid] && (now() - typing[profile.uid] < 5000);

    let html = messages.map(msg => {
      const isOwn = msg.senderUid === currentUid();
      const ts = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
      const checkmarks = msg.status === 'seen'
        ? '<svg class="dm-checks dm-checks-seen" viewBox="0 0 18 10" fill="none"><path d="M1 5l4 4L13 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 9l4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
        : '<svg class="dm-checks" viewBox="0 0 12 10" fill="none"><path d="M1 5l4 4L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      return `
        <div class="social-dm-msg${isOwn ? ' own' : ''}">
          <p>${esc(msg.text || '')}<span class="dm-meta">${ts}${isOwn ? checkmarks : ''}</span></p>
        </div>`;
    }).join('');

    if (isOtherTyping) {
      html += `
        <div class="social-dm-msg">
          <p class="social-typing-dots">Typing...</p>
        </div>`;
    }

    if (!messages.length && !isOtherTyping) {
      return `<div class="social-empty-thread">No messages yet.</div>`;
    }
    return html;
  }

  function renderCreateRoomModal() {
    return `
      <div class="social-modal">
        <div class="social-modal-card">
          <button class="social-modal-close" type="button" id="social-close-room-modal" aria-label="Close">${icon('x')}</button>
          <h2>Create Room</h2>
          <form id="social-create-room-form">
            <div class="form-group">
              <label for="social-room-topic">Topic</label>
              <input class="input" id="social-room-topic" maxlength="80" placeholder="Add a room topic" required>
            </div>
            <div class="form-group">
              <label for="social-room-language">Language</label>
              <input class="input" id="social-room-language" list="social-room-language-list" placeholder="Search and select a language" autocomplete="off" required>
              <datalist id="social-room-language-list">
                ${renderLanguageOptions()}
              </datalist>
            </div>
            <div class="form-group">
              <label for="social-room-limit">People limit</label>
              <input class="input" id="social-room-limit" type="number" min="2" max="50" value="10">
            </div>
            <div class="social-toggle-row">
              <label><input type="checkbox" id="social-room-voice" checked> Voice</label>
              <label><input type="checkbox" id="social-room-chat" checked> Chat</label>
            </div>
            <button class="btn btn-primary btn-block" type="submit">Create Room</button>
          </form>
        </div>
      </div>`;
  }

  function renderFullPlanModal() {
    const profile = allProfiles().find(p => p.uid === state.fullPlanProfileUid) || selectedProfile();
    if (!profile) return '';
    const plan = profile.activePlan;
    return `
      <div class="social-modal">
        <div class="social-modal-card social-plan-modal-card">
          <button class="social-modal-close" type="button" id="social-close-plan-modal" aria-label="Close">${icon('x')}</button>
          <h2>${esc(plan?.name || 'Workout Plan')}</h2>
          <p class="social-modal-sub">Used by ${esc(profile.displayName || 'Member')}</p>
          <div class="social-full-plan">
            ${(plan?.days || []).map(day => `
              <section>
                <h3>${esc(day.name || 'Training Day')}</h3>
                ${(day.exercises || []).map(ex => `
                  <div><span>${esc(ex.name)}</span><strong>${esc(ex.defaultSets || 3)} x ${esc(ex.defaultReps || 8)}</strong></div>
                `).join('')}
              </section>
            `).join('')}
          </div>
          <button class="btn btn-primary btn-block" type="button" data-copy-plan="${esc(profile.uid)}">${icon('copy')} Copy Plan</button>
        </div>
      </div>`;
  }

  function bindRoomEvents(el) {
    bindSharedEvents(el);
    bindRoomBodyEvents(el);
  }

  function bindRoomBodyEvents(el) {
    el.querySelectorAll('[data-select-room]').forEach(row => row.addEventListener('click', () => {
      state.openRoomInfoId = null;
      state.selectedRoomId = row.dataset.selectRoom;
      renderRooms();
    }));
    el.querySelectorAll('[data-room-info]').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.openRoomInfoId = state.openRoomInfoId === btn.dataset.roomInfo ? null : btn.dataset.roomInfo;
      renderRooms();
    }));
    el.querySelectorAll('.social-room-info-popover').forEach(popover => {
      popover.addEventListener('click', e => e.stopPropagation());
    });
    el.querySelector('[data-room-info-close]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      state.openRoomInfoId = null;
      renderRooms();
    });
    el.querySelectorAll('[data-join-room]').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tab = window.open('', '_blank');
      joinRoom(btn.dataset.joinRoom, { openTab: true, tab });
    }));
    el.querySelector('#social-create-room-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      createRoom(e.currentTarget);
    });
    el.querySelector('#social-close-room-modal')?.addEventListener('click', () => {
      state.showCreateRoom = false;
      renderRooms();
    });
  }

  function bindRoomPageEvents(el, room) {
    bindSharedEvents(el);
    el.querySelector('[data-room-mic]')?.addEventListener('click', () => toggleRoomMic(room));
    el.querySelector('[data-room-hangup]')?.addEventListener('click', () => {
      if (room.hostUid === currentUid()) closeHostRoom(room, true);
      else leaveRoom(room, true);
    });
    el.querySelector('[data-room-chat]')?.addEventListener('click', () => {
      state.showRoomSettings = false;
      renderRoomPage();
    });
    el.querySelector('[data-room-settings]')?.addEventListener('click', () => {
      state.showRoomSettings = !state.showRoomSettings;
      renderRoomPage();
    });
    el.querySelector('#social-room-message-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      sendRoomMessage(room.id);
    });
    el.querySelectorAll('[data-kick-member]').forEach(btn => btn.addEventListener('click', () => {
      kickRoomMember(room, btn.dataset.kickMember);
    }));
    el.querySelector('#voice-room-settings-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      updateRoomSettings(room);
    });
  }

  function bindChatEvents(el) {
    bindSharedEvents(el);
    el.querySelectorAll('[data-chat-back]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mobileChatOpen = false;
        state.activeChatUid = null;
        state.selectedProfileUid = null;
        clearUnsubs('activeChatUnsubs');
        state.watchedChatId = null;
        state.dmMessages = [];
        renderChat();
      });
    });
    const mutualSearch = el.querySelector('#social-mutual-search');
    if (mutualSearch) {
      mutualSearch.addEventListener('input', () => {
        state.mutualQuery = mutualSearch.value;
        refreshChatRail(el);
      });
    }
    el.querySelector('#social-direct-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      sendDirectMessage();
    });
    el.querySelector('#social-direct-input')?.addEventListener('input', (e) => {
      const me = currentUid();
      const chatId = state.watchedChatId;
      if (!me || !chatId) return;

      const nowTime = now();
      const lastType = state.typingStatus[chatId]?.[me] || 0;
      if (nowTime - lastType < 3000) return; // Only update Firestore every 3s

      db().collection('social_chats').doc(chatId).set({
        typing: { [me]: nowTime }
      }, { merge: true });
    });
  }

  function bindProfileEvents(el) {
    bindSharedEvents(el);
    el.querySelectorAll('[data-back-rooms]').forEach(btn => btn.addEventListener('click', () => App.navigate('rooms')));
  }

  function bindSharedEvents(el) {
    const search = el.querySelector('#social-search');
    if (search) {
      search.addEventListener('input', () => {
        const view = (location.hash.slice(1) || 'dashboard').split(/[/?]/)[0] || 'dashboard';
        if (view === 'chat') state.mutualQuery = search.value;
        else state.query = search.value;
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => {
          if (view === 'chat') renderChat();
          else if (view === 'rooms') refreshRoomsBody(el);
        }, 80);
      });
    }
    el.querySelector('#social-room-sort')?.addEventListener('change', (e) => {
      state.roomSort = e.target.value;
      renderRooms();
    });
    el.querySelectorAll('#social-create-room, [data-open-room-modal]').forEach(btn => btn.addEventListener('click', () => {
      if (!App.requireAuth()) return;
      state.showCreateRoom = true;
      renderRooms();
    }));
    el.querySelectorAll('[data-social-signin]').forEach(btn => btn.addEventListener('click', () => App.requireAuth()));
    el.querySelectorAll('[data-nav-rooms]').forEach(btn => btn.addEventListener('click', () => App.navigate('rooms')));
    el.querySelectorAll('[data-nav-plans]').forEach(btn => btn.addEventListener('click', () => App.navigate('plans')));
    el.querySelectorAll('[data-follow]').forEach(btn => btn.addEventListener('click', () => toggleFollow(btn.dataset.follow)));
    el.querySelectorAll('[data-start-chat]').forEach(btn => btn.addEventListener('click', () => startChat(btn.dataset.startChat)));
    el.querySelectorAll('[data-open-chat]').forEach(btn => btn.addEventListener('click', () => startChat(btn.dataset.openChat, true)));
    el.querySelectorAll('[data-open-profile]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openProfile(btn.dataset.openProfile);
      };
    });
    el.querySelectorAll('[data-nav-chat]').forEach(btn => btn.addEventListener('click', () => App.navigate('chat')));
    el.querySelectorAll('[data-copy-plan]').forEach(btn => btn.addEventListener('click', () => copyPlan(btn.dataset.copyPlan)));
    el.querySelector('#social-close-plan-modal')?.addEventListener('click', () => {
      state.fullPlanProfileUid = null;
      renderIfActive();
    });
  }

  async function toggleFollow(profileUid) {
    if (!App.requireAuth()) return;
    if (!profileUid || profileUid === currentUid()) return;
    const profile = allProfiles().find(p => p.uid === profileUid);
    if (!profile) {
      App.toast('Profile not found.', 'error');
      return;
    }
    const uid = currentUid();
    const followId = `${uid}_${profileUid}`;
    const followRef = db().collection('social_follows').doc(followId);
    const batch = db().batch();
    const wasFollowing = isFollowing(profileUid);
    const increment = firebase.firestore.FieldValue.increment(wasFollowing ? -1 : 1);
    if (wasFollowing) batch.delete(followRef);
    else batch.set(followRef, { followerUid: uid, followingUid: profileUid, createdAt: now() });
    batch.set(db().collection('social_profiles').doc(uid), { followingCount: increment, updatedAt: now() }, { merge: true });
    batch.set(db().collection('social_profiles').doc(profileUid), { followersCount: increment, updatedAt: now() }, { merge: true });
    await batch.commit();
    App.toast(wasFollowing ? 'Unfollowed' : 'Following');
  }

  async function createRoom(form) {
    if (!App.requireAuth()) return;
    const existingHostRoom = activeHostRoom();
    if (existingHostRoom) {
      state.showCreateRoom = false;
      state.selectedRoomId = existingHostRoom.id;
      state.joinedRoomId = existingHostRoom.id;
      App.toast('You already have a live room. Close it before creating another.', 'error', 4200);
      openRoomTab(existingHostRoom.id);
      renderRooms();
      return;
    }
    const topic = document.getElementById('social-room-topic')?.value.trim() || '';
    const languageInput = document.getElementById('social-room-language');
    const language = selectedLanguage(languageInput?.value);
    const maxPeople = Math.max(2, Math.min(50, parseInt(document.getElementById('social-room-limit')?.value, 10) || 10));
    if (!topic) {
      App.toast('Add a room topic.', 'error');
      return;
    }
    if (!language) {
      App.toast('Select a room language from the list.', 'error');
      languageInput?.focus();
      return;
    }
    const me = Auth.getUser();
    if (!me) return;
    const submitBtn = form?.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || 'Create Room';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';
    }
    const room = {
      topic,
      language,
      maxPeople,
      hostUid: me.uid,
      hostName: me.displayName || 'Host',
      hostPhoto: me.photoURL || '',
      createdByUid: me.uid,
      createdByName: me.displayName || 'Host',
      createdByPhoto: me.photoURL || '',
      participantCount: 1,
      currentParticipantIds: [me.uid],
      voiceEnabled: document.getElementById('social-room-voice').checked,
      chatEnabled: document.getElementById('social-room-chat').checked,
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    };
    try {
      const roomRef = db().collection('social_rooms').doc();
      const hostLockRef = db().collection('social_room_hosts').doc(me.uid);
      await db().runTransaction(async tx => {
        const hostLockSnap = await tx.get(hostLockRef);
        if (hostLockSnap.exists) {
          const err = new Error('active-room-exists');
          err.code = 'active-room-exists';
          err.roomId = hostLockSnap.data()?.roomId || '';
          throw err;
        }
        tx.set(roomRef, room);
        tx.set(roomRef.collection('members').doc(me.uid), memberPayload(true, 'Host'));
        tx.set(hostLockRef, {
          uid: me.uid,
          roomId: roomRef.id,
          createdAt: now(),
          updatedAt: now(),
        });
      });
      state.showCreateRoom = false;
      state.selectedRoomId = roomRef.id;
      state.joinedRoomId = roomRef.id;
      App.toast('Room created');
      openRoomTab(roomRef.id);
      renderRooms();
    } catch (err) {
      console.error('Create room failed', err);
      if (err?.code === 'active-room-exists') {
        state.showCreateRoom = false;
        if (err.roomId) {
          state.selectedRoomId = err.roomId;
          state.joinedRoomId = err.roomId;
          openRoomTab(err.roomId);
        }
        renderRooms();
      }
      const message = err?.code === 'active-room-exists'
        ? 'You already have a live room. Close it before creating another.'
        : err?.code === 'permission-denied'
          ? 'Room create is blocked by Firestore rules. Deploy the latest rules and try again.'
          : 'Room could not be created. Please try again.';
      App.toast(message, 'error', 4200);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }

  function memberPayload(micOn = true, role = '') {
    const me = Auth.getUser();
    return {
      uid: me.uid,
      displayName: me.displayName || 'You',
      photoURL: me.photoURL || '',
      micOn,
      role,
      joinedAt: now(),
      updatedAt: now(),
    };
  }

  async function updateRoomSettings(room) {
    if (!App.requireAuth() || !room || room.hostUid !== currentUid()) return;
    const titleInput = document.getElementById('voice-room-title');
    const languageInput = document.getElementById('voice-room-language');
    const limitInput = document.getElementById('voice-room-limit');
    const topic = titleInput?.value.trim() || '';
    const language = selectedLanguage(languageInput?.value);
    const currentCount = roomCount(room);
    const requestedLimit = parseInt(limitInput?.value, 10) || room.maxPeople || 10;
    const maxPeople = Math.max(2, Math.min(50, requestedLimit));
    if (!topic) {
      App.toast('Add a room title.', 'error');
      titleInput?.focus();
      return;
    }
    if (!language) {
      App.toast('Select a room language from the list.', 'error');
      languageInput?.focus();
      return;
    }
    if (requestedLimit < currentCount) {
      App.toast(`Limit cannot be below ${currentCount} current members.`, 'error');
      limitInput?.focus();
      return;
    }
    try {
      await db().collection('social_rooms').doc(room.id).set({
        topic,
        language,
        maxPeople,
        updatedAt: now(),
      }, { merge: true });
      state.showRoomSettings = false;
      App.toast('Room settings updated');
      renderRoomPage();
    } catch (err) {
      console.error('Room settings update failed', err);
      App.toast(err?.code === 'permission-denied'
        ? 'Room settings are blocked by Firestore rules.'
        : 'Could not update room settings.', 'error', 4200);
    }
  }

  async function joinRoom(roomId, options = {}) {
    if (!App.requireAuth()) {
      if (options.tab && !options.tab.closed) options.tab.close();
      return;
    }
    unlockVoiceAudio();
    const room = allRooms().find(item => item.id === roomId);
    state.selectedRoomId = roomId;
    if (!room) {
      App.toast('Room not found.', 'error');
      if (options.tab && !options.tab.closed) options.tab.close();
      renderRooms();
      return;
    }
    const uid = currentUid();
    const roomRef = db().collection('social_rooms').doc(roomId);
    const memberRef = roomRef.collection('members').doc(uid);
    try {
      await db().runTransaction(async tx => {
        const roomSnap = await tx.get(roomRef);
        const memberSnap = await tx.get(memberRef);
        if (!roomSnap.exists || (roomSnap.data().status || 'active') !== 'active') {
          const err = new Error('room-missing');
          err.code = 'room-missing';
          throw err;
        }
        const roomData = roomSnap.data();
        const currentCount = Math.max(
          Number(roomData.participantCount) || 0,
          Array.isArray(roomData.currentParticipantIds) ? roomData.currentParticipantIds.length : 0
        );
        const maxPeople = Number(roomData.maxPeople) || 10;
        if (!memberSnap.exists && currentCount >= maxPeople) {
          const err = new Error('room-full');
          err.code = 'room-full';
          throw err;
        }
        tx.set(memberRef, memberPayload(true, roomData.hostUid === uid ? 'Host' : ''), { merge: true });
        if (!memberSnap.exists) {
          tx.set(roomRef, {
            participantCount: firebase.firestore.FieldValue.increment(1),
            currentParticipantIds: firebase.firestore.FieldValue.arrayUnion(uid),
            updatedAt: now(),
          }, { merge: true });
        }
      });
      state.joinedRoomId = roomId;
      App.toast('Joined room');
      if (options.openTab) openRoomTab(roomId, options.tab);
      renderRooms();
    } catch (err) {
      console.error('Join room failed', err);
      if (options.tab && !options.tab.closed) options.tab.close();
      const message = err?.code === 'room-full'
        ? 'Room locked. The people limit is full.'
        : err?.code === 'permission-denied'
          ? 'Joining this room is blocked by Firestore rules.'
          : 'Could not join room. Please try again.';
      App.toast(message, 'error', 4200);
    }
  }

  async function ensureJoinedRoom(room) {
    if (!room || isRoomJoined(room)) return;
    await joinRoom(room.id);
  }

  async function sendRoomMessage(roomId = '') {
    if (!App.requireAuth()) return;
    const input = document.getElementById('social-room-message-input');
    const text = input?.value.trim();
    if (!text) return;
    const room = roomId ? roomById(roomId) : selectedRoom();
    if (!room) {
      App.toast('Select a room first.', 'error');
      return;
    }
    if (room.chatEnabled === false) {
      App.toast('Chat is disabled for this room.', 'error');
      return;
    }
    await ensureJoinedRoom(room);
    const me = Auth.getUser();
    await db().collection('social_rooms').doc(room.id).collection('messages').add({
      senderUid: me.uid,
      senderName: me.displayName || 'Member',
      senderPhoto: me.photoURL || '',
      text,
      createdAt: now(),
    });
    input.value = '';
  }

  function stopRoomAudio() {
    clearUnsubs('rtcUnsubs');
    state.peerConnections.forEach(pc => {
      try { pc.close(); } catch (e) { console.warn('Peer close failed', e); }
    });
    state.peerConnections.clear();
    state.candidateIds.clear();
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }
    state.localStream = null;
    state.roomAudioStarted = false;
    document.querySelectorAll('[data-room-audio-peer]').forEach(audio => audio.remove());
  }

  function checkMicPermission() {
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: 'microphone' }).then(status => {
      if (state.micPermission !== status.state) {
        state.micPermission = status.state;
        renderIfActive();
      }
      status.onchange = () => {
        state.micPermission = status.state;
        renderIfActive();
      };
    }).catch(() => {});
  }

  function unlockVoiceAudio() {
    if (state.voiceUnlocked) return;
    const audio = document.createElement('audio');
    audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='; // 0.1s silence
    audio.play().then(() => {
      state.voiceUnlocked = true;
      console.log('Voice audio unlocked for mobile');
      audio.remove();
    }).catch(() => {});
  }

  async function startRoomAudio(room) {
    if (!App.requireAuth() || !room) return;
    unlockVoiceAudio();
    if (room.voiceEnabled === false) {
      App.toast('Voice is disabled for this room.', 'error');
      renderRoomPage();
      return;
    }
    if (!isRoomJoined(room)) {
      if (roomCount(room) >= (room.maxPeople || 10)) {
        App.toast('Room locked. The people limit is full.', 'error');
        renderRoomPage();
        return;
      }
      await joinRoom(room.id);
      if (!isRoomJoined(room)) return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      App.toast('Your browser does not allow microphone access here.', 'error');
      return;
    }
    if (!window.RTCPeerConnection) {
      App.toast('Voice rooms are not supported in this browser.', 'error');
      return;
    }
    try {
      if (!state.localStream) {
        state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
      state.micOn = true;
      state.localStream.getAudioTracks().forEach(track => { track.enabled = true; });
      state.roomAudioStarted = true;
      await updateOwnRoomMic(room.id, true);
      syncRoomPeers(room);
      renderRoomPage();
    } catch (err) {
      console.error('Microphone start failed', err);
      App.toast('Mic permission failed. Allow microphone access and try again.', 'error', 4600);
    }
  }

  async function toggleRoomMic(room) {
    if (!room) return;
    if (!state.localStream || !state.roomAudioStarted || !isRoomJoined(room)) {
      await startRoomAudio(room);
      return;
    }
    state.micOn = !state.micOn;
    state.localStream.getAudioTracks().forEach(track => { track.enabled = state.micOn; });
    await updateOwnRoomMic(room.id, state.micOn);
    renderRoomPage();
  }

  async function updateOwnRoomMic(roomId, micOn) {
    const uid = currentUid();
    if (!uid || !roomId) return;
    try {
      await db().collection('social_rooms').doc(roomId).collection('members').doc(uid).set({
        micOn,
        updatedAt: now(),
      }, { merge: true });
    } catch (err) {
      console.warn('Mic state update failed', err);
    }
  }

  function syncRoomPeers(room) {
    if (!state.roomAudioStarted || !state.localStream || !room || state.currentRoomId !== room.id) return;
    const uid = currentUid();
    const memberIds = new Set(activeRoomMembers(room).map(member => member.uid).filter(id => id && id !== uid));
    state.peerConnections.forEach((pc, peerUid) => {
      if (!memberIds.has(peerUid)) closePeer(peerUid);
    });
    memberIds.forEach(peerUid => ensurePeerConnection(room.id, peerUid));
  }

  function pairIdFor(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
  }

  function closePeer(peerUid) {
    const pc = state.peerConnections.get(peerUid);
    if (pc) {
      try { pc.close(); } catch (e) { console.warn('Peer close failed', e); }
    }
    state.peerConnections.delete(peerUid);
    const audio = document.querySelector(`[data-room-audio-peer="${selectorValue(peerUid)}"]`);
    if (audio) audio.remove();
  }

  async function ensurePeerConnection(roomId, peerUid) {
    const uid = currentUid();
    if (!uid || !peerUid || state.peerConnections.has(peerUid)) return;
    const callerUid = [uid, peerUid].sort()[0];
    const calleeUid = callerUid === uid ? peerUid : uid;
    const isCaller = callerUid === uid;
    const pairId = pairIdFor(uid, peerUid);
    const callRef = db().collection('social_rooms').doc(roomId).collection('calls').doc(pairId);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    state.peerConnections.set(peerUid, pc);
    state.localStream.getTracks().forEach(track => pc.addTrack(track, state.localStream));
    pc.ontrack = (event) => attachRemoteAudio(peerUid, event.streams[0]);
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      callRef.collection(isCaller ? 'callerCandidates' : 'calleeCandidates').add({
        ...event.candidate.toJSON(),
        uid,
        createdAt: now(),
      }).catch(err => console.warn('ICE candidate write failed', err));
    };

    const remoteCandidates = isCaller ? 'calleeCandidates' : 'callerCandidates';
    state.rtcUnsubs.push(callRef.collection(remoteCandidates).onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const key = `${pairId}:${change.doc.id}`;
        if (state.candidateIds.has(key)) return;
        state.candidateIds.set(key, true);
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(err => console.warn('ICE add failed', err));
      });
    }, err => console.warn('ICE listener failed', err)));

    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await callRef.set({
        callerUid,
        calleeUid,
        offer: { type: offer.type, sdp: offer.sdp },
        answer: firebase.firestore.FieldValue.delete(),
        updatedAt: now(),
      }, { merge: true });
      state.rtcUnsubs.push(callRef.onSnapshot(snap => {
        const data = snap.data();
        if (!data?.answer || pc.currentRemoteDescription) return;
        pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(err => console.warn('Answer apply failed', err));
      }, err => console.warn('Answer listener failed', err)));
      return;
    }

    state.rtcUnsubs.push(callRef.onSnapshot(async snap => {
      const data = snap.data();
      if (!data?.offer || pc.currentRemoteDescription) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await callRef.set({
          callerUid,
          calleeUid,
          answer: { type: answer.type, sdp: answer.sdp },
          updatedAt: now(),
        }, { merge: true });
      } catch (err) {
        console.warn('Offer answer failed', err);
      }
    }, err => console.warn('Offer listener failed', err)));
  }

  function attachRemoteAudio(peerUid, stream) {
    if (!stream) return;
    let audio = document.querySelector(`[data-room-audio-peer="${selectorValue(peerUid)}"]`);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audio.dataset.roomAudioPeer = peerUid;
      audio.style.display = 'none';
      document.body.appendChild(audio);
    }
    if (audio.srcObject !== stream) audio.srcObject = stream;
    audio.play?.().catch(() => {});
  }

  function leaveCurrentRoomForPageExit() {
    const uid = currentUid();
    const roomId = state.currentRoomId || state.joinedRoomId || roomRouteId();
    const room = roomById(roomId);
    if (!uid || !room || state.roomExitPending === room.id || !isRoomJoined(room)) return;
    state.roomExitPending = room.id;
    rememberPendingRoomExit(room, uid);
    stopRoomPresence();
    stopRoomAudio();
    try {
      const roomRef = db().collection('social_rooms').doc(room.id);
      const batch = db().batch();
      if (room.hostUid === uid) {
        const memberIds = new Set(activeRoomMembers(room).map(member => member.uid).filter(Boolean));
        memberIds.add(uid);
        memberIds.forEach(memberUid => batch.delete(roomRef.collection('members').doc(memberUid)));
        batch.delete(roomRef);
        batch.delete(db().collection('social_room_hosts').doc(uid));
      } else {
        batch.delete(roomRef.collection('members').doc(uid));
        batch.set(roomRef, {
          participantCount: firebase.firestore.FieldValue.increment(-1),
          currentParticipantIds: firebase.firestore.FieldValue.arrayRemove(uid),
          updatedAt: now(),
        }, { merge: true });
      }
      batch.commit()
        .then(() => forgetPendingRoomExit(room.id))
        .catch(err => {
          console.warn('Room exit write failed', err);
          forgetPendingRoomExit(room.id); // Clear anyway to prevent ghost exits if user navigates back
        });
    } catch (err) {
      console.warn('Room exit write failed', err);
      forgetPendingRoomExit(room.id);
    }
  }

  async function closeHostRoom(room, closeTab = false) {
    const uid = currentUid();
    if (!room || !uid || room.hostUid !== uid) return;
    state.roomExitPending = room.id;
    rememberPendingRoomExit(room, uid);
    stopRoomPresence();
    stopRoomAudio();
    try {
      const roomRef = db().collection('social_rooms').doc(room.id);
      const membersSnap = await roomRef.collection('members').get();
      const batch = db().batch();
      membersSnap.docs.forEach(doc => batch.delete(doc.ref));
      batch.delete(db().collection('social_room_hosts').doc(uid));
      batch.delete(roomRef);
      await batch.commit();
    } catch (err) {
      console.warn('Close room failed', err);
      state.roomExitPending = null;
      forgetPendingRoomExit(room.id);
      App.toast(err?.code === 'permission-denied'
        ? 'Host room close is blocked by Firestore rules. Deploy the latest rules and try again.'
        : 'Could not end the room. Please try again.', 'error', 4200);
      return;
    }
    removeRoomLocally(room.id);
    forgetPendingRoomExit(room.id);
    state.joinedRoomId = null;
    state.showRoomSettings = false;
    state.roomExitPending = null;
    App.toast('Room ended');
    if (closeTab) {
      window.close();
      location.hash = '#rooms';
    } else {
      renderRoomPage();
    }
  }

  async function leaveRoom(room, closeTab = false) {
    const uid = currentUid();
    if (!room || !uid) return;
    state.roomExitPending = room.id;
    rememberPendingRoomExit(room, uid);
    stopRoomPresence();
    stopRoomAudio();
    let result = { deleted: false };
    try {
      const roomRef = db().collection('social_rooms').doc(room.id);
      result = await db().runTransaction(async tx => {
        const roomSnap = await tx.get(roomRef);
        if (!roomSnap.exists) return { deleted: true };

        const roomData = roomSnap.data();
        const isHost = roomData.hostUid === uid;
        const participantIds = Array.isArray(roomData.currentParticipantIds) && roomData.currentParticipantIds.length
          ? roomData.currentParticipantIds
          : roomParticipantIds({ ...roomData, id: room.id });
        const remainingIds = [...new Set(participantIds.filter(id => id && id !== uid))];
        const memberRef = roomRef.collection('members').doc(uid);
        const nextHostUid = isHost && remainingIds.length ? remainingIds[0] : '';
        const nextHostRef = nextHostUid ? roomRef.collection('members').doc(nextHostUid) : null;
        const nextHostSnap = nextHostRef ? await tx.get(nextHostRef) : null;
        const nextHostLockRef = nextHostUid ? db().collection('social_room_hosts').doc(nextHostUid) : null;
        const updatedAt = now();

        tx.delete(memberRef);

        if (!remainingIds.length) {
          tx.delete(roomRef);
          if (roomData.hostUid === uid) {
            tx.delete(db().collection('social_room_hosts').doc(uid));
          }
          return { deleted: true };
        }

        const roomPatch = {
          participantCount: remainingIds.length,
          currentParticipantIds: remainingIds,
          updatedAt,
        };

        if (isHost) {
          const nextHost = nextHostSnap?.data() || {};
          Object.assign(roomPatch, {
            hostUid: nextHostUid,
            hostName: nextHost.displayName || 'Host',
            hostPhoto: nextHost.photoURL || '',
          });
          tx.delete(db().collection('social_room_hosts').doc(uid));
          if (nextHostLockRef) {
            tx.set(nextHostLockRef, {
              uid: nextHostUid,
              roomId: room.id,
              createdAt: updatedAt,
              updatedAt,
            });
          }
        }

        tx.set(roomRef, roomPatch, { merge: true });
        return { deleted: false, roomPatch };
      });
    } catch (err) {
      console.warn('Leave room failed', err);
      state.roomExitPending = null;
      forgetPendingRoomExit(room.id);
      App.toast('Could not leave the room. Please try again.', 'error', 4200);
      return;
    }
    if (result.deleted) {
      removeRoomLocally(room.id);
    } else {
      updateRoomLocally(room.id, result.roomPatch || {});
    }
    forgetPendingRoomExit(room.id);
    state.joinedRoomId = null;
    state.roomExitPending = null;
    if (closeTab) {
      window.close();
      location.hash = '#rooms';
    } else {
      renderRoomPage();
    }
  }

  async function kickRoomMember(room, memberUid) {
    if (!room || room.hostUid !== currentUid() || !memberUid || memberUid === currentUid()) return;
    try {
      await db().collection('social_rooms').doc(room.id).collection('members').doc(memberUid).delete();
      await db().collection('social_rooms').doc(room.id).set({
        participantCount: firebase.firestore.FieldValue.increment(-1),
        currentParticipantIds: firebase.firestore.FieldValue.arrayRemove(memberUid),
        updatedAt: now(),
      }, { merge: true });
      App.toast('Member removed');
    } catch (err) {
      console.error('Kick member failed', err);
      App.toast(err?.code === 'permission-denied'
        ? 'Deploy the latest Firestore rules before host kick works.'
        : 'Could not remove member.', 'error', 4200);
    }
  }

  async function startChat(profileUid, fromList = false) {
    if (!App.requireAuth()) return;
    const profile = allProfiles().find(p => p.uid === profileUid);
    if (!profile || profile.uid === currentUid()) {
      App.toast('Profile not found.', 'error');
      return;
    }

    // If coming from the mutual list, we already know they are mutual.
    // If not, we check strictly.
    if (!fromList && !isMutual(profile)) {
      App.toast('Both people need to follow each other before chat.', 'error');
      state.selectedProfileUid = profile.uid;
      renderIfActive();
      return;
    }

    state.selectedProfileUid = profile.uid;
    state.activeChatUid = profile.uid;
    state.mobileChatOpen = isMobileChat();
    App.navigate('chat');
    renderIfActive();

    const me = Auth.getUser();
    const chatId = chatIdFor(me.uid, profile.uid);
    try {
      await db().collection('social_chats').doc(chatId).set({
        participantAUid: [me.uid, profile.uid].sort()[0],
        participantBUid: [me.uid, profile.uid].sort()[1],
        participantUids: [me.uid, profile.uid],
        updatedAt: now(),
      }, { merge: true });
    } catch (err) {
      console.warn('Start chat sync failed', err);
    }
  }

  function sendDirectMessage() {
    if (!App.requireAuth()) return;
    const input = document.getElementById('social-direct-input');
    const text = input?.value.trim();
    if (!text) return;
    const profile = allProfiles().find(p => p.uid === state.activeChatUid);
    if (!profile || !isMutual(profile)) return;
    const me = Auth.getUser();
    const chatId = chatIdFor(me.uid, profile.uid);
    const message = {
      senderUid: me.uid,
      senderName: me.displayName || 'Member',
      senderPhoto: me.photoURL || '',
      text,
      createdAt: now(),
      status: 'sent',
    };
    input.value = '';

    // Fire and forget: Firestore local cache will instantly trigger onSnapshot
    db().collection('social_chats').doc(chatId).collection('messages').add(message)
      .catch(err => {
        console.error('Direct message failed', err);
        App.toast(err?.code === 'permission-denied'
          ? 'Chat is blocked by Firestore rules.'
          : 'Message could not be sent. Please try again.', 'error', 4200);
      });

    // Update chat metadata and clear typing status
    db().collection('social_chats').doc(chatId).set({
      participantAUid: [me.uid, profile.uid].sort()[0],
      participantBUid: [me.uid, profile.uid].sort()[1],
      participantUids: [me.uid, profile.uid],
      updatedAt: now(),
      typing: { [me.uid]: 0 }
    }, { merge: true }).catch(err => console.warn(err));
  }

  function copyPlan(profileUid) {
    if (!App.requireAuth()) return;
    const profile = allProfiles().find(p => p.uid === profileUid);
    if (!profile?.activePlan) {
      App.toast('No workout plan to copy.', 'error');
      return;
    }
    try {
      Plans.copyExternalPlan(profile.activePlan, profile.displayName);
      App.toast('Plan copied to Workout Plans');
    } catch (err) {
      App.toast(err.message || 'Could not copy plan.', 'error');
    }
  }

  function openProfile(uid) {
    state.selectedProfileUid = uid;
    if ((location.hash.slice(1) || 'dashboard') === 'profile') renderProfile();
    else App.navigate('profile');
  }

  function focusSocialSearch() {
    requestAnimationFrame(() => {
      const input = document.getElementById('social-search');
      if (!input) return;
      input.focus({ preventScroll: true });
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }

  function scrollDirectThreadToEnd() {
    requestAnimationFrame(() => {
      const thread = document.querySelector('#view-chat .social-dm-thread');
      if (!thread) return;
      thread.scrollTop = thread.scrollHeight;
    });
  }

  return {
    init,
    renderRooms,
    renderRoomPage,
    renderChat,
    renderProfile,
    syncOwnProfile,
    openProfile,
  };
})();
