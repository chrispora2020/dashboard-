import { useEffect, useMemo, useRef, useState } from 'react'
import API_BASE from '../config'

const STORAGE_KEY = 'meeting_minutes_records'

function loadMinutes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (error) {
    console.error('No fue posible cargar las actas.', error)
    return []
  }
}

function saveMinutes(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function summarizeText(text, participants = '') {
  const normalized = (text || '').trim().replace(/\s+/g, ' ')
  if (!normalized) return ''

  const hasPunctuation = /[.!?]/.test(normalized)
  const rawSentences = hasPunctuation
    ? normalized.split(/(?<=[.!?])\s+/)
    : normalized.split(/\b(?:tarea\s*\d+|adem[aá]s|tamb[ií]en|luego|despu[eé]s|por favor|pero|entonces)\b/gi)

  const sentences = rawSentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)

  const keywords = ['acord', 'tarea', 'responsable', 'fecha', 'meta', 'objetivo', 'riesgo', 'decisi', 'proximo', 'seguimiento']
  const scored = sentences.map((sentence, index) => {
    const lower = sentence.toLowerCase()
    const keywordScore = keywords.reduce((acc, key) => acc + (lower.includes(key) ? 2 : 0), 0)
    const lengthScore = Math.min(Math.floor(sentence.length / 40), 2)
    const positionScore = index < 2 ? 1 : 0
    return { sentence, score: keywordScore + lengthScore + positionScore }
  })

  const topContext = scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.sentence)

  const actionSentences = sentences.filter((sentence) => /\b(haremos|acordamos|asignad[oa]|responsable|fecha|meta|objetivo|tarea|pr[oó]ximo|seguimiento|resumir|corregir|revisar)\b/i.test(sentence))
  const quoteSource = topContext.find((sentence) => sentence.length >= 40) || sentences[0]

  const personas = participants.split(',').map((name) => name.trim()).filter(Boolean)
  const participantsLine = personas.length
    ? personas.map((name) => `- ${name}: revisar pendientes y acuerdos en próxima reunión.`).join('\n')
    : '- No se especificaron participantes.'

  const contexto = topContext.slice(0, 2).join(' ') || normalized.slice(0, 220)
  const detectedTasks = [...normalized.matchAll(/tarea\s*(\d+)/gi)].map((match) => `Tarea ${match[1]}`)
  const temas = [...new Set(topContext.flatMap((sentence) => sentence.split(/[,;:]/)).map((part) => part.trim()).filter((part) => part.length > 12))]
  const temasTexto = temas.length ? temas.slice(0, 5).map((topic) => `- ${topic}`).join('\n') : '- No se detectaron temas claros.'
  const tareasDetectadas = [
    ...detectedTasks.map((task) => `- ${task}: definir responsable y fecha compromiso.`),
    ...actionSentences.slice(0, 4).map((item) => `- ${item}`)
  ]
  const tareas = tareasDetectadas.length ? tareasDetectadas.slice(0, 6).join('\n') : '- No se detectaron tareas explícitas. Definir responsables y fechas.'
  const citas = quoteSource ? `- “${quoteSource}”` : '- Sin cita destacada.'

  return [
    'Contexto general:',
    contexto,
    '',
    'Temas tratados:',
    temasTexto,
    '',
    'Tareas y metas:',
    tareas,
    '',
    'Citas importantes:',
    citas,
    '',
    'Resumen por participante:',
    participantsLine
  ].join('\n')
}

