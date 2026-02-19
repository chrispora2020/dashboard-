FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
	 && apt-get install -y --no-install-recommends \
		 gcc \
		 libpq-dev \
	 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY ./requirements.txt /app/requirements.txt
RUN pip install --upgrade pip \
	&& pip install --no-cache-dir \
	   --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org \
	   -r /app/requirements.txt
COPY . /app
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
