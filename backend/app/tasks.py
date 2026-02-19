from .celery_app import celery
import time
import requests
import os

BACKEND_URL = os.getenv('BACKEND_INTERNAL_URL', 'http://backend:8000')


@celery.task(bind=True)
def process_pdf(self, file_id: str):
    # Simple simulated extraction: sleep and post a dummy measurement to internal endpoint
    self.update_state(state='PROCESSING')
    time.sleep(2)
    payload = {
        "indicator_key": "bautismos",
        "period_id": "initial",
        "value": 1,
        "unit": "count",
        "source_files": [file_id],
        "raw_extractions": [{"page": 1, "text": "Bautismos 1", "method": "simulated", "confidence": 0.9}],
        "job_id": str(self.request.id)
    }
    try:
        url = f"{BACKEND_URL}/api/internal/measurements"
        requests.post(url, json=payload, timeout=10)
    except Exception:
        pass
