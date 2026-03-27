import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from . import db
from .models import AppSetting, CouncilAssignmentsPlan

router = APIRouter()

COUNCIL_ASSIGNMENTS_KEY = 'council_assignments_plan'
COUNCIL_ASSIGNMENTS_SCOPE = 'default'

DEFAULT_PLAN = {
    'units': [
        {'id': 'libia', 'name': 'Libia'},
        {'id': 'barrio-14', 'name': 'Barrio 14'},
        {'id': 'los-ceibos', 'name': 'Los Ceibos'},
        {'id': 'belloni', 'name': 'Belloni'},
        {'id': 'bella-italia', 'name': 'Bella Italia'},
        {'id': 'pando', 'name': 'Pando'},
        {'id': 'toledo', 'name': 'Toledo'},
    ],
    'committees': [
        {'id': 'jovenes', 'name': 'Comité de Jóvenes'},
        {'id': 'adultos', 'name': 'Comité de Adultos'},
    ],
    'leaders': [
        {
            'id': 'richard-alvez',
            'name': 'Richard Alvez',
            'assignmentTitle': 'Historiador',
            'isHighCouncil': True,
            'isTraveler': False,
            'unitId': '',
            'committeeIds': [],
        },
        {
            'id': 'mauricio-alvez',
            'name': 'Mauricio Alvez',
            'assignmentTitle': 'Secretario de Estaca',
            'isHighCouncil': True,
            'isTraveler': True,
            'unitId': '',
            'committeeIds': [],
        },
        {
            'id': 'fabian-arias',
            'name': 'Fabian Arias',
            'assignmentTitle': 'Presidente de Hombres Jóvenes',
            'isHighCouncil': True,
            'isTraveler': True,
            'unitId': '',
            'committeeIds': ['jovenes'],
        },
        {
            'id': 'andres-benitez',
            'name': 'Andrés Benítez',
            'assignmentTitle': 'Primer Consejero Hombres Jóvenes',
            'isHighCouncil': True,
            'isTraveler': True,
            'unitId': '',
            'committeeIds': ['jovenes'],
        },
        {
            'id': 'juan-carlos-gonzalez',
            'name': 'Juan Carlos Gonzalez',
            'assignmentTitle': '',
            'isHighCouncil': True,
            'isTraveler': False,
            'unitId': '',
            'committeeIds': [],
        },
        {
            'id': 'antonio-gonzalez',
            'name': 'Antonio Gonzalez',
            'assignmentTitle': '',
            'isHighCouncil': True,
            'isTraveler': True,
            'unitId': '',
            'committeeIds': [],
        },
        {
            'id': 'pablo-morales',
            'name': 'Pablo Morales',
            'assignmentTitle': '',
            'isHighCouncil': True,
            'isTraveler': False,
            'unitId': '',
            'committeeIds': [],
        },
        {
            'id': 'jairo-paladino',
            'name': 'Jairo Paladino',
            'assignmentTitle': '',
            'isHighCouncil': True,
            'isTraveler': False,
            'unitId': '',
            'committeeIds': [],
        },
        {
            'id': 'walter-punales',
            'name': 'Walter Puñales',
            'assignmentTitle': 'Presidente de Escuela Dominical',
            'isHighCouncil': True,
            'isTraveler': True,
            'unitId': '',
            'committeeIds': ['adultos'],
        },
        {
            'id': 'joaquin-acota',
            'name': 'Joaquin Acota',
            'assignmentTitle': 'Primer Consejero de Rama',
            'isHighCouncil': True,
            'isTraveler': False,
            'unitId': '',
            'committeeIds': [],
        },
        {
            'id': 'fany-peraca',
            'name': 'Fany Peraca',
            'assignmentTitle': 'Presidenta Sociedad de Socorro',
            'isHighCouncil': False,
            'isTraveler': False,
            'unitId': '',
            'committeeIds': ['adultos'],
        },
        {
            'id': 'ruth-santos',
            'name': 'Ruth Santos',
            'assignmentTitle': 'Presidenta Mujeres Jóvenes',
            'isHighCouncil': False,
            'isTraveler': False,
            'unitId': '',
            'committeeIds': ['jovenes'],
        },
    ],
}


