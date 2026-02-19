"""
Módulo de normalización de datos para conversos
Convierte valores raw de archivos a valores estandarizados
"""
from typing import Tuple, Optional
from datetime import date


# === CATÁLOGOS DE NORMALIZACIÓN ===

ESTADOS_RECOMENDACION = {
    "activo": [
        "Activa", "ACTIVA", "activa",
        "Vigente", "vigente", "VIGENTE",
        "Válida", "valida", "VALIDA", "Valida",
        "Si", "Sí", "si", "sí", "SI", "SÍ",
        "Yes", "yes", "YES",
        "TRUE", "True", "true", "1"
    ],
    "inactivo": [
        "Vencida", "vencida", "VENCIDA",
        "No vigente", "NO VIGENTE", "no vigente",
        "Pendiente", "pendiente", "PENDIENTE",
        "No", "no", "NO",
        "Sin recomendación", "Sin recomendacion", "SIN RECOMENDACION",
        "FALSE", "False", "false", "0"
    ],
    "desconocido": [
        None, "", "N/A", "n/a", "NA", "na",
        "?", "-", "Desconocido", "desconocido", " "
    ]
}

SACERDOCIO_NORMALIZADO = {
    "aaronico": [
        "Aarónico", "Aaronic", "Aaronico", "AARONICO", "Aarón",
        "Diácono", "Diacono", "DIACONO",
        "Maestro", "MAESTRO",
        "Presbítero", "Presbitero", "PRESBITERO"
    ],
    "melquisedec": [
        "Melquisedec", "Melchisedec", "MELQUISEDEC",
        "Élder", "Elder", "ELDER", "elder",
        "Presbítero (M)", "Presbitero (M)",
        "Sumo Sacerdote", "SUMO SACERDOTE"
    ],
    "no_ordenado": [
        "No ha sido ordenado", "No ordenado", "NO ORDENADO",
        "Sin ordenar", "SIN ORDENAR",
        "Pendiente", "PENDIENTE"
    ]
}

SEXO_NORMALIZADO = {
    "M": [
        "M", "Masculino", "masculino", "MASCULINO",
        "Hombre", "hombre", "HOMBRE",
        "H", "Varón", "varon", "VARON",
        "male", "Male", "MALE"
    ],
    "F": [
        "F", "Femenino", "femenino", "FEMENINO",
        "Mujer", "mujer", "MUJER",
        "female", "Female", "FEMALE"
    ]
}


# === FUNCIONES DE NORMALIZACIÓN ===

def normalizar_estado_recomendacion(valor_raw: Optional[str]) -> Tuple[Optional[bool], str]:
    """
    Normaliza el estado de recomendación
    
    Returns:
        (valor_normalizado: bool|None, categoria: str)
    """
    if valor_raw is None or str(valor_raw).strip() == "":
        return (None, "desconocido")
    
    valor_str = ' '.join(str(valor_raw).split()).strip()  # normaliza saltos de línea y espacios
    
    for categoria, valores in ESTADOS_RECOMENDACION.items():
        if valor_str in valores:
            if categoria == "activo":
                return (True, "activo")
            elif categoria == "inactivo":
                return (False, "inactivo")
            else:
                return (None, "desconocido")
    
    # Si no encuentra coincidencia, marcar como desconocido
    return (None, "desconocido")


def normalizar_sacerdocio(valor_raw: Optional[str]) -> Tuple[Optional[str], Optional[bool]]:
    """
    Normaliza el sacerdocio
    
    Returns:
        (sacerdocio_normalizado: str|None, esta_ordenado: bool|None)
    """
    if valor_raw is None or str(valor_raw).strip() in ("", "-", "N/A", "n/a", "NA", "na", "?"):
        return (None, False)  # Sin dato: no se puede inferir sexo
    
    valor_str = ' '.join(str(valor_raw).split()).strip()  # normaliza saltos de línea y espacios múltiples
    
    for categoria, valores in SACERDOCIO_NORMALIZADO.items():
        if valor_str in valores:
            if categoria in ["aaronico", "melquisedec"]:
                return (categoria, True)
            else:
                return ("no_ordenado", False)
    
    # Si no encuentra coincidencia, asumir no ordenado
    return ("no_ordenado", False)


def normalizar_sexo(valor_raw: Optional[str]) -> Optional[str]:
    """
    Normaliza el sexo
    
    Returns:
        "M", "F" o None
    """
    if valor_raw is None or str(valor_raw).strip() == "":
        return None
    
    valor_str = str(valor_raw).strip()
    
    for categoria, valores in SEXO_NORMALIZADO.items():
        if valor_str in valores:
            return categoria
    
    return None


