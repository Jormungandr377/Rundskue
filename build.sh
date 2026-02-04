#!/bin/bash
set -e

echo "🔧 Installing Node.js dependencies..."
cd frontend && npm install

echo "🏗️ Building React frontend..."
npm run build

echo "🐍 Installing Python dependencies..."
cd ../backend && pip install -r requirements.txt

echo "✅ Build completed successfully!"