import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from . import db
from .models import AppSetting, CouncilAssignmentsPlan

router = APIRouter()

COUNCIL_ASSIGNMENTS_KEY = 'council_assignments_plan'
COUNCIL_ASSIGNMENTS_SCOPE = 'default'

DEFAULT_PLAN = json.loads(Path(__file__).with_name('council_assignments_seed.json').read_text(encoding='utf-8'))


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
            'additionalResponsibility': str(leader.get('additionalResponsibility') or ''),
            'assignments': [str(value) for value in leader.get('assignments', [])] if isinstance(leader.get('assignments'), list) else [],
            'referent': str(leader.get('referent') or ''),
            'observations': str(leader.get('observations') or ''),
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

    return {
        'assignmentOptions': plan.get('assignmentOptions') if isinstance(plan.get('assignmentOptions'), list) else DEFAULT_PLAN['assignmentOptions'],
        'referentOptions': plan.get('referentOptions') if isinstance(plan.get('referentOptions'), list) else DEFAULT_PLAN['referentOptions'],
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
    seen_ids = set()
    for leader in normalized_plan['leaders']:
        if not leader['id'] or leader['id'] in seen_ids or not leader['name'].strip():
            raise HTTPException(status_code=422, detail='Cada miembro debe tener nombre e identificador único.')
        seen_ids.add(leader['id'])

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
