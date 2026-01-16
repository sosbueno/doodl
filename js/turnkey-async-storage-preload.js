// Preload AsyncStorage polyfill - Must execute BEFORE Turnkey app loads
// This ensures AsyncStorage is available for Turnkey's runtime detection

(function() {
  'use strict';
  
  if (typeof window === 'undefined') return;
  
  // Only create if it doesn't exist
  if (window.AsyncStorage) return;
  
  const AsyncStorage = {
    getItem: function(key) {
      try {
        const value = localStorage.getItem(key);
        return Promise.resolve(value);
      } catch (e) {
        return Promise.resolve(null);
      }
    },
    setItem: function(key, value) {
      try {
        localStorage.setItem(key, value);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    },
    removeItem: function(key) {
      try {
        localStorage.removeItem(key);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    },
    clear: function() {
      try {
        localStorage.clear();
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    },
    getAllKeys: function() {
      try {
        return Promise.resolve(Object.keys(localStorage));
      } catch (e) {
        return Promise.resolve([]);
      }
    },
    multiGet: function(keys) {
      try {
        const result = keys.map(key => [key, localStorage.getItem(key)]);
        return Promise.resolve(result);
      } catch (e) {
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
        return Promise.reject(e);
      }
    },
    multiRemove: function(keys) {
      try {
        keys.forEach(key => localStorage.removeItem(key));
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    }
  };
  
  // Make available globally
  window.AsyncStorage = AsyncStorage;
  if (typeof globalThis !== 'undefined') {
    globalThis.AsyncStorage = AsyncStorage;
  }
  if (typeof global !== 'undefined') {
    global.AsyncStorage = AsyncStorage;
  }
  
  console.log('✅ AsyncStorage polyfill preloaded');
})();
