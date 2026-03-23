import axios from 'axios'
import { useEffect, useState } from 'react'
import API_BASE from '../config'

const API_PATH = '/api/stake-messages-plan'

const FALLBACK_PLAN = {
  quarterLabel: 'Plan trimestral de discursos',
  months: []
}

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
  const [plan, setPlan] = useState(FALLBACK_PLAN)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPlan() {
      try {
        const { data } = await axios.get(`${API_BASE}${API_PATH}`)

        if (data?.plan) {
          setPlan(data.plan)
        }
      } catch (requestError) {
        setError('No fue posible cargar el plan en este momento. Intenta nuevamente en unos minutos.')
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
            <h3 style={styles.planLabel}>{plan.quarterLabel}</h3>

            {plan.months?.length ? (
              <div style={styles.grid}>
                {plan.months.map((month) => (
                  <article key={month.id} style={styles.card}>
                    <p style={styles.month}>{month.monthLabel}</p>
                    <p style={styles.date}>{toSpanishDate(month.sundayDate)}</p>
                    <p style={styles.topicTitle}>{month.topicTitle || 'Tema pendiente'}</p>
                    {month.topicUrl ? (
                      <a href={month.topicUrl} target="_blank" rel="noreferrer" style={styles.link}>
                        Ver tema de estudio
                      </a>
                    ) : null}

                    <div style={styles.unitsBlock}>
                      {month.units?.map((unit, index) => (
                        <div key={`${month.id}-${index}`} style={styles.unitRow}>
                          <span style={styles.unitName}>{unit.unit}</span>
                          <span style={styles.speaker}>{unit.speaker}</span>
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
  unitsBlock: {
    marginTop: '14px',
    borderTop: '1px solid #e5e7eb',
    paddingTop: '10px'
  },
  unitRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '8px'
  },
  unitName: {
    color: '#334155',
    fontWeight: 600
  },
  speaker: {
    color: '#0f172a'
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
