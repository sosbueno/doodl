// Polyfill for Turnkey to use browser storage instead of React Native
// This file should be loaded before turnkey-app.js

if (typeof window !== 'undefined') {
  // Create a mock AsyncStorage that uses localStorage
  window.AsyncStorage = {
    getItem: (key) => {
      try {
        return Promise.resolve(localStorage.getItem(key));
      } catch (e) {
        return Promise.resolve(null);
      }
    },
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    },
    removeItem: (key) => {
      try {
        localStorage.removeItem(key);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    },
    clear: () => {
      try {
        localStorage.clear();
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    },
    getAllKeys: () => {
      try {
        return Promise.resolve(Object.keys(localStorage));
      } catch (e) {
        return Promise.resolve([]);
      }
    }
  };
  
  // Also set it on global for module systems
  if (typeof global !== 'undefined') {
    global.AsyncStorage = window.AsyncStorage;
  }
}
