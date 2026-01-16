// Polyfill for Turnkey to use browser storage instead of React Native
// This file must be loaded before turnkey-app.js

(function() {
  'use strict';
  
  if (typeof window === 'undefined') return;
  
  // Mock React Native environment detection
  if (!window.navigator) window.navigator = {};
  if (!window.navigator.product) window.navigator.product = 'Gecko';
  
  // Create AsyncStorage mock that uses localStorage
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
  
  // Set on window
  window.AsyncStorage = AsyncStorage;
  
  // Set on global if it exists
  if (typeof global !== 'undefined') {
    global.AsyncStorage = AsyncStorage;
  }
  
  // Mock the module for require/import systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AsyncStorage;
    module.exports.default = AsyncStorage;
  }
  
  // Create a mock module for dynamic imports
  window.__TURNKEY_ASYNC_STORAGE__ = AsyncStorage;
  
  console.log('✅ Turnkey AsyncStorage polyfill loaded');
})();

// Export for ES modules
export default window.AsyncStorage || {};
export const AsyncStorage = window.AsyncStorage || {};
