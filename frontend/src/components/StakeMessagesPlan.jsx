import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import API_BASE from '../config'
import { DEFAULT_PLAN, normalizePlanPayload, PLAN_STORAGE_KEY } from '../utils/stakeMessagesPlan'

const API_PATH = '/api/stake-messages-plan'
const PREVIEW_API_PATH = '/api/stake-messages-link-preview'

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

  lines.push('Este tema aplica para todo el grupo del mes.')

  for (const unit of month.units) {
    lines.push(`${unit.unit} - ${unit.speaker}`)
  }

  if (plan.closingMessage?.trim()) {
    lines.push('', plan.closingMessage)
  }

  return lines.join('\n')
}

function buildQuarterId(monthStartLabel) {
  return `${monthStartLabel.toLowerCase().replaceAll(' ', '-')}-${Date.now()}`
}

export default function StakeMessagesPlan({ canEdit = true }) {
  const [planData, setPlanData] = useState(DEFAULT_PLAN)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [selectedMonthId, setSelectedMonthId] = useState('abril')
  const [previewLoadingId, setPreviewLoadingId] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  const quarterOptions = useMemo(
    () => Object.entries(planData.quarters).map(([id, value]) => ({ id, label: value.quarterLabel || id })),
    [planData.quarters]
  )

  const activeQuarter = useMemo(() => {
    if (planData.quarters[planData.activeQuarterId]) {
      return planData.quarters[planData.activeQuarterId]
    }

    const fallbackQuarterId = quarterOptions[0]?.id
    return fallbackQuarterId ? planData.quarters[fallbackQuarterId] : null
  }, [planData, quarterOptions])

  useEffect(() => {
    async function loadPlan() {
      try {
        const { data } = await axios.get(`${API_BASE}${API_PATH}`)
        if (data?.plan && Object.keys(data.plan).length) {
          const normalized = normalizePlanPayload(data.plan)
          setPlanData(normalized)
          const firstMonthId = normalized.quarters[normalized.activeQuarterId]?.months?.[0]?.id || 'abril'
          setSelectedMonthId(firstMonthId)
          localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(normalized))
        } else {
          const cachedPlan = localStorage.getItem(PLAN_STORAGE_KEY)
          if (cachedPlan) {
            const normalized = normalizePlanPayload(JSON.parse(cachedPlan))
            setPlanData(normalized)
            setSelectedMonthId(normalized.quarters[normalized.activeQuarterId]?.months?.[0]?.id || 'abril')
          }
        }
      } catch (error) {
        try {
          const cachedPlan = localStorage.getItem(PLAN_STORAGE_KEY)
          if (cachedPlan) {
            const normalized = normalizePlanPayload(JSON.parse(cachedPlan))
            setPlanData(normalized)
            setSelectedMonthId(normalized.quarters[normalized.activeQuarterId]?.months?.[0]?.id || 'abril')
          }
        } catch (cacheError) {
          console.warn('No se pudo leer el plan cacheado.', cacheError)
        }
        console.warn('No se pudo cargar plan persistido. Se usa el plan por defecto.', error)
      } finally {
        setLoading(false)
      }
    }

    loadPlan()
  }, [])

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  const selectedMonth = useMemo(
    () => activeQuarter?.months?.find((month) => month.id === selectedMonthId) || activeQuarter?.months?.[0],
    [activeQuarter, selectedMonthId]
  )

  function updateActiveQuarter(patch) {
    setPlanData((prev) => ({
      ...prev,
      quarters: {
        ...prev.quarters,
        [prev.activeQuarterId]: {
          ...prev.quarters[prev.activeQuarterId],
          ...patch
        }
      }
    }))
  }

  function updateMonth(monthId, patch) {
    setPlanData((prev) => ({
      ...prev,
      quarters: {
        ...prev.quarters,
        [prev.activeQuarterId]: {
          ...prev.quarters[prev.activeQuarterId],
          months: prev.quarters[prev.activeQuarterId].months.map((month) => (month.id === monthId ? { ...month, ...patch } : month))
        }
      }
    }))
  }

  function updateUnitField(monthId, unitIndex, patch) {
    setPlanData((prev) => ({
      ...prev,
      quarters: {
        ...prev.quarters,
        [prev.activeQuarterId]: {
          ...prev.quarters[prev.activeQuarterId],
          months: prev.quarters[prev.activeQuarterId].months.map((month) => {
            if (month.id !== monthId) return month

            return {
              ...month,
              units: month.units.map((unit, idx) => (idx === unitIndex ? { ...unit, ...patch } : unit))
            }
          })
        }
      }
    }))
  }

  function createNewQuarterFromCurrent() {
    if (!activeQuarter) return
    const quarterId = buildQuarterId(activeQuarter.months?.[0]?.monthLabel || 'trimestre')

    setPlanData((prev) => ({
      activeQuarterId: quarterId,
      quarters: {
        ...prev.quarters,
        [quarterId]: JSON.parse(JSON.stringify(activeQuarter))
      }
    }))
    setStatus('✅ Nuevo trimestre creado a partir del trimestre actual. Ya puedes editarlo y guardarlo.')
  }

  async function fetchLinkPreview(monthId) {
    const month = activeQuarter?.months?.find((item) => item.id === monthId)
    if (!month?.topicUrl) return

    setPreviewLoadingId(monthId)
    setStatus('')

    try {
      const { data } = await axios.get(`${API_BASE}${PREVIEW_API_PATH}`, { params: { url: month.topicUrl } })
      if (!data?.ok) {
        setStatus(`⚠️ No se pudo obtener preview para ${month.monthLabel}.`) 
        return
      }

      updateMonth(monthId, {
        topicPreviewTitle: data.title || '',
        topicPreviewImage: data.image || '',
        topicPreviewDescription: data.description || ''
      })

      if (!month.topicTitle || month.topicTitle === 'Tema de conferencia') {
        updateMonth(monthId, { topicTitle: data.title || month.topicTitle })
      }

      setStatus(`✅ Preview actualizado para ${month.monthLabel}.`)
    } catch (error) {
      setStatus(`⚠️ No se pudo cargar preview: ${error.response?.data?.detail || error.message}`)
    } finally {
      setPreviewLoadingId('')
    }
  }

  async function savePlan() {
    if (!canEdit) {
      return
    }

    setSaving(true)
    setStatus('')

    try {
      await axios.post(`${API_BASE}${API_PATH}`, { plan: planData })
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(planData))
      setStatus('✅ Plan guardado correctamente.')
    } catch (error) {
      setStatus(`❌ No se pudo guardar: ${error.response?.data?.detail || error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function copyReminder(daysBefore) {
    const text = buildReminderText(activeQuarter, selectedMonth, daysBefore)
    await navigator.clipboard.writeText(text)
    setStatus(`✅ Mensaje copiado para enviar ${daysBefore} días antes.`)
  }

  function clearMonthLink(monthId) {
    updateMonth(monthId, { topicUrl: '' })
    setStatus('🧹 Link limpiado. Puedes pegar uno nuevo.')
  }

  async function pasteMonthLink(monthId) {
    try {
      const value = await navigator.clipboard.readText()
      if (!value?.trim()) {
        setStatus('⚠️ El portapapeles está vacío.')
        return
      }

      updateMonth(monthId, { topicUrl: value.trim() })
      setStatus('📋 Link pegado desde portapapeles.')
    } catch (error) {
      setStatus('⚠️ No se pudo leer el portapapeles. Revisa permisos del navegador.')
    }
  }

  if (loading || !activeQuarter) {
    return <div style={styles.page}>Cargando plan trimestral...</div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Mensajes de Estaca Maroñas</h2>
        <p style={styles.subtitle}>
          {canEdit ? 'Plan editable y persistente para el trimestre.' : 'Vista de solo lectura del plan trimestral.'}
        </p>

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Trimestre activo</label>
            <select
              style={styles.input}
              value={planData.activeQuarterId}
              disabled={!canEdit}
              onChange={(event) => {
                if (!canEdit) return
                const quarterId = event.target.value
                setPlanData((prev) => ({ ...prev, activeQuarterId: quarterId }))
                setSelectedMonthId(planData.quarters[quarterId]?.months?.[0]?.id || 'abril')
              }}
            >
              {quarterOptions.map((quarter) => (
                <option key={quarter.id} value={quarter.id}>{quarter.label}</option>
              ))}
            </select>
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Acciones de trimestre</label>
            <button type="button" style={styles.secondaryBtn} onClick={createNewQuarterFromCurrent} disabled={!canEdit}>Duplicar trimestre para nuevo periodo</button>
          </div>
        </div>

        <label style={styles.label}>Título del plan</label>
        <input
          style={styles.input}
          value={activeQuarter.quarterLabel}
          disabled={!canEdit}
          onChange={(event) => updateActiveQuarter({ quarterLabel: event.target.value })}
        />

        <label style={styles.label}>Introducción del mensaje</label>
        <textarea
          style={styles.textarea}
          value={activeQuarter.introMessage}
          disabled={!canEdit}
          onChange={(event) => updateActiveQuarter({ introMessage: event.target.value })}
        />

        <label style={styles.label}>Cierre del mensaje</label>
        <textarea
          style={styles.textarea}
          value={activeQuarter.closingMessage}
          disabled={!canEdit}
          onChange={(event) => updateActiveQuarter({ closingMessage: event.target.value })}
        />

        {activeQuarter.months.map((month) => (
          <section key={month.id} style={styles.monthSection}>
            <h3 style={styles.monthTitle}>{month.monthLabel} · {toSpanishDate(month.sundayDate)}</h3>

            <div style={styles.row}>
              <div style={styles.col}>
                <label style={styles.label}>Fecha (domingo)</label>
                <input
                  type="date"
                  style={styles.input}
                  value={month.sundayDate}
                  disabled={!canEdit}
                  onChange={(event) => updateMonth(month.id, { sundayDate: event.target.value })}
                />
              </div>
              <div style={styles.col}>
                <label style={styles.label}>Tema</label>
                <input
                  style={styles.input}
                  value={month.topicTitle}
                  disabled={!canEdit}
                  onChange={(event) => updateMonth(month.id, { topicTitle: event.target.value })}
                />
              </div>
            </div>

            <p style={styles.note}>El tema y link de este mes son generales para todo el grupo.</p>

            <label style={styles.label}>Link del tema</label>
            <div style={{ ...styles.row, ...styles.linkRow, ...(isMobile ? styles.linkRowMobile : null) }}>
              <input
                style={{ ...styles.input, ...styles.linkInput, marginBottom: 0, flex: 1 }}
                value={month.topicUrl}
                disabled={!canEdit}
                onChange={(event) => updateMonth(month.id, { topicUrl: event.target.value })}
                placeholder="Pega aquí el link del tema"
              />
              <div style={{ ...styles.linkActions, ...(isMobile ? styles.linkActionsMobile : null) }}>
                <button type="button" style={styles.iconBtn} onClick={() => clearMonthLink(month.id)} title="Limpiar link" disabled={!canEdit}>
                  🧹 Limpiar
                </button>
                <button type="button" style={styles.iconBtn} onClick={() => pasteMonthLink(month.id)} title="Pegar link" disabled={!canEdit}>
                  📋 Pegar
                </button>
              </div>
              <button type="button" style={styles.secondaryBtn} onClick={() => fetchLinkPreview(month.id)} disabled={previewLoadingId === month.id || !canEdit}>
                {previewLoadingId === month.id ? 'Cargando preview...' : 'Cargar preview'}
              </button>
            </div>

            {(month.topicPreviewTitle || month.topicPreviewImage) && (
              <div style={styles.previewCard}>
                {month.topicPreviewImage && <img src={month.topicPreviewImage} alt="Preview del enlace" style={styles.previewImage} />}
                <div>
                  <strong>{month.topicPreviewTitle || 'Título no encontrado'}</strong>
                  {month.topicPreviewDescription ? <p style={styles.previewDescription}>{month.topicPreviewDescription}</p> : null}
                </div>
              </div>
            )}

            <label style={styles.label}>Notas</label>
            <textarea
              style={styles.textarea}
              value={month.notes || ''}
              disabled={!canEdit}
              onChange={(event) => updateMonth(month.id, { notes: event.target.value })}
              placeholder="Ej: Si hay conferencia de unidad, no hay mensaje de estaca."
            />

            <p style={styles.assignedTalksTitle}>Discursos asignados por unidad</p>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Unidad</th>
                  <th style={styles.th}>Discurso asignado</th>
                </tr>
              </thead>
              <tbody>
                {month.units.map((unit, index) => (
                  <tr key={`${month.id}-${index}`}>
                    <td style={styles.td}>
                      <input
                        style={styles.input}
                        value={unit.unit}
                        disabled={!canEdit}
                        onChange={(event) => updateUnitField(month.id, index, { unit: event.target.value })}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        style={styles.input}
                        value={unit.speaker}
                        disabled={!canEdit}
                        onChange={(event) => updateUnitField(month.id, index, { speaker: event.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        {canEdit ? (
          <button type="button" onClick={savePlan} style={styles.saveBtn} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar plan trimestral'}
          </button>
        ) : null}

        <div style={styles.reminderBox}>
          <h3 style={styles.monthTitle}>Recordatorios para grupo</h3>
          <p style={styles.note}>Se generan los textos para copiar/pegar. El envío automático tipo chatbot requiere integración externa (WhatsApp/Telegram).</p>

          <label style={styles.label}>Mes para recordatorio</label>
          <select
            style={styles.input}
            value={selectedMonth?.id}
            onChange={(event) => setSelectedMonthId(event.target.value)}
          >
            {activeQuarter.months.map((month) => (
              <option key={month.id} value={month.id}>{month.monthLabel}</option>
            ))}
          </select>

          <p style={styles.note}>Enviar 5 días antes: <strong>{toSpanishDate(shiftDays(selectedMonth?.sundayDate, 5))}</strong></p>
          <p style={styles.note}>Enviar 2 días antes: <strong>{toSpanishDate(shiftDays(selectedMonth?.sundayDate, 2))}</strong></p>

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
    flexWrap: 'wrap',
    alignItems: 'center'
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
    marginBottom: '10px',
    fontSize: '16px',
    minHeight: '42px'
  },
  textarea: {
    width: '100%',
    minHeight: '84px',
    boxSizing: 'border-box',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    padding: '10px 12px',
    marginBottom: '10px',
    fontSize: '16px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '8px'
  },
  assignedTalksTitle: {
    marginTop: '12px',
    marginBottom: '6px',
    color: '#0f172a',
    fontWeight: 700
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
  secondaryBtn: {
    background: '#e2e8f0',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    minHeight: '42px'
  },
  iconBtn: {
    background: '#f8fafc',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    minHeight: '42px',
    whiteSpace: 'nowrap'
  },
  linkRow: {
    alignItems: 'stretch'
  },
  linkRowMobile: {
    flexDirection: 'column'
  },
  linkInput: {
    minHeight: '46px'
  },
  linkActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  linkActionsMobile: {
    width: '100%'
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
  previewCard: {
    marginTop: '8px',
    marginBottom: '10px',
    padding: '10px',
    borderRadius: '10px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  previewImage: {
    width: '72px',
    height: '72px',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '1px solid #cbd5e1'
  },
  previewDescription: {
    margin: '6px 0 0 0',
    color: '#475569',
    fontSize: '14px'
  },
  status: {
    marginTop: '14px',
    fontWeight: 600
  }
}
