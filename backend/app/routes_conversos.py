"""
Rutas para gestión de conversos: upload, mapeo, validación, enriquecimiento
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io
import pdfplumber
from datetime import datetime, date

from . import db
from .models import PdfFile, PersonaConverso, MapeoColumna, PeriodoKPI
from .schemas import (
    PersonaConversoCreate, PersonaConversoOut, PersonaConversoEnriquecer,
    MapeoRequest, MapeoColumnaCreate, UploadResponse, ValidacionArchivo,
    ImportacionConfirmada, ValidacionFila
)
from .normalizacion import (
    normalizar_estado_recomendacion, normalizar_sacerdocio, normalizar_sexo,
    calcular_edad, validar_fecha_confirmacion, calcular_completitud
)

router = APIRouter(prefix='/conversos', tags=['conversos'])


def _merge_pdf_continuation_rows(raw_rows: list, num_cols: int) -> list:
    """
    pdfplumber collapses multiline rows: all cell data lands in col_0, rest empty.
    Pattern of a collapsed row:
      col_0 = "Apellido, Nombre Edad? Sacerdocio? Recomendacion? Unidad Fecha"
      col_1..n = all empty

    Strategy:
    1. If a row has data in multiple columns → already correctly parsed, keep as-is.
    2. If a row has data ONLY in col_0 AND col_0 looks like person data (has comma) →
       try to parse it by matching known patterns for each field.
    3. If col_0 is a continuation-only line (Barrio X, or 'ordenado', no comma) →
       merge into previous row's col_0 for re-parsing.
    """
    import re

    MESES = r'(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)'
    DATE_RE = re.compile(rf'\d{{1,2}}\s+{MESES}\s+\d{{4}}', re.IGNORECASE)
    UNIDAD_RE = re.compile(r'((?:Barrio|Rama|Distrito|Estaca)\s+[\w\s]+?)(?=\s+\d{{1,2}}\s+{MESES}|\s*$)'.format(MESES=MESES), re.IGNORECASE)
    SACER_WORDS = ['Aarónico', 'Aaronico', 'Melquisedec', 'Elder', 'Diácono', 'Diacono',
                   'Maestro', 'Presbítero', 'Presbitero', 'Sumo Sacerdote',
                   'No ha sido ordenado', 'No ordenado', 'Sin ordenar']
    REC_WORDS = ['Activa', 'Vigente', 'Valida', 'Válida', 'Vencida', 'Pendiente',
                 'Sin recomendación', 'Sin recomendacion']

    def cell(val):
        if val is None:
            return ''
        s = ' '.join(str(val).split()).strip()
        return '' if s.lower() in ('none', 'nan') else s

    def all_other_empty(row):
        return all(not cell(row[i]) for i in range(1, len(row)))

    def parse_collapsed(text):
        """
        Parse a collapsed single-cell row into [nombre, edad, sacerdocio, recomendacion, llamamientos, unidad, fecha].
        """
        result = [''] * 7
        remaining = text.strip()

        # 1. Extract fecha (dd mes yyyy)
        date_m = DATE_RE.search(remaining)
        if date_m:
            result[6] = date_m.group(0)
            remaining = remaining[:date_m.start()].strip() + ' ' + remaining[date_m.end():].strip()
            remaining = remaining.strip()

        # 2. Extract sacerdocio (longest match first so "No ha sido ordenado" beats "ordenado")
        for s in sorted(SACER_WORDS, key=len, reverse=True):
            if re.search(re.escape(s), remaining, re.IGNORECASE):
                result[2] = s
                remaining = re.sub(re.escape(s), '', remaining, flags=re.IGNORECASE).strip()
                break

        # 3. Extract recomendacion
        for r in sorted(REC_WORDS, key=len, reverse=True):
            if re.search(re.escape(r), remaining, re.IGNORECASE):
                result[3] = r
                remaining = re.sub(re.escape(r), '', remaining, flags=re.IGNORECASE).strip()
                break

        # 4. Extract unidad (Barrio/Rama followed by name words)
        unidad_m = re.search(r'(Barrio|Rama|Distrito|Estaca)\s+[\w\s]+', remaining, re.IGNORECASE)
        if unidad_m:
            result[5] = unidad_m.group(0).strip()
            remaining = remaining[:unidad_m.start()].strip() + ' ' + remaining[unidad_m.end():].strip()
            remaining = remaining.strip()

        # 5. Extract edad (standalone 1-2 digit number)
        edad_m = re.search(r'(?<!\d)(\d{1,2})(?!\d)', remaining)
        if edad_m:
            result[1] = edad_m.group(1)
            remaining = remaining[:edad_m.start()].strip() + ' ' + remaining[edad_m.end():].strip()
            remaining = remaining.strip()

        # 6. Whatever remains is the name
        result[0] = ' '.join(remaining.split())
        return result

    def is_continuation_only(row):
        """Row that has only location/overflow text in col_0, no name data."""
        col0 = cell(row[0])
        if not col0:
            return True
        col0_lower = col0.lower()
        if col0_lower == 'ordenado':
            return True
        # Pure location line with no comma: Barrio X / Rama X, all other cols empty
        if not ',' in col0 and all_other_empty(row):
            if any(col0_lower.startswith(p) for p in ('barrio ', 'rama ', 'distrito ', 'estaca ')):
                return True
        return False

    if not raw_rows:
        return []

    padded = [(list(r) + [None] * num_cols)[:num_cols] for r in raw_rows]
    result = []

    for row in padded:
        col0 = cell(row[0])

        # Skip empty rows
        if not col0 and all_other_empty(row):
            continue

        if is_continuation_only(row):
            # Append col0 text to previous row's col0 for re-parsing
            if result:
                prev_col0 = cell(result[-1][0])
                result[-1][0] = (prev_col0 + ' ' + col0).strip()
            continue

        # Check if this is a fully-collapsed row (all data in col0, rest empty)
        if all_other_empty(row) and col0 and ',' in col0:
            parsed = parse_collapsed(col0)
            result.append(parsed)
            continue

        # Normal row: keep as-is
        result.append(list(row))

    print(f"[DEBUG] PDF merge: {len(padded)} raw rows → {len(result)} merged rows")
    for i, r in enumerate(result):
        print(f"[DEBUG]   row {i+1}: {[cell(c) for c in r]}")
    return result


# === UPLOAD Y DETECCIÓN DE COLUMNAS ===

@router.post('/upload', response_model=UploadResponse)
async def upload_archivo(
    file: UploadFile = File(...),
    db_session: Session = Depends(db.get_db)
):
    """
    Sube archivo CSV/Excel y detecta columnas automáticamente
    """
    # Validar tipo de archivo por extensión (más confiable que content_type que varía por navegador)
    fname_lower = file.filename.lower() if file.filename else ''
    allowed_extensions = ('.pdf', '.csv', '.xls', '.xlsx')
    if not fname_lower.endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no soportado. Use PDF, CSV o Excel (.xlsx)"
        )
    
    import os
    try:
        # Leer archivo
        contents = await file.read()

        # Guardar archivo físicamente en /app/uploads
        uploads_dir = '/app/uploads'
        os.makedirs(uploads_dir, exist_ok=True)
        file_path = os.path.join(uploads_dir, file.filename)
        with open(file_path, 'wb') as f:
            f.write(contents)

        # Detectar formato y leer para preview
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith('.pdf'):
            with pdfplumber.open(io.BytesIO(contents)) as pdf:
                all_tables = []
                for page in pdf.pages:
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            all_tables.extend(table)
                if not all_tables:
                    raise HTTPException(
                        status_code=400,
                        detail="No se encontraron tablas en el PDF"
                    )
                headers = all_tables[0]
                clean_headers = [h if h is not None else f"col_{i+1}" for i, h in enumerate(headers)]
                raw_rows = all_tables[1:]
                merged_rows = _merge_pdf_continuation_rows(raw_rows, len(clean_headers))
                df = pd.DataFrame(merged_rows, columns=clean_headers)
        else:
            df = pd.read_excel(io.BytesIO(contents))

        # Guardar registro del archivo
        pdf_file = PdfFile(
            filename=file.filename,
            mime=file.content_type,
            size_bytes=len(contents),
            status='pending_mapping',
            file_metadata={
                'total_filas': len(df),
                'columnas': list(df.columns)
            }
        )
        db_session.add(pdf_file)
        db_session.commit()
        db_session.refresh(pdf_file)

        # Preparar preview (primeras 5 filas)
        preview_data = df.head(5).fillna('').to_dict('records')

        return UploadResponse(
            file_id=pdf_file.id,
            filename=file.filename,
            total_filas=len(df),
            columnas_detectadas=list(df.columns),
            preview_data=preview_data
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando archivo: {str(e)}")


# === MAPEO DE COLUMNAS ===

@router.post('/mapear')
async def mapear_columnas(
    request: MapeoRequest,
    db_session: Session = Depends(db.get_db)
):
    """
    Define el mapeo de columnas del archivo a campos del modelo
    """
    # Verificar que el archivo existe
    archivo = db_session.query(PdfFile).filter(PdfFile.id == request.file_id).first()
    if not archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    # Guardar mapeos
    for mapeo in request.mapeos:
        mapeo_db = MapeoColumna(
            archivo_id=request.file_id,
            columna_fuente=mapeo.columna_fuente,
            campo_destino=mapeo.campo_destino,
            tipo_dato=mapeo.tipo_dato,
            transformacion=mapeo.transformacion
        )
        db_session.add(mapeo_db)
    
    # Actualizar estado del archivo
    archivo.status = 'mapped'
    db_session.commit()
    
    return {"success": True, "file_id": request.file_id, "mapeos_guardados": len(request.mapeos)}


# === VALIDACIÓN ===

@router.get('/validar/{file_id}', response_model=ValidacionArchivo)
async def validar_archivo(
    file_id: str,
    db_session: Session = Depends(db.get_db)
):
    """
    Valida los datos antes de confirmar la importación
    """
    # Obtener archivo y mapeos
    archivo = db_session.query(PdfFile).filter(PdfFile.id == file_id).first()
    if not archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    mapeos = db_session.query(MapeoColumna).filter(MapeoColumna.archivo_id == file_id).all()
    if not mapeos:
        raise HTTPException(status_code=400, detail="Archivo no tiene mapeo definido")
    
    # Reconstruir DataFrame (en producción, esto debería venir de caché/storage)
    # Por ahora retornamos estructura de validación simulada
    
    total_filas = archivo.file_metadata.get('total_filas', 0)
    
    return ValidacionArchivo(
        total_filas=total_filas,
        validas=total_filas,
        con_errores=0,
        errores=[],
        advertencias=[],
        requiere_enriquecimiento={'edad': 0, 'sexo': 0}
    )


# === CONFIRMAR IMPORTACIÓN ===

@router.post('/confirmar/{file_id}', response_model=ImportacionConfirmada)
async def confirmar_importacion(
    file_id: str,
    db_session: Session = Depends(db.get_db)
):
    """
    Confirma la importación y guarda los conversos en la BD.
    Si no hay mapeos explícitos, usa mapeo automático.
    """
    archivo = db_session.query(PdfFile).filter(PdfFile.id == file_id).first()
    if not archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    mapeos = db_session.query(MapeoColumna).filter(MapeoColumna.archivo_id == file_id).all()
    
    # Crear diccionario de mapeo (puede estar vacío si usamos auto-mapeo)
    mapeo_dict = {m.columna_fuente: m.campo_destino for m in mapeos} if mapeos else {}

    # Limpiar datos de importaciones anteriores antes de insertar nuevos
    # Esto asegura que cada importación reemplaza completamente los datos anteriores
    db_session.query(PersonaConverso).delete()
    db_session.query(MapeoColumna).delete()
    # Borrar archivos anteriores excepto el actual y los referenciados por jóvenes
    from .models import PdfFile as PdfFileModel, JovenRecomendacion
    jovenes_file_ids = {j.archivo_fuente_id for j in db_session.query(JovenRecomendacion.archivo_fuente_id).all() if j.archivo_fuente_id}
    db_session.query(PdfFileModel).filter(
        PdfFileModel.id != file_id,
        ~PdfFileModel.id.in_(jovenes_file_ids)
    ).delete(synchronize_session='fetch')
    db_session.commit()

    # Leer archivo original y procesar filas
    import os
    import json
    errores = []
    advertencias = []
    personas_importadas = 0

    # Recuperar metadata
    columnas = archivo.file_metadata.get('columnas', [])
    total_filas = archivo.file_metadata.get('total_filas', 0)

    # Buscar archivo en disco - usar ruta absoluta consistente con el upload
    file_path = os.path.join('/app/uploads', archivo.filename)
    df = None
    try:
        if archivo.filename.endswith('.csv') and os.path.exists(file_path):
            df = pd.read_csv(file_path)
        elif archivo.filename.endswith('.xlsx') and os.path.exists(file_path):
            df = pd.read_excel(file_path)
        elif archivo.filename.endswith('.pdf') and os.path.exists(file_path):
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                all_tables = []
                for page in pdf.pages:
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            all_tables.extend(table)
                if not all_tables:
                    raise Exception('No se encontraron tablas en el PDF')
                headers = all_tables[0]
                clean_headers = [h if h is not None else f"col_{i+1}" for i, h in enumerate(headers)]
                raw_rows = all_tables[1:]
                print(f"[DEBUG RAW] {len(raw_rows)} raw rows before merge:")
                for ri, rr in enumerate(raw_rows):
                    print(f"[DEBUG RAW]   {ri+1}: {[' '.join(str(c).split()) if c else '' for c in rr]}")
                merged_rows = _merge_pdf_continuation_rows(raw_rows, len(clean_headers))
                df = pd.DataFrame(merged_rows, columns=clean_headers)
        else:
            # Si no existe el archivo físico, intentar reconstruir desde metadata (no ideal)
            raise Exception('Archivo original no disponible en disco')
    except Exception as e:
        errores.append(f'Error leyendo archivo original: {str(e)}')
        archivo.status = 'error'
        db_session.commit()
        return ImportacionConfirmada(
            success=False,
            file_id=file_id,
            personas_importadas=0,
            errores=errores,
            advertencias=advertencias
        )

    # Aplicar mapeo y crear registros
    # Mapeo automático si no hay mapeos explícitos
    if not mapeos:
        print(f"[DEBUG] No hay mapeos explícitos, usando mapeo automático")
        print(f"[DEBUG] Columnas del df: {list(df.columns)}")
        
        mapeo_dict = {}
        
        # PRIMERO: Mapeo por posición para columnas genéricas (col_X) - tiene prioridad
        # En los PDF detectados: col_1=nombre, col_2=edad (no sexo), col_3=sacerdocio, col_4=recomendación
        mapeo_generico = {
            'col_1': 'nombre_preferencia',
            'col_2': 'edad_al_confirmar',
            'col_3': 'sacerdocio',
            'col_4': 'estado_recomendacion_raw',
            'col_5': 'llamamientos',
            'col_6': 'unidad',
            'col_7': 'fecha_confirmacion'
        }
        for col in df.columns:
            if col in mapeo_generico:
                mapeo_dict[col] = mapeo_generico[col]
                print(f"[DEBUG] Mapeado por posición: {col} -> {mapeo_generico[col]}")
        
        # SEGUNDO: Para columnas NO genéricas, intentar mapeo por nombre/variantes
        variantes_mapeo = {
            'nombre_preferencia': ['nombre preferencia', 'nombre_preferencia'],
            'sacerdocio': ['sacerdocio'],
            'estado_recomendacion_raw': ['estado recomendacion', 'estado_recomendacion', 'estado_recomendacion_raw'],
            'llamamientos': ['llamamientos'],
            'unidad': ['unidad'],
            'fecha_confirmacion': ['fecha confirmacion', 'fecha_confirmación', 'fecha de la confirmacion'],
            'fecha_nacimiento': ['fecha nacimiento', 'fecha_nacimiento'],
            'sexo': ['sexo', 'edad']
        }
        for col in df.columns:
            if col not in mapeo_dict:  # Solo si no se mapeó por posición
                col_norm = str(col).strip().lower()
                for campo, variantes_lista in variantes_mapeo.items():
                    if any(col_norm == v for v in variantes_lista):  # Coincidencia exacta, no "in"
                        mapeo_dict[col] = campo
                        print(f"[DEBUG] Mapeado por nombre: {col} -> {campo}")
                        break
        
        # TERCERO: Si la primera columna aún no está mapeada, asumirla como nombre
        primera_col = df.columns[0] if len(df.columns) > 0 else None
        if primera_col and primera_col not in mapeo_dict:
            mapeo_dict[primera_col] = 'nombre_preferencia'
            print(f"[DEBUG] Primera columna mapeada por defecto: {primera_col} -> nombre_preferencia")
        
        print(f"[DEBUG] Mapeo final: {mapeo_dict}")
        print(f"[DEBUG] Total filas en df: {len(df)}")

    from dateutil import parser as dateparser
    for idx, row in df.iterrows():
        try:
            # Saltar filas que sean encabezados o vacías
            if all((str(x).strip() == '' or pd.isna(x)) for x in row.values):
                print(f"[DEBUG] Fila {idx+1} vacía, saltando")
                continue
            datos = {}
            for col_src, col_dst in mapeo_dict.items():
                if col_dst:
                    val = row.get(col_src, None)
                    # Convertir fechas a ISO si corresponde
                    if col_dst in ['fecha_confirmacion', 'fecha_nacimiento'] and val and isinstance(val, str):
                        try:
                            val = dateparser.parse(val, dayfirst=True).date()
                        except Exception:
                            advertencias.append(f'Fila {idx+1}: fecha inválida en {col_dst} ({val})')
                            val = None
                    datos[col_dst] = val
            # Saltar si la fila es encabezado (ej: contiene 'nombre' o 'fecha' en vez de datos)
            # Limpiar nombre: usar solo la primera línea si viene con saltos de línea
            if datos.get('nombre_preferencia') and '\n' in str(datos['nombre_preferencia']):
                # Unir todas las líneas del nombre (ej: "Funes Martínez,\nSandra Mariela" → "Funes Martínez, Sandra Mariela")
                partes = [p.strip() for p in str(datos['nombre_preferencia']).split('\n') if p.strip()]
                datos['nombre_preferencia'] = ' '.join(partes)

            nombre_val = str(datos.get('nombre_preferencia','')).strip().lower()
            # Saltar filas de encabezado, pie de tabla o resumen
            FILAS_IGNORAR = ['nombre', 'lista', 'recuento', 'total', 'subtotal', 'suma',
                             'count', 'header', 'encabezado', 'nombre preferencia', 'barrio']
            if any(nombre_val.startswith(p) for p in FILAS_IGNORAR):
                print(f"[DEBUG] Fila {idx+1} es encabezado/resumen ({nombre_val}), saltando")
                continue
            # Saltar si el nombre contiene solo números (ej: "10", "168")
            if nombre_val.replace('.','').replace(',','').isdigit():
                print(f"[DEBUG] Fila {idx+1} es numérica ({nombre_val}), saltando")
                continue
            if not datos.get('nombre_preferencia'):
                advertencias.append(f'Fila {idx+1} sin nombre_preferencia, omitida')
                print(f"[DEBUG] Fila {idx+1} sin nombre_preferencia, saltando")
                continue

            # Normalizaciones básicas para que los KPIs tengan datos mínimos
            edad_cruda = datos.get('edad_al_confirmar')
            edad_val = None
            if edad_cruda is not None:
                try:
                    edad_val = int(str(edad_cruda).strip())
                except Exception:
                    edad_val = None
            # Si no hay edad, asumir 18 para que cuente en KPIs de recomendación
            if edad_val is None:
                edad_val = 18


            # Normalizar todos los strings: reemplazar saltos de línea por espacio
            # (pdfplumber a veces une celdas multilínea con \n)
            for campo_str in ['sacerdocio', 'estado_recomendacion_raw', 'llamamientos', 'unidad', 'sexo']:
                if datos.get(campo_str) and isinstance(datos[campo_str], str):
                    datos[campo_str] = ' '.join(datos[campo_str].split()).strip()

            # Tratar cadenas "None", "nan", "NaN" como vacío real
            for campo_str in ['sacerdocio', 'estado_recomendacion_raw', 'llamamientos', 'unidad', 'sexo', 'nombre_preferencia']:
                if str(datos.get(campo_str, '')).strip().lower() in ('none', 'nan'):
                    datos[campo_str] = None

            # --- Rescate de columnas desplazadas (PDF con celdas multilinea) ---
            # Buscar en TODAS las celdas de la fila valores de sacerdocio / recomendación
            # que pdfplumber asignó a la columna equivocada
            PALABRAS_SACERDOCIO_SCAN = ['aarónico', 'aaronico', 'elder', 'melquisedec',
                                        'presbítero', 'presbitero', 'sumo sacerdote',
                                        'diácono', 'diacono', 'maestro',
                                        'no ha sido ordenado', 'no ha sido', 'no ordenado', 'sin ordenar']
            PALABRAS_REC_SCAN = ['activa', 'vigente', 'valida', 'válida', 'activo',
                                 'vencida', 'pendiente', 'sin recomendación', 'sin recomendacion']

            sacer_actual = str(datos.get('sacerdocio') or '').strip().lower()
            rec_actual   = str(datos.get('estado_recomendacion_raw') or '').strip().lower()

            for cell_val in row.values:
                cell_str = ' '.join(str(cell_val).split()).strip()
                cell_lower = cell_str.lower()
                if cell_lower in ('none', 'nan', ''):
                    continue
                # Si sacerdocio está vacío y esta celda parece sacerdocio → asignar
                if not sacer_actual and any(p in cell_lower for p in PALABRAS_SACERDOCIO_SCAN):
                    datos['sacerdocio'] = cell_str
                    sacer_actual = cell_lower
                # Si recomendación está vacía y esta celda parece recomendación → asignar
                if not rec_actual and any(p in cell_lower for p in PALABRAS_REC_SCAN):
                    datos['estado_recomendacion_raw'] = cell_str
                    rec_actual = cell_lower

            sexo_norm = normalizar_sexo(datos.get('sexo'))
            sacerdocio_raw = str(datos.get('sacerdocio') or '').strip()

            # Si sacerdocio cell tiene un valor de recomendación (columna desplazada), moverlo
            PALABRAS_RECOMENDACION = ['activa', 'vigente', 'valida', 'válida', 'activo']
            rec_raw_actual = str(datos.get('estado_recomendacion_raw') or '').strip().lower()
            if sacerdocio_raw.lower() in PALABRAS_RECOMENDACION and not rec_raw_actual:
                datos['estado_recomendacion_raw'] = sacerdocio_raw
                datos['sacerdocio'] = None
                sacerdocio_raw = ''

            sacerdocio_raw_lower = sacerdocio_raw.lower()

            # Normalizar sacerdocio PRIMERO (fuente de verdad para esta_ordenado)
            sacerdocio_norm, esta_ordenado = normalizar_sacerdocio(sacerdocio_raw)

            # Asumir sexo M si el sacerdocio es explícitamente masculino o "no ha sido ordenado"
            SACERDOCIO_MASCULINO = ['no ha sido ordenado', 'aarónico', 'aaronico', 'elder', 'melquisedec',
                                    'presbítero', 'presbitero', 'sumo sacerdote', 'diácono', 'diacono', 'maestro']
            if sexo_norm is None:
                if any(pal in sacerdocio_raw_lower for pal in SACERDOCIO_MASCULINO):
                    sexo_norm = 'M'

            # Normalizar recomendación
            tiene_recomendacion, estado_recomendacion_cat = normalizar_estado_recomendacion(
                datos.get('estado_recomendacion_raw')
            )
            raw_rec = str(datos.get('estado_recomendacion_raw') or '').lower()
            if tiene_recomendacion is None:
                if 'activa' in raw_rec or 'vigente' in raw_rec or 'valida' in raw_rec or 'válida' in raw_rec:
                    tiene_recomendacion = True
                elif raw_rec and raw_rec not in ['', 'nan', 'none']:
                    tiene_recomendacion = False
            # Si no hay fecha de confirmación, intentar extraer de nombre o poner hoy
            if not datos.get('fecha_confirmacion'):
                try:
                    import re
                    from dateutil import parser as dateparser
                    m = re.search(r"(\d{1,2} \w{3} \d{4})", str(row.values))
                    if m:
                        datos['fecha_confirmacion'] = dateparser.parse(m.group(1), dayfirst=True).date()
                    else:
                        from datetime import datetime
                        datos['fecha_confirmacion'] = datetime.now().date()
                except Exception:
                    from datetime import datetime
                    datos['fecha_confirmacion'] = datetime.now().date()

            print(f"[DEBUG] Insertando fila {idx+1}: {datos.get('nombre_preferencia')} | sacerdocio='{sacerdocio_raw}' | rec_raw='{datos.get('estado_recomendacion_raw')}' | tiene_rec={tiene_recomendacion} | sexo={sexo_norm} | sacerdocio_norm={sacerdocio_norm} | ordenado={esta_ordenado}")
            converso = PersonaConverso(
                id=None,
                nombre_preferencia=datos.get('nombre_preferencia', ''),
                sacerdocio=datos.get('sacerdocio'),
                estado_recomendacion_raw=datos.get('estado_recomendacion_raw'),
                llamamientos=datos.get('llamamientos'),
                unidad=datos.get('unidad'),
                fecha_confirmacion=datos.get('fecha_confirmacion'),
                fecha_nacimiento=datos.get('fecha_nacimiento'),
                sexo=sexo_norm,
                edad_al_confirmar=edad_val,
                tiene_recomendacion=tiene_recomendacion,
                sacerdocio_normalizado=sacerdocio_norm,
                esta_ordenado=esta_ordenado,
                archivo_fuente_id=file_id,
                fila_numero=idx+1
            )
            db_session.add(converso)
            personas_importadas += 1
        except Exception as e:
            errores.append(f'Fila {idx+1}: {str(e)}')
            print(f"[DEBUG] Error en fila {idx+1}: {str(e)}")
    
    print(f"[DEBUG] Total personas importadas: {personas_importadas}")
    archivo.status = 'processed'
    db_session.commit()
    print(f"[DEBUG] Commit realizado")
    return ImportacionConfirmada(
        success=True,
        file_id=file_id,
        personas_importadas=personas_importadas,
        errores=errores,
        advertencias=advertencias
    )


# === IMPORT DIRECTO (SIN DISCO) ===

@router.post('/import')
async def import_conversos_directo(
    file: UploadFile = File(...),
    db_session: Session = Depends(db.get_db)
):
    """
    Importa conversos en un solo paso: lee el archivo en memoria, procesa y guarda.
    No requiere almacenamiento en disco (compatible con Render y plataformas efímeras).
    """
    import os, re
    from dateutil import parser as dateparser

    fname_lower = file.filename.lower() if file.filename else ''
    allowed_extensions = ('.pdf', '.csv', '.xls', '.xlsx')
    if not fname_lower.endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail="Tipo de archivo no soportado. Use PDF, CSV o Excel (.xlsx)"
        )

    try:
        contents = await file.read()

        # --- Parsear archivo en memoria ---
        if fname_lower.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif fname_lower.endswith('.pdf'):
            with pdfplumber.open(io.BytesIO(contents)) as pdf:
                all_tables = []
                for page in pdf.pages:
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            all_tables.extend(table)
                if not all_tables:
                    raise HTTPException(status_code=400, detail="No se encontraron tablas en el PDF")
                headers = all_tables[0]
                clean_headers = [h if h is not None else f"col_{i+1}" for i, h in enumerate(headers)]
                raw_rows = all_tables[1:]
                merged_rows = _merge_pdf_continuation_rows(raw_rows, len(clean_headers))
                df = pd.DataFrame(merged_rows, columns=clean_headers)
        else:
            df = pd.read_excel(io.BytesIO(contents))

        # --- Registrar en PdfFile (para archivo_fuente_id) ---
        pdf_file = PdfFile(
            filename=file.filename,
            mime=file.content_type,
            size_bytes=len(contents),
            status='processing',
            file_metadata={'total_filas': len(df), 'columnas': list(df.columns)}
        )
        db_session.add(pdf_file)
        db_session.commit()
        db_session.refresh(pdf_file)
        file_id = pdf_file.id

        # --- Limpiar datos previos ---
        db_session.query(PersonaConverso).delete()
        db_session.query(MapeoColumna).delete()
        from .models import JovenRecomendacion
        jovenes_file_ids = {j.archivo_fuente_id for j in db_session.query(JovenRecomendacion.archivo_fuente_id).all() if j.archivo_fuente_id}
        from .models import PdfFile as PdfFileModel
        db_session.query(PdfFileModel).filter(
            PdfFileModel.id != file_id,
            ~PdfFileModel.id.in_(jovenes_file_ids)
        ).delete(synchronize_session='fetch')
        db_session.commit()

        # --- Auto-mapeo ---
        mapeo_dict = {}
        mapeo_generico = {
            'col_1': 'nombre_preferencia',
            'col_2': 'edad_al_confirmar',
            'col_3': 'sacerdocio',
            'col_4': 'estado_recomendacion_raw',
            'col_5': 'llamamientos',
            'col_6': 'unidad',
            'col_7': 'fecha_confirmacion'
        }
        for col in df.columns:
            if col in mapeo_generico:
                mapeo_dict[col] = mapeo_generico[col]

        variantes_mapeo = {
            'nombre_preferencia': ['nombre preferencia', 'nombre_preferencia'],
            'sacerdocio': ['sacerdocio'],
            'estado_recomendacion_raw': ['estado recomendacion', 'estado_recomendacion', 'estado_recomendacion_raw'],
            'llamamientos': ['llamamientos'],
            'unidad': ['unidad'],
            'fecha_confirmacion': ['fecha confirmacion', 'fecha_confirmación', 'fecha de la confirmacion'],
            'fecha_nacimiento': ['fecha nacimiento', 'fecha_nacimiento'],
            'sexo': ['sexo', 'edad']
        }
        for col in df.columns:
            if col not in mapeo_dict:
                col_norm = str(col).strip().lower()
                for campo, variantes_lista in variantes_mapeo.items():
                    if any(col_norm == v for v in variantes_lista):
                        mapeo_dict[col] = campo
                        break

        primera_col = df.columns[0] if len(df.columns) > 0 else None
        if primera_col and primera_col not in mapeo_dict:
            mapeo_dict[primera_col] = 'nombre_preferencia'

        print(f"[IMPORT] Columnas: {list(df.columns)}")
        print(f"[IMPORT] Mapeo final: {mapeo_dict}")
        print(f"[IMPORT] Total filas en df: {len(df)}")

        # --- Procesar filas ---
        errores = []
        advertencias = []
        personas_importadas = 0

        FILAS_IGNORAR = ['nombre', 'lista', 'recuento', 'total', 'subtotal', 'suma',
                         'count', 'header', 'encabezado', 'nombre preferencia', 'barrio']
        SACERDOCIO_MASCULINO = ['no ha sido ordenado', 'aarónico', 'aaronico', 'elder', 'melquisedec',
                                'presbítero', 'presbitero', 'sumo sacerdote', 'diácono', 'diacono', 'maestro']
        PALABRAS_SACERDOCIO_SCAN = ['aarónico', 'aaronico', 'elder', 'melquisedec',
                                    'presbítero', 'presbitero', 'sumo sacerdote',
                                    'diácono', 'diacono', 'maestro',
                                    'no ha sido ordenado', 'no ha sido', 'no ordenado', 'sin ordenar']
        PALABRAS_REC_SCAN = ['activa', 'vigente', 'valida', 'válida', 'activo',
                             'vencida', 'pendiente', 'sin recomendación', 'sin recomendacion']
        PALABRAS_RECOMENDACION = ['activa', 'vigente', 'valida', 'válida', 'activo']

        for idx, row in df.iterrows():
            try:
                if all((str(x).strip() == '' or pd.isna(x)) for x in row.values):
                    continue

                datos = {}
                for col_src, col_dst in mapeo_dict.items():
                    if col_dst:
                        val = row.get(col_src, None)
                        if col_dst in ['fecha_confirmacion', 'fecha_nacimiento'] and val and isinstance(val, str):
                            try:
                                val = dateparser.parse(val, dayfirst=True).date()
                            except Exception:
                                advertencias.append(f'Fila {idx+1}: fecha inválida en {col_dst} ({val})')
                                val = None
                        datos[col_dst] = val

                if datos.get('nombre_preferencia') and '\n' in str(datos['nombre_preferencia']):
                    partes = [p.strip() for p in str(datos['nombre_preferencia']).split('\n') if p.strip()]
                    datos['nombre_preferencia'] = ' '.join(partes)

                nombre_val = str(datos.get('nombre_preferencia', '')).strip().lower()
                if any(nombre_val.startswith(p) for p in FILAS_IGNORAR):
                    continue
                if nombre_val.replace('.', '').replace(',', '').isdigit():
                    continue
                if not datos.get('nombre_preferencia'):
                    advertencias.append(f'Fila {idx+1} sin nombre_preferencia, omitida')
                    continue

                # Normalizar strings
                for campo_str in ['sacerdocio', 'estado_recomendacion_raw', 'llamamientos', 'unidad', 'sexo']:
                    if datos.get(campo_str) and isinstance(datos[campo_str], str):
                        datos[campo_str] = ' '.join(datos[campo_str].split()).strip()
                for campo_str in ['sacerdocio', 'estado_recomendacion_raw', 'llamamientos', 'unidad', 'sexo', 'nombre_preferencia']:
                    if str(datos.get(campo_str, '')).strip().lower() in ('none', 'nan'):
                        datos[campo_str] = None

                # Rescate de columnas desplazadas
                sacer_actual = str(datos.get('sacerdocio') or '').strip().lower()
                rec_actual   = str(datos.get('estado_recomendacion_raw') or '').strip().lower()
                for cell_val in row.values:
                    cell_str = ' '.join(str(cell_val).split()).strip()
                    cell_lower = cell_str.lower()
                    if cell_lower in ('none', 'nan', ''):
                        continue
                    if not sacer_actual and any(p in cell_lower for p in PALABRAS_SACERDOCIO_SCAN):
                        datos['sacerdocio'] = cell_str
                        sacer_actual = cell_lower
                    if not rec_actual and any(p in cell_lower for p in PALABRAS_REC_SCAN):
                        datos['estado_recomendacion_raw'] = cell_str
                        rec_actual = cell_lower

                sexo_norm = normalizar_sexo(datos.get('sexo'))
                sacerdocio_raw = str(datos.get('sacerdocio') or '').strip()
                rec_raw_actual = str(datos.get('estado_recomendacion_raw') or '').strip().lower()
                if sacerdocio_raw.lower() in PALABRAS_RECOMENDACION and not rec_raw_actual:
                    datos['estado_recomendacion_raw'] = sacerdocio_raw
                    datos['sacerdocio'] = None
                    sacerdocio_raw = ''

                sacerdocio_raw_lower = sacerdocio_raw.lower()
                sacerdocio_norm, esta_ordenado = normalizar_sacerdocio(sacerdocio_raw)

                if sexo_norm is None:
                    if any(pal in sacerdocio_raw_lower for pal in SACERDOCIO_MASCULINO):
                        sexo_norm = 'M'

                tiene_recomendacion, estado_recomendacion_cat = normalizar_estado_recomendacion(
                    datos.get('estado_recomendacion_raw')
                )
                raw_rec = str(datos.get('estado_recomendacion_raw') or '').lower()
                if tiene_recomendacion is None:
                    if 'activa' in raw_rec or 'vigente' in raw_rec or 'valida' in raw_rec or 'válida' in raw_rec:
                        tiene_recomendacion = True
                    elif raw_rec and raw_rec not in ['', 'nan', 'none']:
                        tiene_recomendacion = False

                # Edad
                edad_cruda = datos.get('edad_al_confirmar')
                edad_val = None
                if edad_cruda is not None:
                    try:
                        edad_val = int(str(edad_cruda).strip())
                    except Exception:
                        edad_val = None
                if edad_val is None:
                    edad_val = 18

                # Fecha confirmación fallback
                if not datos.get('fecha_confirmacion'):
                    try:
                        m = re.search(r"(\d{1,2} \w{3} \d{4})", str(row.values))
                        if m:
                            datos['fecha_confirmacion'] = dateparser.parse(m.group(1), dayfirst=True).date()
                        else:
                            datos['fecha_confirmacion'] = datetime.now().date()
                    except Exception:
                        datos['fecha_confirmacion'] = datetime.now().date()

                print(f"[IMPORT] Fila {idx+1}: {datos.get('nombre_preferencia')} | sacerdocio='{sacerdocio_raw}' | rec='{datos.get('estado_recomendacion_raw')}' | tiene_rec={tiene_recomendacion}")
                converso = PersonaConverso(
                    id=None,
                    nombre_preferencia=datos.get('nombre_preferencia', ''),
                    sacerdocio=datos.get('sacerdocio'),
                    estado_recomendacion_raw=datos.get('estado_recomendacion_raw'),
                    llamamientos=datos.get('llamamientos'),
                    unidad=datos.get('unidad'),
                    fecha_confirmacion=datos.get('fecha_confirmacion'),
                    fecha_nacimiento=datos.get('fecha_nacimiento'),
                    sexo=sexo_norm,
                    edad_al_confirmar=edad_val,
                    tiene_recomendacion=tiene_recomendacion,
                    sacerdocio_normalizado=sacerdocio_norm,
                    esta_ordenado=esta_ordenado,
                    archivo_fuente_id=file_id,
                    fila_numero=idx + 1
                )
                db_session.add(converso)
                personas_importadas += 1
            except Exception as e:
                errores.append(f'Fila {idx+1}: {str(e)}')
                print(f"[IMPORT] Error fila {idx+1}: {str(e)}")

        pdf_file.status = 'processed'
        db_session.commit()
        print(f"[IMPORT] Total personas importadas: {personas_importadas}")

        return {
            'ok': True,
            'total': personas_importadas,
            'mensaje': f'{personas_importadas} conversos importados correctamente',
            'advertencias': errores + advertencias
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando archivo: {str(e)}")


# === ENRIQUECIMIENTO ===

@router.get('/pendientes-enriquecimiento', response_model=List[PersonaConversoOut])
async def obtener_pendientes_enriquecimiento(
    campo: Optional[str] = Query(None, regex="^(edad|sexo)$"),
    limite: int = Query(50, ge=1, le=200),
    db_session: Session = Depends(db.get_db)
):
    """
    Lista personas que necesitan enriquecimiento de datos
    """
    query = db_session.query(PersonaConverso).filter(
        PersonaConverso.enriquecido == False
    )
    
    if campo == 'edad':
        query = query.filter(PersonaConverso.fecha_nacimiento.is_(None))
    elif campo == 'sexo':
        query = query.filter(PersonaConverso.sexo.is_(None))
    
    personas = query.limit(limite).all()
    return personas


@router.patch('/{persona_id}/enriquecer', response_model=PersonaConversoOut)
async def enriquecer_persona(
    persona_id: str,
    data: PersonaConversoEnriquecer,
    user_id: str = Query(...),  # En producción vendría del token JWT
    db_session: Session = Depends(db.get_db)
):
    """
    Actualiza datos faltantes de una persona
    """
    persona = db_session.query(PersonaConverso).filter(PersonaConverso.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    
    # Actualizar datos enriquecidos
    if data.fecha_nacimiento:
        persona.fecha_nacimiento = data.fecha_nacimiento
        # Recalcular edad
        if persona.fecha_confirmacion:
            persona.edad_al_confirmar = calcular_edad(data.fecha_nacimiento, persona.fecha_confirmacion)
    
    if data.sexo:
        persona.sexo = normalizar_sexo(data.sexo)
    
    if data.notas_enriquecimiento:
        persona.notas_enriquecimiento = data.notas_enriquecimiento
    
    # Marcar como enriquecido
    persona.enriquecido = True
    persona.enriquecido_por = user_id
    persona.enriquecido_fecha = datetime.utcnow()
    
    db_session.commit()
    db_session.refresh(persona)
    
    return persona


@router.post('/enriquecer-lote')
async def enriquecer_lote(
    datos: List[dict],
    user_id: str = Query(...),
    db_session: Session = Depends(db.get_db)
):
    """
    Enriquece múltiples personas de una vez
    """
    actualizados = 0
    errores = []
    
    for item in datos:
        try:
            persona = db_session.query(PersonaConverso).filter(
                PersonaConverso.id == item['id']
            ).first()
            
            if not persona:
                errores.append(f"Persona {item['id']} no encontrada")
                continue
            
            if 'fecha_nacimiento' in item:
                persona.fecha_nacimiento = item['fecha_nacimiento']
                if persona.fecha_confirmacion:
                    persona.edad_al_confirmar = calcular_edad(
                        item['fecha_nacimiento'], 
                        persona.fecha_confirmacion
                    )
            
            if 'sexo' in item:
                persona.sexo = normalizar_sexo(item['sexo'])
            
            persona.enriquecido = True
            persona.enriquecido_por = user_id
            persona.enriquecido_fecha = datetime.utcnow()
            
            actualizados += 1
            
        except Exception as e:
            errores.append(f"Error en {item.get('id')}: {str(e)}")
    
    db_session.commit()
    
    return {
        "success": True,
        "actualizados": actualizados,
        "errores": errores
    }


# === LISTAR CONVERSOS ===

@router.get('/', response_model=List[PersonaConversoOut])
async def listar_conversos(
    unidad: Optional[str] = None,
    periodo_id: Optional[str] = None,
    limite: int = Query(100, ge=1, le=500),
    db_session: Session = Depends(db.get_db)
):
    """
    Lista conversos con filtros opcionales
    """
    query = db_session.query(PersonaConverso)
    
    if unidad:
        query = query.filter(PersonaConverso.unidad == unidad)
    
    if periodo_id:
        periodo = db_session.query(PeriodoKPI).filter(PeriodoKPI.id == periodo_id).first()
        if periodo:
            query = query.filter(
                PersonaConverso.fecha_confirmacion >= periodo.fecha_inicio,
                PersonaConverso.fecha_confirmacion <= periodo.fecha_fin
            )
    
    personas = query.limit(limite).all()
    return personas


# === OBTENER CONVERSO POR ID ===

@router.get('/{persona_id}', response_model=PersonaConversoOut)
async def obtener_converso(
    persona_id: str,
    db_session: Session = Depends(db.get_db)
):
    """
    Obtiene detalles de un converso específico
    """
    persona = db_session.query(PersonaConverso).filter(PersonaConverso.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    
    return persona
