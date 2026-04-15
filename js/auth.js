/* ─── Auth ─ Firebase Google Sign-In ─────────────────────────── */
const Auth = (() => {

  // ── PASTE YOUR FIREBASE CONFIG OBJECT HERE ─────────────────────
  const firebaseConfig = {
    apiKey:            "AIzaSyCyho3WClAktI8ATgFxHVvw_rrL-izSBl0",
    authDomain:        "fittrack-sync.firebaseapp.com",
    projectId:         "fittrack-sync",
    storageBucket:     "fittrack-sync.firebasestorage.app",
    messagingSenderId: "363491476923",
    appId:             "1:363491476923:web:805d5f1edbd0d25266309e",
  };
  // ── END CONFIG ─────────────────────────────────────────────────

  firebase.initializeApp(firebaseConfig);
  const _auth = firebase.auth();
  const _db   = firebase.firestore();

  // Try popup first; if blocked by browser, fall back to redirect
  async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      return await _auth.signInWithPopup(provider);
    } catch (err) {
      if (err.code === 'auth/popup-blocked' ||
          err.code === 'auth/popup-closed-by-user' ||
          err.code === 'auth/cancelled-popup-request') {
        // Popup was blocked — silently fall back to redirect
        return _auth.signInWithRedirect(provider);
      }
      throw err;
    }
  }

  // Called once on app init to pick up any pending redirect result
  function handleRedirectResult() {
    return _auth.getRedirectResult().catch(err => {
      // Ignore "no pending redirect" — only log real errors
      if (err.code && err.code !== 'auth/no-auth-event') {
        console.error('Firebase redirect result error:', err.code, err.message);
      }
    });
  }

  function signOut() {
    return _auth.signOut().then(() => {
      ['ft_plans', 'ft_logs', 'ft_settings', 'ft_sidebar_collapsed'].forEach(k =>
        localStorage.removeItem(k));
      location.reload();
    });
  }

  function onAuthReady(callback) { _auth.onAuthStateChanged(callback); }
  function getUser()             { return _auth.currentUser; }
  function getDb()               { return _db; }

  return { signInWithGoogle, handleRedirectResult, signOut, onAuthReady, getUser, getDb };
})();
