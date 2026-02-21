from __future__ import annotations

from statistics import mean
from typing import Any

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix='/lcr', tags=['lcr'])

UNIDADES_ASISTENCIA = {
    'Bella Italia': 238619,
    'Belloni': 204625,
    'Libia': 181420,
    'Los Ceibos': 209392,
    'Montevideo 14': 97829,
    'Pando': 219444,
    'Toledo': 207462,
}


class LcrIndicadoresBody(BaseModel):
    year: int = Field(default=2026, ge=2000, le=2100)
    lang: str = Field(default='spa', min_length=2, max_length=8)
    cookie: str | None = None
    authorization: str | None = None



def _extract_values(payload: Any) -> list[float]:
    values: list[float] = []

    if isinstance(payload, dict):
        for key, value in payload.items():
            if key == 'value' and isinstance(value, (int, float)):
                values.append(float(value))
            else:
                values.extend(_extract_values(value))
    elif isinstance(payload, list):
        for item in payload:
            values.extend(_extract_values(item))

    return values



def _safe_json(response: requests.Response, endpoint: str) -> Any:
    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=f'LCR devolvió una respuesta inválida en {endpoint}',
        ) from exc



def _build_headers(body: LcrIndicadoresBody) -> dict[str, str]:
    headers = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 KPI Dashboard',
    }

    if body.cookie:
        headers['Cookie'] = body.cookie.strip()

    if body.authorization:
        headers['Authorization'] = body.authorization.strip()

    return headers



@router.post('/indicadores')
def obtener_indicadores_lcr(body: LcrIndicadoresBody):
    headers = _build_headers(body)
    timeout = 20

    asistencia_unidades: list[dict[str, Any]] = []

    for nombre, unidad in UNIDADES_ASISTENCIA.items():
        endpoint = f'https://lcr.churchofjesuschrist.org/api/sacrament-attendance/unit/{unidad}/years/{body.year}?lang={body.lang}'
        try:
            response = requests.get(endpoint, headers=headers, timeout=timeout)
        except requests.RequestException as exc:
            raise HTTPException(status_code=502, detail=f'No se pudo consultar LCR para {nombre}: {exc}') from exc

        if response.status_code in (401, 403):
            raise HTTPException(
                status_code=401,
                detail='LCR rechazó la autenticación. Revisa cookie/authorization de sesión.',
            )

        if not response.ok:
            raise HTTPException(
                status_code=502,
                detail=f'LCR respondió {response.status_code} para {nombre}',
            )

        payload = _safe_json(response, endpoint)
        valores = _extract_values(payload)
        promedio = mean(valores) if valores else 0.0

        asistencia_unidades.append({
            'unidad': nombre,
            'unidad_id': unidad,
            'cantidad_muestras': len(valores),
            'promedio': round(promedio, 2),
            'suma': round(sum(valores), 2),
        })

    total_asistencia = round(sum(item['promedio'] for item in asistencia_unidades), 2)

    youth_endpoint = (
        'https://lcr.churchofjesuschrist.org/api/temple-recommend/youth-report'
        '?unitNumber=511927&loadTableData=true&lang=spa'
    )

    try:
        youth_response = requests.get(youth_endpoint, headers=headers, timeout=timeout)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f'No se pudo consultar reporte de jóvenes: {exc}') from exc

    if youth_response.status_code in (401, 403):
        raise HTTPException(
            status_code=401,
            detail='LCR rechazó la autenticación para jóvenes. Revisa cookie/authorization de sesión.',
        )

    if not youth_response.ok:
        raise HTTPException(
            status_code=502,
            detail=f'LCR respondió {youth_response.status_code} para jóvenes',
        )

    youth_payload = _safe_json(youth_response, youth_endpoint)

    table_data = []
    if isinstance(youth_payload, dict):
        for key in ('tableData', 'rows', 'data'):
            maybe_rows = youth_payload.get(key)
            if isinstance(maybe_rows, list):
                table_data = maybe_rows
                break

    total_jovenes = len(table_data)

    activos = 0
    vence_pronto = 0

    for row in table_data:
        if not isinstance(row, dict):
            continue
        estado = str(
            row.get('status')
            or row.get('recommendStatus')
            or row.get('estado')
            or row.get('state')
            or ''
        ).lower()

        if any(token in estado for token in ('active', 'activa', 'vigente')):
            activos += 1
        if any(token in estado for token in ('expires soon', 'vence pronto', 'expiring')):
            vence_pronto += 1

    jovenes_activos_total = activos + vence_pronto
    porcentaje_jovenes = round((jovenes_activos_total / total_jovenes) * 100, 2) if total_jovenes else 0

    return {
        'year': body.year,
        'asistencia': {
            'indicador': 'asistencia_sacramental',
            'total': total_asistencia,
            'unidades': asistencia_unidades,
            'meta': 550,
            'porcentaje_logro': round((total_asistencia / 550) * 100, 2),
        },
        'jovenes_recomendacion': {
            'indicador': 'jovenes_recomendacion',
            'total_jovenes': total_jovenes,
            'activos_mas_vence_pronto': jovenes_activos_total,
            'activos': activos,
            'vence_pronto': vence_pronto,
            'porcentaje': porcentaje_jovenes,
            'meta': 100,
        },
    }
