import io
import re
import csv
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from .db import get_db
from .models import MisioneroCampo, PdfFile

router = APIRouter(prefix='/misioneros', tags=['misioneros'])

META_MISIONEROS = 19
MISION_SERVICIO_LABEL = "Misión de servicio a la Iglesia"

# ── Normalización ─────────────────────────────────────────────────────────────

def es_mision_servicio(mision: str) -> bool:
    """Detecta si el tipo de misión es 'Misión de servicio a la Iglesia'."""
    if not mision:
        return False
    m = mision.strip().lower()
    return "servicio a la iglesia" in m or "servicio iglesia" in m


def _parse_misioneros_pdf(content: bytes) -> list[dict]:
    """Extrae misioneros de un PDF usando pdfplumber.
    Intenta primero extract_tables(), si no hay tablas usa extract_text() line-by-line.
    El PDF debe tener columnas: Nombre / Misión / Comenzó / Término esperado / Unidad actual
    """
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(status_code=500, detail="pdfplumber no está instalado")

    filas = []
    fila_num = 1

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        print(f"[DEBUG MISIONEROS PDF] Páginas: {len(pdf.pages)}")
        for page_idx, page in enumerate(pdf.pages):
            # ── Intentar extract_tables ──────────────────────────────────────
            tables = page.extract_tables()
            print(f"[DEBUG MISIONEROS PDF] Página {page_idx+1}: {len(tables)} tabla(s) encontrada(s)")
            if tables:
                for t_idx, table in enumerate(tables):
                    print(f"[DEBUG MISIONEROS PDF] Tabla {t_idx}: {len(table)} filas")
                    for r_idx, row in enumerate(table):
                        if not row or not any(row):
                            continue
                        cells = [str(c).strip() if c else '' for c in row]
                        print(f"[DEBUG MISIONEROS PDF]   fila {r_idx}: {cells[:4]}")
                        # Detectar fila de encabezado: solo si contiene "nombre" + otra columna de cabecera
                        joined = ' '.join(cells).lower()
                        if 'nombre' in joined and ('comenzó' in joined or 'comenzo' in joined or 'término' in joined):
                            print(f"[DEBUG MISIONEROS PDF]   → encabezado, salteada")
                            continue
                        # Saltar filas de título/sección
                        if joined.startswith('misioneros') or 'estaca' in joined or 'mi plan' == joined.strip():
                            continue
                        # La primera celda no vacía es el nombre
                        nombre = next((c for c in cells if c), '')
                        if not nombre:
                            continue
                        # Asignar columnas flexiblemente: tomar el primer no-vacío como nombre
                        # y las demás en orden
                        non_empty = [c for c in cells if c]
                        filas.append({
                            'nombre':           cells[0] if cells[0] else non_empty[0],
                            'mision':           cells[1] if len(cells) > 1 else '',
                            'comenzo':          cells[2] if len(cells) > 2 else '',
                            'termino_esperado': cells[3] if len(cells) > 3 else '',
                            'unidad_actual':    cells[4] if len(cells) > 4 else '',
                            'fila_numero':      fila_num,
                        })
                        fila_num += 1
            else:
                # ── Fallback: extract_text line-by-line ─────────────────────
                text = page.extract_text() or ''
                print(f"[DEBUG MISIONEROS PDF] Página {page_idx+1} texto (primeros 300 chars): {text[:300]!r}")
                for line in text.split('\n'):
                    line = line.strip()
                    if not line:
                        continue
                    # Saltar encabezados y títulos de página
                    lower = line.lower()
                    if 'nombre' in lower and ('comenzó' in lower or 'comenzo' in lower or 'término' in lower):
                        continue
                    if 'misioneros de' in lower or 'estaca' in lower or 'mi plan' in lower:
                        continue
                    # Separar por tabulaciones, múltiples espacios o |
                    parts = re.split(r'\t|  {2,}|\|', line)
                    parts = [p.strip() for p in parts if p.strip()]
                    if len(parts) >= 1:
                        filas.append({
                            'nombre':           parts[0],
                            'mision':           parts[1] if len(parts) > 1 else '',
                            'comenzo':          parts[2] if len(parts) > 2 else '',
                            'termino_esperado': parts[3] if len(parts) > 3 else '',
                            'unidad_actual':    parts[4] if len(parts) > 4 else '',
                            'fila_numero':      fila_num,
                        })
                        fila_num += 1

    print(f"[DEBUG MISIONEROS PDF] Total filas parseadas: {len(filas)}")
    return filas


