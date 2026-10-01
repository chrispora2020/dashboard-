import json
import os
import unittest
from pathlib import Path

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import db
from app.models import AppSetting, CouncilAssignmentsPlan
from app.routes_council_assignments import DEFAULT_PLAN, router


class CouncilAssignmentsTest(unittest.TestCase):
    def setUp(self):
        engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        AppSetting.__table__.create(engine)
        CouncilAssignmentsPlan.__table__.create(engine)
        session_factory = sessionmaker(bind=engine)

        def get_session():
            with session_factory() as session:
                yield session

        app = FastAPI()
        app.include_router(router, prefix='/api')
        app.dependency_overrides[db.get_db] = get_session
        self.client = TestClient(app)
        self.addCleanup(engine.dispose)
        self.addCleanup(self.client.close)

    def test_excel_seed(self):
        plan = self.client.get('/api/council-assignments').json()['plan']
        self.assertEqual(len(plan['leaders']), 11)
        self.assertEqual(sum('jovenes' in leader['committeeIds'] for leader in plan['leaders']), 5)
        self.assertEqual(plan['leaders'][0]['referent'], 'Presidente Silva')
        frontend_seed = Path(__file__).parents[2] / 'frontend/src/utils/councilAssignmentsSeed.json'
        self.assertEqual(plan, json.loads(frontend_seed.read_text(encoding='utf-8')))

    def test_save_edit_and_remove_all(self):
        plan = json.loads(json.dumps(DEFAULT_PLAN))
        leader = plan['leaders'][0]
        leader.update(additionalResponsibility='Responsabilidad nueva', assignments=['Una', 'Dos', 'Tres'],
                      observations='Observaciones nuevas', referent='Otro referente', unitIds=['belloni', 'libia'])
        plan['leaders'] = [leader]
        self.assertEqual(self.client.post('/api/council-assignments', json={'plan': plan}).status_code, 200)
        saved = self.client.get('/api/council-assignments').json()['plan']
        self.assertEqual(saved['leaders'], plan['leaders'])
        plan['leaders'] = []
        self.client.post('/api/council-assignments', json={'plan': plan})
        self.assertEqual(self.client.get('/api/council-assignments').json()['plan']['leaders'], [])


if __name__ == '__main__':
    unittest.main()
