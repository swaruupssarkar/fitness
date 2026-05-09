/* ─── Notes ─ Personal notes per user ───────────────────────── */
const Notes = (() => {

  const LS_KEY = 'ft_notes';

  function db()  { return Auth.getDb(); }
  function uid()  { return Auth.getUser()?.uid || null; }

  /* ── localStorage helpers ─────────────────────────────────────── */
  function _lsGet()  { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return []; } }
  function _lsSet(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {} }

  /* ── Auth gate ────────────────────────────────────────────────── */
  function requireAuth() {
    if (uid()) return true;
    App.showSignInModal();
    return false;
  }

  /* ── Storage ──────────────────────────────────────────────────── */
  function getNotes() {
    return _lsGet();
  }

  async function saveNote(note) {
    if (!requireAuth()) return;
    const now = Date.now();
    const notes = _lsGet();

    if (note.id) {
      const idx = notes.findIndex(n => n.id === note.id);
      if (idx >= 0) {
        notes[idx] = { ...notes[idx], title: note.title || '', body: note.body || '', updatedAt: now };
      } else {
        const id = 'note_' + now + '_' + Math.random().toString(36).slice(2, 9);
        notes.unshift({ id, title: note.title || '', body: note.body || '', createdAt: now, updatedAt: now });
      }
    } else {
      const id = 'note_' + now + '_' + Math.random().toString(36).slice(2, 9);
      notes.unshift({ id, title: note.title || '', body: note.body || '', createdAt: now, updatedAt: now });
    }

    _lsSet(notes);
    await _fsSyncNotes(notes);
  }

  async function deleteNote(id) {
    if (!requireAuth()) return;
    if (!id) { App.toast('Invalid note.', 'error'); return; }
    const notes = _lsGet().filter(n => n.id !== id);
    _lsSet(notes);
    await _fsSyncNotes(notes);
  }

  /* ── Firestore sync ───────────────────────────────────────────── */
  async function _fsSyncNotes(notes) {
    const u = uid();
    if (!u) return;

    const col = db().collection(`users/${u}/notes`);
    try {
      // Single batch: delete all existing, then write current notes
      const batch = db().batch();

      const snap = await col.get();
      if (!snap.empty) {
        snap.docs.forEach(d => {
          if (d.id) batch.delete(d.ref);
        });
      }

      // Only write notes that have a valid non-empty id
      const validNotes = notes.filter(n => n.id && n.id.trim() !== '');
      validNotes.forEach(n => batch.set(col.doc(n.id), n));

      await batch.commit();
    } catch (e) {
      // Firestore sync failed — localStorage already updated, user experience unaffected
      console.warn('Notes Firestore sync failed:', e.code || e.message);
    }
  }

  /* ── Render ───────────────────────────────────────────────────── */
  let _editingId = null;

  async function render() {
    _editingId = null;
    const el = document.getElementById('view-notes');
    el.innerHTML = `<div class="view-header"><h1>Notes</h1></div><div class="notes-loading">Loading…</div>`;
    const notes = getNotes();
    renderView(el, notes);
  }

  function renderView(el, notes) {
    const isGuest = !uid();
    el.innerHTML = `
      <div class="view-header">
        <h1>Notes</h1>
        <p class="subtitle">${isGuest ? '—' : notes.length + ' note' + (notes.length !== 1 ? 's' : '')}</p>
      </div>

      ${isGuest ? `
        <div class="notes-auth-gate">
          <div class="empty-icon">🔐</div>
          <p>Sign in to save and manage your notes.</p>
          <button class="btn btn-primary" id="notes-signin-btn">Sign In</button>
        </div>
      ` : `
      <div class="notes-compose">
        <input type="text" id="note-title" class="input notes-title-input" placeholder="Title (optional)">
        <textarea id="note-body" class="input notes-body-input" placeholder="Write a note…" rows="3"></textarea>
        <div class="notes-compose-actions">
          <button class="btn btn-primary" id="note-save-btn">Add Note</button>
          <button class="btn btn-outline" id="note-cancel-btn" style="display:none">Cancel</button>
        </div>
      </div>
      `}

      ${!isGuest && notes.length ? `
        <div class="notes-list" id="notes-list">
          ${notes.map(n => renderNoteCard(n)).join('')}
        </div>` : ''}
      ${!isGuest && !notes.length ? `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <p>No notes yet. Write your first one above.</p>
        </div>` : ''}
    `;
    bindEvents(el);
  }

  function renderNoteCard(n) {
    const date = new Date(n.updatedAt || n.createdAt).toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric' });
    return `
      <div class="note-card" data-id="${esc(n.id || '')}">
        <div class="note-card-header">
          ${n.title ? `<div class="note-card-title">${esc(n.title)}</div>` : ''}
          <div class="note-card-date">${date}</div>
        </div>
        <div class="note-card-body">${esc(n.body || '').replace(/\n/g, '<br>')}</div>
        <div class="note-card-actions">
          <button class="btn btn-sm btn-outline note-edit-btn" data-id="${esc(n.id || '')}">Edit</button>
          <button class="btn btn-sm btn-danger note-del-btn" data-id="${esc(n.id || '')}">Delete</button>
        </div>
      </div>`;
  }

  function resetCompose() {
    const titleInp = document.getElementById('note-title');
    const bodyInp  = document.getElementById('note-body');
    const saveBtn  = document.getElementById('note-save-btn');
    const cancelBtn = document.getElementById('note-cancel-btn');
    if (!titleInp || !bodyInp || !saveBtn || !cancelBtn) return;
    titleInp.value = '';
    bodyInp.value  = '';
    saveBtn.textContent = 'Add Note';
    cancelBtn.style.display = 'none';
    _editingId = null;
  }

  function getNotesContainer() {
    return document.getElementById('notes-list') || document.querySelector('.empty-state');
  }

  async function refreshNotesList() {
    const notes = getNotes();
    const el = document.getElementById('view-notes');
    const listEl = getNotesContainer();
    if (!listEl || !el) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = notes.length
      ? `<div class="notes-list" id="notes-list">${notes.map(renderNoteCard).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">📝</div><p>No notes yet. Write your first one above.</p></div>`;
    listEl.replaceWith(wrapper.firstElementChild);
    const subtitle = el.querySelector('.subtitle');
    if (subtitle) subtitle.textContent =
      `${notes.length} note${notes.length !== 1 ? 's' : ''}`;
  }

  function bindEvents(el) {
    const signInBtn = el.querySelector('#notes-signin-btn');
    if (signInBtn) {
      signInBtn.addEventListener('click', () => App.showSignInModal());
    }

    const saveBtn   = document.getElementById('note-save-btn');
    const cancelBtn = document.getElementById('note-cancel-btn');
    const titleInp = document.getElementById('note-title');
    const bodyInp   = document.getElementById('note-body');

    cancelBtn?.addEventListener('click', resetCompose);

    saveBtn?.addEventListener('click', async () => {
      if (!requireAuth()) return;
      const title = titleInp.value.trim();
      const body  = bodyInp.value.trim();
      if (!body && !title) { App.toast('Write something first.', 'error'); return; }
      saveBtn.disabled = true;
      saveBtn.textContent = '…';
      try {
        await saveNote({ id: _editingId || null, title, body });
        App.toast(_editingId ? 'Note updated!' : 'Note saved!', 'success');
        resetCompose();
        await refreshNotesList();
      } catch (e) {
        App.toast('Failed to save: ' + (e.message || e.code || 'error'), 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = _editingId ? 'Update Note' : 'Add Note';
      }
    });

    // auto-grow textarea
    bodyInp?.addEventListener('input', () => {
      bodyInp.style.height = 'auto';
      bodyInp.style.height = bodyInp.scrollHeight + 'px';
    });

    // Delegated note-card events on #view-notes
    el.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.note-edit-btn');
      const delBtn  = e.target.closest('.note-del-btn');

      // ── Edit ──────────────────────────────────────────────────
      if (editBtn) {
        if (!requireAuth()) return;
        const id = editBtn.dataset.id;
        if (!id) { App.toast('Note not found.', 'error'); return; }
        const notes = getNotes();
        const note  = notes.find(n => n.id === id);
        if (!note) { App.toast('Note not found.', 'error'); return; }
        _editingId = note.id;
        const tInp = document.getElementById('note-title');
        const bInp = document.getElementById('note-body');
        const sBtn = document.getElementById('note-save-btn');
        const cBtn = document.getElementById('note-cancel-btn');
        if (tInp) tInp.value = note.title || '';
        if (bInp) bInp.value = note.body  || '';
        if (sBtn) sBtn.textContent = 'Update Note';
        if (cBtn) cBtn.style.display = '';
        if (tInp) { tInp.scrollIntoView({ behavior: 'smooth', block: 'start' }); tInp.focus(); }
        return;
      }

      // ── Delete ───────────────────────────────────────────────
      if (delBtn) {
        if (!requireAuth()) return;
        const id = delBtn.dataset.id;
        if (!id) { App.toast('Note not found.', 'error'); return; }
        if (!confirm('Delete this note?')) return;
        try {
          await deleteNote(id);
          App.toast('Note deleted!', 'success');
          await refreshNotesList();
        } catch (e) {
          App.toast('Failed to delete: ' + (e.message || e.code), 'error');
        }
        return;
      }
    });
  }

  return { render };
})();