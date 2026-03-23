import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from . import db
from .models import AppSetting

router = APIRouter()

STAKE_MESSAGES_PLAN_KEY = 'stake_messages_quarter_plan'


class StakeMessagesPlanPayload(BaseModel):
    plan: dict = Field(default_factory=dict)


@router.get('/stake-messages-plan')
def get_stake_messages_plan(session: Session = Depends(db.get_db)):
    setting = session.query(AppSetting).filter(AppSetting.key == STAKE_MESSAGES_PLAN_KEY).first()

    if not setting or not setting.value:
        return {'plan': {}}

    try:
        return {'plan': json.loads(setting.value)}
    except json.JSONDecodeError:
        return {'plan': {}}


@router.post('/stake-messages-plan')
def save_stake_messages_plan(payload: StakeMessagesPlanPayload, session: Session = Depends(db.get_db)):
    serialized_plan = json.dumps(payload.plan, ensure_ascii=False)
    setting = session.query(AppSetting).filter(AppSetting.key == STAKE_MESSAGES_PLAN_KEY).first()

    if not setting:
        setting = AppSetting(key=STAKE_MESSAGES_PLAN_KEY, value=serialized_plan)
        session.add(setting)
    else:
        setting.value = serialized_plan

    session.commit()
    return {'ok': True, 'plan': payload.plan}
