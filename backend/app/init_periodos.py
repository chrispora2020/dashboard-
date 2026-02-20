"""
Script para inicializar los periodos de KPI para 2026.
Crea periodos mensuales, trimestrales y anual.
"""
from calendar import monthrange
from datetime import date

from app.db import SessionLocal
from app.models import PeriodoKPI


def inicializar_periodos_2026():
    """Inicializa todos los periodos de KPI para 2026."""
    db = SessionLocal()

    try:
        existing = db.query(PeriodoKPI).filter(PeriodoKPI.year == 2026).first()
        if existing:
            print("Los periodos de 2026 ya existen. Saltando inicializacion.")
            return

        periodos = []

        meses = [
            ('Enero', 1), ('Febrero', 2), ('Marzo', 3), ('Abril', 4),
            ('Mayo', 5), ('Junio', 6), ('Julio', 7), ('Agosto', 8),
            ('Septiembre', 9), ('Octubre', 10), ('Noviembre', 11), ('Diciembre', 12)
        ]
        for mes_nombre, mes_num in meses:
            ultimo_dia = monthrange(2026, mes_num)[1]
            periodos.append(PeriodoKPI(
                nombre=f"{mes_nombre} 2026",
                tipo='mes',
                fecha_inicio=date(2026, mes_num, 1),
                fecha_fin=date(2026, mes_num, ultimo_dia),
                year=2026
            ))

        trimestres = [
            ('Q1 2026', 1, 1, 3, 31),
            ('Q2 2026', 4, 1, 6, 30),
            ('Q3 2026', 7, 1, 9, 30),
            ('Q4 2026', 10, 1, 12, 31)
        ]
        for nombre, mes_inicio, dia_inicio, mes_fin, dia_fin in trimestres:
            periodos.append(PeriodoKPI(
                nombre=nombre,
                tipo='trimestre',
                fecha_inicio=date(2026, mes_inicio, dia_inicio),
                fecha_fin=date(2026, mes_fin, dia_fin),
                year=2026
            ))

        periodos.append(PeriodoKPI(
            nombre='2026',
            tipo='año',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            year=2026
        ))

        db.bulk_save_objects(periodos)
        db.commit()
        print(f"Inicializacion completada: {len(periodos)} periodos creados")

    except Exception as e:
        db.rollback()
        print(f"Error al inicializar periodos: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Inicializando periodos de KPI para 2026...")
    inicializar_periodos_2026()
