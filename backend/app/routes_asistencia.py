import io
import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .db import get_db
from .models import AsistenciaSacramental

router = APIRouter(prefix='/asistencia', tags=['asistencia'])

META_ASISTENCIA = 550


def _parse_asistencia_txt(content: bytes) -> tuple[int, dict]:
    """Parsea un TXT con lineas 'Barrio N'.
    Ignora cabeceras y lineas sin número al final.
    Retorna (total, {barrio: valor})."""
    text = content.decode('utf-8-sig', errors='replace')
    desglose = {}
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
        # Buscar líneas que terminan en un número: "Libia 78"
        m = re.match(r'^(.+?)\s+(\d+)\s*$', line)
        if not m:
            continue
        barrio = m.group(1).strip()
        valor = int(m.group(2))
        # Saltar si el "barrio" parece un encabezado
        if any(kw in barrio.lower() for kw in ['asistencia', 'total', 'sacramental', 'barrio', 'congregaci']):
            continue
        desglose[barrio] = valor
    total = sum(desglose.values())
    return total, desglose


class RegistrarAsistenciaBody(BaseModel):
    periodo: str = '2026'
    valor: int
    notas: str = ''


@router.post('/upload')
async def upload_asistencia(file: UploadFile = File(...), periodo: str = '2026', db: Session = Depends(get_db)):
    """Sube un TXT con asistencia por barrio y suma el total."""
    content = await file.read()
    fname = file.filename.lower()

    if not (fname.endswith('.txt') or fname.endswith('.csv')):
        raise HTTPException(status_code=400, detail="Solo se acepta archivo .txt o .csv")

    total, desglose = _parse_asistencia_txt(content)

    if total == 0:
        raise HTTPException(status_code=400, detail="No se encontraron datos válidos. Formato esperado: 'Barrio Número' por línea.")

    existente = db.query(AsistenciaSacramental).filter(
        AsistenciaSacramental.periodo == periodo
    ).first()

    if existente:
        existente.valor = total
        existente.desglose = desglose
        existente.notas = f'Importado desde {file.filename}'
    else:
        nuevo = AsistenciaSacramental(
            periodo=periodo,
            valor=total,
            desglose=desglose,
            notas=f'Importado desde {file.filename}',
        )
        db.add(nuevo)

    db.commit()
    print(f"[ASISTENCIA] Periodo {periodo}: total={total}, barrios={list(desglose.keys())}")
    return {
        'ok': True,
        'total': total,
        'desglose': desglose,
        'mensaje': f'Asistencia registrada: {total} personas en {len(desglose)} barrios'
    }


@router.post('/registrar')
def registrar_asistencia(body: RegistrarAsistenciaBody, db: Session = Depends(get_db)):
    """Registra o actualiza el valor de asistencia sacramental para un periodo."""
    # Actualizar si ya existe para ese periodo, si no crear
    existente = db.query(AsistenciaSacramental).filter(
        AsistenciaSacramental.periodo == body.periodo
    ).first()

    if existente:
        existente.valor = body.valor
        existente.notas = body.notas
    else:
        nuevo = AsistenciaSacramental(
            periodo=body.periodo,
            valor=body.valor,
            notas=body.notas,
        )
        db.add(nuevo)

    db.commit()
    return {'ok': True, 'periodo': body.periodo, 'valor': body.valor}


@router.get('/kpi')
def get_kpi_asistencia(periodo: str = '2026', db: Session = Depends(get_db)):
    registro = db.query(AsistenciaSacramental).filter(
        AsistenciaSacramental.periodo == periodo
    ).order_by(AsistenciaSacramental.created_at.desc()).first()

    valor = registro.valor if registro else 0
    porcentaje = round((valor / META_ASISTENCIA) * 100, 1) if META_ASISTENCIA > 0 else 0

    return {
        'indicador': 'asistencia_sacramental',
        'nombre': 'Asistencia Sacramental',
        'real': valor,
        'meta': META_ASISTENCIA,
        'porcentaje': porcentaje,
        'notas': registro.notas if registro else '',
        'desglose': registro.desglose if registro else {},
    }