export default function MeetingMinutes({ canEdit }) {
  const [records, setRecords] = useState(() => loadMinutes())
  const [form, setForm] = useState({ date: '', participants: '', transcript: '', summary: '' })
  const [editingId, setEditingId] = useState(null)
  const [listeningState, setListeningState] = useState('idle')
  const [recognitionError, setRecognitionError] = useState('')
  const [summaryPrompt, setSummaryPrompt] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [promptSaving, setPromptSaving] = useState(false)
  const [aiError, setAiError] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const recognitionRef = useRef(null)
  const transcriptFinalRef = useRef('')
  const transcriptInterimRef = useRef('')
  const shouldRunRef = useRef(false)

  const isListening = listeningState === 'listening'
  const isPaused = listeningState === 'paused'
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [records]
  )

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleSave(event) {
    event.preventDefault()
    if (!form.date || !form.summary.trim()) {
      return
    }

    const payload = {
      date: form.date,
      participants: form.participants,
      transcript: form.transcript,
      summary: form.summary,
      createdAt: new Date().toISOString()
    }

    const next = editingId
      ? records.map((record) => (record.id === editingId ? { ...record, ...payload } : record))
      : [{ id: Date.now(), ...payload }, ...records]

    setRecords(next)
    saveMinutes(next)
    setForm({ date: '', participants: '', transcript: '', summary: '' })
    setEditingId(null)
    setShowForm(false)
    setRecognitionError('')
  }

  function handleEdit(record) {
    setForm({
      date: record.date || '',
      participants: record.participants || '',
      transcript: record.transcript || '',
      summary: record.summary || ''
    })
    setEditingId(record.id)
    setShowForm(true)
    setExpandedId(null)
    setRecognitionError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleDelete(recordId) {
    const next = records.filter((record) => record.id !== recordId)
    setRecords(next)
    saveMinutes(next)
    if (editingId === recordId) {
      setEditingId(null)
      setForm({ date: '', participants: '', transcript: '', summary: '' })
    }
  }

  async function handleAISummary() {
    const source = form.transcript || form.summary
    if (!source?.trim()) {
      setAiError('Escribe o transcribe contenido antes de generar resumen.')
      return
    }

    setSummaryLoading(true)
    setAiError('')
    try {
      const response = await fetch(`${API_BASE}/api/ai/meetings/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: source, prompt: summaryPrompt })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || 'No se pudo generar el resumen con IA.')
      setForm((prev) => ({ ...prev, summary: data.summary || '' }))
    } catch (error) {
      console.error(error)
      setAiError(error.message || 'Error generando resumen con IA.')
      setForm((prev) => ({ ...prev, summary: summarizeText(source, prev.participants) }))
    } finally {
      setSummaryLoading(false)
    }
  }

  async function handleSavePrompt() {
    if (!summaryPrompt.trim()) {
      setAiError('El prompt no puede estar vacío.')
      return
    }

    setPromptSaving(true)
    setAiError('')
    try {
      const response = await fetch(`${API_BASE}/api/ai/meetings/summary-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: summaryPrompt })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || 'No se pudo guardar el prompt.')
      setSummaryPrompt(data.prompt || summaryPrompt)
    } catch (error) {
      console.error(error)
      setAiError(error.message || 'Error guardando prompt.')
    } finally {
      setPromptSaving(false)
    }
  }

  function startRecognitionLoop() {
    if (!shouldRunRef.current) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onstart = () => setListeningState('listening')

    recognition.onerror = (event) => {
      if (['no-speech', 'aborted'].includes(event?.error)) return
      setRecognitionError('No se pudo acceder al micrófono para transcribir.')
      shouldRunRef.current = false
      setListeningState('idle')
    }

    recognition.onend = () => {
      // Flush cualquier interim pendiente
      if (transcriptInterimRef.current.trim()) {
        transcriptFinalRef.current = `${transcriptFinalRef.current} ${transcriptInterimRef.current}`.trim()
        transcriptInterimRef.current = ''
        setForm((prev) => ({ ...prev, transcript: transcriptFinalRef.current }))
      }
      // Si sigue activo, reiniciar automáticamente
      if (shouldRunRef.current) {
        setTimeout(startRecognitionLoop, 300)
      }
    }

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript || ''
        if (result.isFinal) {
          transcriptFinalRef.current = `${transcriptFinalRef.current} ${text}`.trim()
        } else {
          interim += text
        }
      }
      transcriptInterimRef.current = interim.trim()
      setForm((prev) => ({ ...prev, transcript: `${transcriptFinalRef.current} ${interim.trim()}`.trim() }))
    }

    try {
      recognition.start()
    } catch {
      // Si falla el start (por ejemplo browser throttle), reintentar
      if (shouldRunRef.current) setTimeout(startRecognitionLoop, 500)
    }
  }

  function startTranscription() {
    if (!SpeechRecognition) {
      setRecognitionError('Tu navegador no soporta transcripción automática. Usa Chrome o Edge actualizado.')
      return
    }
    setRecognitionError('')
    transcriptFinalRef.current = (form.transcript || '').trim()
    transcriptInterimRef.current = ''
    shouldRunRef.current = true
    startRecognitionLoop()
  }

  function pauseTranscription() {
    shouldRunRef.current = false
    setListeningState('paused')
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }

  function resumeTranscription() {
    if (!SpeechRecognition) {
      setRecognitionError('Tu navegador no soporta transcripción automática. Usa Chrome o Edge actualizado.')
      return
    }
    setRecognitionError('')
    transcriptInterimRef.current = ''
    shouldRunRef.current = true
    startRecognitionLoop()
  }

  function stopTranscription() {
    shouldRunRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListeningState('idle')
  }


  useEffect(() => () => {
    shouldRunRef.current = false
    recognitionRef.current?.stop()
  }, [])


  useEffect(() => {
    let active = true

    async function loadPrompt() {
      try {
        const response = await fetch(`${API_BASE}/api/ai/meetings/summary-prompt`)
        const data = await response.json()
        if (!response.ok) return
        if (active) setSummaryPrompt(data.prompt || '')
      } catch (error) {
        console.error('No se pudo cargar prompt de resumen.', error)
      }
    }

    loadPrompt()
    return () => {
      active = false
    }
  }, [])

  return (
    <main style={{ padding: '20px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: '#1e293b' }}>Actas de reuniones</h2>
        {canEdit && !showForm && !editingId ? (
          <button
            type="button"
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ date: '', participants: '', transcript: '', summary: '' }) }}
            style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            + Nueva acta
          </button>
        ) : null}
      </div>

      {/* Formulario nueva/editar acta */}
      {canEdit && (showForm || editingId) ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#1e293b' }}>{editingId ? '✏️ Editar acta' : '➕ Nueva acta'}</h3>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); setForm({ date: '', participants: '', transcript: '', summary: '' }); stopTranscription() }}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
              title="Cerrar"
            >✕</button>
          </div>

          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  Fecha
                  <input type="date" name="date" value={form.date} onChange={handleChange} required style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  Participantes
                  <input
                    type="text"
                    name="participants"
                    value={form.participants}
                    onChange={handleChange}
                    placeholder="Ej: Presidencia, secretario, líderes"
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </label>
              </div>

              {/* Transcripción (sólo para generar resumen) */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎙️ Transcripción (para generar resumen IA)</div>
                <textarea
                  name="transcript"
                  value={form.transcript}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Transcribí por voz o escribí el contenido de la reunión. Luego generá el resumen con IA."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', background: '#fff' }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                  <button type="button" onClick={startTranscription} disabled={isListening || isPaused}
                    style={{ background: isListening ? '#dcfce7' : '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 12px', cursor: isListening || isPaused ? 'not-allowed' : 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                  >🎙️ Iniciar</button>
                  <button type="button" onClick={pauseTranscription} disabled={!isListening}
                    style={{ background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 12px', cursor: !isListening ? 'not-allowed' : 'pointer', fontSize: 13 }}
                  >⏸️ Pausar</button>
                  <button type="button" onClick={resumeTranscription} disabled={!isPaused}
                    style={{ background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 12px', cursor: !isPaused ? 'not-allowed' : 'pointer', fontSize: 13 }}
                  >▶️ Retomar</button>
                  <button type="button" onClick={stopTranscription} disabled={!isListening && !isPaused}
                    style={{ background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 12px', cursor: (!isListening && !isPaused) ? 'not-allowed' : 'pointer', fontSize: 13 }}
                  >⏹️ Terminar</button>
                  <button
                    type="button"
                    onClick={handleAISummary}
                    disabled={summaryLoading}
                    style={{ background: summaryLoading ? '#94a3b8' : '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: summaryLoading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}
                  >
                    {summaryLoading ? '⏳ Generando...' : '✨ Generar resumen IA'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfig((v) => !v)}
                    title="Configuración del resumen IA"
                    style={{ background: showConfig ? '#e0e7ff' : '#f1f5f9', border: '1px solid #c7d2fe', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    ⚙️ <span style={{ fontSize: 12, fontWeight: 500, color: '#4338ca' }}>Config.</span>
                  </button>
                </div>
                {isListening ? <p style={{ color: '#166534', margin: '6px 0 0', fontSize: 12 }}>🟢 Grabando…</p> : null}
                {isPaused ? <p style={{ color: '#92400e', margin: '6px 0 0', fontSize: 12 }}>🟡 Pausado</p> : null}
                {recognitionError ? <p style={{ color: '#b91c1c', margin: '6px 0 0', fontSize: 12 }}>{recognitionError}</p> : null}
              </div>

              {/* Panel config IA */}
              {showConfig ? (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>⚙️ Prompt de resumen IA</span>
                    <button type="button" onClick={() => setShowConfig(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                  </div>
                  <textarea
                    value={summaryPrompt}
                    onChange={(event) => setSummaryPrompt(event.target.value)}
                    rows={10}
                    placeholder="Define el prompt para la IA"
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', padding: 10, resize: 'vertical', background: '#fff', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleSavePrompt}
                      disabled={promptSaving}
                      style={{ background: promptSaving ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: promptSaving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}
                    >
                      {promptSaving ? 'Guardando...' : '💾 Guardar prompt'}
                    </button>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Se aplica al próximo resumen.</span>
                  </div>
                </div>
              ) : null}

              {aiError ? <p style={{ color: '#b91c1c', margin: 0, fontSize: 13 }}>{aiError}</p> : null}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Resumen de la reunión
                <div style={{ position: 'relative' }}>
                  <textarea
                    name="summary"
                    value={form.summary}
                    onChange={handleChange}
                    rows={10}
                    required
                    disabled={summaryLoading}
                    placeholder="Resumen generado por IA o escrito manualmente"
                    style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${summaryLoading ? '#a5b4fc' : '#d1d5db'}`, fontSize: 13, resize: 'vertical', width: '100%', boxSizing: 'border-box', opacity: summaryLoading ? 0.4 : 1, transition: 'opacity 0.2s' }}
                  />
                  {summaryLoading ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 6, background: 'rgba(238,242,255,0.85)', pointerEvents: 'none' }}>
                      <div style={{ width: 36, height: 36, border: '4px solid #e0e7ff', borderTop: '4px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#4338ca' }}>La IA está pensando…</span>
                      <span style={{ fontSize: 11, color: '#6366f1' }}>Esto puede tardar unos segundos</span>
                    </div>
                  ) : null}
                </div>
              </label>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
                >
                  {editingId ? '💾 Actualizar acta' : '💾 Guardar acta'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); setForm({ date: '', participants: '', transcript: '', summary: '' }); stopTranscription() }}
                  style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {/* Grilla de actas */}
      {sortedRecords.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px dashed #e2e8f0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          <p style={{ margin: 0, fontSize: 14 }}>No hay actas registradas aún.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {/* Cabecera de la grilla */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px', gap: 12, padding: '8px 16px', background: '#f1f5f9', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Fecha</span>
            <span>Participantes / Resumen</span>
            <span style={{ textAlign: 'right' }}>Acciones</span>
          </div>

          {sortedRecords.map((record) => {
            const isExpanded = expandedId === record.id
            const summaryPreview = (record.summary || '').replace(/\n/g, ' ').slice(0, 120)
            const hasMore = (record.summary || '').length > 120
            return (
              <div key={record.id} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${isExpanded ? '#a5b4fc' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: isExpanded ? '0 2px 8px rgba(99,102,241,0.08)' : 'none', transition: 'border-color 0.15s' }}>
                {/* Fila principal */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px', gap: 12, padding: '12px 16px', cursor: 'pointer', alignItems: 'center', background: isExpanded ? '#eef2ff' : '#fff' }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap' }}>
                    📅 {record.date}
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      👥 {record.participants || 'Sin participantes'}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {summaryPreview}{hasMore && !isExpanded ? '…' : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                    {canEdit ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEdit(record) }}
                          title="Editar"
                          style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                        >✏️</button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (window.confirm('¿Eliminar esta acta?')) handleDelete(record.id) }}
                          title="Eliminar"
                          style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                        >🗑️</button>
                      </>
                    ) : null}
                    <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 2 }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Contenido expandido */}
                {isExpanded ? (
                  <div style={{ borderTop: '1px solid #e0e7ff', padding: '16px 20px', background: '#fafafe' }}>
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📝 Resumen</span>
                    </div>
                    <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{record.summary || 'Sin resumen.'}</pre>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
