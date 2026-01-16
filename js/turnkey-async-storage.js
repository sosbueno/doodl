// Turnkey AsyncStorage polyfill - Browser-compatible storage
// This provides a localStorage-based implementation of AsyncStorage
// Must be loaded BEFORE Turnkey app to ensure it's available

(function() {
  'use strict';
  
  // Prevent re-initialization
  if (typeof window !== 'undefined' && window.AsyncStorage) {
    return;
  }

const AsyncStorage = {
  getItem: function(key) {
    try {
      const value = localStorage.getItem(key);
      return Promise.resolve(value);
    } catch (e) {
      console.warn('AsyncStorage.getItem error:', e);
      return Promise.resolve(null);
    }
  },
  setItem: function(key, value) {
    try {
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (e) {
      console.warn('AsyncStorage.setItem error:', e);
      return Promise.reject(e);
    }
  },
  removeItem: function(key) {
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (e) {
      console.warn('AsyncStorage.removeItem error:', e);
      return Promise.reject(e);
    }
  },
  clear: function() {
    try {
      localStorage.clear();
      return Promise.resolve();
    } catch (e) {
      console.warn('AsyncStorage.clear error:', e);
      return Promise.reject(e);
    }
  },
  getAllKeys: function() {
    try {
      return Promise.resolve(Object.keys(localStorage));
    } catch (e) {
      console.warn('AsyncStorage.getAllKeys error:', e);
      return Promise.resolve([]);
    }
  },
  multiGet: function(keys) {
    try {
      const result = keys.map(key => [key, localStorage.getItem(key)]);
      return Promise.resolve(result);
    } catch (e) {
      console.warn('AsyncStorage.multiGet error:', e);
      return Promise.resolve([]);
    }
  },
  multiSet: function(keyValuePairs) {
    try {
      keyValuePairs.forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      return Promise.resolve();
    } catch (e) {
      console.warn('AsyncStorage.multiSet error:', e);
      return Promise.reject(e);
    }
  },
  multiRemove: function(keys) {
    try {
      keys.forEach(key => localStorage.removeItem(key));
      return Promise.resolve();
    } catch (e) {
      console.warn('AsyncStorage.multiRemove error:', e);
      return Promise.reject(e);
    }
  }
};

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AsyncStorage;
  module.exports.default = AsyncStorage;
}

// Make available globally for Turnkey (when loaded as script tag)
if (typeof window !== 'undefined') {
  // Make available globally for Turnkey
  window.AsyncStorage = AsyncStorage;
  window.global = window.global || window;
  window.global.AsyncStorage = AsyncStorage;
  
  // Also set on globalThis for modern environments
  if (typeof globalThis !== 'undefined') {
    globalThis.AsyncStorage = AsyncStorage;
  }
}

})();
