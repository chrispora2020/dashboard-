import json
import os
from datetime import datetime
from typing import Any

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import AppSetting

router = APIRouter(tags=["meeting-ai"])

SYSTEM_PROMPT = """Actúa como un asistente inteligente especializado en analizar reuniones, clases, discursos y conversaciones.

Tu tarea es:
1. Crear un resumen claro y profesional.
2. Identificar los temas principales.
3. Detectar decisiones tomadas.
4. Extraer tareas o compromisos pendientes.
5. Detectar ideas importantes o repetidas.
6. Identificar dudas o problemas planteados.
7. Generar una sección de “próximos pasos”.
8. Crear una lista breve tipo TL;DR.
9. Mantener memoria contextual de la conversación para responder preguntas posteriores.
10. Si falta información o algo no queda claro, indicarlo.
"""


class AnalyzeRequest(BaseModel):
    org_id: str = "default"
    meeting_id: str | None = None
    date: str | None = None
    participants: list[str] = Field(default_factory=list)
    transcript: str


class AskRequest(BaseModel):
    org_id: str = "default"
    question: str


def _get_setting(db: Session, key: str, default: Any):
    row = db.get(AppSetting, key)
    if not row:
        return default
    try:
        return json.loads(row.value)
    except Exception:
        return default


def _set_setting(db: Session, key: str, value: Any):
    row = db.get(AppSetting, key)
    payload = json.dumps(value, ensure_ascii=False)
    if row:
        row.value = payload
    else:
        db.add(AppSetting(key=key, value=payload))


def _chat_ollama(messages: list[dict[str, str]]) -> str:
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
    model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    try:
        resp = requests.post(ollama_url, json={"model": model, "stream": False, "messages": messages}, timeout=120)
        resp.raise_for_status()
        return resp.json().get("message", {}).get("content", "")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"No se pudo conectar a Ollama: {exc}")


@router.post("/ai/meetings/analyze")
def analyze_meeting(body: AnalyzeRequest):
    transcript = body.transcript.strip()
    if len(transcript) < 20:
        raise HTTPException(status_code=400, detail="Transcripción insuficiente.")

    db = SessionLocal()
    try:
        meetings_key = f"meeting_ai:{body.org_id}:meetings"
        memory_key = f"meeting_ai:{body.org_id}:memory"
        meetings = _get_setting(db, meetings_key, [])
        memory = _get_setting(db, memory_key, {"decisiones_vigentes": [], "tareas_abiertas": [], "riesgos": [], "temas_recurrentes": []})

        meeting_date = body.date or datetime.utcnow().date().isoformat()
        meeting_id = body.meeting_id or f"meeting-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
        context = json.dumps({"memoria": memory, "ultimas_reuniones": meetings[-5:]}, ensure_ascii=False)

        user_prompt = f"""Contexto previo de la organización:
{context}

Nueva transcripción:
\"\"\"
{transcript}
\"\"\"

Participantes: {', '.join(body.participants) if body.participants else 'No informados'}
Fecha: {meeting_date}

Devuelve el análisis en el formato solicitado."""

        analysis = _chat_ollama([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ])

        meetings.append({
            "meeting_id": meeting_id,
            "date": meeting_date,
            "participants": body.participants,
            "analysis": analysis,
            "created_at": datetime.utcnow().isoformat() + "Z",
        })

        _set_setting(db, meetings_key, meetings[-30:])
        _set_setting(db, memory_key, memory)
        db.commit()
        return {"ok": True, "meeting_id": meeting_id, "analysis": analysis, "memory": memory}
    finally:
        db.close()


@router.post("/ai/meetings/ask")
def ask_meeting_context(body: AskRequest):
    db = SessionLocal()
    try:
        context = {
            "memoria": _get_setting(db, f"meeting_ai:{body.org_id}:memory", {}),
            "ultimas_reuniones": _get_setting(db, f"meeting_ai:{body.org_id}:meetings", [])[-8:],
        }
        answer = _chat_ollama([
            {"role": "system", "content": "Eres asistente experto de la organización. Responde solo con información registrada. Si no existe, indícalo."},
            {"role": "user", "content": f"Contexto: {json.dumps(context, ensure_ascii=False)}\n\nPregunta: {body.question}"},
        ])
        return {"ok": True, "answer": answer}
    finally:
        db.close()
