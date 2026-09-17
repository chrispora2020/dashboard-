"""Mapeo por encabezado: nunca deducir Unidad desde una columna de personas."""
import unicodedata


def normalizar_encabezado(value):
    text = unicodedata.normalize('NFKD', str(value or ''))
    text = ''.join(c for c in text if not unicodedata.combining(c))
    return ' '.join(text.lower().replace('_', ' ').split()).strip()


ALIASES = {
    'nombre_preferencia': ['nombre', 'nombre preferencia', 'nombre de preferencia', 'nombre completo', 'nombre y apellido'],
    'unidad': ['unidad', 'nombre de la unidad', 'unidad actual', 'barrio', 'barrio o rama'],
    'edad_al_confirmar': ['edad', 'edad al confirmar'],
    'sexo': ['sexo'],
    'sacerdocio': ['sacerdocio'],
    'estado_recomendacion_raw': ['estado recomendacion', 'estado recomendacion raw', 'estado de recomendacion', 'estado de la recomendacion', 'estado de recomendacion para el templo', 'estado de la recomendacion para el templo', 'estado', 'estado raw'],
    'llamamientos': ['llamamientos', 'llamamiento'],
    'fecha_confirmacion': ['fecha confirmacion', 'fecha de confirmacion', 'fecha de la confirmacion'],
    'fecha_nacimiento': ['fecha nacimiento', 'fecha de nacimiento'],
    'vencimiento_raw': ['vencimiento', 'vencimiento raw', 'fecha de vencimiento', 'fecha de vencimiento de la recomendacion'],
}


def mapear_columnas(columnas):
    result = {}
    for column in columnas:
        normalized = normalizar_encabezado(column)
        for field, aliases in ALIASES.items():
            if normalized in aliases:
                if field in result.values():
                    raise ValueError(f'Hay dos columnas para {field}. Revise los encabezados de la lista.')
                result[column] = field
                break
    return result


def mapear_conversos(columnas):
    result = mapear_columnas(columnas)
    if 'nombre_preferencia' not in result.values() or 'unidad' not in result.values():
        raise ValueError('No se identificaron las columnas Nombre y Unidad. Conserve los encabezados de la lista original.')
    return result


def encabezado_pdf(filas):
    for index, row in enumerate(filas):
        mapped = mapear_columnas([c for c in row if c])
        if 'nombre_preferencia' in mapped.values() and 'unidad' in mapped.values():
            return index, [' '.join(str(c).split()) if c else f'col_{i + 1}' for i, c in enumerate(row)]
    raise ValueError('El PDF no contiene un encabezado identificable con Nombre y Unidad.')


def mapear_recomendaciones(df):
    mapping = mapear_columnas(df.columns)
    if 'nombre_preferencia' not in mapping.values() or 'unidad' not in mapping.values():
        raise ValueError('La lista debe incluir las columnas Nombre y Unidad.')
    targets = {'nombre_preferencia': 'nombre', 'edad_al_confirmar': 'edad', 'estado_recomendacion_raw': 'estado_raw'}
    return df.rename(columns={source: targets.get(field, field) for source, field in mapping.items()})
