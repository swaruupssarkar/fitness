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

  function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return _auth.signInWithPopup(provider);
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

  return { signInWithGoogle, signOut, onAuthReady, getUser, getDb };
})();