def _parse_misioneros_txt(text: str) -> list[dict]:
    """
    Parsea el texto copiado del portal de miembros.
    El portal pega con U+00A0 (non-breaking space) en lugar de espacios normales.
    """
    import unicodedata

    # ── Paso 1: normalización TOTAL de todo tipo de espacio unicode ──────────
    normalized = ''
    for ch in text:
        if unicodedata.category(ch) == 'Zs' or ch in ('\t', '\r'):
            normalized += ' '
        else:
            normalized += ch
    text = normalized

    # ── Paso 2: Regex de fechas — usa \s+ para capturar cualquier espacio ────
    MONTHS = (r'(?:ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?'
              r'|jul(?:io)?|ago(?:sto)?|sep(?:t(?:iembre)?)?|set|oct(?:ubre)?'
              r'|nov(?:iembre)?|dic(?:iembre)?)')
    DATE_RE = re.compile(rf'\b\d{{1,2}}\s+{MONTHS}\.?\s+\d{{4}}\b', re.IGNORECASE)

    SERV_LABEL = 'Misión de servicio a la Iglesia'
    MISSION_START = {
        'bolivia','méxico','mexico','brasil','brazil','perú','peru','ecuador',
        'argentina','chile','colombia','paraguay','uruguay','venezuela',
        'guatemala','costa','panamá','panama','honduras','nicaragua',
        'estados','usa','canada','canadá','españa','spain','alemania',
        'australia','filipinas','japan','corea','korea','misión','mision','mission',
        'north','south','east','west','ciudad','new','el',
    }

    # ── Paso 3: unir líneas partidas ─────────────────────────────────────────
    def is_new_entry(ln: str) -> bool:
        ln = ln.strip()
        if not ln or not re.match(r'^[A-ZÁÉÍÓÚÑÜ]', ln):
            return False
        ci = ln.find(',')
        if ci < 1 or ci > 45:
            return False
        if any(c.isdigit() for c in ln[:ci]):
            return False
        first = ln.split()[0].lower().rstrip('.,') if ln.split() else ''
        return first not in MISSION_START

    SKIP = {'mi plan', 'unidad actual', 'término esperado', 'termino esperado',
            'comenzó', 'comenzo', 'misión', 'mision', 'nombre'}

    blocks: list[str] = []
    cur = ''
    for raw in text.split('\n'):
        ln = raw.strip()
        if not ln:
            continue
        low = ln.lower()
        if low in SKIP:
            continue
        if 'nombre' in low and ('misión' in low or 'mision' in low):
            continue
        if re.match(r'^misioneros\s+(de|en)\b', low):
            continue
        if is_new_entry(ln):
            if cur:
                blocks.append(cur)
            cur = ln
        else:
            cur = (cur + ' ' + ln).strip() if cur else ln
    if cur:
        blocks.append(cur)

    print(f"[MIS TXT] {len(blocks)} bloques")

    # ── Paso 4: parsear cada bloque ───────────────────────────────────────────
    filas = []
    for i, block in enumerate(blocks):
        # colapsar múltiples espacios que quedaron
        block = re.sub(r'  +', ' ', block).strip()
        dates = list(DATE_RE.finditer(block))
        print(f"[MIS TXT] [{i+1}] {len(dates)} fechas | {block[:90]!r}")

        if not dates:
            print(f"[MIS TXT]   → sin fechas, omitido")
            continue

        comenzo = dates[0].group(0).strip()
        if len(dates) >= 2:
            termino = dates[1].group(0).strip()
            before  = block[:dates[0].start()].strip()
            unidad  = block[dates[1].end():].strip()
        else:
            termino = ''
            before  = block[:dates[0].start()].strip()
            unidad  = block[dates[0].end():].strip()

        unidad = re.sub(r'\s*mi plan\s*$', '', unidad, flags=re.IGNORECASE).strip()

        nombre = before
        mision = ''
        low_b  = before.lower()

        if 'servicio a la iglesia' in low_b:
            si = re.search(r'misi[oó]n\s+de\s+servicio', before, re.IGNORECASE)
            cut = si.start() if si else len(before)
            nombre = before[:cut].strip().rstrip(',').strip()
            mision = SERV_LABEL
        else:
            ci = before.find(',')
            if ci >= 0:
                words = before[ci + 1:].strip().split()
                cidx = next((j for j, w in enumerate(words)
                             if w.lower().rstrip('.,') in MISSION_START), None)
                if cidx is not None:
                    nombre = f"{before[:ci].strip()}, {' '.join(words[:cidx])}".strip(', ')
                    mision = ' '.join(words[cidx:])
                else:
                    nombre = f"{before[:ci].strip()}, {' '.join(words[:2])}".strip(', ')
                    mision = ' '.join(words[2:])

        filas.append({
            'nombre': nombre.strip(),
            'mision': mision.strip(),
            'comenzo': comenzo,
            'termino_esperado': termino,
            'unidad_actual': unidad,
            'fila_numero': i + 1,
        })
        print(f"[MIS TXT]   OK → {nombre.strip()!r} | {mision.strip()!r}")

    print(f"[MIS TXT] Total: {len(filas)}")
    return filas


