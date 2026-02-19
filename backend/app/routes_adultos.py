"""
Rutas para gestión de Adultos Investidos con Recomendación: upload e importación
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import pandas as pd
import io
import re
import os
import pdfplumber

from . import db
from .models import PdfFile, AdultoRecomendacion

router = APIRouter(prefix='/adultos', tags=['adultos'])

META_ADULTOS_RECOMENDACION = 100  # 100%

# === NORMALIZACIÓN DE ESTADO ===

ESTADO_ACTIVA    = 'activa'
ESTADO_VENCE     = 'vence_pronto'
ESTADO_VENCIDA   = 'vencida'
ESTADO_CANCELADA = 'cancelada'
ESTADO_SIN_EST   = 'sin_estado'

def normalizar_estado_adulto(estado_raw: str, vencimiento_raw: str = '') -> str:
    if not estado_raw or str(estado_raw).strip().lower() in ('', 'none', 'nan'):
        return ESTADO_SIN_EST
    s = ' '.join(str(estado_raw).split()).lower()
    v = ' '.join(str(vencimiento_raw or '').split()).lower()
    if 'cancelada' in s or 'cancelado' in s:
        return ESTADO_CANCELADA
    if 'extraviada' in s or 'extraviado' in s or 'robada' in s or 'robado' in s:
        return ESTADO_CANCELADA
    if 'vencen en' in s or 'vence en' in s or 'vencen en' in v or 'vence en' in v:
        return ESTADO_VENCE
    if 'vencida' in s or 'vencido' in s or 'expired' in s:
        return ESTADO_VENCIDA
    if 'activa' in s or 'vigente' in s or 'active' in s:
        return ESTADO_ACTIVA
    return ESTADO_SIN_EST

def tiene_rec_activa(estado_norm: str) -> bool:
    return estado_norm in (ESTADO_ACTIVA, ESTADO_VENCE)

# === PDF PARSING ===

MESES = r'(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)'
VENCE_RE = re.compile(rf'Vencen?\s+en\s+(?:\d+\s+d[íi]as?|{MESES}\.?\s+\d{{4}})', re.IGNORECASE)
MES_ANIO_RE = re.compile(rf'{MESES}\.?\s+\d{{4}}', re.IGNORECASE)

def _parse_adultos_pdf(contents: bytes) -> pd.DataFrame:
    """
    Extrae lista de adultos investidos con recomendación con extract_text
    para evitar que las filas con fondo de color sean ignoradas.
    """
    ESTADOS = [
        'extraviada o robada', 'extraviado o robado',
        'no ha sido bautizado', 'no bautizado',
        'vencen en', 'vence en',
        'cancelada', 'cancelado',
        'vencida', 'vencido',
        'activa', 'vigente',
    ]
    MES_ANIO_FULL = re.compile(
        r'\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?\s+\d{4}\b',
        re.IGNORECASE
    )
    UNIDAD_RE = re.compile(
        r'\b(Barrio|Rama|Distrito|Estaca)\s+[\w\s]+$',
        re.IGNORECASE
    )
    SKIP_STARTS = [
        'nombre', 'estado de la recomendaci',
        'para uso exclusivo', 'derechos reservados',
        'intellectual reserve', 'estaca montevideo',
        'recuento:', 'total:',
    ]

    records = []

    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text(x_tolerance=3, y_tolerance=3)
            if not text:
                continue
            lines = text.split('\n')
            print(f"[DEBUG ADULTOS TEXT] Page {page_num+1}: {len(lines)} lines")

            for line in lines:
                line = ' '.join(line.split()).strip()
                if not line:
                    continue
                ll = line.lower()
                if any(ll.startswith(s) for s in SKIP_STARTS):
                    continue
                first_tok = ll.split()[0] if ll.split() else ''
                if re.match(r'^\d+$', first_tok):
                    continue
                if ',' not in line:
                    continue

                rec = _parse_adultos_line(line, ESTADOS, MES_ANIO_FULL, UNIDAD_RE)
                if rec:
                    records.append(rec)

    if not records:
        raise ValueError("No se encontraron datos de adultos en el PDF")

    df = pd.DataFrame(records)
    print(f"[DEBUG ADULTOS] Total parsed: {len(df)} records")
    return df


def _parse_adultos_line(line: str, estados: list, mes_re, unidad_re) -> dict:
    """Parsea una linea de texto en dict: nombre, sexo, edad, estado_raw, vencimiento_raw, unidad"""
    remaining = line.strip()
    result = {
        'nombre': '', 'sexo': '', 'edad': '',
        'estado_raw': '', 'vencimiento_raw': '', 'unidad': ''
    }

    # 1. Unidad al final
    unidad_m = unidad_re.search(remaining)
    if unidad_m:
        result['unidad'] = unidad_m.group(0).strip()
        remaining = remaining[:unidad_m.start()].strip()

    # 2. Fecha vencimiento
    mes_m = mes_re.search(remaining)
    if mes_m:
        result['vencimiento_raw'] = mes_m.group(0).strip()
        remaining = remaining[:mes_m.start()].strip()

    # 3. Estado
    for est in sorted(estados, key=len, reverse=True):
        m = re.search(re.escape(est), remaining, re.IGNORECASE)
        if m:
            result['estado_raw'] = m.group(0).strip()
            remaining = remaining[:m.start()].strip()
            break

    # 4. Sexo y edad (escaneando tokens desde la derecha)
    tokens = remaining.split()
    edad_val = ''
    sexo_val = ''
    name_tokens = list(tokens)

    for i in range(len(name_tokens) - 1, -1, -1):
        t = name_tokens[i]
        if re.match(r'^\d{1,2}$', t) and int(t) <= 99:
            edad_val = t
            name_tokens.pop(i)
            break

    for i in range(len(name_tokens) - 1, -1, -1):
        t = name_tokens[i]
        if t.upper() in ('M', 'F', 'V'):
            sexo_val = 'M' if t.upper() in ('M', 'V') else 'F'
            name_tokens.pop(i)
            break

    result['nombre'] = ' '.join(name_tokens).strip()
    result['sexo'] = sexo_val
    result['edad'] = edad_val

    if ',' not in result['nombre'] or not result['nombre']:
        return None

    return result


# === ENDPOINTS ===

@router.post('/upload')
async def upload_adultos(
    file: UploadFile = File(...),
    db_session: Session = Depends(db.get_db)
):
    """Sube lista de adultos investidos con recomendación e importa directamente."""
    contents = await file.read()

    uploads_dir = '/app/uploads'
    os.makedirs(uploads_dir, exist_ok=True)
    file_path = os.path.join(uploads_dir, file.filename)
    with open(file_path, 'wb') as f:
        f.write(contents)

    pdf_file = PdfFile(
        filename=file.filename,
        mime=file.content_type,
        size_bytes=len(contents),
        status='processed',
        file_metadata={}
    )
    db_session.add(pdf_file)
    db_session.flush()

    try:
        if file.filename.endswith('.pdf'):
            df = _parse_adultos_pdf(contents)
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
            df.columns = ['nombre', 'sexo', 'edad', 'estado_raw', 'vencimiento_raw', 'unidad'][:len(df.columns)]
        else:
            df = pd.read_excel(io.BytesIO(contents))
            df.columns = ['nombre', 'sexo', 'edad', 'estado_raw', 'vencimiento_raw', 'unidad'][:len(df.columns)]
    except Exception as e:
        db_session.rollback()
        raise HTTPException(status_code=400, detail=f"Error leyendo archivo: {str(e)}")

    deleted = db_session.query(AdultoRecomendacion).delete()
    print(f"[DEBUG ADULTOS] Deleted {deleted} previous records")

    SKIP_NOMBRES = [
        'nombre', 'apellido', 'lista', 'recuento', 'total', 'subtotal',
        'estado de', 'para uso', 'derechos', 'intellectual',
    ]
    imported = 0
    skipped = 0

    for idx, row in df.iterrows():
        nombre = str(row.get('nombre', '') or '').strip()
        if not nombre or nombre.lower() in ('none', 'nan'):
            skipped += 1
            continue
        nombre_lower = nombre.lower()
        if any(nombre_lower.startswith(p) for p in SKIP_NOMBRES):
            skipped += 1
            continue
        if nombre_lower.replace('.', '').replace(',', '').isdigit():
            skipped += 1
            continue

        estado_raw  = str(row.get('estado_raw', '') or '').strip()
        venc_raw    = str(row.get('vencimiento_raw', '') or '').strip()
        estado_norm = normalizar_estado_adulto(estado_raw, venc_raw)
        rec_activa  = tiene_rec_activa(estado_norm)

        edad_raw = row.get('edad', None)
        try:
            edad_val = int(str(edad_raw).strip()) if edad_raw not in (None, '', 'nan', 'None') else None
        except Exception:
            edad_val = None

        sexo_raw  = str(row.get('sexo', '') or '').strip()
        sexo_norm = None
        if sexo_raw.upper() == 'M':
            sexo_norm = 'M'
        elif sexo_raw.upper() == 'F':
            sexo_norm = 'F'

        adulto = AdultoRecomendacion(
            nombre=nombre,
            sexo=sexo_norm,
            edad=edad_val,
            estado_raw=estado_raw if estado_raw and estado_raw.lower() not in ('none', 'nan') else None,
            vencimiento_raw=venc_raw if venc_raw and venc_raw.lower() not in ('none', 'nan') else None,
            unidad=str(row.get('unidad', '') or '').strip() or None,
            estado_normalizado=estado_norm,
            tiene_recomendacion_activa=rec_activa,
            archivo_fuente_id=pdf_file.id,
            fila_numero=idx + 1
        )
        db_session.add(adulto)
        imported += 1
        print(f"[DEBUG ADULTOS IMPORT] Row {idx+1}: nombre={nombre} | estado='{estado_raw}' | norm={estado_norm}")

    db_session.commit()
    print(f"[DEBUG ADULTOS] Imported {imported}, skipped {skipped}")

    return {
        "success": True,
        "file_id": pdf_file.id,
        "importados": imported,
        "skipped": skipped
    }


@router.get('/kpi')
async def kpi_adultos_recomendacion(db_session: Session = Depends(db.get_db)):
    """
    KPI: Adultos Investidos con Recomendación.
    Real = activa + vence_pronto / Potencial = todos
    """
    todos = db_session.query(AdultoRecomendacion).all()
    empty = {
        "indicador": "adultos_recomendacion",
        "nombre": "Adultos Investidos con Recomendación",
        "real": 0, "potencial": 0, "porcentaje": 0, "meta": META_ADULTOS_RECOMENDACION,
        "desglose": {"activa":0,"vence_pronto":0,"vencida":0,"cancelada":0,"sin_estado":0},
        "personas": {"activa":[],"vence_pronto":[],"vencida":[],"cancelada":[],"sin_estado":[]}
    }
    if not todos:
        return empty

    grupos = {
        ESTADO_ACTIVA:    [],
        ESTADO_VENCE:     [],
        ESTADO_VENCIDA:   [],
        ESTADO_CANCELADA: [],
        ESTADO_SIN_EST:   [],
    }
    for a in todos:
        est = a.estado_normalizado or ESTADO_SIN_EST
        if est not in grupos:
            est = ESTADO_SIN_EST
        grupos[est].append(a)

    real       = len(grupos[ESTADO_ACTIVA]) + len(grupos[ESTADO_VENCE])
    potencial  = len(todos)
    porcentaje = round(real / potencial * 100, 1) if potencial > 0 else 0

    def personas(lista):
        return [{"nombre": a.nombre, "unidad": a.unidad or '', "vencimiento": a.vencimiento_raw or '', "estado": a.estado_raw or ''} for a in lista]

    return {
        "indicador": "adultos_recomendacion",
        "nombre": "Adultos Investidos con Recomendación",
        "real": real,
        "potencial": potencial,
        "porcentaje": porcentaje,
        "meta": META_ADULTOS_RECOMENDACION,
        "desglose": {
            "activa":       len(grupos[ESTADO_ACTIVA]),
            "vence_pronto": len(grupos[ESTADO_VENCE]),
            "vencida":      len(grupos[ESTADO_VENCIDA]),
            "cancelada":    len(grupos[ESTADO_CANCELADA]),
            "sin_estado":   len(grupos[ESTADO_SIN_EST]),
        },
        "personas": {
            "activa":       personas(grupos[ESTADO_ACTIVA]),
            "vence_pronto": personas(grupos[ESTADO_VENCE]),
            "vencida":      personas(grupos[ESTADO_VENCIDA]),
            "cancelada":    personas(grupos[ESTADO_CANCELADA]),
            "sin_estado":   personas(grupos[ESTADO_SIN_EST]),
        }
    }
