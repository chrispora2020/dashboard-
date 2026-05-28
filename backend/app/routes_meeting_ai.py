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


class SummarizeRequest(BaseModel):
    org_id: str = "default"
    text: str
    prompt: str | None = None


DEFAULT_SUMMARY_PROMPT = """Eres un asistente experto en resumir textos en español.

Genera una respuesta clara, accionable y breve con este formato:
1) Resumen ejecutivo (1 párrafo)
2) Ideas clave (viñetas)
3) Tareas/acciones (viñetas con responsable sugerido si aplica)
4) Próximos pasos (máximo 3)

Reglas:
- No inventes datos que no aparezcan en el texto.
- Si falta contexto, indícalo.
- Mantén lenguaje simple y profesional.
"""


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


def _chat_gemini(messages: list[dict[str, str]]) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Falta configurar GEMINI_API_KEY en el servidor.")

    base_url = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    try:
        resp = requests.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages, "temperature": 0.2},
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
    except requests.HTTPError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(status_code=502, detail=f"Error en API de Gemini: {detail}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"No se pudo conectar a Gemini: {exc}")


@router.get("/ai/meetings/summary-prompt")
def get_summary_prompt(org_id: str = "default"):
    db = SessionLocal()
    try:
        key = f"meeting_ai:{org_id}:summary_prompt"
        prompt = _get_setting(db, key, DEFAULT_SUMMARY_PROMPT)
        return {"ok": True, "prompt": prompt}
    finally:
        db.close()


@router.post("/ai/meetings/summary-prompt")
def save_summary_prompt(body: dict[str, str]):
    org_id = body.get("org_id", "default")
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="El prompt no puede estar vacío.")

    db = SessionLocal()
    try:
        key = f"meeting_ai:{org_id}:summary_prompt"
        _set_setting(db, key, prompt)
        db.commit()
        return {"ok": True, "prompt": prompt}
    finally:
        db.close()


@router.post("/ai/meetings/summarize")
def summarize_text(body: SummarizeRequest):
    text = (body.text or "").strip()
    if len(text) < 20:
        raise HTTPException(status_code=400, detail="El texto es demasiado corto para resumir.")

    db = SessionLocal()
    try:
        key = f"meeting_ai:{body.org_id}:summary_prompt"
        saved_prompt = _get_setting(db, key, DEFAULT_SUMMARY_PROMPT)
        prompt = (body.prompt or saved_prompt or DEFAULT_SUMMARY_PROMPT).strip()
    finally:
        db.close()

    summary = _chat_gemini([
        {"role": "system", "content": prompt},
        {"role": "user", "content": text},
    ])
    return {"ok": True, "summary": summary, "prompt_used": prompt}


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
