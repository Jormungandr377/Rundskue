# ============================================
# Stage 1: Build the React frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files first for layer caching
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build production bundle
RUN npm run build

# ============================================
# Stage 2: Python runtime
# ============================================
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

# Set working directory to monorepo root
# Critical: uvicorn runs as backend.app.main:app from this directory
# and main.py resolves static files via Path(__file__).parent.parent.parent / "frontend" / "dist"
WORKDIR /app

# Copy backend requirements and install Python deps
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend from stage 1
# Lands at /app/frontend/dist — exactly where main.py expects it
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy startup script (runs migrations then starts app)
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/health || exit 1

CMD ["./start.sh"]