def _parse_misioneros_csv(content: bytes) -> list[dict]:
    """Parsea CSV/TSV con los campos: Nombre, Misión, Comenzó, Término esperado, Unidad actual."""
    filas = []
    try:
        text = content.decode('utf-8-sig', errors='replace')
        reader = csv.DictReader(io.StringIO(text))
        for i, row in enumerate(reader, start=2):
            # Intentar mapear columnas con nombres flexibles
            nombre = (
                row.get('Nombre') or row.get('nombre') or row.get('NOMBRE') or ''
            ).strip()
            if not nombre:
                continue
            mision = (
                row.get('Misión') or row.get('Mision') or row.get('mision') or
                row.get('MISIÓN') or row.get('Tipo Misión') or ''
            ).strip()
            comenzo = (
                row.get('Comenzó') or row.get('Comenzo') or row.get('Inicio') or
                row.get('Fecha Inicio') or ''
            ).strip()
            termino = (
                row.get('Término esperado') or row.get('Termino esperado') or
                row.get('Termino') or row.get('Término') or ''
            ).strip()
            unidad = (
                row.get('Unidad actual') or row.get('Unidad') or row.get('unidad') or ''
            ).strip()

            filas.append({
                'nombre': nombre,
                'mision': mision,
                'comenzo': comenzo,
                'termino_esperado': termino,
                'unidad_actual': unidad,
                'fila_numero': i,
            })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al parsear CSV: {e}")
    return filas


def _parse_misioneros_excel(content: bytes) -> list[dict]:
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        # Primera fila = headers
        headers = [str(h).strip() if h else '' for h in rows[0]]
        filas = []
        for i, row in enumerate(rows[1:], start=2):
            row_dict = {headers[j]: (str(v).strip() if v is not None else '') for j, v in enumerate(row)}
            nombre = row_dict.get('Nombre') or row_dict.get('nombre') or ''
            if not nombre.strip():
                continue
            mision = row_dict.get('Misión') or row_dict.get('Mision') or row_dict.get('Tipo Misión') or ''
            comenzo = row_dict.get('Comenzó') or row_dict.get('Comenzo') or row_dict.get('Inicio') or ''
            termino = row_dict.get('Término esperado') or row_dict.get('Termino esperado') or row_dict.get('Termino') or ''
            unidad = row_dict.get('Unidad actual') or row_dict.get('Unidad') or ''
            filas.append({
                'nombre': nombre.strip(),
                'mision': mision.strip(),
                'comenzo': comenzo.strip(),
                'termino_esperado': termino.strip(),
                'unidad_actual': unidad.strip(),
                'fila_numero': i,
            })
        return filas
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al parsear Excel: {e}")