def calcular_edad(fecha_nacimiento: Optional[date], fecha_referencia: Optional[date] = None) -> Optional[int]:
    """
    Calcula edad en años
    
    Args:
        fecha_nacimiento: Fecha de nacimiento
        fecha_referencia: Fecha de referencia (por defecto hoy)
    
    Returns:
        Edad en años o None si no se puede calcular
    """
    if not fecha_nacimiento:
        return None
    
    if not fecha_referencia:
        from datetime import datetime
        fecha_referencia = datetime.now().date()
    
    edad = fecha_referencia.year - fecha_nacimiento.year
    
    # Ajustar si aún no cumplió años
    if (fecha_referencia.month, fecha_referencia.day) < (fecha_nacimiento.month, fecha_nacimiento.day):
        edad -= 1
    
    return edad


def es_elegible_recomendacion(edad: Optional[int]) -> Optional[bool]:
    """
    Determina si es elegible para recomendación (>= 12 años)
    
    Returns:
        True si es elegible, False si no, None si no se puede determinar
    """
    if edad is None:
        return None
    return edad >= 12


def es_elegible_ordenacion(sexo: Optional[str]) -> Optional[bool]:
    """
    Determina si es elegible para ordenación (solo varones)
    
    Returns:
        True si es elegible, False si no, None si no se puede determinar
    """
    if sexo is None:
        return None
    return sexo == "M"


def validar_fecha_confirmacion(fecha: Optional[date]) -> dict:
    """
    Valida que la fecha de confirmación sea válida
    
    Returns:
        {"valido": bool, "error": str|None, "advertencia": str|None}
    """
    from datetime import datetime
    
    if not fecha:
        return {"valido": False, "error": "Fecha de confirmación requerida"}
    
    if fecha > datetime.now().date():
        return {"valido": False, "error": "Fecha no puede ser futura"}
    
    if fecha.year < 1900:
        return {"valido": False, "error": "Fecha inválida (anterior a 1900)"}
    
    # Advertencia si es muy antigua
    if fecha.year < 2020:
        return {
            "valido": True,
            "advertencia": f"Fecha antigua ({fecha.year}), verificar si es correcta"
        }
    
    return {"valido": True}


def calcular_completitud(persona_data: dict) -> float:
    """
    Calcula el % de campos completados
    
    Args:
        persona_data: Dict con los campos de la persona
    
    Returns:
        Porcentaje de completitud (0-100)
    """
    campos_importantes = [
        'nombre_preferencia',
        'fecha_confirmacion',
        'unidad',
        'sacerdocio',
        'estado_recomendacion_raw',
        'fecha_nacimiento',
        'sexo',
        'llamamientos'
    ]
    
    campos_completos = sum(
        1 for campo in campos_importantes 
        if persona_data.get(campo) and str(persona_data.get(campo)).strip()
    )
    
    return (campos_completos / len(campos_importantes)) * 100


def agregar_regla_normalizado(campo: str, valor_raw: str, categoria: str):
    """
    Agrega un nuevo valor al catálogo de normalización
    (Para valores no reconocidos que el usuario quiere agregar)
    
    Args:
        campo: "recomendacion", "sacerdocio", "sexo"
        valor_raw: Valor original a normalizar
        categoria: Categoría a la que pertenece
    """
    if campo == "recomendacion" and categoria in ESTADOS_RECOMENDACION:
        if valor_raw not in ESTADOS_RECOMENDACION[categoria]:
            ESTADOS_RECOMENDACION[categoria].append(valor_raw)
    
    elif campo == "sacerdocio" and categoria in SACERDOCIO_NORMALIZADO:
        if valor_raw not in SACERDOCIO_NORMALIZADO[categoria]:
            SACERDOCIO_NORMALIZADO[categoria].append(valor_raw)
    
    elif campo == "sexo" and categoria in SEXO_NORMALIZADO:
        if valor_raw not in SEXO_NORMALIZADO[categoria]:
            SEXO_NORMALIZADO[categoria].append(valor_raw)


def obtener_valores_desconocidos(personas: list, campo: str) -> dict:
    """
    Identifica valores que no se pudieron normalizar
    
    Args:
        personas: Lista de PersonaConverso
        campo: Campo a analizar
    
    Returns:
        {valor_raw: frecuencia}
    """
    valores_desconocidos = {}
    
    for persona in personas:
        if campo == "recomendacion":
            valor_raw = persona.estado_recomendacion_raw
            if persona.tiene_recomendacion is None and valor_raw:
                valores_desconocidos[valor_raw] = valores_desconocidos.get(valor_raw, 0) + 1
        
        elif campo == "sacerdocio":
            valor_raw = persona.sacerdocio
            if persona.sacerdocio_normalizado is None and valor_raw:
                valores_desconocidos[valor_raw] = valores_desconocidos.get(valor_raw, 0) + 1
        
        elif campo == "sexo":
            valor_raw = getattr(persona, 'sexo_raw', None)
            if persona.sexo is None and valor_raw:
                valores_desconocidos[valor_raw] = valores_desconocidos.get(valor_raw, 0) + 1
    
    return valores_desconocidos
