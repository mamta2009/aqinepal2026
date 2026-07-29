# Isolates Python 3.12 from the host (safe alongside other sites on Ubuntu).
FROM python:3.12.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Build deps for scikit-learn / numpy wheels fallback
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r /app/backend/requirements.txt

# App tree: backend needs sibling landing/, frontend/, docs/, config/
COPY backend/ /app/backend/
COPY landing/ /app/landing/
COPY frontend/ /app/frontend/
COPY docs/ /app/docs/
COPY config/ /app/config/

WORKDIR /app/backend

EXPOSE 8000

# Single worker: AQ_SNAPSHOT_SYNC scheduler must not be duplicated
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers"]
