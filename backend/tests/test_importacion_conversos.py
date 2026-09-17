import asyncio
import contextlib
import io
import os
import unittest
from unittest.mock import patch
from types import SimpleNamespace

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.db import Base
from app.models import PersonaConverso
from app.routes_conversos import import_conversos_directo, _leer_pdf_conversos
from app.routes_kpis import obtener_resumen_kpis
from app.columnas_listas import mapear_conversos, encabezado_pdf, mapear_recomendaciones
import pandas as pd


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

    def test_unidad_desde_encabezado_aunque_cambie_el_orden(self):
        csv = 'Sexo,Nombre de la unidad,Nombre de preferencia,Edad,Fecha de la confirmación\nV,Unidad Norte,Persona Ejemplo,20,01/02/2026'
        file = UploadFile(filename='conversos.csv', file=io.BytesIO(csv.encode('utf-8')))
        with Session(self.engine) as session, contextlib.redirect_stdout(io.StringIO()):
            asyncio.run(import_conversos_directo(file, session))
        with Session(self.engine) as session:
            persona = session.query(PersonaConverso).one()
            self.assertEqual(persona.unidad, 'Unidad Norte')
            self.assertEqual(persona.nombre_preferencia, 'Persona Ejemplo')

    def test_encabezado_pdf_despues_del_titulo(self):
        index, columns = encabezado_pdf([
            ['Lista Nuevos conversos', None, None],
            ['Nombre de\npreferencia', 'Sexo', 'Unidad'],
            ['Persona Ejemplo', 'V', 'Unidad Norte'],
        ])
        self.assertEqual(index, 1)
        self.assertEqual(mapear_conversos(columns)['Unidad'], 'unidad')

    def test_recomendaciones_no_intercambian_nombre_y_unidad(self):
        df = pd.DataFrame([['Unidad Norte', 'Activa', 'Persona Ejemplo']], columns=['Unidad', 'Estado de la recomendación', 'Nombre'])
        mapped = mapear_recomendaciones(df)
        self.assertEqual(mapped.iloc[0]['unidad'], 'Unidad Norte')
        self.assertEqual(mapped.iloc[0]['nombre'], 'Persona Ejemplo')

    def test_falta_unidad_no_se_deduce_de_nombres(self):
        with self.assertRaises(ValueError):
            mapear_conversos(['Nombre', 'Sexo', 'Nombre de un familiar'])

    def test_pdf_fila_fusionada_respeta_limites_de_unidad(self):
        # El extractor de tablas mezcla el nombre con la unidad; el texto físico
        # de cada columna mantiene el dato correcto, incluso con saltos de línea.
        table = SimpleNamespace(
            extract=lambda: [['Nombre', 'Unidad'], ['Apellido, Nombre Barrio Libia Nombre', None]],
            rows=[
                SimpleNamespace(cells=[(0, 0, 100, 20), (100, 0, 200, 20)]),
                SimpleNamespace(bbox=(0, 20, 200, 60)),
            ],
        )
        page = SimpleNamespace(
            find_tables=lambda: [table],
            crop=lambda box: SimpleNamespace(extract_text=lambda: 'Apellido, Nombre' if box[0] == 0 else 'Barrio\nLibia'),
        )
        df = _leer_pdf_conversos(SimpleNamespace(pages=[page]))
        self.assertEqual(df.iloc[0]['Unidad'], 'Barrio\nLibia')
        self.assertEqual(df.iloc[0]['Nombre'], 'Apellido, Nombre')