def _diagnostico_pdf(content: bytes) -> str:
    """Devuelve un resumen de lo que pdfplumber ve en el PDF para ayudar a diagnosticar."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            paginas = len(pdf.pages)
            partes = [f"{paginas} página(s)."]
            for i, page in enumerate(pdf.pages[:2]):
                tables = page.extract_tables()
                text = (page.extract_text() or '')[:400]
                partes.append(f"[pág {i+1}] {len(tables)} tabla(s). Texto: {text!r}")
            return ' | '.join(partes)
    except Exception as e:
        return str(e)


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post('/debug-pdf')
async def debug_pdf(file: UploadFile = File(...)):
    """Endpoint de diagnóstico: muestra exactamente qué extrae pdfplumber del PDF."""
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(status_code=500, detail="pdfplumber no instalado")

    content = await file.read()
    result = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for i, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            text = page.extract_text() or ''
            page_info = {
                'pagina': i + 1,
                'tablas': len(tables),
                'tabla_datos': [[str(c) if c else '' for c in row] for table in tables for row in (table or [])[:5]],
                'texto_muestra': text[:600],
            }
            result.append(page_info)
    return result

@router.post('/upload')
async def upload_misioneros(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    fname = file.filename.lower()

    # Parsear según tipo
    if fname.endswith('.pdf'):
        filas = _parse_misioneros_pdf(content)
    elif fname.endswith('.txt'):
        text = content.decode('utf-8-sig', errors='replace')
        filas = _parse_misioneros_txt(text)
    elif fname.endswith('.csv'):
        filas = _parse_misioneros_csv(content)
    elif fname.endswith('.xlsx') or fname.endswith('.xls'):
        filas = _parse_misioneros_excel(content)
    else:
        raise HTTPException(status_code=400, detail="Solo se aceptan PDF, CSV o Excel (.xlsx)")

    if not filas:
        # Devolver diagnóstico
        diag = _diagnostico_pdf(content) if fname.endswith('.pdf') else "Archivo vacío o sin datos reconocibles"
        raise HTTPException(status_code=400, detail=f"No se encontraron registros. Diagnóstico: {diag}")

    # Registrar archivo
    pdf_file = PdfFile(
        filename=file.filename,
        mime=file.content_type or 'application/octet-stream',
        size_bytes=len(content),
        status='procesado',
    )
    db.add(pdf_file)
    db.flush()

    # Limpiar registros anteriores
    db.query(MisioneroCampo).delete()

    # Insertar nuevos
    total = 0
    servicio = 0
    for f in filas:
        es_serv = es_mision_servicio(f['mision'])
        if es_serv:
            servicio += 1
        misionero = MisioneroCampo(
            nombre=f['nombre'],
            mision=f['mision'],
            comenzo=f['comenzo'],
            termino_esperado=f['termino_esperado'],
            unidad_actual=f['unidad_actual'],
            es_mision_servicio=es_serv,
            archivo_fuente_id=pdf_file.id,
            fila_numero=f['fila_numero'],
        )
        db.add(misionero)
        total += 1

    db.commit()
    print(f"[MISIONEROS] Total: {total} | Misión de servicio: {servicio}")
    return {
        'ok': True,
        'total': total,
        'mision_servicio': servicio,
        'mensaje': f'{total} misioneros importados correctamente'
    }


@router.get('/kpi')
def get_kpi_misioneros(db: Session = Depends(get_db)):
    todos = db.query(MisioneroCampo).all()

    # En el campo = misiones reales (Bolivia, México, etc.) – los que NO son servicio a la Iglesia
    en_campo = [m for m in todos if not m.es_mision_servicio]
    de_servicio = [m for m in todos if m.es_mision_servicio]

    total_campo = len(en_campo)
    total_servicio = len(de_servicio)
    porcentaje = round((total_campo / META_MISIONEROS) * 100, 1) if META_MISIONEROS > 0 else 0

    personas_campo = [
        {
            'nombre': m.nombre,
            'mision': m.mision or '',
            'comenzo': m.comenzo or '',
            'termino_esperado': m.termino_esperado or '',
            'unidad_actual': m.unidad_actual or '',
        }
        for m in en_campo
    ]

    personas_servicio = [
        {
            'nombre': m.nombre,
            'unidad_actual': m.unidad_actual or '',
            'comenzo': m.comenzo or '',
            'termino_esperado': m.termino_esperado or '',
        }
        for m in de_servicio
    ]

    print(f"[MISIONEROS KPI] En campo: {total_campo} | De servicio: {total_servicio}")

    return {
        'indicador': 'misioneros_campo',
        'nombre': 'Misioneros en el Campo',
        'real': total_campo,           # Los que están en misiones reales
        'meta': META_MISIONEROS,
        'porcentaje': porcentaje,
        'sub_servicio': total_servicio,  # Misioneros de servicio a la Iglesia
        'personas': personas_campo,      # Detalle de los en campo
        'personas_servicio': personas_servicio,  # Detalle de los de servicio
    }
