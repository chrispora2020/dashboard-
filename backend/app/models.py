from sqlalchemy import Column, String, DateTime, Boolean, Text, JSON, Numeric, BigInteger, Date, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .db import Base
import uuid


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = 'users'
    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String)
    role = Column(String, default='user')
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PdfFile(Base):
    __tablename__ = 'pdf_files'
    id = Column(String, primary_key=True, default=gen_uuid)
    uploader_id = Column(String)
    filename = Column(String, nullable=False)
    s3_path = Column(String, nullable=True)
    checksum = Column(String)
    size_bytes = Column(BigInteger)
    mime = Column(String)
    status = Column(String, default='uploaded')
    file_metadata = Column(JSON, default={})
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relaciones
    conversos = relationship("PersonaConverso", back_populates="archivo_fuente")


class Measurement(Base):
    __tablename__ = 'measurements'
    id = Column(String, primary_key=True, default=gen_uuid)
    indicator_id = Column(String)
    period_id = Column(String)
    value = Column(Numeric)
    unit = Column(String)
    source_files = Column(JSON, default=list)
    extracted_by_job = Column(String)
    raw_extractions = Column(JSON, default=list)
    validated = Column(Boolean, default=False)
    validated_by = Column(String)
    validated_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PeriodoKPI(Base):
    """Define periodos de medición (mes, trimestre, año)"""
    __tablename__ = 'periodos'
    
    id = Column(String, primary_key=True, default=gen_uuid)
    nombre = Column(String, nullable=False)  # "2026-Q1", "Enero 2026"
    tipo = Column(String, nullable=False)  # "mes", "trimestre", "año"
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    year = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PersonaConverso(Base):
    """Representa a cada converso con datos enriquecidos"""
    __tablename__ = 'personas_conversos'
    
    id = Column(String, primary_key=True, default=gen_uuid)
    
    # Datos de la fuente original
    nombre_preferencia = Column(String, nullable=False)
    sacerdocio = Column(String)  # Raw del PDF/CSV
    estado_recomendacion_raw = Column(String)  # Raw del PDF/CSV
    llamamientos = Column(Text)
    unidad = Column(String)
    fecha_confirmacion = Column(Date)
    
    # Datos normalizados (calculados automáticamente)
    sacerdocio_normalizado = Column(String)  # "aaronico", "melquisedec", "no_ordenado"
    tiene_recomendacion = Column(Boolean)  # TRUE/FALSE/NULL
    esta_ordenado = Column(Boolean)  # TRUE/FALSE/NULL
    
    # Datos enriquecidos (faltantes en la fuente)
    fecha_nacimiento = Column(Date, nullable=True)
    edad_al_confirmar = Column(Integer, nullable=True)  # Calculado
    sexo = Column(String, nullable=True)  # "M", "F"
    
    # Metadatos de enriquecimiento
    enriquecido = Column(Boolean, default=False)
    enriquecido_por = Column(String)  # user_id
    enriquecido_fecha = Column(DateTime(timezone=True))
    notas_enriquecimiento = Column(Text)
    
    # Auditoría
    archivo_fuente_id = Column(String, ForeignKey('pdf_files.id'))
    fila_numero = Column(Integer)  # Número de fila en el archivo original
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relaciones
    archivo_fuente = relationship("PdfFile", back_populates="conversos")


class IndicadorKPI(Base):
    """Almacena cálculos de indicadores por periodo"""
    __tablename__ = 'indicadores_kpi'
    
    id = Column(String, primary_key=True, default=gen_uuid)
    
    # Identificación
    indicador_key = Column(String, nullable=False)  # "bautismos_conversos"
    periodo_id = Column(String, ForeignKey('periodos.id'))
    unidad = Column(String, nullable=True)  # Para breakdown por unidad
    
    # Valores calculados
    real = Column(Integer, nullable=False)
    potencial = Column(Integer, nullable=False)
    elegibles = Column(Integer)
    no_elegibles = Column(Integer)
    sin_clasificar = Column(Integer)
    porcentaje = Column(Float)
    meta = Column(Float)
    
    # Metadatos
    personas_ids = Column(JSON)  # Lista de IDs de PersonaConverso
    faltantes_ids = Column(JSON)  # IDs que están en potencial pero no en real
    calculado_en = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relaciones
    periodo = relationship("PeriodoKPI")


