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
  const recognitionRef = useRef(null)
  const transcriptFinalRef = useRef('')
  const transcriptInterimRef = useRef('')
  const pauseRequestedRef = useRef(false)
  const stopRequestedRef = useRef(false)

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
    setRecognitionError('')
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

  function resetTranscriptState(baseTranscript = '') {
    transcriptFinalRef.current = (baseTranscript || '').trim()
    transcriptInterimRef.current = ''
  }

  function createRecognition() {
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => setListeningState('listening')
    recognition.onerror = (event) => {
      if (event?.error === 'no-speech' || event?.error === 'aborted') {
        return
      }
      setRecognitionError('No se pudo acceder al micrófono para transcribir.')
      setListeningState('idle')
    }
    recognition.onend = () => {
      if (pauseRequestedRef.current) {
        setListeningState('paused')
        return
      }

      if (stopRequestedRef.current) {
        stopRequestedRef.current = false
        setListeningState('idle')
        recognitionRef.current = null
        return
      }

      if (transcriptInterimRef.current.trim()) {
        transcriptFinalRef.current = `${transcriptFinalRef.current} ${transcriptInterimRef.current}`.trim()
        transcriptInterimRef.current = ''
        setForm((prev) => ({ ...prev, transcript: transcriptFinalRef.current }))
      }

      const restartedRecognition = createRecognition()
      recognitionRef.current = restartedRecognition
      restartedRecognition.start()
    }

    recognition.onresult = (event) => {
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript || ''

        if (result.isFinal) {
          transcriptFinalRef.current = `${transcriptFinalRef.current} ${text}`.trim()
        } else {
          interimTranscript += text
        }
      }

      transcriptInterimRef.current = interimTranscript.trim()
      const nextTranscript = `${transcriptFinalRef.current} ${transcriptInterimRef.current}`.trim()
      setForm((prev) => ({ ...prev, transcript: nextTranscript }))
    }

    return recognition
  }

  function startTranscription() {
    if (!SpeechRecognition) {
      setRecognitionError('Tu navegador no soporta transcripción automática. Usa Chrome o Edge actualizado.')
      return
    }

    setRecognitionError('')
    resetTranscriptState(form.transcript)
    pauseRequestedRef.current = false
    stopRequestedRef.current = false
    const recognition = createRecognition()
    recognitionRef.current = recognition
    recognition.start()
  }

  function pauseTranscription() {
    if (!recognitionRef.current || !isListening) {
      return
    }
    pauseRequestedRef.current = true
    stopRequestedRef.current = false
    setListeningState('paused')
    recognitionRef.current.stop()
  }

  function resumeTranscription() {
    if (!SpeechRecognition) {
      setRecognitionError('Tu navegador no soporta transcripción automática. Usa Chrome o Edge actualizado.')
      return
    }
    if (!isPaused) {
      return
    }

    setRecognitionError('')
    resetTranscriptState(form.transcript)
    pauseRequestedRef.current = false
    stopRequestedRef.current = false
    const recognition = createRecognition()
    recognitionRef.current = recognition
    recognition.start()
  }

  function stopTranscription() {
    if (recognitionRef.current) {
      pauseRequestedRef.current = false
      stopRequestedRef.current = true
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setListeningState('idle')
  }


  useEffect(() => () => {
    stopRequestedRef.current = true
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
    <main style={{ padding: '20px' }}>
      <h2>Actas de reuniones</h2>

      {canEdit ? (
        <form onSubmit={handleSave} style={{ background: '#fff', padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <label>
              Fecha
              <input type="date" name="date" value={form.date} onChange={handleChange} required style={{ width: '100%' }} />
            </label>

            <label>
              Participantes
              <input
                type="text"
                name="participants"
                value={form.participants}
                onChange={handleChange}
                placeholder="Ej: Presidencia, secretario, líderes"
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Transcripción
              <textarea
                name="transcript"
                value={form.transcript}
                onChange={handleChange}
                rows={5}
                placeholder="Puedes escribir o usar transcribir por voz"
                style={{ width: '100%' }}
              />
            </label>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={startTranscription} disabled={isListening || isPaused}>🎙️ Iniciar transcripción</button>
              <button type="button" onClick={pauseTranscription} disabled={!isListening}>⏸️ Pausar</button>
              <button type="button" onClick={resumeTranscription} disabled={!isPaused}>▶️ Retomar</button>
              <button type="button" onClick={stopTranscription} disabled={!isListening && !isPaused}>⏹️ Terminar</button>
              <button type="button" onClick={handleAISummary} disabled={summaryLoading}>{summaryLoading ? 'Generando resumen...' : '✨ Generar resumen (IA real)'}</button>
            </div>

            {recognitionError ? <p style={{ color: '#b91c1c' }}>{recognitionError}</p> : null}
            {aiError ? <p style={{ color: '#b91c1c' }}>{aiError}</p> : null}
            {isListening ? <p style={{ color: '#166534' }}>🟢 Grabando y transcribiendo en tiempo real…</p> : null}
            {isPaused ? <p style={{ color: '#92400e' }}>🟡 Transcripción pausada. Puedes retomar o terminar.</p> : null}

            <label>
              Prompt de resumen IA (editable)
              <textarea
                name="summaryPrompt"
                value={summaryPrompt}
                onChange={(event) => setSummaryPrompt(event.target.value)}
                rows={7}
                placeholder="Define aquí el prompt que usará la IA para resumir"
                style={{ width: '100%' }}
              />
            </label>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={handleSavePrompt} disabled={promptSaving}>{promptSaving ? 'Guardando prompt...' : 'Guardar prompt IA'}</button>
            </div>

            <label>
              Resumen de la reunión
              <textarea
                name="summary"
                value={form.summary}
                onChange={handleChange}
                rows={10}
                required
                placeholder="Incluye contexto, temas, tareas/metas, citas y resumen por participante"
                style={{ width: '100%' }}
              />
            </label>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit">{editingId ? 'Actualizar acta' : 'Guardar acta'}</button>
              {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm({ date: '', participants: '', transcript: '', summary: '' }) }}>Cancelar edición</button> : null}
            </div>
          </div>
        </form>
      ) : null}

      <section style={{ display: 'grid', gap: 12 }}>
        {sortedRecords.length === 0 ? <p>No hay actas registradas.</p> : null}

        {sortedRecords.map((record) => (
          <article key={record.id} style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
            <h3>{record.date}</h3>
            <p><strong>Participantes:</strong> {record.participants || 'No especificados'}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}><strong>Resumen:</strong> {record.summary}</p>
            {record.transcript ? <p><strong>Transcripción:</strong> {record.transcript}</p> : null}
            {canEdit ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" onClick={() => handleEdit(record)}>Editar</button>
                <button type="button" onClick={() => handleDelete(record.id)}>Eliminar</button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  )
}
