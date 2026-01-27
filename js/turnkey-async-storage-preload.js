// Preload AsyncStorage polyfill - Must execute BEFORE Turnkey app loads
// This ensures AsyncStorage is available for Turnkey's runtime detection

(function() {
  'use strict';
  
  if (typeof window === 'undefined') return;
  
  // Only create if it doesn't exist
  if (window.AsyncStorage) {
    console.log('✅ AsyncStorage already exists, skipping polyfill');
    return;
  }
  
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
  
  // Make available globally on all possible global objects
  window.AsyncStorage = AsyncStorage;
  if (typeof globalThis !== 'undefined') {
    globalThis.AsyncStorage = AsyncStorage;
  }
  if (typeof global !== 'undefined') {
    global.AsyncStorage = AsyncStorage;
  }
  
  // Set up require cache for dynamic requires (CommonJS)
  if (typeof require !== 'undefined') {
    if (!require.cache) {
      require.cache = {};
    }
    require.cache['@react-native-async-storage/async-storage'] = {
      exports: AsyncStorage,
      loaded: true,
      id: '@react-native-async-storage/async-storage'
    };
    
    // Mock require.resolve to handle dynamic requires
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
  
  // Also set up for ES module dynamic imports (if needed)
  if (typeof window !== 'undefined') {
    // Create a module registry for dynamic imports
    window.__ASYNC_STORAGE_MODULE__ = AsyncStorage;
    
    // Ensure AsyncStorage is available for Turnkey's MobileStorageManager detection
    // Turnkey checks for AsyncStorage in various ways, so we need to cover all bases
    Object.defineProperty(window, 'AsyncStorage', {
      value: AsyncStorage,
      writable: false,
      configurable: false,
      enumerable: true
    });
  }
  
  // Also ensure it's available on globalThis with same properties
  if (typeof globalThis !== 'undefined') {
    Object.defineProperty(globalThis, 'AsyncStorage', {
      value: AsyncStorage,
      writable: false,
      configurable: false,
      enumerable: true
    });
  }
  
  console.log('✅ AsyncStorage polyfill preloaded');
})();
