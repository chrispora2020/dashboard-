"""
Script para inicializar los periodos de KPI para 2026
Crea periodos mensuales, trimestrales y anuales
"""
from datetime import date
from app.db import SessionLocal
from app.models import PeriodoKPI

def initializar_periodos_2026():
    """Inicializa todos los periodos de KPI para 2026"""
    db = SessionLocal()
    
    try:
        # Verificar si ya existen periodos de 2026
        existing = db.query(PeriodoKPI).filter(
            PeriodoKPI.nombre.like('%2026%')
        ).first()
        
        if existing:
            print("❌ Los periodos de 2026 ya existen. Saltando inicialización.")
            return
        
        periodos = []
        
        # Periodos mensuales de 2026
        meses = [
            ('Enero', 1), ('Febrero', 2), ('Marzo', 3), ('Abril', 4),
            ('Mayo', 5), ('Junio', 6), ('Julio', 7), ('Agosto', 8),
            ('Septiembre', 9), ('Octubre', 10), ('Noviembre', 11), ('Diciembre', 12)
        ]
        
        for mes_nombre, mes_num in meses:
            # Calcular último día del mes
            if mes_num == 12:
                fecha_fin = date(2026, 12, 31)
            else:
                from calendar import monthrange
                ultimo_dia = monthrange(2026, mes_num)[1]
                fecha_fin = date(2026, mes_num, ultimo_dia)
            
            periodos.append(PeriodoKPI(
                nombre=f"{mes_nombre} 2026",
                tipo='mensual',
                fecha_inicio=date(2026, mes_num, 1),
                fecha_fin=fecha_fin,
                activo=True
            ))
        
        # Periodos trimestrales
        trimestres = [
            ('Q1 2026', 1, 1, 3, 31),
            ('Q2 2026', 4, 1, 6, 30),
            ('Q3 2026', 7, 1, 9, 30),
            ('Q4 2026', 10, 1, 12, 31)
        ]
        
        for nombre, mes_inicio, dia_inicio, mes_fin, dia_fin in trimestres:
            periodos.append(PeriodoKPI(
                nombre=nombre,
                tipo='trimestral',
                fecha_inicio=date(2026, mes_inicio, dia_inicio),
                fecha_fin=date(2026, mes_fin, dia_fin),
                activo=True
            ))
        
        # Periodo anual
        periodos.append(PeriodoKPI(
            nombre='2026',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        ))
        
        # Guardar todos los periodos
        db.bulk_save_objects(periodos)
        db.commit()
        
        print(f"✅ Inicialización completada: {len(periodos)} periodos creados")
        print(f"   - 12 periodos mensuales")
        print(f"   - 4 periodos trimestrales")
        print(f"   - 1 periodo anual")
        
        # Listar todos los periodos creados
        print("\nPeriodos creados:")
        for p in periodos:
            print(f"   • {p.nombre} ({p.tipo}): {p.fecha_inicio} a {p.fecha_fin}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error al inicializar periodos: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("Inicializando periodos de KPI para 2026...")
    initializar_periodos_2026()
