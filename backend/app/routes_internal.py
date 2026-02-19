from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from . import db
from .schemas import MeasurementIn
from .models import Measurement

router = APIRouter()


@router.post('/measurements')
def create_measurement(payload: MeasurementIn, db: Session = Depends(db.get_db)):
    m = Measurement(
        indicator_id=payload.indicator_key,
        period_id=payload.period_id,
        value=payload.value,
        unit=payload.unit,
        source_files=payload.source_files or [],
        raw_extractions=payload.raw_extractions or [],
        extracted_by_job=payload.job_id,
        validated=False,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "indicator_id": m.indicator_id, "value": float(m.value)}
