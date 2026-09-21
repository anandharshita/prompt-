/**
 * ==============================================================================
 * PROMPT DASHBOARD — REST API CLIENT SDK
 * ==============================================================================
 * Provides clean HTTP interaction with the backend server.
 * Handles automatic failover to local browser persistence when offline or in file://.
 * ==============================================================================
 */

const PromptApi = (function() {
  'use strict';

  const isHttp = typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
  const BASE_URL = isHttp ? '' : 'http://localhost:3000';

  async function request(endpoint, options = {}) {
    const defaultHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Attach active session token if present
    const session = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('prompt_admin_session_v3') : null;
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed.token) {
          defaultHeaders['Authorization'] = `Bearer ${parsed.token}`;
        }
      } catch (e) {}
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, config);
      const data = await res.json().catch(() => null);
      return {
        ok: res.ok,
        status: res.status,
        data
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err.message,
        data: null
      };
    }
  }

  return {
    isAvailable: isHttp,

    // Health
    getHealth() {
      return request('/api/health');
    },

    // Auth
    login(username, password) {
      return request('/api/auth', {
        method: 'POST',
        body: { username, password }
      });
    },

    // Products
    getProducts() {
      return request('/api/products');
    },

    saveProducts(catalog, categories = []) {
      return request('/api/products', {
        method: 'POST',
        body: { catalog, categories }
      });
    },

    addProduct(product, operator) {
      return request('/api/products', {
        method: 'POST',
        body: { product, _operator: operator }
      });
    },

    updateProduct(product, operator) {
      return request('/api/products', {
        method: 'PUT',
        body: { product, _operator: operator }
      });
    },

    deleteProduct(productId, operator) {
      return request(`/api/products?id=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        body: { _operator: operator }
      });
    },

    // Users
    getUsers() {
      return request('/api/users');
    },

    createUser(user, operator) {
      return request('/api/users', {
        method: 'POST',
        body: { ...user, _operator: operator }
      });
    },

    deleteUser(username, operator) {
      return request(`/api/users?username=${encodeURIComponent(username)}`, {
        method: 'DELETE',
        body: { _operator: operator }
      });
    },

    // History & Rollback
    getHistory() {
      return request('/api/history');
    },

    rollback(historyId, operator) {
      return request('/api/history', {
        method: 'POST',
        body: { action: 'undo', historyId, operator }
      });
    },

    // Settings
    getSettings() {
      return request('/api/settings');
    },

    saveSettings(settings, operator) {
      return request('/api/settings', {
        method: 'POST',
        body: { settings, _operator: operator }
      });
    },

    // Sync
    previewSync() {
      return request('/api/sync?preview=true');
    },

    runSync(operator) {
      return request('/api/sync', {
        method: 'POST',
        body: { _operator: operator }
      });
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PromptApi;
}
