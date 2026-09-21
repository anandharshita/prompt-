/**
 * ==============================================================================
 * PROMPT DASHBOARD — CLIENT AUTHENTICATION & RBAC SERVICE
 * ==============================================================================
 * Manages user sessions, role checks, password hashes, and admin authorization.
 * ==============================================================================
 */

const PromptAuth = (function() {
  'use strict';

  const SESSION_KEY = "prompt_admin_session_v3";
  let currentUser = null;

  function getStoredSession() {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const sess = JSON.parse(raw);
      if (Date.now() > sess.expiresAt) {
        logout();
        return null;
      }
      return sess;
    } catch (e) {
      return null;
    }
  }

  function getUser() {
    if (currentUser) return currentUser;
    const sess = getStoredSession();
    if (sess) {
      currentUser = { username: sess.username, role: sess.role, token: sess.token };
      return currentUser;
    }
    return null;
  }

  function isAuthenticated() {
    return !!getUser();
  }

  function isSuperAdmin() {
    const u = getUser();
    return u && u.role === 'superadmin';
  }

  function isAdmin() {
    const u = getUser();
    return u && (u.role === 'admin' || u.role === 'superadmin');
  }

  function createSession(username, role, token = null) {
    const sessToken = token || ("pw_sess_" + Math.random().toString(36).substring(2) + Date.now().toString(36));
    const sessionData = {
      token: sessToken,
      username: username,
      role: role,
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    }
    currentUser = { username, role, token: sessToken };
    return sessionData;
  }

  function logout() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY);
    }
    currentUser = null;
  }

  return {
    getUser,
    isAuthenticated,
    isSuperAdmin,
    isAdmin,
    createSession,
    logout
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PromptAuth;
}
