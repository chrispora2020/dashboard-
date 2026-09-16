import os
import unittest
from datetime import date

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.db import Base
from app.models import PersonaConverso, PeriodoKPI
from app.calculador_indicadores import CalculadorIndicadores
from app.normalizacion import normalizar_estado_recomendacion, normalizar_sexo, normalizar_sacerdocio


class ConversosTest(unittest.TestCase):
    def test_import_values(self):
        self.assertEqual(normalizar_sexo(' V '), 'M')
        self.assertTrue(normalizar_estado_recomendacion(' ACTIVA ')[0])
        for value in (None, '', 'Inactiva', 'No vigente', 'Vencida'):
            self.assertFalse(normalizar_estado_recomendacion(value)[0])
        self.assertFalse(normalizar_sacerdocio('NO HA SIDO ORDENADO')[1])
        self.assertTrue(normalizar_sacerdocio('DIÁCONO')[1])

    def test_counts_and_pending_people(self):
        engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(engine)
        with Session(engine) as session:
            rows = [
                ('menor', 11, 'F', '', 'Activa', 'Norte'),
                ('ordenado', 12, 'V', 'Diácono', 'Activa', 'Norte'),
                ('pendiente', 20, 'V', 'No ha sido ordenado', '', 'Sur'),
                ('inactiva', 30, 'F', '', 'Inactiva', 'Sur'),
                ('sin edad', None, 'F', '', 'Activa', None),
            ]
            for name, age, sex, priesthood, recommend, unit in rows:
                session.add(PersonaConverso(
                    id=name, nombre_preferencia=name, edad_al_confirmar=age,
                    sexo=sex, sacerdocio=priesthood, estado_recomendacion_raw=recommend,
                    unidad=unit, fecha_confirmacion=date(2026, 2, 1),
                    tiene_recomendacion=True, esta_ordenado=True,
                ))
            session.flush()
            calculator = CalculadorIndicadores(session)
            period = PeriodoKPI(nombre='2026', fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 12, 31))
            self.assertEqual(calculator.calcular_bautismos_conversos(period)['resumen']['real'], 5)
            result = calculator.calcular_conversos_recomendacion(period)
            self.assertEqual((result['resumen']['real'], result['resumen']['potencial']), (1, 3))
            self.assertEqual({p['nombre'] for p in result['faltantes']}, {'pendiente', 'inactiva'})
            self.assertTrue(all(p['unidad'] == 'Sur' for p in result['faltantes']))
            result = calculator.calcular_conversos_ordenados(period)
            self.assertEqual((result['resumen']['real'], result['resumen']['potencial']), (1, 2))
            self.assertEqual([p['nombre'] for p in result['faltantes']], ['pendiente'])
            self.assertEqual(calculator.calcular_conversos_ordenados(period, 'Norte')['resumen']['real'], 1)
        engine.dispose()


if __name__ == '__main__':
    unittest.main()
