FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
	 && apt-get install -y --no-install-recommends \
		 gcc \
		 libpq-dev \
		 supervisor \
	 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Build context: raíz del repositorio (necesario para Render cuando usa backend/Dockerfile).
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip \
	&& pip install --no-cache-dir \
	   --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org \
	   -r /app/requirements.txt
COPY backend/ /app/
COPY backend/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

ENV PYTHONUNBUFFERED=1
ENV PORT=7860
EXPOSE 7860
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
