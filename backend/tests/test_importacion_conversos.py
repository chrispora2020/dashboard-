import asyncio
import contextlib
import io
import os
import unittest
from unittest.mock import patch

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.db import Base
from app.models import PersonaConverso
from app.routes_conversos import import_conversos_directo
from app.routes_kpis import obtener_resumen_kpis


class ImportacionConversosTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)

    def tearDown(self):
        self.engine.dispose()

    def importar(self, filas):
        csv = 'nombre_preferencia,edad,sexo,sacerdocio,estado_recomendacion_raw,unidad,fecha_confirmación\n'
        csv += '\n'.join(filas)
        file = UploadFile(filename='conversos.csv', file=io.BytesIO(csv.encode('utf-8')))
        with Session(self.engine) as session, contextlib.redirect_stdout(io.StringIO()):
            return asyncio.run(import_conversos_directo(file, session))

    def resumen(self):
        with Session(self.engine) as session:
            return asyncio.run(obtener_resumen_kpis('2026', None, session))

    def test_reemplazo_visible_en_otra_sesion(self):
        self.importar(['Anterior,20,V,Diácono,Activa,Norte,01/02/2026'])
        resultado = self.importar([
            f'Converso {i},20,V,Diácono,Activa,Norte,01/02/2026' for i in range(93)
        ])
        self.assertEqual(resultado['total'], 93)
        resumen = self.resumen()
        self.assertEqual(resumen['indicadores'][0]['valor_real'], 93)
        self.assertEqual(resumen['lista_conversos'], {'total': 93, 'en_periodo': 93, 'fuera_periodo': 0})
        with Session(self.engine) as session:
            self.assertEqual(session.query(PersonaConverso).filter_by(nombre_preferencia='Anterior').count(), 0)

    def test_lista_vacia_conserva_datos_anteriores(self):
        self.importar(['Anterior,20,V,Diácono,Activa,Norte,01/02/2026'])
        with self.assertRaises(HTTPException):
            self.importar([])
        self.assertEqual(self.resumen()['lista_conversos']['total'], 1)

    def test_explica_diferencia_por_periodo(self):
        self.importar([
            'Actual,20,V,Diácono,Activa,Norte,01/02/2026',
            'Otro año,20,V,Diácono,Activa,Norte,01/02/2025',
        ])
        self.assertEqual(self.resumen()['lista_conversos'], {'total': 2, 'en_periodo': 1, 'fuera_periodo': 1})

    def test_error_al_guardar_conserva_lista_anterior(self):
        self.importar(['Anterior,20,V,Diácono,Activa,Norte,01/02/2026'])
        with patch.object(Session, 'commit', side_effect=RuntimeError('Error de escritura')):
            with self.assertRaises(HTTPException):
                self.importar(['Nuevo,20,V,Diácono,Activa,Sur,01/02/2026'])
        with Session(self.engine) as session:
            self.assertEqual([p.nombre_preferencia for p in session.query(PersonaConverso)], ['Anterior'])
