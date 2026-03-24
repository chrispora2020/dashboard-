import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import API_BASE from '../config'
import { normalizePlanPayload, PLAN_STORAGE_KEY } from '../utils/stakeMessagesPlan'

const API_PATH = '/api/stake-messages-plan'

const FALLBACK_PLAN = normalizePlanPayload({
  quarterLabel: 'Plan trimestral de discursos',
  months: []
})

const MOTIVATIONAL_QUOTE = {
  text: 'Si estáis preparados, no temeréis.',
  reference: 'Doctrina y Convenios 38:30'
}

function toSpanishDate(isoDate) {
  if (!isoDate) return 'Fecha pendiente'

  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('es-UY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export default function SpeakersPlanView() {
  const [planData, setPlanData] = useState(FALLBACK_PLAN)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const quarterOptions = useMemo(
    () => Object.entries(planData.quarters).map(([id, value]) => ({ id, label: value.quarterLabel || id })),
    [planData.quarters]
  )

  const activeQuarter = useMemo(() => {
    if (planData.quarters[planData.activeQuarterId]) {
      return planData.quarters[planData.activeQuarterId]
    }
    return quarterOptions[0]?.id ? planData.quarters[quarterOptions[0].id] : { quarterLabel: '', months: [] }
  }, [planData, quarterOptions])

  useEffect(() => {
    async function loadPlan() {
      try {
        const { data } = await axios.get(`${API_BASE}${API_PATH}`)

        if (data?.plan && Object.keys(data.plan).length) {
          const normalized = normalizePlanPayload(data.plan)
          setPlanData(normalized)
          localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(normalized))
        } else {
          const cachedPlan = localStorage.getItem(PLAN_STORAGE_KEY)
          if (cachedPlan) {
            setPlanData(normalizePlanPayload(JSON.parse(cachedPlan)))
          }
        }
      } catch (requestError) {
        let loadedFromCache = false
        try {
          const cachedPlan = localStorage.getItem(PLAN_STORAGE_KEY)
          if (cachedPlan) {
            setPlanData(normalizePlanPayload(JSON.parse(cachedPlan)))
            loadedFromCache = true
          }
        } catch (cacheError) {
          console.warn('No fue posible leer el plan cacheado', cacheError)
        }
        if (!loadedFromCache) {
          setError('No fue posible cargar el plan en este momento. Intenta nuevamente en unos minutos.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadPlan()
  }, [])

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <section style={styles.hero}>
          <h2 style={styles.title}>Plan de discursos y temas</h2>
          <p style={styles.subtitle}>
            Espacio para que cada discursante revise su tema con tiempo y pueda prepararse con oración.
          </p>
          <div style={styles.quoteCard}>
            <p style={styles.quoteText}>“{MOTIVATIONAL_QUOTE.text}”</p>
            <p style={styles.quoteReference}>{MOTIVATIONAL_QUOTE.reference}</p>
          </div>
        </section>

        {loading && <p style={styles.message}>Cargando plan persistido...</p>}

        {!loading && error && <p style={styles.error}>{error}</p>}

        {!loading && !error && (
          <section>
            <div style={styles.headerRow}>
              <h3 style={styles.planLabel}>{activeQuarter.quarterLabel}</h3>
              <select
                style={styles.quarterSelect}
                value={planData.activeQuarterId}
                onChange={(event) => setPlanData((prev) => ({ ...prev, activeQuarterId: event.target.value }))}
              >
                {quarterOptions.map((quarter) => (
                  <option key={quarter.id} value={quarter.id}>{quarter.label}</option>
                ))}
              </select>
            </div>

            {activeQuarter.months?.length ? (
              <div style={styles.grid}>
                {activeQuarter.months.map((month) => (
                  <article key={month.id} style={styles.card}>
                    <p style={styles.month}>{month.monthLabel}</p>
                    <p style={styles.date}>{toSpanishDate(month.sundayDate)}</p>
                    <p style={styles.topicTitle}>Tema del discurso: {month.topicTitle || 'Tema pendiente'}</p>
                    {month.topicUrl ? (
                      <a href={month.topicUrl} target="_blank" rel="noreferrer" style={styles.link}>
                        Abrir discurso
                      </a>
                    ) : null}

                    {(month.topicPreviewTitle || month.topicPreviewImage || month.topicPreviewDescription) && (
                      <div style={styles.previewCard}>
                        {month.topicPreviewImage ? <img src={month.topicPreviewImage} alt="Miniatura del tema" style={styles.previewImage} /> : null}
                        <div style={styles.previewContent}>
                          <p style={styles.previewLabel}>Vista previa del discurso</p>
                          <p style={styles.previewTitle}>{month.topicPreviewTitle || 'Título detectado automáticamente'}</p>
                          {month.topicPreviewDescription ? <p style={styles.previewDescription}>{month.topicPreviewDescription}</p> : null}
                        </div>
                      </div>
                    )}

                    <div style={styles.unitsBlock}>
                      {month.units?.map((unit, index) => (
                        <div key={`${month.id}-${index}`} style={styles.unitCard}>
                          <span style={styles.unitName}>{unit.unit}</span>
                          <span style={styles.speakerLabel}>Discursante</span>
                          <span style={styles.speaker}>{unit.speaker || 'Pendiente'}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p style={styles.message}>Aún no hay meses configurados en el plan.</p>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    padding: '28px 20px',
    background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
    minHeight: 'calc(100vh - 84px)'
  },
  container: {
    maxWidth: '1100px',
    margin: '0 auto'
  },
  hero: {
    background: '#ffffff',
    borderRadius: '18px',
    padding: '24px',
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
    marginBottom: '24px'
  },
  title: {
    margin: 0,
    fontSize: '30px',
    color: '#1e1b4b'
  },
  subtitle: {
    marginTop: '8px',
    marginBottom: '16px',
    color: '#475569'
  },
  quoteCard: {
    border: '1px solid #c7d2fe',
    borderRadius: '12px',
    padding: '14px 16px',
    background: '#eef2ff'
  },
  quoteText: {
    margin: 0,
    fontSize: '18px',
    color: '#312e81',
    fontWeight: 600
  },
  quoteReference: {
    marginTop: '6px',
    marginBottom: 0,
    color: '#4338ca'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px'
  },
  quarterSelect: {
    minWidth: '250px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '8px 10px'
  },
  planLabel: {
    marginTop: 0,
    marginBottom: '14px',
    color: '#1f2937'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px'
  },
  card: {
    background: '#fff',
    borderRadius: '14px',
    padding: '18px',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
    border: '1px solid #e2e8f0'
  },
  month: {
    margin: 0,
    fontWeight: 700,
    color: '#111827',
    fontSize: '20px'
  },
  date: {
    marginTop: '4px',
    color: '#64748b'
  },
  topicTitle: {
    marginTop: '10px',
    marginBottom: '6px',
    color: '#1e3a8a',
    fontWeight: 600
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 600
  },
  previewCard: {
    marginTop: '10px',
    padding: '10px',
    borderRadius: '10px',
    border: '1px solid #dbeafe',
    background: '#eff6ff',
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    flexWrap: 'wrap'
  },
  previewImage: {
    width: '64px',
    height: '64px',
    borderRadius: '8px',
    objectFit: 'cover',
    border: '1px solid #bfdbfe'
  },
  previewContent: {
    minWidth: '180px',
    flex: '1 1 180px'
  },
  previewLabel: {
    margin: '0 0 4px 0',
    color: '#3730a3',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  previewTitle: {
    margin: 0,
    color: '#1e3a8a',
    fontWeight: 600
  },
  previewDescription: {
    margin: '4px 0 0 0',
    color: '#1e40af',
    fontSize: '13px'
  },
  unitsBlock: {
    marginTop: '14px',
    borderTop: '1px solid #e5e7eb',
    paddingTop: '12px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px'
  },
  unitCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '10px'
  },
  unitName: {
    color: '#0f172a',
    fontWeight: 700
  },
  speakerLabel: {
    color: '#64748b',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  speaker: {
    color: '#1e293b',
    fontSize: '14px'
  },
  message: {
    color: '#334155'
  },
  error: {
    color: '#b91c1c',
    background: '#fee2e2',
    border: '1px solid #fecaca',
    padding: '10px 12px',
    borderRadius: '8px'
  }
}
