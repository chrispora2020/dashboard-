import { useEffect, useMemo, useRef, useState } from 'react'
import API_BASE from '../config'

function summarizeText(text, participants = '') {
  const normalized = (text || '').trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  const sentences = normalized.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  const keywords = ['acord', 'tarea', 'responsable', 'fecha', 'objetivo', 'riesgo', 'decisi']
  const top = sentences.map((s, i) => ({ s, score: keywords.reduce((a, k) => a + (s.toLowerCase().includes(k) ? 2 : 0), 0) + (i < 2 ? 1 : 0) })).sort((a, b) => b.score - a.score).slice(0, 3).map((x) => x.s)
  const personas = participants.split(',').map((n) => n.trim()).filter(Boolean)
  return ['Contexto:', top.join(' ') || normalized.slice(0, 200), '', 'Participantes:', personas.length ? personas.map((n) => `- ${n}`).join('\n') : '- No especificados'].join('\n')
}

export default function MeetingMinutes({ canEdit, category = 'consejo' }) {
  const [records, setRecords] = useState([])
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ date: '', participants: '', transcript: '', summary: '' })
  const [editingId, setEditingId] = useState(null)
  const [listeningState, setListeningState] = useState('idle')
  const [recognitionError, setRecognitionError] = useState('')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  const [summaryPrompt, setSummaryPrompt] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [promptSaving, setPromptSaving] = useState(false)
  const [aiError, setAiError] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [leaderNames, setLeaderNames] = useState([])
  const [participantInput, setParticipantInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const recognitionRef = useRef(null)
  const transcriptFinalRef = useRef('')
  const transcriptInterimRef = useRef('')
  const shouldRunRef = useRef(false)
  const participantInputRef = useRef(null)

  const isListening = listeningState === 'listening'
  const isPaused = listeningState === 'paused'
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

  const selectedParticipants = form.participants
    ? form.participants.split(',').map((p) => p.trim()).filter(Boolean)
    : []

  const filteredSuggestions = leaderNames.filter(
    (name) =>
      name.toLowerCase().includes(participantInput.toLowerCase()) &&
      !selectedParticipants.map((p) => p.toLowerCase()).includes(name.toLowerCase())
  )

  function addParticipant(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (selectedParticipants.map((p) => p.toLowerCase()).includes(trimmed.toLowerCase())) return
    const next = [...selectedParticipants, trimmed]
    setForm((prev) => ({ ...prev, participants: next.join(', ') }))
    setParticipantInput('')
    setShowSuggestions(false)
  }

  function removeParticipant(name) {
    const next = selectedParticipants.filter((p) => p.toLowerCase() !== name.toLowerCase())
    setForm((prev) => ({ ...prev, participants: next.join(', ') }))
  }

  function handleParticipantKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      if (participantInput.trim()) addParticipant(participantInput)
    } else if (event.key === 'Backspace' && !participantInput && selectedParticipants.length) {
      removeParticipant(selectedParticipants[selectedParticipants.length - 1])
    }
  }

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
    if (!form.date || !form.summary.trim()) return
    setSaving(true)
    setRecognitionError('')
    const payload = { category, date: form.date, participants: form.participants, transcript: form.transcript, summary: form.summary }
    const url = editingId ? `${API_BASE}/api/meetings/${editingId}` : `${API_BASE}/api/meetings`
    const method = editingId ? 'PUT' : 'POST'
    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then((r) => { if (!r.ok) throw new Error('Error al guardar'); return r.json() })
      .then((saved) => {
        setRecords((prev) =>
          editingId ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev]
        )
        setForm({ date: '', participants: '', transcript: '', summary: '' })
        setEditingId(null)
        setShowForm(false)
      })
      .catch((err) => setAiError(err.message || 'Error al guardar.'))
      .finally(() => setSaving(false))
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
    if (!window.confirm('¿Eliminar esta acta? Esta acción no se puede deshacer.')) return
    fetch(`${API_BASE}/api/meetings/${recordId}`, { method: 'DELETE' })
      .then((r) => { if (!r.ok) throw new Error('Error al eliminar') })
      .then(() => {
        setRecords((prev) => prev.filter((r) => r.id !== recordId))
        if (editingId === recordId) {
          setEditingId(null)
          setForm({ date: '', participants: '', transcript: '', summary: '' })
          setShowForm(false)
        }
      })
      .catch((err) => setAiError(err.message || 'Error al eliminar.'))
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

  // Cargar actas desde la API
  useEffect(() => {
    let active = true
    setRecordsLoading(true)
    setRecordsError('')
    fetch(`${API_BASE}/api/meetings?category=${category}`)
      .then((r) => { if (!r.ok) throw new Error('No se pudieron cargar las actas.'); return r.json() })
      .then((data) => { if (active) setRecords(data) })
      .catch((err) => { if (active) setRecordsError(err.message) })
      .finally(() => { if (active) setRecordsLoading(false) })
    return () => { active = false }
  }, [category])

  // Responsive listener
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 640) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
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

  useEffect(() => {
    fetch(`${API_BASE}/api/council-assignments`)
      .then((r) => r.json())
      .then((data) => {
        const names = (data?.plan?.leaders || [])
          .map((l) => l.name)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
        setLeaderNames(names)
      })
      .catch(() => {})
  }, [])

  return (
    <main style={{ padding: isMobile ? '12px' : '20px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: isMobile ? 17 : 22 }}>
          {category === 'presidencia' ? '📋 Actas Presidencia' : '📋 Actas Consejo / Comité'}
        </h2>
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
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: isMobile ? '14px' : '20px 24px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#1e293b' }}>{editingId ? '✏️ Editar acta' : '➕ Nueva acta'}</h3>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); setForm({ date: '', participants: '', transcript: '', summary: '' }); setParticipantInput(''); setShowSuggestions(false); stopTranscription() }}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
              title="Cerrar"
            >✕</button>
          </div>

          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  Fecha
                  <input type="date" name="date" value={form.date} onChange={handleChange} required style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Participantes</span>
                    {leaderNames.length > 0 ? (
                      selectedParticipants.length === leaderNames.length ? (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, participants: '' }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#94a3b8', fontWeight: 600, padding: 0, textDecoration: 'underline' }}
                        >Limpiar todos</button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, participants: leaderNames.join(', ') }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6366f1', fontWeight: 600, padding: 0, textDecoration: 'underline' }}
                        >Seleccionar todos</button>
                      )
                    ) : null}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div
                      onClick={() => participantInputRef.current?.focus()}
                      style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '5px 8px', borderRadius: 6, border: `1px solid ${showSuggestions ? '#a5b4fc' : '#d1d5db'}`, background: '#fff', cursor: 'text', minHeight: 36, alignItems: 'center' }}
                    >
                      {selectedParticipants.map((name) => (
                        <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: '#e0e7ff', color: '#3730a3', borderRadius: 4, padding: '2px 6px 2px 9px', fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>
                          {name}
                          <button type="button" onClick={() => removeParticipant(name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', fontSize: 15, lineHeight: 1, padding: '0 0 0 3px', display: 'flex', alignItems: 'center' }}>×</button>
                        </span>
                      ))}
                      <input
                        ref={participantInputRef}
                        value={participantInput}
                        onChange={(e) => { setParticipantInput(e.target.value); setShowSuggestions(true) }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        onKeyDown={handleParticipantKeyDown}
                        placeholder={selectedParticipants.length ? '' : 'Buscar o escribir nombre...'}
                        style={{ border: 'none', outline: 'none', fontSize: 13, minWidth: 150, flex: 1, background: 'transparent', padding: '2px 4px' }}
                      />
                    </div>
                    {showSuggestions && filteredSuggestions.length > 0 ? (
                      <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200, maxHeight: 200, overflowY: 'auto' }}>
                        {filteredSuggestions.map((name) => (
                          <div
                            key={name}
                            onMouseDown={() => addParticipant(name)}
                            style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9' }}
                          >
                            <span style={{ fontSize: 14 }}>👤</span> {name}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {showSuggestions && participantInput.trim() && filteredSuggestions.length === 0 ? (
                      <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200 }}>
                        <div
                          onMouseDown={() => addParticipant(participantInput)}
                          style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          <span style={{ fontSize: 14 }}>➕</span> Agregar «{participantInput.trim()}»
                        </div>
                      </div>
                    ) : null}
                  </div>
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

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ background: saving ? '#94a3b8' : '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}
                >
                  {saving ? '⏳ Guardando…' : editingId ? '💾 Actualizar acta' : '💾 Guardar acta'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); setForm({ date: '', participants: '', transcript: '', summary: '' }); setParticipantInput(''); setShowSuggestions(false); stopTranscription() }}
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
      {recordsLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6366f1' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          <p style={{ margin: 0, fontSize: 14 }}>Cargando actas…</p>
        </div>
      ) : recordsError ? (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: '#b91c1c', background: '#fff1f2', borderRadius: 12, border: '1px solid #fecdd3' }}>
          <p style={{ margin: 0, fontSize: 13 }}>{recordsError}</p>
        </div>
      ) : sortedRecords.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px dashed #e2e8f0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          <p style={{ margin: 0, fontSize: 14 }}>No hay actas registradas aún.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {/* Cabecera de la grilla - ocultar en mobile */}
          {!isMobile ? (
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px', gap: 12, padding: '8px 14px', background: '#f1f5f9', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Fecha</span>
              <span>Participantes / Resumen</span>
              <span style={{ textAlign: 'right' }}>Acciones</span>
            </div>
          ) : null}

          {sortedRecords.map((record) => {
            const isExpanded = expandedId === record.id
            const summaryPreview = (record.summary || '').replace(/\n/g, ' ').slice(0, isMobile ? 70 : 120)
            const hasMore = (record.summary || '').length > (isMobile ? 70 : 120)
            return (
              <div key={record.id} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${isExpanded ? '#a5b4fc' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: isExpanded ? '0 2px 8px rgba(99,102,241,0.08)' : 'none' }}>
                {/* Fila principal */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '110px 1fr 90px', gap: isMobile ? 8 : 12, padding: isMobile ? '10px 12px' : '11px 14px', cursor: 'pointer', alignItems: 'center', background: isExpanded ? '#eef2ff' : '#fff' }}
                >
                  {isMobile ? (
                    /* Vista mobile: info + acciones en 2 columnas */
                    <>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 2 }}>📅 {record.date}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          👥 {record.participants || 'Sin participantes'}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                          {summaryPreview}{hasMore && !isExpanded ? '…' : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                        {canEdit ? (
                          <>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(record) }} title="Editar" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 13 }}>✏️</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(record.id) }} title="Eliminar" style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 13 }}>🗑️</button>
                          </>
                        ) : null}
                        <span style={{ color: '#94a3b8', fontSize: 11 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </>
                  ) : (
                    /* Vista desktop: 3 columnas */
                    <>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap' }}>📅 {record.date}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          👥 {record.participants || 'Sin participantes'}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {summaryPreview}{hasMore && !isExpanded ? '…' : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'flex-end' }}>
                        {canEdit ? (
                          <>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(record) }} title="Editar" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 13 }}>✏️</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(record.id) }} title="Eliminar" style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 13 }}>🗑️</button>
                          </>
                        ) : null}
                        <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 2 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Contenido expandido */}
                {isExpanded ? (
                  <div style={{ borderTop: '1px solid #e0e7ff', padding: isMobile ? '12px' : '16px 20px', background: '#fafafe' }}>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📝 Resumen</span>
                    </div>
                    <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: isMobile ? 12 : 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{record.summary || 'Sin resumen.'}</pre>
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
