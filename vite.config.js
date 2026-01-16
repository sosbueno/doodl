import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Map React Native async storage to our polyfill
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'js/turnkey-async-storage.js'),
      'react-native': 'react-native-web'
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        turnkey: './js/turnkey-app.jsx'
      },
      output: {
        entryFileNames: 'turnkey-app.js',
        format: 'iife',
        name: 'TurnkeyApp',
        globals: {
          '@react-native-async-storage/async-storage': 'null'
        }
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
