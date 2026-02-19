"""
Rutas para KPIs y periodos
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from . import db
from .models import PeriodoKPI
from .schemas import (
    PeriodoCreate, PeriodoOut, IndicadorDetalle,
    IndicadorTendencia, BreakdownUnidad
)
from .calculador_indicadores import CalculadorIndicadores, INDICADORES_CONFIG

router = APIRouter(prefix='/kpis', tags=['kpis'])


# === PERIODOS ===

@router.get('/periodos', response_model=List[PeriodoOut])
async def listar_periodos(
    year: Optional[int] = None,
    tipo: Optional[str] = Query(None, regex="^(mes|trimestre|año)$"),
    db_session: Session = Depends(db.get_db)
):
    """
    Lista periodos disponibles
    """
    query = db_session.query(PeriodoKPI)
    
    if year:
        query = query.filter(PeriodoKPI.year == year)
    
    if tipo:
        query = query.filter(PeriodoKPI.tipo == tipo)
    
    periodos = query.order_by(PeriodoKPI.fecha_inicio).all()
    return periodos


@router.post('/periodos', response_model=PeriodoOut)
async def crear_periodo(
    periodo: PeriodoCreate,
    db_session: Session = Depends(db.get_db)
):
    """
    Crea un nuevo periodo personalizado
    """
    periodo_db = PeriodoKPI(**periodo.dict())
    db_session.add(periodo_db)
    db_session.commit()
    db_session.refresh(periodo_db)
    
    return periodo_db


# === INDICADORES - RESUMEN ===

@router.get('/resumen')
async def obtener_resumen_kpis(
    periodo: str = Query(..., description="Nombre del periodo (ej: '2026', 'Enero 2026', 'Q1 2026')"),
    unidad: Optional[str] = None,
    db_session: Session = Depends(db.get_db)
):
    """
    Dashboard principal - todos los KPIs resumidos
    """
    # Buscar periodo por nombre
    periodo_obj = db_session.query(PeriodoKPI).filter(PeriodoKPI.nombre == periodo).first()
    if not periodo_obj:
        # Si no hay periodo o no hay datos, devolver estructura vacía
        return {
            "periodo": periodo,
            "indicadores": []
        }
    
    calculador = CalculadorIndicadores(db_session)
    indicadores = calculador.calcular_todos_indicadores(periodo_obj, unidad)
    
    # Simplificar para dashboard
    resumen = []
    for ind in indicadores:
        resumen.append({
            "indicador_id": ind["indicador"],
            "indicador": ind["indicador"],
            "nombre": ind["nombre"],
            "valor_real": ind["resumen"]["real"],
            "real": ind["resumen"]["real"],
            "potencial": ind["resumen"]["potencial"],
            "porcentaje_logro": ind["resumen"].get("porcentaje", 0),
            "porcentaje": ind["resumen"].get("porcentaje", 0),
            "meta": ind["resumen"]["meta"],
            "semaforo": ind["resumen"]["estado_semaforo"]
        })
    
    return {
        "periodo": periodo,
        "indicadores": resumen
    }


# === INDICADORES - DETALLE ===

@router.get('/{indicador_key}')
async def obtener_detalle_indicador(
    indicador_key: str,
    periodo: str = Query(..., description="Nombre del periodo"),
    unidad: Optional[str] = None,
    db_session: Session = Depends(db.get_db)
):
    """
    Detalle completo de un indicador específico
    """
    if indicador_key not in INDICADORES_CONFIG:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    
    periodo_obj = db_session.query(PeriodoKPI).filter(PeriodoKPI.nombre == periodo).first()
    if not periodo_obj:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    
    calculador = CalculadorIndicadores(db_session)
    
    if indicador_key == "bautismos_conversos":
        resultado = calculador.calcular_bautismos_conversos(periodo_obj, unidad)
    elif indicador_key == "conversos_recomendacion":
        resultado = calculador.calcular_conversos_recomendacion(periodo_obj, unidad)
    elif indicador_key == "conversos_ordenados":
        resultado = calculador.calcular_conversos_ordenados(periodo_obj, unidad)
    else:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    
    # Agregar breakdown por unidad si no se filtró por unidad
    if not unidad:
        resultado["por_unidad"] = calculador.calcular_breakdown_unidades(indicador_key, periodo_obj)
    else:
        resultado["por_unidad"] = []
    
    # Agregar metainformación
    resultado["meta_info"] = {
        "total_conversos": len(resultado["personas_ids"]),
        "calculado_en": periodo_obj.created_at if hasattr(periodo_obj, 'created_at') else None,
        "requiere_enriquecimiento": len(resultado.get("advertencias", [])) > 0,
        "fuentes": []  # TODO: agregar archivos fuente
    }
    
    return resultado


# === TENDENCIA ===

@router.get('/{indicador_key}/tendencia', response_model=List[IndicadorTendencia])
async def obtener_tendencia(
    indicador_key: str,
    periodo: str = Query(..., description="Periodo base (ej: '2026')"),
    unidad: Optional[str] = None,
    db_session: Session = Depends(db.get_db)
):
    """
    Datos de tendencia mensual para gráficos
    """
    if indicador_key not in INDICADORES_CONFIG:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    
    # Extraer año del periodo (ej: '2026' o 'Q1 2026' -> 2026)
    import re
    year_match = re.search(r'\d{4}', periodo)
    if not year_match:
        raise HTTPException(status_code=400, detail="No se pudo extraer el año del periodo")
    year = int(year_match.group())
    
    calculador = CalculadorIndicadores(db_session)
    tendencia = calculador.calcular_tendencia(indicador_key, year, unidad)
    
    return tendencia


# === BREAKDOWN POR UNIDAD ===

@router.get('/{indicador_key}/breakdown', response_model=List[BreakdownUnidad])
async def obtener_breakdown(
    indicador_key: str,
    periodo: str = Query(..., description="Nombre del periodo"),
    db_session: Session = Depends(db.get_db)
):
    """
    Breakdown por unidad o categoría
    """
    if indicador_key not in INDICADORES_CONFIG:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    
    periodo_obj = db_session.query(PeriodoKPI).filter(PeriodoKPI.nombre == periodo).first()
    if not periodo_obj:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    
    calculador = CalculadorIndicadores(db_session)
    breakdown = calculador.calcular_breakdown_unidades(indicador_key, periodo_obj)
    
    return breakdown


# === FALTANTES ===

@router.get('/{indicador_key}/faltantes')
async def obtener_faltantes(
    indicador_key: str,
    periodo: str = Query(..., description="Nombre del periodo"),
    unidad: Optional[str] = None,
    db_session: Session = Depends(db.get_db)
):
    """
    Lista de personas que faltan para cumplir meta
    """
    if indicador_key not in INDICADORES_CONFIG:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    
    periodo_obj = db_session.query(PeriodoKPI).filter(PeriodoKPI.nombre == periodo).first()
    if not periodo_obj:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    
    calculador = CalculadorIndicadores(db_session)
    
    if indicador_key == "bautismos_conversos":
        resultado = calculador.calcular_bautismos_conversos(periodo_obj, unidad)
    elif indicador_key == "conversos_recomendacion":
        resultado = calculador.calcular_conversos_recomendacion(periodo_obj, unidad)
    elif indicador_key == "conversos_ordenados":
        resultado = calculador.calcular_conversos_ordenados(periodo_obj, unidad)
    else:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    
    return resultado.get("faltantes", [])

# === UTILIDADES - INICIALIZACIÓN ===

@router.post('/periodos/inicializar-2026')
async def inicializar_periodos_2026(db_session: Session = Depends(db.get_db)):
    """
    Inicializa todos los periodos de 2026 (12 mensuales, 4 trimestrales, 1 anual)
    """
    from datetime import date
    from calendar import monthrange
    
    # Verificar si ya existen periodos de 2026
    existing = db_session.query(PeriodoKPI).filter(
        PeriodoKPI.nombre.like('%2026%')
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="Los periodos de 2026 ya existen. Elimínalos primero si quieres recrearlos."
        )
    
    periodos_creados = []
    
    # Periodos mensuales
    meses = [
        ('Enero', 1), ('Febrero', 2), ('Marzo', 3), ('Abril', 4),
        ('Mayo', 5), ('Junio', 6), ('Julio', 7), ('Agosto', 8),
        ('Septiembre', 9), ('Octubre', 10), ('Noviembre', 11), ('Diciembre', 12)
    ]
    
    for mes_nombre, mes_num in meses:
        ultimo_dia = monthrange(2026, mes_num)[1]
        periodo = PeriodoKPI(
            nombre=f"{mes_nombre} 2026",
            tipo='mensual',
            fecha_inicio=date(2026, mes_num, 1),
            fecha_fin=date(2026, mes_num, ultimo_dia),
            activo=True
        )
        db_session.add(periodo)
        periodos_creados.append(periodo.nombre)
    
    # Periodos trimestrales
    trimestres = [
        ('Q1 2026', 1, 1, 3, 31),
        ('Q2 2026', 4, 1, 6, 30),
        ('Q3 2026', 7, 1, 9, 30),
        ('Q4 2026', 10, 1, 12, 31)
    ]
    
    for nombre, mes_inicio, dia_inicio, mes_fin, dia_fin in trimestres:
        periodo = PeriodoKPI(
            nombre=nombre,
            tipo='trimestral',
            fecha_inicio=date(2026, mes_inicio, dia_inicio),
            fecha_fin=date(2026, mes_fin, dia_fin),
            activo=True
        )
        db_session.add(periodo)
        periodos_creados.append(periodo.nombre)
    
    # Periodo anual
    periodo = PeriodoKPI(
        nombre='2026',
        tipo='anual',
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 12, 31),
        activo=True
    )
    db_session.add(periodo)
    periodos_creados.append(periodo.nombre)
    
    db_session.commit()
    
    return {
        "message": "Periodos de 2026 inicializados exitosamente",
        "total_periodos": len(periodos_creados),
        "periodos": periodos_creados
    }