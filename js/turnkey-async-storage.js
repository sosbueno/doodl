// Turnkey AsyncStorage polyfill - Browser-compatible storage
// This provides a localStorage-based implementation of AsyncStorage
// Used via Vite alias: @react-native-async-storage/async-storage -> this file

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

// CommonJS export (for dynamic requires)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AsyncStorage;
  module.exports.default = AsyncStorage;
}

// ES Module export (for Vite bundling)
export default AsyncStorage;
export { AsyncStorage };

// Also make available globally for runtime detection
if (typeof window !== 'undefined') {
  window.AsyncStorage = AsyncStorage;
  if (typeof globalThis !== 'undefined') {
    globalThis.AsyncStorage = AsyncStorage;
  }
  if (typeof global !== 'undefined') {
    global.AsyncStorage = AsyncStorage;
  }
  
  // Mock require for dynamic imports (CommonJS)
  if (typeof require !== 'undefined') {
    if (!require.cache) {
      require.cache = {};
    }
    require.cache['@react-native-async-storage/async-storage'] = {
      exports: AsyncStorage,
      loaded: true,
      id: '@react-native-async-storage/async-storage'
    };
    
    // Mock require.resolve
    const originalResolve = require.resolve;
    require.resolve = function(id) {
      if (id === '@react-native-async-storage/async-storage') {
        return '@react-native-async-storage/async-storage';
      }
      if (typeof originalResolve === 'function') {
        return originalResolve.apply(this, arguments);
      }
      return id;
    };
  }
}
