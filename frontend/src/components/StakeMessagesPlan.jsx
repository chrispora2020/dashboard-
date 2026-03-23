import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import API_BASE from '../config'

const API_PATH = '/api/stake-messages-plan'

const DEFAULT_PLAN = {
  quarterLabel: 'Plan trimestral Abril - Junio 2026',
  introMessage: 'Muy buenas noches queridos líderes de la Estaca Maroñas, este domingo tendremos mensaje de estaca 😉',
  closingMessage: 'Les recordamos que todos lo puedan preparar por las dudas.',
  months: [
    {
      id: 'abril',
      monthLabel: 'Abril',
      sundayDate: '2026-04-19',
      topicUrl: 'https://www.churchofjesuschrist.org/study/general-conference/2025/10/13browning?lang=spa',
      topicTitle: 'Tema de conferencia',
      notes: '',
      units: [
        { unit: 'Los Ceibos', speaker: 'Prs María Elena' },
        { unit: 'Libia', speaker: 'Richard Alvez' },
        { unit: 'Belloni', speaker: 'Prs Silva' },
        { unit: 'B. Italia', speaker: 'Ruth Santos' },
        { unit: 'Toledo', speaker: 'Antonio González' },
        { unit: 'B.14', speaker: 'Joaquín Acosta' },
        { unit: 'Pando', speaker: 'Conferencia (sin mensaje de estaca)' }
      ]
    },
    {
      id: 'mayo',
      monthLabel: 'Mayo',
      sundayDate: '2026-05-17',
      topicUrl: 'https://www.churchofjesuschrist.org/study/general-conference/2025/10/13browning?lang=spa',
      topicTitle: 'Tema de conferencia',
      notes: '',
      units: [
        { unit: 'Los Ceibos', speaker: 'Prs María Elena' },
        { unit: 'Libia', speaker: 'Richard Alvez' },
        { unit: 'Belloni', speaker: 'Prs Silva' },
        { unit: 'B. Italia', speaker: 'Ruth Santos' },
        { unit: 'Toledo', speaker: 'Antonio González' },
        { unit: 'B.14', speaker: 'Joaquín Acosta' },
        { unit: 'Pando', speaker: 'Pablo Morales' }
      ]
    },
    {
      id: 'junio',
      monthLabel: 'Junio',
      sundayDate: '2026-06-21',
      topicUrl: 'https://www.churchofjesuschrist.org/study/general-conference/2025/10/13browning?lang=spa',
      topicTitle: 'Tema de conferencia',
      notes: '',
      units: [
        { unit: 'Los Ceibos', speaker: 'Prs María Elena' },
        { unit: 'Libia', speaker: 'Richard Alvez' },
        { unit: 'Belloni', speaker: 'Prs Silva' },
        { unit: 'B. Italia', speaker: 'Ruth Santos' },
        { unit: 'Toledo', speaker: 'Antonio González' },
        { unit: 'B.14', speaker: 'Joaquín Acosta' },
        { unit: 'Pando', speaker: 'Pablo Morales' }
      ]
    }
  ]
}

function toSpanishDate(isoDate) {
  if (!isoDate) return 'Sin fecha'
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('es-UY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function shiftDays(isoDate, amount) {
  if (!isoDate) return ''
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() - amount)
  return date.toISOString().slice(0, 10)
}

function buildReminderText(plan, month, daysBefore) {
  const heading = daysBefore === 5
    ? 'Recordatorio (5 días antes)'
    : 'Recordatorio (2 días antes)'

  const lines = [
    `${heading} · Mensaje de Estaca`,
    `Fecha: ${toSpanishDate(month.sundayDate)}`,
    '',
    `Tema: ${month.topicTitle}`,
    month.topicUrl,
    '',
    plan.introMessage,
    ''
  ]

  for (const unit of month.units) {
    const discourseTitle = unit.talkTitle?.trim() || month.topicTitle || 'Tema pendiente'
    const discourseUrl = unit.talkUrl?.trim() || month.topicUrl || ''
    lines.push(`${unit.unit} - ${unit.speaker}`)
    lines.push(`Discurso asignado: ${discourseTitle}`)
    if (discourseUrl) {
      lines.push(`Link: ${discourseUrl}`)
    }
  }

  if (plan.closingMessage?.trim()) {
    lines.push('', plan.closingMessage)
  }

  return lines.join('\n')
}

