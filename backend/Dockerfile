# syntax=docker/dockerfile:1

# --- deps stage: install Python packages into an isolated prefix ---
FROM python:3.11-slim AS deps

WORKDIR /build

# Prefer wheels; only install compilers if a package forces a source build.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt \
    && pip uninstall -y pip setuptools wheel \
    && find /install -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true \
    && find /install -type d \( -name 'tests' -o -name 'test' \) -exec rm -rf {} + 2>/dev/null || true \
    && find /install -type f -name '*.pyc' -delete \
    && rm -rf /root/.cache/pip

# --- runtime: no compilers, no model cache, no test files ---
FROM python:3.11-slim AS runtime

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /install /usr/local

# App source only (see .dockerignore)
COPY . .

# Drop packaging tools from the final image (come from python:slim base).
RUN pip uninstall -y pip setuptools wheel \
    && find /usr/local -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true

EXPOSE 8000
ENV PYTHONUNBUFFERED=1
ENV ENABLE_LOCAL_LLM_FALLBACK=false

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
