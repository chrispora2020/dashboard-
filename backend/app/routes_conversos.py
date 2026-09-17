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
from .columnas_listas import mapear_conversos, encabezado_pdf
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


def _guardar_lista(db_session, archivo, cantidad, errores):
    """Confirma el reemplazo completo o conserva la lista anterior ante un error."""
    try:
        if errores or cantidad == 0:
            raise HTTPException(
                status_code=400,
                detail="No se reemplazó la lista anterior. " + (
                    "; ".join(errores[:5]) if errores else "El archivo no contiene conversos válidos."
                ),
            )
        db_session.flush()
        guardados = db_session.query(PersonaConverso).filter(
            PersonaConverso.archivo_fuente_id == archivo.id
        ).count()
        if guardados != cantidad:
            raise HTTPException(status_code=500, detail="No se pudo verificar la lista guardada.")
        archivo.status = 'processed'
        db_session.commit()
    except Exception:
        db_session.rollback()
        raise


def _leer_pdf_conversos(pdf):
    """Lee cada celda por sus límites físicos, incluso si el PDF fusiona filas."""
    columnas = None
    limites = None
    registros = []
    for page in pdf.pages:
        for table in page.find_tables():
            raw = table.extract()
            try:
                header_index, current_columns = encabezado_pdf(raw)
            except ValueError:
                if columnas is None:
                    continue
                header_index = -1
                current_columns = columnas
            else:
                cells = table.rows[header_index].cells
                if any(cell is None for cell in cells):
                    raise ValueError('No se pudieron separar las columnas del PDF. Importe la lista en CSV o Excel.')
                limites = [(cell[0], cell[2]) for cell in cells]
                if columnas is not None and current_columns != columnas:
                    raise ValueError('Las columnas del PDF cambian entre páginas. Importe la lista en CSV o Excel.')
                columnas = current_columns
            for row in table.rows[header_index + 1:]:
                registros.append([
                    page.crop((left, row.bbox[1], right, row.bbox[3])).extract_text() or ''
                    for left, right in limites
                ])
    if columnas is None:
        raise ValueError('No se encontró la tabla con los encabezados Nombre y Unidad.')
    return pd.DataFrame(registros, columns=columnas)


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
                df = _leer_pdf_conversos(pdf)
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
    # Borrar archivos anteriores excepto el actual y los referenciados por CUALQUIER tabla que tenga FK a pdf_files
    from .models import PdfFile as PdfFileModel, JovenRecomendacion, AdultoRecomendacion, MisioneroCampo
    ids_en_uso = set()
    for row in db_session.query(JovenRecomendacion.archivo_fuente_id).all():
        if row.archivo_fuente_id:
            ids_en_uso.add(row.archivo_fuente_id)
    for row in db_session.query(AdultoRecomendacion.archivo_fuente_id).all():
        if row.archivo_fuente_id:
            ids_en_uso.add(row.archivo_fuente_id)
    for row in db_session.query(MisioneroCampo.archivo_fuente_id).all():
        if row.archivo_fuente_id:
            ids_en_uso.add(row.archivo_fuente_id)
    db_session.query(PdfFileModel).filter(
        PdfFileModel.id != file_id,
        ~PdfFileModel.id.in_(ids_en_uso)
    ).delete(synchronize_session='fetch')
    # El reemplazo se confirma junto con los registros nuevos.

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
                df = _leer_pdf_conversos(pdf)
        else:
            # Si no existe el archivo físico, intentar reconstruir desde metadata (no ideal)
            raise Exception('Archivo original no disponible en disco')
    except Exception as e:
        errores.append(f'Error leyendo archivo original: {str(e)}')
        db_session.rollback()
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
        mapeo_dict = mapear_conversos(list(df.columns))
    else:
        unidad_fuente = next(col for col, campo in mapear_conversos(list(df.columns)).items() if campo == 'unidad')
        mapeo_dict = {col: campo for col, campo in mapeo_dict.items() if campo != 'unidad'}
        mapeo_dict[unidad_fuente] = 'unidad'

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
                    if col_dst in ['fecha_confirmacion', 'fecha_nacimiento'] and val is not None:
                        if hasattr(val, 'date') and callable(val.date):
                            val = val.date()  # datetime / pandas.Timestamp → date
                        elif isinstance(val, date):
                            pass  # ya es date
                        elif isinstance(val, str) and val.strip():
                            try:
                                val_norm = ' '.join(val.split())
                                val = dateparser.parse(val_norm, dayfirst=True).date()
                            except Exception:
                                advertencias.append(f'Fila {idx+1}: fecha inválida en {col_dst} ({val})')
                                val = None
                        else:
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
    _guardar_lista(db_session, archivo, personas_importadas, errores)
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
                df = _leer_pdf_conversos(pdf)
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
        db_session.flush()
        file_id = pdf_file.id

        # --- Limpiar datos previos ---
        db_session.query(PersonaConverso).delete()
        db_session.query(MapeoColumna).delete()
        # Proteger IDs referenciados por CUALQUIER tabla con FK a pdf_files
        from .models import JovenRecomendacion, AdultoRecomendacion, MisioneroCampo, PdfFile as PdfFileModel
        ids_en_uso = set()
        for row in db_session.query(JovenRecomendacion.archivo_fuente_id).all():
            if row.archivo_fuente_id:
                ids_en_uso.add(row.archivo_fuente_id)
        for row in db_session.query(AdultoRecomendacion.archivo_fuente_id).all():
            if row.archivo_fuente_id:
                ids_en_uso.add(row.archivo_fuente_id)
        for row in db_session.query(MisioneroCampo.archivo_fuente_id).all():
            if row.archivo_fuente_id:
                ids_en_uso.add(row.archivo_fuente_id)
        db_session.query(PdfFileModel).filter(
            PdfFileModel.id != file_id,
            ~PdfFileModel.id.in_(ids_en_uso)
        ).delete(synchronize_session='fetch')

        mapeo_dict = mapear_conversos(list(df.columns))

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
                        if col_dst in ['fecha_confirmacion', 'fecha_nacimiento'] and val is not None:
                            # Manejar objetos date/datetime/Timestamp de pandas directamente
                            if hasattr(val, 'date') and callable(val.date):
                                val = val.date()  # datetime / pandas.Timestamp → date
                            elif isinstance(val, date):
                                pass  # ya es date, no hacer nada
                            elif isinstance(val, str) and val.strip():
                                try:
                                    # Normalizar espacios en la cadena (no-break spaces, etc.)
                                    val_norm = ' '.join(val.split())
                                    val = dateparser.parse(val_norm, dayfirst=True).date()
                                except Exception:
                                    advertencias.append(f'Fila {idx+1}: fecha inválida en {col_dst} ({val})')
                                    val = None
                            else:
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

                # Edad
                edad_cruda = datos.get('edad_al_confirmar')
                edad_val = None
                if edad_cruda is not None:
                    try:
                        edad_val = int(str(edad_cruda).strip())
                    except Exception:
                        edad_val = None
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

        _guardar_lista(db_session, pdf_file, personas_importadas, errores)
        print(f"[IMPORT] Total personas importadas: {personas_importadas}")

        return {
            'ok': True,
            'total': personas_importadas,
            'mensaje': f'{personas_importadas} conversos importados correctamente',
            'advertencias': errores + advertencias
        }

    except HTTPException:
        db_session.rollback()
        raise
    except ValueError as e:
        db_session.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db_session.rollback()
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
