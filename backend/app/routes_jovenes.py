"""
Rutas para gestión de Jóvenes con Recomendación: upload e importación
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import io
import re
import os
import pdfplumber

from . import db
from .models import PdfFile, JovenRecomendacion

router = APIRouter(prefix='/jovenes', tags=['jovenes'])

META_JOVENES_RECOMENDACION = 100  # 100%

# === NORMALIZACIÓN DE ESTADO ===

ESTADO_ACTIVA    = 'activa'
ESTADO_VENCE     = 'vence_pronto'   # "Vencen en X días"
ESTADO_VENCIDA   = 'vencida'
ESTADO_CANCELADA = 'cancelada'
ESTADO_NO_BAUT   = 'no_bautizado'
ESTADO_SIN_EST   = 'sin_estado'

def normalizar_estado_joven(estado_raw: str, vencimiento_raw: str = '') -> str:
    if not estado_raw or str(estado_raw).strip().lower() in ('', 'none', 'nan'):
        return ESTADO_SIN_EST
    s = ' '.join(str(estado_raw).split()).lower()
    v = ' '.join(str(vencimiento_raw or '').split()).lower()
    if 'no ha sido bautizado' in s or 'no bautizado' in s or 'no baptized' in s:
        return ESTADO_NO_BAUT
    if 'cancelada' in s or 'cancelado' in s:
        return ESTADO_CANCELADA
    if 'extraviada' in s or 'extraviado' in s or 'robada' in s or 'robado' in s:
        return ESTADO_CANCELADA  # Extraviada o robada → cancelada
    if 'vencen en' in s or 'vence en' in s or 'vencen en' in v or 'vence en' in v:
        return ESTADO_VENCE
    if 'vencida' in s or 'vencido' in s or 'expired' in s:
        return ESTADO_VENCIDA
    if 'activa' in s or 'vigente' in s or 'active' in s:
        return ESTADO_ACTIVA
    return ESTADO_SIN_EST

def tiene_rec_activa(estado_norm: str) -> bool:
    return estado_norm in (ESTADO_ACTIVA, ESTADO_VENCE)

# === PDF PARSING (same collapsed-row logic as conversos) ===

MESES = r'(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)'
DATE_RE = re.compile(rf'\d{{1,2}}\s+{MESES}\s+\d{{4}}', re.IGNORECASE)
# Acepta tanto "Vencen en 15 días" como "Vencen en feb. 2026"
VENCE_RE = re.compile(rf'Vencen?\s+en\s+(?:\d+\s+d[íi]as?|{MESES}\.?\s+\d{{4}})', re.IGNORECASE)
MES_ANIO_RE = re.compile(rf'{MESES}\.?\s+\d{{4}}', re.IGNORECASE)

def _cell(val):
    if val is None:
        return ''
    s = ' '.join(str(val).split()).strip()
    return '' if s.lower() in ('none', 'nan') else s

def _parse_jovenes_pdf(contents: bytes) -> pd.DataFrame:
    """
    Extract jovenes PDF using text extraction (not table extraction) to avoid
    zebra-stripe color rows being skipped by pdfplumber's table detector.

    Expected line format (space-separated tokens):
      Apellido Nombre, Nombre2  Sexo  Edad  [Estado]  [Vencimiento]  Unidad
    """
    # Known estado values in the PDF (for detection)
    ESTADOS = [
        'extraviada o robada', 'extraviado o robado',
        'no ha sido bautizado', 'no bautizado',
        'vencen en', 'vence en',
        'cancelada', 'cancelado',
        'vencida', 'vencido',
        'activa', 'vigente',
    ]
    # Matches "mes. año" or "mes año" at the end
    MES_ANIO_FULL = re.compile(
        r'\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?\s+\d{4}\b',
        re.IGNORECASE
    )
    UNIDAD_RE = re.compile(
        r'\b(Barrio|Rama|Distrito|Estaca)\s+[\w\s]+$',
        re.IGNORECASE
    )

    # Lines to skip (headers, footers, page numbers)
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
            print(f"[DEBUG JOVENES TEXT] Page {page_num+1}: {len(lines)} lines")

            for line in lines:
                line = ' '.join(line.split()).strip()
                if not line:
                    continue

                # Skip header/footer lines
                ll = line.lower()
                if any(ll.startswith(s) for s in SKIP_STARTS):
                    continue
                # Skip pure page numbers or "N Para uso..."
                first_tok = ll.split()[0] if ll.split() else ''
                if re.match(r'^\d+$', first_tok):
                    continue

                # Must contain a comma (Apellido, Nombre) to be a data row
                if ',' not in line:
                    continue

                rec = _parse_jovenes_line(line, ESTADOS, MES_ANIO_FULL, UNIDAD_RE)
                if rec:
                    records.append(rec)
                    print(f"[DEBUG JOVENES LINE] {rec}")

    if not records:
        raise ValueError("No se encontraron datos de jóvenes en el PDF")

    df = pd.DataFrame(records)
    print(f"[DEBUG JOVENES] Total parsed: {len(df)} records")
    return df


def _parse_jovenes_line(line: str, estados: list, mes_re, unidad_re) -> dict:
    """
    Parse a single text line into a dict with keys:
    nombre, sexo, edad, estado_raw, vencimiento_raw, unidad
    """
    remaining = line.strip()
    result = {
        'nombre': '', 'sexo': '', 'edad': '',
        'estado_raw': '', 'vencimiento_raw': '', 'unidad': ''
    }

    # 1. Extract unidad (Barrio/Rama/... at the end)
    unidad_m = unidad_re.search(remaining)
    if unidad_m:
        result['unidad'] = unidad_m.group(0).strip()
        remaining = remaining[:unidad_m.start()].strip()

    # 2. Extract vencimiento date (mes. año)
    mes_m = mes_re.search(remaining)
    if mes_m:
        result['vencimiento_raw'] = mes_m.group(0).strip()
        remaining = remaining[:mes_m.start()].strip()

    # 3. Extract estado (longest match first)
    for est in sorted(estados, key=len, reverse=True):
        m = re.search(re.escape(est), remaining, re.IGNORECASE)
        if m:
            result['estado_raw'] = m.group(0).strip()
            remaining = remaining[:m.start()].strip()
            break

    # 4. Extract sexo (M/F/V as standalone token near the end)
    # After removing unidad/estado/date, remaining is: "Apellido, Nombre Sexo Edad"
    # Try to find sexo and edad at the end
    tokens = remaining.split()
    # Scan from the right for edad (number ≤99) then sexo (M/F/V)
    edad_val = ''
    sexo_val = ''
    name_tokens = list(tokens)

    # Look for edad (1-2 digit number)
    for i in range(len(name_tokens) - 1, -1, -1):
        t = name_tokens[i]
        if re.match(r'^\d{1,2}$', t) and int(t) <= 99:
            edad_val = t
            name_tokens.pop(i)
            break

    # Look for sexo (single letter M/F/V after removing edad)
    for i in range(len(name_tokens) - 1, -1, -1):
        t = name_tokens[i]
        if t.upper() in ('M', 'F', 'V'):
            sexo_val = 'M' if t.upper() in ('M', 'V') else 'F'
            name_tokens.pop(i)
            break

    result['nombre'] = ' '.join(name_tokens).strip()
    result['sexo'] = sexo_val
    result['edad'] = edad_val

    # Must have a name with a comma
    if ',' not in result['nombre'] or not result['nombre']:
        return None

    return result


def _merge_jovenes_rows(raw_rows: list, num_cols: int) -> list:
    """
    Same collapsed-row strategy as conversos:
    If a row has data only in col_0 and it has a comma (Apellido, Nombre) → parse it.
    If a row has data only in col_0 and no comma → continuation of previous row.
    """
    SEXO_WORDS = {'m', 'f', 'masculino', 'femenino', 'male', 'female'}
    ESTADO_WORDS = ['activa', 'vencida', 'vencen en', 'cancelada', 'no ha sido bautizado',
                    'no bautizado', 'sin estado', 'vigente']

    def all_other_empty(row):
        return all(not _cell(row[i]) for i in range(1, len(row)))

    # Patrones que indican encabezado/pie de página del PDF
    SKIP_PATTERNS = [
        'estado de la recomendación', 'estado de la recomendacion',
        'para uso exclusivo', 'derechos reservados', 'intellectual reserve',
        'estaca montevideo', 'nombre sexo edad',
    ]

    def is_continuation_only(row):
        col0 = _cell(row[0])
        if not col0:
            return True
        # Fragmento de nombre sin coma y sin otros datos → continuación de la fila anterior
        if ',' not in col0 and all_other_empty(row):
            return True
        return False

    def is_skip_row(col0):
        """Filas que son encabezados/pies de página del PDF y no son datos."""
        t = col0.lower()
        # Número de página solo o "N Para uso exclusivo..."
        first_token = t.split()[0] if t.split() else ''
        if re.match(r'^\d+$', first_token):
            return True
        return any(t.startswith(p) for p in SKIP_PATTERNS)

    def parse_collapsed(text):
        """Parse 'Apellido, Nombre Sexo? Edad? Estado? Vencimiento? Unidad'"""
        result = [''] * 6
        remaining = text.strip()

        # Extract "Vencen en X días / Vencen en feb. 2026"
        # → put keyword in estado (col3) and date in vencimiento (col4)
        vence_m = VENCE_RE.search(remaining)
        if vence_m:
            result[3] = vence_m.group(0)          # estado_raw = "Vencen en feb. 2026"
            # Extract the trailing mes. año portion as vencimiento_raw
            mes_m = MES_ANIO_RE.search(vence_m.group(0))
            result[4] = mes_m.group(0) if mes_m else ''
            remaining = remaining[:vence_m.start()] + remaining[vence_m.end():]
            remaining = remaining.strip()
        else:
            # Extract mes. año as vencimiento sin estado conocido
            mes_m = MES_ANIO_RE.search(remaining)
            if mes_m:
                result[4] = mes_m.group(0)
                remaining = remaining[:mes_m.start()] + remaining[mes_m.end():]
                remaining = remaining.strip()

        # Extract unidad
        unidad_m = re.search(r'(Barrio|Rama|Distrito|Estaca)\s+[\w\s]+', remaining, re.IGNORECASE)
        if unidad_m:
            result[5] = unidad_m.group(0).strip()
            remaining = remaining[:unidad_m.start()] + remaining[unidad_m.end():]
            remaining = remaining.strip()

        # Extract estado (solo si no fue capturado por VENCE_RE)
        if not result[3]:
            ESTADO_WORDS_FULL = [
                'extraviada o robada', 'extraviado o robado',
                'no ha sido bautizado', 'no bautizado',
                'cancelada', 'cancelado',
                'vencida', 'vencido',
                'activa', 'vigente',
                'sin estado',
            ]
            for est in sorted(ESTADO_WORDS_FULL, key=len, reverse=True):
                m = re.search(re.escape(est), remaining, re.IGNORECASE)
                if m:
                    result[3] = m.group(0)
                    remaining = remaining[:m.start()] + remaining[m.end():]
                    remaining = remaining.strip()
                    break

        # Extract sexo (single letter or word)
        sexo_m = re.search(r'\b(M|F|Masculino|Femenino)\b', remaining, re.IGNORECASE)
        if sexo_m:
            result[1] = sexo_m.group(0)
            remaining = remaining[:sexo_m.start()] + remaining[sexo_m.end():]
            remaining = remaining.strip()

        # Extract edad
        edad_m = re.search(r'(?<!\d)(\d{1,2})(?!\d)', remaining)
        if edad_m:
            result[2] = edad_m.group(1)
            remaining = remaining[:edad_m.start()] + remaining[edad_m.end():]
            remaining = remaining.strip()

        result[0] = ' '.join(remaining.split())
        return result

    padded = [(list(r) + [None] * num_cols)[:num_cols] for r in raw_rows]
    result = []

    for row in padded:
        col0 = _cell(row[0])
        if not col0 and all_other_empty(row):
            continue
        # Saltar filas de encabezado/pie de página del PDF
        if is_skip_row(col0) and all_other_empty(row):
            print(f'[DEBUG JOVENES] Skipping header/footer row: {col0[:60]}')
            continue
        if is_continuation_only(row):
            if result:
                result[-1][0] = (_cell(result[-1][0]) + ' ' + col0).strip()
            continue
        if all_other_empty(row) and ',' in col0:
            result.append(parse_collapsed(col0))
            continue
        result.append([_cell(c) for c in row])

    print(f"[DEBUG JOVENES] merge: {len(padded)} → {len(result)} rows")
    for i, r in enumerate(result):
        print(f"[DEBUG JOVENES]   merged {i+1}: {r}")
    return result


# === ENDPOINTS ===

@router.post('/upload')
async def upload_jovenes(
    file: UploadFile = File(...),
    db_session: Session = Depends(db.get_db)
):
    """
    Sube lista de jóvenes e importa directamente (sin mapeo manual).
    Limpia registros anteriores antes de insertar.
    """
    contents = await file.read()

    # Save physical file
    uploads_dir = '/app/uploads'
    os.makedirs(uploads_dir, exist_ok=True)
    file_path = os.path.join(uploads_dir, file.filename)
    with open(file_path, 'wb') as f:
        f.write(contents)

    # Register file
    pdf_file = PdfFile(
        filename=file.filename,
        mime=file.content_type,
        size_bytes=len(contents),
        status='processed',
        file_metadata={}
    )
    db_session.add(pdf_file)
    db_session.flush()

    # Parse
    try:
        if file.filename.endswith('.pdf'):
            df = _parse_jovenes_pdf(contents)
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
            df.columns = ['nombre', 'sexo', 'edad', 'estado_raw', 'vencimiento_raw', 'unidad'][:len(df.columns)]
        else:
            df = pd.read_excel(io.BytesIO(contents))
            df.columns = ['nombre', 'sexo', 'edad', 'estado_raw', 'vencimiento_raw', 'unidad'][:len(df.columns)]
    except Exception as e:
        db_session.rollback()
        raise HTTPException(status_code=400, detail=f"Error leyendo archivo: {str(e)}")

    # Clean previous data
    deleted = db_session.query(JovenRecomendacion).delete()
    print(f"[DEBUG JOVENES] Deleted {deleted} previous records")

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
            print(f"[DEBUG JOVENES] Skip header row: {nombre}")
            skipped += 1
            continue
        if nombre_lower.replace('.', '').replace(',', '').isdigit():
            skipped += 1
            continue

        estado_raw = str(row.get('estado_raw', '') or '').strip()
        venc_raw   = str(row.get('vencimiento_raw', '') or '').strip()
        estado_norm = normalizar_estado_joven(estado_raw, venc_raw)
        rec_activa  = tiene_rec_activa(estado_norm)

        edad_raw = row.get('edad', None)
        try:
            edad_val = int(str(edad_raw).strip()) if edad_raw not in (None, '', 'nan', 'None') else None
        except Exception:
            edad_val = None

        sexo_raw = str(row.get('sexo', '') or '').strip()
        # _parse_jovenes_line already normalizes V→M
        sexo_norm = None
        if sexo_raw.upper() in ('M',):
            sexo_norm = 'M'
        elif sexo_raw.upper() in ('F',):
            sexo_norm = 'F'

        joven = JovenRecomendacion(
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
        db_session.add(joven)
        imported += 1
        print(f"[DEBUG IMPORT] Row {idx+1}: nombre={nombre} | estado_raw='{estado_raw}' | venc_raw='{venc_raw}' | norm={estado_norm}")

    db_session.commit()
    print(f"[DEBUG JOVENES] Imported {imported}, skipped {skipped}")

    return {
        "success": True,
        "file_id": pdf_file.id,
        "importados": imported,
        "skipped": skipped
    }


@router.get('/kpi')
async def kpi_jovenes_recomendacion(db_session: Session = Depends(db.get_db)):
    """
    Calcula KPI: Jóvenes con Recomendación.

    Real      = activa + vence_pronto
    Potencial = todos (sin_estado + no_bautizado + vencida + cancelada + activa + vence_pronto)
    % = Real / Potencial * 100
    """
    todos = db_session.query(JovenRecomendacion).all()
    if not todos:
        return {
            "indicador": "jovenes_recomendacion",
            "nombre": "Jóvenes con Recomendación",
            "real": 0, "potencial": 0, "porcentaje": 0, "meta": META_JOVENES_RECOMENDACION,
            "desglose": {"activa":0,"vence_pronto":0,"vencida":0,"cancelada":0,"no_bautizado":0,"sin_estado":0},
            "personas": {"activa":[],"vence_pronto":[],"vencida":[],"cancelada":[],"no_bautizado":[],"sin_estado":[]}
        }

    grupos = {
        ESTADO_ACTIVA:    [],
        ESTADO_VENCE:     [],
        ESTADO_VENCIDA:   [],
        ESTADO_CANCELADA: [],
        ESTADO_NO_BAUT:   [],
        ESTADO_SIN_EST:   [],
    }
    for j in todos:
        est = j.estado_normalizado or ESTADO_SIN_EST
        if est not in grupos:
            est = ESTADO_SIN_EST
        grupos[est].append(j)

    print("[DEBUG KPI] Total jóvenes:", len(todos))
    for estado, lista in grupos.items():
        print(f"[DEBUG KPI] Estado: {estado}, Count: {len(lista)}")

    reales     = grupos[ESTADO_ACTIVA] + grupos[ESTADO_VENCE]
    print("[DEBUG KPI] Reales (activa + vence_pronto):", len(reales))

    potencial  = len(todos)
    real       = len(reales)
    porcentaje = round(real / potencial * 100, 1) if potencial > 0 else 0

    print("[DEBUG KPI] Potencial:", potencial)
    print("[DEBUG KPI] Real:", real)
    print("[DEBUG KPI] Porcentaje:", porcentaje)

    def personas(lista):
        return [{"nombre": j.nombre, "unidad": j.unidad or '', "vencimiento": j.vencimiento_raw or '', "estado": j.estado_raw or ''} for j in lista]

    return {
        "indicador": "jovenes_recomendacion",
        "nombre": "Jóvenes con Recomendación",
        "real": real,
        "potencial": potencial,
        "porcentaje": porcentaje,
        "meta": META_JOVENES_RECOMENDACION,
        "desglose": {
            "activa":         len(grupos[ESTADO_ACTIVA]),
            "vence_pronto":   len(grupos[ESTADO_VENCE]),
            "vencida":        len(grupos[ESTADO_VENCIDA]),
            "cancelada":      len(grupos[ESTADO_CANCELADA]),
            "no_bautizado":   len(grupos[ESTADO_NO_BAUT]),
            "sin_estado":     len(grupos[ESTADO_SIN_EST]),
        },
        "personas": {
            "activa":         personas(grupos[ESTADO_ACTIVA]),
            "vence_pronto":   personas(grupos[ESTADO_VENCE]),
            "vencida":        personas(grupos[ESTADO_VENCIDA]),
            "cancelada":      personas(grupos[ESTADO_CANCELADA]),
            "no_bautizado":   personas(grupos[ESTADO_NO_BAUT]),
            "sin_estado":     personas(grupos[ESTADO_SIN_EST]),
        }
    }
