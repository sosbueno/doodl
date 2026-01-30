#!/usr/bin/env bash
# Install server deps and start. Wallet is vanilla JS - no build step.
set -e
cd "$(dirname "$0")"
echo "📦 Installing dependencies..."
npm install
echo "✅ Starting server..."
npm start
