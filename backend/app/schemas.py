from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any, Dict
from datetime import date, datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str]


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str]


class FileOut(BaseModel):
    id: str
    filename: str
    status: str


class MeasurementIn(BaseModel):
    indicator_key: str
    period_id: str
    value: float
    unit: Optional[str]
    source_files: Optional[List[str]]
    raw_extractions: Optional[Any]
    job_id: Optional[str]


# === SCHEMAS PARA CONVERSOS ===

class PersonaConversoCreate(BaseModel):
    """Schema para crear un nuevo converso"""
    nombre_preferencia: str
    sacerdocio: Optional[str]
    estado_recomendacion_raw: Optional[str]
    llamamientos: Optional[str]
    unidad: Optional[str]
    fecha_confirmacion: Optional[date]
    fecha_nacimiento: Optional[date]
    sexo: Optional[str]
    archivo_fuente_id: str
    fila_numero: Optional[int]


class PersonaConversoEnriquecer(BaseModel):
    """Schema para enriquecer datos faltantes"""
    fecha_nacimiento: Optional[date]
    sexo: Optional[str]
    notas_enriquecimiento: Optional[str]


class PersonaConversoOut(BaseModel):
    """Schema de salida para converso"""
    id: str
    nombre_preferencia: str
    sacerdocio: Optional[str]
    estado_recomendacion_raw: Optional[str]
    llamamientos: Optional[str]
    unidad: Optional[str]
    fecha_confirmacion: Optional[date]
    
    # Normalizados
    sacerdocio_normalizado: Optional[str]
    tiene_recomendacion: Optional[bool]
    esta_ordenado: Optional[bool]
    
    # Enriquecidos
    fecha_nacimiento: Optional[date]
    edad_al_confirmar: Optional[int]
    sexo: Optional[str]
    enriquecido: bool
    
    # Auditoría
    archivo_fuente_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# === SCHEMAS PARA PERIODOS ===

class PeriodoCreate(BaseModel):
    """Schema para crear periodo"""
    nombre: str
    tipo: str  # "mes", "trimestre", "año"
    fecha_inicio: date
    fecha_fin: date
    year: int


class PeriodoOut(BaseModel):
    """Schema de salida para periodo"""
    id: str
    nombre: str
    tipo: str
    fecha_inicio: date
    fecha_fin: date
    year: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# === SCHEMAS PARA MAPEO ===

class MapeoColumnaCreate(BaseModel):
    """Schema para definir mapeo de columnas"""
    columna_fuente: str
    campo_destino: str
    tipo_dato: str
    transformacion: Optional[str]


class MapeoRequest(BaseModel):
    """Request completo de mapeo"""
    file_id: str
    mapeos: List[MapeoColumnaCreate]
    normalizar_automatico: bool = True


class ValidacionFila(BaseModel):
    """Resultado de validación de una fila"""
    fila: int
    valida: bool
    errores: List[str] = []
    advertencias: List[str] = []


class ValidacionArchivo(BaseModel):
    """Resultado de validación de archivo completo"""
    total_filas: int
    validas: int
    con_errores: int
    errores: List[Dict]
    advertencias: List[Dict]
    requiere_enriquecimiento: Dict[str, int]


# === SCHEMAS PARA INDICADORES ===

class BreakdownUnidad(BaseModel):
    """Breakdown por unidad"""
    unidad: str
    real: int
    potencial: int
    porcentaje: Optional[float]


class PersonaFaltante(BaseModel):
    """Persona que falta para cumplir meta"""
    id: str
    nombre: str
    unidad: Optional[str]
    estado_actual: str
    fecha_confirmacion: Optional[date]
    dias_desde_confirmacion: Optional[int]


class Advertencia(BaseModel):
    """Advertencia en cálculo de indicador"""
    tipo: str
    mensaje: str
    cantidad: int
    accion_sugerida: str


class IndicadorResumen(BaseModel):
    """Resumen de un indicador"""
    real: int
    potencial: int
    porcentaje: Optional[float]
    meta: float
    diferencia_meta: Optional[float]
    estado_semaforo: str  # "verde", "amarillo", "rojo"


class IndicadorBreakdown(BaseModel):
    """Breakdown detallado de indicador"""
    elegibles: Optional[int]
    no_elegibles: Optional[int]
    sin_clasificar: Optional[int]


class IndicadorDetalle(BaseModel):
    """Detalle completo de un indicador"""
    indicador: str
    nombre: str
    periodo: PeriodoOut
    resumen: IndicadorResumen
    breakdown: IndicadorBreakdown
    faltantes: List[PersonaFaltante]
    por_unidad: List[BreakdownUnidad]
    advertencias: List[Advertencia]
    meta_info: Dict


class IndicadorTendencia(BaseModel):
    """Punto de tendencia para gráfico"""
    periodo: str
    real: int
    potencial: int
    porcentaje: Optional[float]


# === SCHEMAS PARA NORMALIZACIÓN ===

class ValorNormalizadoCreate(BaseModel):
    """Crear regla de normalización"""
    campo: str
    valor_raw: str
    valor_normalizado: str
    categoria: str


class ValorDesconocido(BaseModel):
    """Valor que no se pudo normalizar"""
    campo: str
    valor_raw: str
    frecuencia: int
    sugerencia: Optional[str]


# === SCHEMAS PARA UPLOAD ===

class UploadResponse(BaseModel):
    """Respuesta de upload"""
    file_id: str
    filename: str
    total_filas: int
    columnas_detectadas: List[str]
    preview_data: List[Dict]


class ImportacionConfirmada(BaseModel):
    """Resultado de importación confirmada"""
    success: bool
    file_id: str
    personas_importadas: int
    errores: List[str]
    advertencias: List[str]
