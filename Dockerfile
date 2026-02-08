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

# Install runtime deps, build deps, pip install, then remove build deps in one layer
COPY backend/requirements.txt /tmp/requirements.txt
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq5 curl \
        gcc g++ libffi-dev libpq-dev python3-dev && \
    pip install --no-cache-dir -r /tmp/requirements.txt && \
    apt-get purge -y --auto-remove gcc g++ libffi-dev libpq-dev python3-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/requirements.txt

# Create a non-root user to run the application
RUN groupadd --gid 1001 appuser && \
    useradd --uid 1001 --gid appuser --shell /bin/bash --create-home appuser

# Set working directory to monorepo root
# Critical: uvicorn runs as backend.app.main:app from this directory
# and main.py resolves static files via Path(__file__).parent.parent.parent / "frontend" / "dist"
WORKDIR /app

# Copy backend requirements (needed by app at runtime for reference)
COPY backend/requirements.txt ./backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend from stage 1
# Lands at /app/frontend/dist — exactly where main.py expects it
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy startup script (runs migrations then starts app)
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Make app directory owned by appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

CMD ["./start.sh"]
