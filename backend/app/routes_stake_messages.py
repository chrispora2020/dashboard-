import json
import re

import requests
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from . import db
from .models import AppSetting

router = APIRouter()

STAKE_MESSAGES_PLAN_KEY = 'stake_messages_quarter_plan'


class StakeMessagesPlanPayload(BaseModel):
    plan: dict = Field(default_factory=dict)


def _normalize_plan_payload(plan: dict):
    if isinstance(plan, dict) and 'quarters' in plan:
        return plan

    # Compatibilidad con payload histórico de un solo trimestre.
    legacy_quarter_id = 'legacy-quarter'
    return {
        'activeQuarterId': legacy_quarter_id,
        'quarters': {
            legacy_quarter_id: plan
        }
    }


@router.get('/stake-messages-plan')
def get_stake_messages_plan(session: Session = Depends(db.get_db)):
    setting = session.query(AppSetting).filter(AppSetting.key == STAKE_MESSAGES_PLAN_KEY).first()

    if not setting or not setting.value:
        return {'plan': {}}

    try:
        plan = json.loads(setting.value)
        return {'plan': _normalize_plan_payload(plan)}
    except json.JSONDecodeError:
        return {'plan': {}}


@router.post('/stake-messages-plan')
def save_stake_messages_plan(payload: StakeMessagesPlanPayload, session: Session = Depends(db.get_db)):
    normalized_plan = _normalize_plan_payload(payload.plan)
    serialized_plan = json.dumps(normalized_plan, ensure_ascii=False)
    setting = session.query(AppSetting).filter(AppSetting.key == STAKE_MESSAGES_PLAN_KEY).first()

    if not setting:
        setting = AppSetting(key=STAKE_MESSAGES_PLAN_KEY, value=serialized_plan)
        session.add(setting)
    else:
        setting.value = serialized_plan

    session.commit()
    return {'ok': True, 'plan': normalized_plan}


@router.get('/stake-messages-link-preview')
def get_stake_messages_link_preview(url: str = Query(..., min_length=8, max_length=2000)):
    if not (url.startswith('http://') or url.startswith('https://')):
        return {'ok': False, 'detail': 'URL inválida'}

    try:
        response = requests.get(
            url,
            timeout=6,
            allow_redirects=True,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; dashboard-preview-bot/1.0)'}
        )
        response.raise_for_status()
        html = response.text[:500_000]
    except requests.RequestException as exc:
        return {'ok': False, 'detail': f'No se pudo obtener el enlace: {exc}'}

    def find_meta(property_name: str):
        pattern = re.compile(
            rf'<meta[^>]+(?:property|name)=["\']{re.escape(property_name)}["\'][^>]+content=["\']([^"\']+)["\']',
            re.IGNORECASE
        )
        match = pattern.search(html)
        return match.group(1).strip() if match else ''

    title = find_meta('og:title') or find_meta('twitter:title')
    if not title:
        title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
        if title_match:
            title = re.sub(r'\s+', ' ', title_match.group(1)).strip()

    image = find_meta('og:image') or find_meta('twitter:image')
    description = find_meta('og:description') or find_meta('description')

    return {
        'ok': True,
        'title': title,
        'image': image,
        'description': description,
        'url': response.url,
    }
