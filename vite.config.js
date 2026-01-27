import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Map React Native async storage to our browser polyfill
      // The real package is installed but needs browser polyfill
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'js/turnkey-async-storage.js'),
      'react-native': 'react-native-web'
    }
  },
  build: {
    outDir: 'dist',
    commonjsOptions: {
      transformMixedEsModules: true
    },
    rollupOptions: {
      input: {
        turnkey: './js/turnkey-app.jsx'
      },
      output: {
        entryFileNames: 'turnkey-app.js',
        format: 'iife',
        name: 'TurnkeyApp',
        globals: {
          '@react-native-async-storage/async-storage': 'AsyncStorage'
        }
      },
      onwarn(warning, warn) {
        // Suppress warnings about Node.js crypto modules - they're handled by Turnkey
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('nodecrypto')) {
          return;
        }
        // Suppress AsyncStorage warnings since we're using a polyfill
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('async-storage')) {
          return;
        }
        warn(warning);
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    '__DEV__': false
  },
  optimizeDeps: {
    exclude: ['@react-native-async-storage/async-storage']
  }
});
