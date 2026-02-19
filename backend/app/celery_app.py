import os
from celery import Celery

REDIS = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

celery = Celery('worker', broker=REDIS, backend=REDIS)

celery.conf.task_routes = {
    'app.tasks.process_pdf': {'queue': 'pdfs'}
}