class JovenRecomendacion(Base):
    """Representa a cada joven de la lista de recomendación"""
    __tablename__ = 'jovenes_recomendacion'

    id = Column(String, primary_key=True, default=gen_uuid)

    # Datos del PDF
    nombre = Column(String, nullable=False)
    sexo = Column(String)               # "M", "F"
    edad = Column(Integer)
    estado_raw = Column(String)         # "Activa", "Vencen en 15 días", "Vencida", "Cancelada", etc.
    vencimiento_raw = Column(String)    # Contenido de la columna Vencimiento
    unidad = Column(String)

    # Valores normalizados
    estado_normalizado = Column(String)  # "activa", "vence_pronto", "vencida", "cancelada",
                                         # "no_bautizado", "sin_estado"
    tiene_recomendacion_activa = Column(Boolean)  # True si activa o vence_pronto

    # Auditoría
    archivo_fuente_id = Column(String, ForeignKey('pdf_files.id'))
    fila_numero = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AdultoRecomendacion(Base):
    """Representa a cada adulto investido de la lista de recomendación"""
    __tablename__ = 'adultos_recomendacion'

    id = Column(String, primary_key=True, default=gen_uuid)

    # Datos del PDF
    nombre = Column(String, nullable=False)
    sexo = Column(String)               # "M", "F"
    edad = Column(Integer)
    estado_raw = Column(String)
    vencimiento_raw = Column(String)
    unidad = Column(String)

    # Valores normalizados
    estado_normalizado = Column(String)  # "activa", "vence_pronto", "vencida", "cancelada", "sin_estado"
    tiene_recomendacion_activa = Column(Boolean)

    # Auditoría
    archivo_fuente_id = Column(String, ForeignKey('pdf_files.id'))
    fila_numero = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MisioneroCampo(Base):
    """Represent cada misionero actualmente en el campo"""
    __tablename__ = 'misioneros_campo'

    id = Column(String, primary_key=True, default=gen_uuid)

    nombre = Column(String, nullable=False)
    mision = Column(String)            # Tipo de misión (ej. "Misión de servicio a la Iglesia")
    comenzo = Column(String)           # Fecha de inicio (guardada como texto desde CSV/Excel)
    termino_esperado = Column(String)  # Fecha término esperado
    unidad_actual = Column(String)     # Unidad/barrio actual

    # Es "Misión de servicio a la Iglesia"?
    es_mision_servicio = Column(Boolean, default=False)

    archivo_fuente_id = Column(String, ForeignKey('pdf_files.id'))
    fila_numero = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AsistenciaSacramental(Base):
    """Registra el valor de asistencia sacramental por periodo"""
    __tablename__ = 'asistencia_sacramental'

    id = Column(String, primary_key=True, default=gen_uuid)
    periodo = Column(String, nullable=False)  # ej. "2026", "2026-Q1"
    valor = Column(Integer, nullable=False)
    desglose = Column(JSON, default=dict)     # {"Barrio": N, ...}
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MapeoColumna(Base):
    """Mapeo de columnas del archivo fuente a campos del modelo"""
    __tablename__ = 'mapeos_columnas'
    
    id = Column(String, primary_key=True, default=gen_uuid)
    archivo_id = Column(String, ForeignKey('pdf_files.id'))
    
    columna_fuente = Column(String)  # "Nombre de preferencia"
    campo_destino = Column(String)  # "nombre_preferencia"
    tipo_dato = Column(String)  # "string", "date", "boolean"
    transformacion = Column(String)  # "normalizar_estado", "calcular_edad"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ValorNormalizado(Base):
    """Catálogo de valores normalizados para limpieza de datos"""
    __tablename__ = 'valores_normalizados'
    
    id = Column(String, primary_key=True, default=gen_uuid)
    campo = Column(String)  # "estado_recomendacion", "sacerdocio"
    valor_raw = Column(String)  # "ACTIVA"
    valor_normalizado = Column(String)  # "activa"
    categoria = Column(String)  # "activo", "inactivo", "desconocido"
    activo = Column(Boolean, default=True)  # Para deshabilitar reglas
    created_at = Column(DateTime(timezone=True), server_default=func.now())