class CouncilAssignmentsPayload(BaseModel):
    plan: dict = Field(default_factory=dict)


def _normalize_plan_payload(plan: dict):
    if not isinstance(plan, dict):
        return DEFAULT_PLAN

    units = plan.get('units') if isinstance(plan.get('units'), list) else DEFAULT_PLAN['units']
    committees = plan.get('committees') if isinstance(plan.get('committees'), list) else DEFAULT_PLAN['committees']
    leaders = plan.get('leaders') if isinstance(plan.get('leaders'), list) else DEFAULT_PLAN['leaders']

    normalized_leaders = []
    for leader in leaders:
        if not isinstance(leader, dict):
            continue
        normalized_leaders.append({
            'id': str(leader.get('id') or ''),
            'name': str(leader.get('name') or ''),
            'assignmentTitle': str(leader.get('assignmentTitle') or ''),
            'isHighCouncil': bool(leader.get('isHighCouncil', False)),
            'isTraveler': bool(leader.get('isTraveler', False)),
            'unitId': str(leader.get('unitId') or ''),
            'unitIds': [
                str(unit_id or '')
                for unit_id in (
                    leader.get('unitIds')
                    if isinstance(leader.get('unitIds'), list)
                    else ([leader.get('unitId')] if leader.get('unitId') else [])
                )
                if str(unit_id or '')
            ],
            'committeeIds': leader.get('committeeIds') if isinstance(leader.get('committeeIds'), list) else [],
        })

    if not normalized_leaders:
        normalized_leaders = DEFAULT_PLAN['leaders']

    return {
        'units': units,
        'committees': committees,
        'leaders': normalized_leaders,
    }


@router.get('/council-assignments')
def get_council_assignments(session: Session = Depends(db.get_db)):
    row = session.query(CouncilAssignmentsPlan).filter(CouncilAssignmentsPlan.scope_key == COUNCIL_ASSIGNMENTS_SCOPE).first()
    if row and isinstance(row.plan_data, dict):
        return {'plan': _normalize_plan_payload(row.plan_data)}

    # Compatibilidad por si hubiera una versión previa en app_settings.
    setting = session.query(AppSetting).filter(AppSetting.key == COUNCIL_ASSIGNMENTS_KEY).first()
    if setting and setting.value:
        try:
            plan = _normalize_plan_payload(json.loads(setting.value))
            migrated = CouncilAssignmentsPlan(scope_key=COUNCIL_ASSIGNMENTS_SCOPE, plan_data=plan)
            session.add(migrated)
            session.commit()
            return {'plan': plan}
        except json.JSONDecodeError:
            pass

    return {'plan': DEFAULT_PLAN}


@router.post('/council-assignments')
def save_council_assignments(payload: CouncilAssignmentsPayload, session: Session = Depends(db.get_db)):
    normalized_plan = _normalize_plan_payload(payload.plan)

    row = session.query(CouncilAssignmentsPlan).filter(CouncilAssignmentsPlan.scope_key == COUNCIL_ASSIGNMENTS_SCOPE).first()
    if not row:
        row = CouncilAssignmentsPlan(scope_key=COUNCIL_ASSIGNMENTS_SCOPE, plan_data=normalized_plan)
        session.add(row)
    else:
        row.plan_data = normalized_plan

    serialized_plan = json.dumps(normalized_plan, ensure_ascii=False)
    setting = session.query(AppSetting).filter(AppSetting.key == COUNCIL_ASSIGNMENTS_KEY).first()
    if not setting:
        session.add(AppSetting(key=COUNCIL_ASSIGNMENTS_KEY, value=serialized_plan))
    else:
        setting.value = serialized_plan

    session.commit()
    return {'ok': True, 'plan': normalized_plan}
