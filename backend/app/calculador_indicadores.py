"""
Lógica de cálculo de indicadores KPI
"""
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from datetime import date

from .models import PersonaConverso, PeriodoKPI, IndicadorKPI
from .normalizacion import es_elegible_recomendacion, es_elegible_ordenacion


# === DEFINICIÓN DE INDICADORES ===

INDICADORES_CONFIG = {
    "bautismos_conversos": {
        "nombre": "Bautismos de Conversos",
        "meta_anual": 168,
        "tipo": "acumulativo"
    },
    "conversos_recomendacion": {
        "nombre": "Conversos con Recomendación",
        "meta": 100,  # 100%
        "tipo": "porcentaje"
    },
    "conversos_ordenados": {
        "nombre": "Conversos Ordenados",
        "meta": 100,  # 100%
        "tipo": "porcentaje"
    }
}


class CalculadorIndicadores:
    """Clase para calcular indicadores KPI"""
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def calcular_bautismos_conversos(
        self, 
        periodo: PeriodoKPI,
        unidad: Optional[str] = None
    ) -> Dict:
        """
        Calcula indicador: Bautismos de Conversos
        
        REAL = COUNT(confirmaciones en el periodo)
        POTENCIAL = REAL (evento ya ocurrió)
        % AVANCE = (REAL / META) * 100
        """
        query = self.db.query(PersonaConverso).filter(
            PersonaConverso.fecha_confirmacion >= periodo.fecha_inicio,
            PersonaConverso.fecha_confirmacion <= periodo.fecha_fin
        )
        
        if unidad:
            query = query.filter(PersonaConverso.unidad == unidad)
        
        personas = query.all()
        real = len(personas)
        potencial = real
        meta = INDICADORES_CONFIG["bautismos_conversos"]["meta_anual"]
        
        # Calcular porcentaje vs meta anual
        porcentaje_meta = (real / meta * 100) if meta > 0 else 0
        
        # Determinar estado semáforo
        estado = self._calcular_semaforo(porcentaje_meta, tipo="acumulativo")
        
        return {
            "indicador": "bautismos_conversos",
            "nombre": INDICADORES_CONFIG["bautismos_conversos"]["nombre"],
            "periodo": {
                "id": periodo.id,
                "nombre": periodo.nombre,
                "fecha_inicio": periodo.fecha_inicio,
                "fecha_fin": periodo.fecha_fin
            },
            "resumen": {
                "real": real,
                "potencial": potencial,
                "porcentaje": None,  # No aplica para acumulativo
                "meta": meta,
                "diferencia_meta": real - meta,
                "porcentaje_meta": porcentaje_meta,
                "estado_semaforo": estado
            },
            "breakdown": {
                "total_conversos": real,
                "por_mes": self._breakdown_por_mes(personas, periodo)
            },
            "personas_ids": [p.id for p in personas],
            "personas": [{"nombre": p.nombre_preferencia, "unidad": p.unidad or ''} for p in personas],
            "potenciales": [],
            "reales": [],
            "faltantes": [],  # No aplica para acumulativos
            "advertencias": []
        }
    
    def calcular_conversos_recomendacion(
        self,
        periodo: PeriodoKPI,
        unidad: Optional[str] = None
    ) -> Dict:
        """
        Calcula indicador: Conversos con Recomendación
        
        ELEGIBLES = mayores de 12 años
        REAL = ELEGIBLES con recomendación activa
        % = REAL / ELEGIBLES * 100
        """
        query = self.db.query(PersonaConverso).filter(
            PersonaConverso.fecha_confirmacion >= periodo.fecha_inicio,
            PersonaConverso.fecha_confirmacion <= periodo.fecha_fin
        )
        
        if unidad:
            query = query.filter(PersonaConverso.unidad == unidad)
        

        todas_personas = query.all()

        # Clasificar por elegibilidad (mayores de 12 años)
        elegibles = {}
        con_recomendacion = {}
        sin_recomendacion = {}
        no_elegibles = []
        sin_clasificar = []
        for persona in todas_personas:
            edad = persona.edad_al_confirmar if persona.edad_al_confirmar is not None else 18
            if edad > 12:
                elegibles[persona.id] = persona
                if persona.tiene_recomendacion is True:
                    con_recomendacion[persona.id] = persona
                else:
                    sin_recomendacion[persona.id] = persona
            else:
                no_elegibles.append(persona)

        elegibles = list(elegibles.values())
        con_recomendacion = list(con_recomendacion.values())
        sin_recomendacion = list(sin_recomendacion.values())
        
        # Calcular resultados
        total_elegibles = len(elegibles)
        real = len(con_recomendacion)
        porcentaje = (real / total_elegibles * 100) if total_elegibles > 0 else 0
        
        estado = self._calcular_semaforo(porcentaje if porcentaje else 0)
        
        # Preparar advertencias
        advertencias = []
        if len(sin_clasificar) > 0:
            advertencias.append({
                "tipo": "datos_incompletos",
                "mensaje": f"{len(sin_clasificar)} personas sin dato de edad",
                "cantidad": len(sin_clasificar),
                "accion_sugerida": "enriquecer_datos"
            })
        if total_elegibles == 0:
            advertencias.append({
                "tipo": "sin_elegibles",
                "mensaje": "No hay conversos elegibles para recomendación en el periodo.",
                "cantidad": 0
            })
        
        return {
            "indicador": "conversos_recomendacion",
            "nombre": INDICADORES_CONFIG["conversos_recomendacion"]["nombre"],
            "periodo": {
                "id": periodo.id,
                "nombre": periodo.nombre,
                "fecha_inicio": periodo.fecha_inicio,
                "fecha_fin": periodo.fecha_fin
            },
            "resumen": {
                "real": real,
                "potencial": total_elegibles,
                "porcentaje": porcentaje,
                "meta": 100,
                "diferencia_meta": porcentaje - 100,
                "estado_semaforo": estado,
                "comentario": advertencias[-1]["mensaje"] if total_elegibles == 0 else ""
            },
            "breakdown": {
                "elegibles": total_elegibles,
                "no_elegibles": len(no_elegibles),
                "sin_clasificar": len(sin_clasificar),
                "con_recomendacion_activa": real,
                "sin_recomendacion": len(sin_recomendacion)
            },
            "potenciales": [{"nombre": p.nombre_preferencia, "unidad": p.unidad} for p in elegibles],
            "reales": [{"nombre": p.nombre_preferencia, "unidad": p.unidad} for p in con_recomendacion],
            "faltantes": self._preparar_faltantes(
                sin_recomendacion,
                "Sin recomendación activa"
            ),
            "personas_ids": [p.id for p in elegibles],
            "faltantes_ids": [p.id for p in sin_recomendacion],
            "advertencias": advertencias
        }
    
    def calcular_conversos_ordenados(
        self,
        periodo: PeriodoKPI,
        unidad: Optional[str] = None
    ) -> Dict:
        """
        Calcula indicador: Conversos Ordenados
        
        ELEGIBLES = varones
        REAL = ELEGIBLES ordenados (con sacerdocio)
        % = REAL / ELEGIBLES * 100
        """
        query = self.db.query(PersonaConverso).filter(
            PersonaConverso.fecha_confirmacion >= periodo.fecha_inicio,
            PersonaConverso.fecha_confirmacion <= periodo.fecha_fin
        )
        
        if unidad:
            query = query.filter(PersonaConverso.unidad == unidad)
        
        todas_personas = query.all()
        
        # Clasificar por elegibilidad (varones mayores de 12 años)
        elegibles = {}
        ordenados = {}
        sin_ordenar = {}
        no_elegibles = []
        sin_clasificar = []
        for persona in todas_personas:
            # Es varón si sexo = 'M' explícito
            es_varon = (persona.sexo is not None and persona.sexo.upper() == 'M')
            # Si no hay sexo, mirar sacerdocio_normalizado (solo valores explícitos son indicador de varón)
            # 'no_ordenado' solo aparece cuando el archivo dice "No ha sido ordenado" (nunca para null/vacío)
            if not es_varon and persona.sacerdocio_normalizado in ['aaronico', 'melquisedec', 'no_ordenado']:
                es_varon = True
            if es_varon:
                elegibles[persona.id] = persona
                if persona.esta_ordenado is True:
                    ordenados[persona.id] = persona
                else:
                    sin_ordenar[persona.id] = persona
            else:
                no_elegibles.append(persona)

        elegibles = list(elegibles.values())
        ordenados = list(ordenados.values())
        sin_ordenar = list(sin_ordenar.values())
        
        # Calcular resultados
        total_elegibles = len(elegibles)
        real = len(ordenados)
        porcentaje = (real / total_elegibles * 100) if total_elegibles > 0 else 0
        
        estado = self._calcular_semaforo(porcentaje if porcentaje else 0)
        
        # Preparar advertencias
        advertencias = []
        if len(sin_clasificar) > 0:
            advertencias.append({
                "tipo": "datos_incompletos",
                "mensaje": f"{len(sin_clasificar)} personas sin dato de sexo o edad",
                "cantidad": len(sin_clasificar),
                "accion_sugerida": "enriquecer_datos"
            })
        if total_elegibles == 0:
            advertencias.append({
                "tipo": "sin_elegibles",
                "mensaje": "No hay conversos varones elegibles para ordenación en el periodo.",
                "cantidad": 0
            })
        return {
            "indicador": "conversos_ordenados",
            "nombre": INDICADORES_CONFIG["conversos_ordenados"]["nombre"],
            "periodo": {
                "id": periodo.id,
                "nombre": periodo.nombre,
                "fecha_inicio": periodo.fecha_inicio,
                "fecha_fin": periodo.fecha_fin
            },
            "resumen": {
                "real": real,
                "potencial": total_elegibles,
                "porcentaje": porcentaje,
                "meta": 100,
                "diferencia_meta": porcentaje - 100,
                "estado_semaforo": estado,
                "comentario": advertencias[-1]["mensaje"] if total_elegibles == 0 else ""
            },
            "breakdown": {
                "elegibles": total_elegibles,
                "no_elegibles": len(no_elegibles),
                "sin_clasificar": len(sin_clasificar),
                "varones_ordenados": real,
                "varones_sin_ordenar": len(sin_ordenar),
                "mujeres": len(no_elegibles)
            },
            "potenciales": [{"nombre": p.nombre_preferencia, "unidad": p.unidad} for p in elegibles],
            "reales": [{"nombre": p.nombre_preferencia, "unidad": p.unidad} for p in ordenados],
            "faltantes": self._preparar_faltantes(
                sin_ordenar,
                "No ordenado"
            ),
            "personas_ids": [p.id for p in elegibles],
            "faltantes_ids": [p.id for p in sin_ordenar],
            "advertencias": advertencias
        }
    
    def calcular_todos_indicadores(
        self,
        periodo: PeriodoKPI,
        unidad: Optional[str] = None
    ) -> List[Dict]:
        """
        Calcula todos los indicadores para un periodo
        """
        return [
            self.calcular_bautismos_conversos(periodo, unidad),
            self.calcular_conversos_recomendacion(periodo, unidad),
            self.calcular_conversos_ordenados(periodo, unidad)
        ]
    
    def calcular_tendencia(
        self,
        indicador_key: str,
        year: int,
        unidad: Optional[str] = None
    ) -> List[Dict]:
        """
        Calcula tendencia mensual de un indicador para graficar
        """
        periodos = self.db.query(PeriodoKPI).filter(
            PeriodoKPI.year == year,
            PeriodoKPI.tipo == "mes"
        ).order_by(PeriodoKPI.fecha_inicio).all()
        
        tendencia = []
        for periodo in periodos:
            if indicador_key == "bautismos_conversos":
                resultado = self.calcular_bautismos_conversos(periodo, unidad)
            elif indicador_key == "conversos_recomendacion":
                resultado = self.calcular_conversos_recomendacion(periodo, unidad)
            elif indicador_key == "conversos_ordenados":
                resultado = self.calcular_conversos_ordenados(periodo, unidad)
            else:
                continue
            
            tendencia.append({
                "periodo": periodo.nombre,
                "real": resultado["resumen"]["real"],
                "potencial": resultado["resumen"]["potencial"],
                "porcentaje": resultado["resumen"].get("porcentaje")
            })
        
        return tendencia
    
    def calcular_breakdown_unidades(
        self,
        indicador_key: str,
        periodo: PeriodoKPI
    ) -> List[Dict]:
        """
        Calcula breakdown por unidad
        """
        # Obtener todas las unidades del periodo
        unidades = self.db.query(PersonaConverso.unidad).filter(
            PersonaConverso.fecha_confirmacion >= periodo.fecha_inicio,
            PersonaConverso.fecha_confirmacion <= periodo.fecha_fin,
            PersonaConverso.unidad.isnot(None)
        ).distinct().all()
        
        breakdown = []
        for (unidad,) in unidades:
            if indicador_key == "bautismos_conversos":
                resultado = self.calcular_bautismos_conversos(periodo, unidad)
            elif indicador_key == "conversos_recomendacion":
                resultado = self.calcular_conversos_recomendacion(periodo, unidad)
            elif indicador_key == "conversos_ordenados":
                resultado = self.calcular_conversos_ordenados(periodo, unidad)
            else:
                continue
            
            breakdown.append({
                "unidad": unidad,
                "real": resultado["resumen"]["real"],
                "potencial": resultado["resumen"]["potencial"],
                "porcentaje": resultado["resumen"].get("porcentaje")
            })
        
        return sorted(breakdown, key=lambda x: x["real"], reverse=True)
    
    # === HELPERS ===
    
    def _calcular_semaforo(self, porcentaje: float, tipo: str = "porcentaje") -> str:
        """
        Determina color de semáforo según porcentaje
        
        Verde: >= 90%
        Amarillo: >= 70%
        Rojo: < 70%
        """
        if porcentaje >= 90:
            return "verde"
        elif porcentaje >= 70:
            return "amarillo"
        else:
            return "rojo"
    
    def _preparar_faltantes(self, personas: List[PersonaConverso], razon: str) -> List[Dict]:
        """
        Prepara lista de personas faltantes para el detalle
        """
        from datetime import datetime
        
        faltantes = []
        for persona in personas:
            dias_desde = None
            if persona.fecha_confirmacion:
                dias_desde = (datetime.now().date() - persona.fecha_confirmacion).days
            
            faltantes.append({
                "id": persona.id,
                "nombre": persona.nombre_preferencia,
                "unidad": persona.unidad,
                "estado_actual": razon,
                "fecha_confirmacion": persona.fecha_confirmacion,
                "dias_desde_confirmacion": dias_desde
            })
        
        return faltantes
    
    def _breakdown_por_mes(self, personas: List[PersonaConverso], periodo: PeriodoKPI) -> Dict:
        """
        Agrupa personas por mes dentro del periodo
        """
        from collections import defaultdict
        
        por_mes = defaultdict(int)
        for persona in personas:
            if persona.fecha_confirmacion:
                mes = persona.fecha_confirmacion.strftime('%Y-%m')
                por_mes[mes] += 1
        
        return dict(por_mes)
