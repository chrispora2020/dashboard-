import { useMemo, useState } from 'react'

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

function summarizeText(text) {
  const normalized = (text || '').trim()
  if (!normalized) {
    return ''
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  return sentences.slice(0, 3).join(' ')
}

export default function MeetingMinutes({ canEdit }) {
  const [records, setRecords] = useState(() => loadMinutes())
  const [form, setForm] = useState({ date: '', participants: '', transcript: '', summary: '' })
  const [isListening, setIsListening] = useState(false)
  const [recognitionError, setRecognitionError] = useState('')

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

    const next = [
      {
        id: Date.now(),
        date: form.date,
        participants: form.participants,
        transcript: form.transcript,
        summary: form.summary,
        createdAt: new Date().toISOString()
      },
      ...records
    ]

    setRecords(next)
    saveMinutes(next)
    setForm({ date: '', participants: '', transcript: '', summary: '' })
    setRecognitionError('')
  }

  function handleAISummary() {
    const source = form.transcript || form.summary
    setForm((prev) => ({ ...prev, summary: summarizeText(source) }))
  }

  function startTranscription() {
    if (!SpeechRecognition) {
      setRecognitionError('Tu navegador no soporta transcripción automática. Usa Chrome o Edge actualizado.')
      return
    }

    setRecognitionError('')
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => setIsListening(true)
    recognition.onerror = () => {
      setRecognitionError('No se pudo acceder al micrófono para transcribir.')
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript
      }
      setForm((prev) => ({ ...prev, transcript: `${prev.transcript} ${transcript}`.trim() }))
    }

    recognition.start()

  }

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
              <button type="button" onClick={startTranscription}>🎙️ Transcribir</button>
              <button type="button" onClick={handleAISummary}>✨ Resumir IA</button>
            </div>

            {recognitionError ? <p style={{ color: '#b91c1c' }}>{recognitionError}</p> : null}
            {isListening ? <p style={{ color: '#166534' }}>Grabando y transcribiendo en tiempo real…</p> : null}

            <label>
              Resumen de la reunión
              <textarea
                name="summary"
                value={form.summary}
                onChange={handleChange}
                rows={4}
                required
                placeholder="Resumen final del acta"
                style={{ width: '100%' }}
              />
            </label>

            <button type="submit">Guardar acta</button>
          </div>
        </form>
      ) : null}

      <section style={{ display: 'grid', gap: 12 }}>
        {sortedRecords.length === 0 ? <p>No hay actas registradas.</p> : null}

        {sortedRecords.map((record) => (
          <article key={record.id} style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
            <h3>{record.date}</h3>
            <p><strong>Participantes:</strong> {record.participants || 'No especificados'}</p>
            <p><strong>Resumen:</strong> {record.summary}</p>
            {record.transcript ? <p><strong>Transcripción:</strong> {record.transcript}</p> : null}
          </article>
        ))}
      </section>
    </main>
  )
}
