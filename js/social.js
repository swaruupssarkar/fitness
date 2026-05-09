/* --- Social - Rooms, profiles, follows, chat, plan copy ------- */
const Social = (() => {
  const ROOM_CATEGORIES = ['All', 'Fitness', 'Nutrition', 'Accountability', 'Recovery'];
  const MAX_ROOM_LIMIT = 50;

  const state = {
    user: null,
    query: '',
    mutualQuery: '',
    activeCategory: 'All',
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
    showCreateRoom: false,
    fullPlanProfileUid: null,
    searchTimer: null,
    unsubs: [],
    activeRoomUnsubs: [],
    activeChatUnsubs: [],
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

  function renderIfActive() {
    const view = location.hash.slice(1) || 'dashboard';
    if (view === 'rooms') renderRooms();
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
      copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5 17.5 17.5"/><path d="m21 21-3-3"/><path d="m6 6-3-3"/><path d="m18 21 3-3"/><path d="m3 6 3-3"/><path d="m10 8 6 6"/><path d="m8 10 6 6"/></svg>',
      send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
      dots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
      x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
      chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
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

  function avatar(profile, cls = '') {
    const name = profile?.displayName || profile?.name || 'Member';
    const photo = profile?.photoURL || '';
    return `
      <span class="social-avatar ${cls}">
        ${photo ? `<img src="${esc(photo)}" alt="${esc(name)}">` : `<span>${esc(initials(name))}</span>`}
        ${profile?.online !== false ? '<i class="social-online-dot"></i>' : ''}
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
      online: true,
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

  function isFollowing(uid) {
    return state.following.has(uid);
  }

  function isMutual(profile) {
    if (!profile || profile.uid === currentUid()) return false;
    return state.following.has(profile.uid) && state.followers.has(profile.uid);
  }

  function visibleProfiles() {
    const q = state.query.trim().toLowerCase();
    return allProfiles().filter(profile => {
      if (!q) return true;
      return [
        profile.displayName,
        usernameFor(profile),
        profile.activePlan?.name,
      ].join(' ').toLowerCase().includes(q);
    });
  }

  function visibleRooms() {
    const q = state.query.trim().toLowerCase();
    const rooms = allRooms().filter(room => {
      if (state.activeCategory !== 'All' && room.category !== state.activeCategory) return false;
      if (!q) return true;
      return [room.topic, room.category, room.hostName].join(' ').toLowerCase().includes(q);
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

  async function syncOwnProfile() {
    const me = Auth.getUser();
    if (!me) return;
    const ref = db().collection('social_profiles').doc(me.uid);
    const snap = await ref.get();
    const displayName = me.displayName || 'FitTrack Member';
    const payload = {
      uid: me.uid,
      displayName,
      displayNameLower: displayName.toLowerCase(),
      emailLower: (me.email || '').toLowerCase(),
      photoURL: me.photoURL || '',
      username: `@${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'fittrack'}`,
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

  function watchProfiles() {
    const unsub = db().collection('social_profiles').limit(60).onSnapshot(snap => {
      state.profiles = snap.docs.map(doc => ({ ...doc.data(), uid: doc.id, online: true }));
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
    clearUnsubs('unsubs');
    clearUnsubs('activeRoomUnsubs');
    clearUnsubs('activeChatUnsubs');
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
    if (!user) {
      renderIfActive();
      return;
    }
    try {
      await syncOwnProfile();
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
      }
      return;
    }
    if (state.watchedRoomId === room.id) return;
    clearUnsubs('activeRoomUnsubs');
    state.watchedRoomId = room.id;
    const roomRef = db().collection('social_rooms').doc(room.id);
    state.activeRoomUnsubs.push(roomRef.collection('members').onSnapshot(snap => {
      state.roomMembers = snap.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
      renderIfActive();
    }, err => console.warn('Room members listener failed', err)));
    state.activeRoomUnsubs.push(roomRef.collection('messages').orderBy('createdAt', 'asc').limit(50).onSnapshot(snap => {
      state.roomMessages = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      renderIfActive();
    }, err => console.warn('Room messages listener failed', err)));
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
    state.activeChatUnsubs.push(db().collection('social_chats').doc(chatId).collection('messages')
      .orderBy('createdAt', 'asc').limit(60).onSnapshot(snap => {
        state.dmMessages = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        renderIfActive();
      }, err => console.warn('Direct chat listener failed', err)));
  }

  function renderRooms() {
    const el = document.getElementById('view-rooms');
    if (!el) return;
    const rooms = visibleRooms();
    const room = selectedRoom();
    const people = state.query.trim()
      ? visibleProfiles().filter(profile => profile.uid !== currentUid()).slice(0, 8)
      : [];
    state.selectedRoomId = room?.id || null;
    ensureRoomWatch(room);
    el.innerHTML = `
      <div class="social-shell">
        ${renderTopbar('Rooms')}
        <div class="social-rooms-only">
          ${state.query.trim() ? renderPeopleResults(people) : ''}
          <section class="social-panel social-room-list-panel social-room-list-panel-wide">
            <div class="social-panel-head">
              <h2><span>${icon('room')}</span> Live Rooms</h2>
              <label class="social-sort">Sort:
                <select id="social-room-sort" aria-label="Sort rooms">
                  ${['Active', 'Newest', 'Capacity'].map(item => `<option${state.roomSort === item ? ' selected' : ''}>${item}</option>`).join('')}
                </select>
              </label>
            </div>
            <div class="social-room-list">
              ${rooms.length
                ? rooms.map(item => renderRoomRow(item, room?.id === item.id)).join('')
                : renderEmptyState(
                    state.query.trim() ? 'No real rooms found' : 'No live rooms yet',
                    state.query.trim() ? 'Try a different room topic or person name.' : 'Create the first real room for your community.',
                    state.user ? 'Create Room' : 'Sign In',
                    state.user ? 'data-open-room-modal' : 'data-social-signin'
                  )}
            </div>
          </section>
        </div>
        ${state.showCreateRoom ? renderCreateRoomModal() : ''}
        ${state.fullPlanProfileUid ? renderFullPlanModal() : ''}
      </div>`;
    bindRoomEvents(el);
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
          <h1>${esc(profile.displayName || 'Profile')}</h1>
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
    const profile = mutuals.find(p => p.uid === state.activeChatUid) || mutuals[0] || null;
    state.activeChatUid = profile?.uid || null;
    state.selectedProfileUid = profile?.uid || null;
    ensureChatWatch(profile);
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
                  <h2>${esc(profile.displayName || 'Member')}</h2>
                  <p>Mutual chat</p>
                </div>
              </div>
              <div class="social-dm-thread">
                ${renderDirectMessages(profile)}
              </div>
              <form class="social-message-form" id="social-direct-form">
                <input class="input" id="social-direct-input" placeholder="Message...">
                <button class="social-send-btn" type="submit" aria-label="Send direct message">${icon('send')}</button>
              </form>
            </section>
            <aside class="social-side-stack">
              ${renderProfileCard(profile)}
            </aside>
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
  }

  function renderTopbar(title) {
    const isRooms = title === 'Rooms';
    const searchValue = isRooms ? state.query : state.mutualQuery;
    const searchPlaceholder = isRooms ? 'Search rooms or people' : 'Search mutual friends';
    return `
      <div class="social-topbar">
        <h1>${esc(title)}</h1>
        <label class="social-global-search">
          <span>${icon('search')}</span>
          <input id="social-search" type="search" value="${esc(searchValue)}" placeholder="${esc(searchPlaceholder)}" autocomplete="off">
          <span>${icon('search')}</span>
        </label>
        ${isRooms ? `
          <div class="social-filter-row" role="tablist" aria-label="Room categories">
            ${ROOM_CATEGORIES.map(cat => `
              <button class="social-filter${state.activeCategory === cat ? ' active' : ''}" type="button" data-category="${esc(cat)}">${esc(cat)}</button>
            `).join('')}
          </div>
          <button class="social-create-btn" id="social-create-room" type="button">${icon('plus')} Create Room</button>
        ` : '<span></span><span></span>'}
      </div>`;
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
          ${people.length ? people.map(profile => `
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
          `).join('') : renderEmptyState('No mutuals', 'Mutual chats appear after both people follow each other.')}
        </div>
      </aside>`;
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

  function renderRoomRow(room, active) {
    const count = room.participantCount || 0;
    const max = room.maxPeople || 10;
    const avatars = roomParticipants(room);
    const extraCount = Math.max(count - avatars.length, 0);
    const category = String(room.category || 'Fitness').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    return `
      <article class="social-room-row${active ? ' active' : ''}" data-select-room="${esc(room.id)}">
        <div class="social-room-icon">${icon('room')}</div>
        <div class="social-room-main">
          <h3>${esc(room.topic || 'Untitled Room')}</h3>
          <div class="social-room-meta">
            <span class="social-tag social-tag-${esc(category)}">${esc(room.category || 'Fitness')}</span>
            <span>Host: ${esc(room.hostName || 'Member')}</span>
          </div>
          <div class="social-mini-avatars">
            ${avatars.map(p => avatar(p, 'social-avatar-xs')).join('')}
            ${extraCount ? `<span class="social-extra-count">+${extraCount}</span>` : ''}
          </div>
        </div>
        <div class="social-room-count">${count} / ${max}</div>
        <div class="social-room-tools">
          <span class="social-tool-mic">${icon('mic')}</span>
          <span>${icon('chat')}</span>
        </div>
        <button class="social-join-btn" type="button" data-join-room="${esc(room.id)}">${active ? 'Join' : 'Join'}</button>
      </article>`;
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

  function renderActiveRoom(room) {
    const members = state.roomMembers.length ? state.roomMembers : roomParticipants(room);
    const messages = state.roomMessages;
    return `
      <section class="social-panel social-active-room">
        <div class="social-active-head">
          <strong>Active Room</strong>
          <span>${esc(room.topic || 'Room')}</span>
          <b>Live</b>
        </div>
        <div class="social-speaker-grid">
          ${members.slice(0, 5).map(member => `
            <div class="social-speaker">
              ${avatar(member)}
              <strong>${esc(member.displayName || 'Member')}</strong>
              <small>${member.role || (member.uid === currentUid() ? 'You' : '')}</small>
              <span class="${member.micOn === false ? 'muted' : ''}">${member.micOn === false ? icon('micOff') : icon('mic')}</span>
            </div>
          `).join('')}
          <div class="social-room-cap">+${Math.max((room.participantCount || members.length || 0) - 5, 0)}<small>${room.participantCount || members.length || 0} / ${room.maxPeople || 10}</small></div>
        </div>
        <div class="social-room-chat">
          ${messages.length ? messages.map(msg => renderRoomMessage(msg)).join('') : '<div class="social-empty-thread">No room messages yet.</div>'}
        </div>
        <form class="social-message-form" id="social-room-message-form">
          <input class="input" id="social-room-message-input" placeholder="Message room...">
          <button class="social-send-btn" type="submit" aria-label="Send room message">${icon('send')}</button>
        </form>
      </section>`;
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
    if (!messages.length) {
      return `<div class="social-empty-thread">No messages yet.</div>`;
    }
    return messages.map(msg => `
      <div class="social-dm-msg${msg.senderUid === currentUid() ? ' own' : ''}">
        <p>${esc(msg.text || '')}</p>
        <span>${esc(msg.senderName || '')}</span>
      </div>
    `).join('');
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
            <div class="social-form-grid">
              <div class="form-group">
                <label for="social-room-category">Category</label>
                <select class="input" id="social-room-category">
                  ${ROOM_CATEGORIES.filter(cat => cat !== 'All').map(cat => `<option>${esc(cat)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="social-room-limit">People limit</label>
                <input class="input" id="social-room-limit" type="number" min="2" max="50" value="10">
              </div>
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
    el.querySelectorAll('[data-select-room]').forEach(row => row.addEventListener('click', () => {
      state.selectedRoomId = row.dataset.selectRoom;
      renderRooms();
    }));
    el.querySelectorAll('[data-join-room]').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      joinRoom(btn.dataset.joinRoom);
    }));
    el.querySelector('#social-room-message-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      sendRoomMessage();
    });
    el.querySelector('#social-create-room-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      createRoom();
    });
    el.querySelector('#social-close-room-modal')?.addEventListener('click', () => {
      state.showCreateRoom = false;
      renderRooms();
    });
  }

  function bindChatEvents(el) {
    bindSharedEvents(el);
    const mutualSearch = el.querySelector('#social-mutual-search');
    if (mutualSearch) {
      mutualSearch.addEventListener('input', () => {
        state.mutualQuery = mutualSearch.value;
        renderChat();
        requestAnimationFrame(() => {
          const input = document.getElementById('social-mutual-search');
          if (!input) return;
          input.focus({ preventScroll: true });
          input.setSelectionRange(input.value.length, input.value.length);
        });
      });
    }
    el.querySelector('#social-direct-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      sendDirectMessage();
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
        const view = location.hash.slice(1) || 'dashboard';
        if (view === 'chat') state.mutualQuery = search.value;
        else state.query = search.value;
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => {
          if (view === 'chat') renderChat();
          else if (view === 'rooms') renderRooms();
          focusSocialSearch();
        }, 120);
      });
    }
    el.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.category;
      renderRooms();
    }));
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

  async function createRoom() {
    if (!App.requireAuth()) return;
    const topic = document.getElementById('social-room-topic').value.trim();
    const category = document.getElementById('social-room-category').value;
    const maxPeople = Math.max(2, Math.min(50, parseInt(document.getElementById('social-room-limit').value, 10) || 10));
    if (!topic) {
      App.toast('Add a room topic.', 'error');
      return;
    }
    const me = Auth.getUser();
    const room = {
      topic,
      category,
      maxPeople,
      hostUid: me.uid,
      hostName: me.displayName || 'Host',
      hostPhoto: me.photoURL || '',
      participantCount: 1,
      currentParticipantIds: [me.uid],
      voiceEnabled: document.getElementById('social-room-voice').checked,
      chatEnabled: document.getElementById('social-room-chat').checked,
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    };
    const ref = await db().collection('social_rooms').add(room);
    await ref.collection('members').doc(me.uid).set(memberPayload(true, 'Host'));
    state.showCreateRoom = false;
    state.selectedRoomId = ref.id;
    App.toast('Room created');
    renderRooms();
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

  async function joinRoom(roomId) {
    if (!App.requireAuth()) return;
    const room = allRooms().find(item => item.id === roomId);
    state.selectedRoomId = roomId;
    if (!room) {
      App.toast('Room not found.', 'error');
      renderRooms();
      return;
    }
    const uid = currentUid();
    const roomRef = db().collection('social_rooms').doc(roomId);
    const memberRef = roomRef.collection('members').doc(uid);
    const snap = await memberRef.get();
    if (!snap.exists && (room.participantCount || 0) >= (room.maxPeople || 10)) {
      App.toast('This room is full.', 'error');
      return;
    }
    await memberRef.set(memberPayload(true, room.hostUid === uid ? 'Host' : ''), { merge: true });
    if (!snap.exists) {
      await roomRef.set({
        participantCount: firebase.firestore.FieldValue.increment(1),
        currentParticipantIds: firebase.firestore.FieldValue.arrayUnion(uid),
        updatedAt: now(),
      }, { merge: true });
    }
    App.toast('Joined room');
    renderRooms();
  }

  async function sendRoomMessage() {
    if (!App.requireAuth()) return;
    const input = document.getElementById('social-room-message-input');
    const text = input?.value.trim();
    if (!text) return;
    const room = selectedRoom();
    if (!room) {
      App.toast('Select a room first.', 'error');
      return;
    }
    await joinRoom(room.id);
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

  async function startChat(profileUid, fromList = false) {
    if (!App.requireAuth()) return;
    const profile = allProfiles().find(p => p.uid === profileUid);
    if (!profile || profile.uid === currentUid()) {
      App.toast('Profile not found.', 'error');
      return;
    }
    state.selectedProfileUid = profile.uid;
    if (!isMutual(profile)) {
      if (!fromList) App.toast('Both people need to follow each other before chat.', 'error');
      renderIfActive();
      return;
    }
    const me = Auth.getUser();
    const chatId = chatIdFor(me.uid, profile.uid);
    await db().collection('social_chats').doc(chatId).set({
      participantAUid: [me.uid, profile.uid].sort()[0],
      participantBUid: [me.uid, profile.uid].sort()[1],
      participantUids: [me.uid, profile.uid],
      updatedAt: now(),
    }, { merge: true });
    state.activeChatUid = profile.uid;
    App.navigate('chat');
  }

  async function sendDirectMessage() {
    if (!App.requireAuth()) return;
    const input = document.getElementById('social-direct-input');
    const text = input?.value.trim();
    if (!text) return;
    const profile = allProfiles().find(p => p.uid === state.activeChatUid);
    if (!profile || !isMutual(profile)) return;
    const me = Auth.getUser();
    const chatId = chatIdFor(me.uid, profile.uid);
    await db().collection('social_chats').doc(chatId).set({
      participantAUid: [me.uid, profile.uid].sort()[0],
      participantBUid: [me.uid, profile.uid].sort()[1],
      participantUids: [me.uid, profile.uid],
      updatedAt: now(),
    }, { merge: true });
    await db().collection('social_chats').doc(chatId).collection('messages').add({
      senderUid: me.uid,
      senderName: me.displayName || 'Member',
      senderPhoto: me.photoURL || '',
      text,
      createdAt: now(),
    });
    input.value = '';
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

  return {
    init,
    renderRooms,
    renderChat,
    renderProfile,
    syncOwnProfile,
    openProfile,
  };
})();
