import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Prevent React Native dependencies from being bundled for web
      '@react-native-async-storage/async-storage': false,
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
