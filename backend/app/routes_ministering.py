from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from . import db
from .models import AppSetting

router = APIRouter()

MINISTERING_TEXT_KEY = 'ministering_interviews_raw_text'


class MinisteringPayload(BaseModel):
    text: str = ''


@router.get('/ministering')
def get_ministering_text(session: Session = Depends(db.get_db)):
    setting = session.query(AppSetting).filter(AppSetting.key == MINISTERING_TEXT_KEY).first()
    return {'text': setting.value if setting else ''}


@router.post('/ministering')
def save_ministering_text(payload: MinisteringPayload, session: Session = Depends(db.get_db)):
    setting = session.query(AppSetting).filter(AppSetting.key == MINISTERING_TEXT_KEY).first()

    if not setting:
        setting = AppSetting(key=MINISTERING_TEXT_KEY, value=payload.text or '')
        session.add(setting)
    else:
        setting.value = payload.text or ''

    session.commit()
    return {'ok': True, 'text': setting.value}
