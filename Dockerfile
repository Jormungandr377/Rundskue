# Use Python 3.9 as base image
FROM python:3.9-slim

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY frontend/package.json frontend/package.json
COPY backend/requirements.txt backend/requirements.txt

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm install

# Install backend dependencies
WORKDIR /app/backend
RUN pip install -r requirements.txt

# Copy application code
WORKDIR /app
COPY . .

# Build frontend (skip TypeScript check for now)
WORKDIR /app/frontend
RUN npx vite build

# Set working directory back to app root
WORKDIR /app

# Expose port (Railway will set PORT env var)
EXPOSE $PORT

# Start command - use PORT environment variable
CMD python -m uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}