export default function StakeMessagesPlan() {
  const [plan, setPlan] = useState(DEFAULT_PLAN)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [selectedMonthId, setSelectedMonthId] = useState('abril')

  useEffect(() => {
    async function loadPlan() {
      try {
        const { data } = await axios.get(`${API_BASE}${API_PATH}`)
        if (data?.plan?.months?.length) {
          setPlan(data.plan)
          setSelectedMonthId(data.plan.months[0].id)
        }
      } catch (error) {
        console.warn('No se pudo cargar plan persistido. Se usa el plan por defecto.', error)
      } finally {
        setLoading(false)
      }
    }

    loadPlan()
  }, [])

  const selectedMonth = useMemo(
    () => plan.months.find((month) => month.id === selectedMonthId) || plan.months[0],
    [plan.months, selectedMonthId]
  )

  function updateMonth(monthId, patch) {
    setPlan((prev) => ({
      ...prev,
      months: prev.months.map((month) => (month.id === monthId ? { ...month, ...patch } : month))
    }))
  }

  function updateUnit(monthId, unitIndex, key, value) {
    setPlan((prev) => ({
      ...prev,
      months: prev.months.map((month) => {
        if (month.id !== monthId) return month

        return {
          ...month,
          units: month.units.map((unit, idx) => (idx === unitIndex ? { ...unit, [key]: value } : unit))
        }
      })
    }))
  }

  async function savePlan() {
    setSaving(true)
    setStatus('')

    try {
      await axios.post(`${API_BASE}${API_PATH}`, { plan })
      setStatus('✅ Plan guardado correctamente.')
    } catch (error) {
      setStatus(`❌ No se pudo guardar: ${error.response?.data?.detail || error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function copyReminder(daysBefore) {
    const text = buildReminderText(plan, selectedMonth, daysBefore)
    await navigator.clipboard.writeText(text)
    setStatus(`✅ Mensaje copiado para enviar ${daysBefore} días antes.`)
  }

  if (loading) {
    return <div style={styles.page}>Cargando plan trimestral...</div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Mensajes de Estaca Maroñas</h2>
        <p style={styles.subtitle}>Plan editable y persistente para el trimestre.</p>

        <label style={styles.label}>Título del plan</label>
        <input
          style={styles.input}
          value={plan.quarterLabel}
          onChange={(event) => setPlan((prev) => ({ ...prev, quarterLabel: event.target.value }))}
        />

        <label style={styles.label}>Introducción del mensaje</label>
        <textarea
          style={styles.textarea}
          value={plan.introMessage}
          onChange={(event) => setPlan((prev) => ({ ...prev, introMessage: event.target.value }))}
        />

        <label style={styles.label}>Cierre del mensaje</label>
        <textarea
          style={styles.textarea}
          value={plan.closingMessage}
          onChange={(event) => setPlan((prev) => ({ ...prev, closingMessage: event.target.value }))}
        />

        {plan.months.map((month) => (
          <section key={month.id} style={styles.monthSection}>
            <h3 style={styles.monthTitle}>{month.monthLabel} · {toSpanishDate(month.sundayDate)}</h3>

            <div style={styles.row}>
              <div style={styles.col}>
                <label style={styles.label}>Fecha (domingo)</label>
                <input
                  type="date"
                  style={styles.input}
                  value={month.sundayDate}
                  onChange={(event) => updateMonth(month.id, { sundayDate: event.target.value })}
                />
              </div>
              <div style={styles.col}>
                <label style={styles.label}>Tema</label>
                <input
                  style={styles.input}
                  value={month.topicTitle}
                  onChange={(event) => updateMonth(month.id, { topicTitle: event.target.value })}
                />
              </div>
            </div>

            <label style={styles.label}>Link del tema</label>
            <input
              style={styles.input}
              value={month.topicUrl}
              onChange={(event) => updateMonth(month.id, { topicUrl: event.target.value })}
            />

            <label style={styles.label}>Notas</label>
            <textarea
              style={styles.textarea}
              value={month.notes || ''}
              onChange={(event) => updateMonth(month.id, { notes: event.target.value })}
              placeholder="Ej: Si hay conferencia de unidad, no hay mensaje de estaca."
            />

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Unidad</th>
                  <th style={styles.th}>Persona asignada</th>
                  <th style={styles.th}>Título del discurso asignado</th>
                  <th style={styles.th}>Link del discurso</th>
                </tr>
              </thead>
              <tbody>
                {month.units.map((unit, index) => (
                  <tr key={`${month.id}-${index}`}>
                    <td style={styles.td}>
                      <input
                        style={styles.input}
                        value={unit.unit}
                        onChange={(event) => updateUnit(month.id, index, 'unit', event.target.value)}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        style={styles.input}
                        value={unit.speaker}
                        onChange={(event) => updateUnit(month.id, index, 'speaker', event.target.value)}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        style={styles.input}
                        value={unit.talkTitle || ''}
                        onChange={(event) => updateUnit(month.id, index, 'talkTitle', event.target.value)}
                        placeholder="Tema o idea del discurso"
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        style={styles.input}
                        value={unit.talkUrl || ''}
                        onChange={(event) => updateUnit(month.id, index, 'talkUrl', event.target.value)}
                        placeholder="https://..."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <button type="button" onClick={savePlan} style={styles.saveBtn} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar plan trimestral'}
        </button>

        <div style={styles.reminderBox}>
          <h3 style={styles.monthTitle}>Recordatorios para grupo</h3>
          <p style={styles.note}>Se generan los textos para copiar/pegar. El envío automático tipo chatbot requiere integración externa (WhatsApp/Telegram).</p>

          <label style={styles.label}>Mes para recordatorio</label>
          <select
            style={styles.input}
            value={selectedMonth.id}
            onChange={(event) => setSelectedMonthId(event.target.value)}
          >
            {plan.months.map((month) => (
              <option key={month.id} value={month.id}>{month.monthLabel}</option>
            ))}
          </select>

          <p style={styles.note}>Enviar 5 días antes: <strong>{toSpanishDate(shiftDays(selectedMonth.sundayDate, 5))}</strong></p>
          <p style={styles.note}>Enviar 2 días antes: <strong>{toSpanishDate(shiftDays(selectedMonth.sundayDate, 2))}</strong></p>

          <div style={styles.row}>
            <button type="button" style={styles.reminderBtn} onClick={() => copyReminder(5)}>Copiar mensaje (5 días antes)</button>
            <button type="button" style={styles.reminderBtn} onClick={() => copyReminder(2)}>Copiar mensaje (2 días antes)</button>
          </div>
        </div>

        {status && <p style={styles.status}>{status}</p>}
      </div>
    </div>
  )
}

const styles = {
  page: {
    padding: '24px'
  },
  card: {
    maxWidth: '1080px',
    margin: '0 auto',
    background: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
  },
  title: {
    marginTop: 0,
    marginBottom: '4px'
  },
  subtitle: {
    marginTop: 0,
    color: '#4b5563'
  },
  monthSection: {
    marginTop: '24px',
    borderTop: '1px solid #e5e7eb',
    paddingTop: '16px'
  },
  monthTitle: {
    marginTop: 0,
    marginBottom: '12px'
  },
  row: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  col: {
    flex: '1 1 300px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 600,
    color: '#111827'
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    padding: '10px 12px',
    marginBottom: '10px'
  },
  textarea: {
    width: '100%',
    minHeight: '84px',
    boxSizing: 'border-box',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    padding: '10px 12px',
    marginBottom: '10px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '8px'
  },
  th: {
    textAlign: 'left',
    borderBottom: '1px solid #e5e7eb',
    padding: '8px',
    color: '#374151'
  },
  td: {
    borderBottom: '1px solid #f3f4f6',
    padding: '8px',
    verticalAlign: 'top'
  },
  saveBtn: {
    marginTop: '18px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  reminderBox: {
    marginTop: '20px',
    padding: '16px',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0'
  },
  reminderBtn: {
    background: '#0369a1',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    cursor: 'pointer'
  },
  note: {
    marginTop: '6px',
    marginBottom: '8px',
    color: '#334155'
  },
  status: {
    marginTop: '14px',
    fontWeight: 600
  }
}
