import axios from 'axios'
import { useState } from 'react'
import API_BASE from '../config'
import KPICard from './KPICard'

export default function ApiDashboard() {
  const [year, setYear] = useState('2026')
  const [cookie, setCookie] = useState('')
  const [authorization, setAuthorization] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null)

  async function cargarIndicadores() {
    setLoading(true)
    setError('')

    try {
      const { data } = await axios.post(`${API_BASE}/api/lcr/indicadores`, {
        year: Number(year),
        cookie: cookie || null,
        authorization: authorization || null,
      })
      setResultado(data)
    } catch (e) {
      setResultado(null)
      setError(e.response?.data?.detail || 'No fue posible consultar APIs de LCR')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Dashboard API (beta)</h2>
      <p style={styles.help}>Esta solapa clona el dashboard para empezar a traer indicadores directo desde API.</p>

      <div style={styles.formCard}>
        <div style={styles.formGrid}>
          <label style={styles.field}>
            Año
            <input value={year} onChange={(e) => setYear(e.target.value)} style={styles.input} />
          </label>
          <label style={styles.field}>
            Cookie de sesión LCR
            <input value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder='opcionales: cookie completa' style={styles.input} />
          </label>
          <label style={styles.field}>
            Authorization header
            <input value={authorization} onChange={(e) => setAuthorization(e.target.value)} placeholder='Bearer ... (opcional)' style={styles.input} />
          </label>
        </div>
        <button onClick={cargarIndicadores} disabled={loading} style={styles.button}>
          {loading ? 'Consultando...' : 'Cargar indicadores desde API'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {resultado && (
        <>
          <div style={styles.grid}>
            <KPICard
              title='Asistencia Sacramental'
              meta={resultado.asistencia.meta}
              actual={resultado.asistencia.total}
              potencial={resultado.asistencia.total}
              comentario='Promedio por unidad y luego suma total.'
              color={resultado.asistencia.porcentaje_logro >= 80 ? '#10b981' : resultado.asistencia.porcentaje_logro >= 50 ? '#f59e0b' : '#ef4444'}
            />
            <KPICard
              title='Jóvenes con Recomendación'
              meta={resultado.jovenes_recomendacion.meta}
              actual={resultado.jovenes_recomendacion.porcentaje}
              potencial={resultado.jovenes_recomendacion.porcentaje}
              unit='%'
              comentario={`Activos + vence pronto: ${resultado.jovenes_recomendacion.activos_mas_vence_pronto} / ${resultado.jovenes_recomendacion.total_jovenes}`}
              color={resultado.jovenes_recomendacion.porcentaje >= 80 ? '#10b981' : resultado.jovenes_recomendacion.porcentaje >= 50 ? '#f59e0b' : '#ef4444'}
            />
          </div>

          <div style={styles.tableCard}>
            <h3 style={{ marginTop: 0 }}>Asistencia por unidad</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Unidad</th>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Promedio</th>
                  <th style={styles.th}>Muestras</th>
                </tr>
              </thead>
              <tbody>
                {resultado.asistencia.unidades.map((item) => (
                  <tr key={item.unidad_id}>
                    <td style={styles.td}>{item.unidad}</td>
                    <td style={styles.td}>{item.unidad_id}</td>
                    <td style={styles.td}>{item.promedio}</td>
                    <td style={styles.td}>{item.cantidad_muestras}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  page: { maxWidth: 1200, margin: '0 auto', padding: 20 },
  title: { marginBottom: 6 },
  help: { marginTop: 0, color: '#555' },
  formCard: { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: 12, marginBottom: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 600, fontSize: 14 },
  input: { padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d7de', fontSize: 14 },
  button: { padding: '10px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 },
  error: { marginTop: 12, background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8 },
  grid: { marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 },
  tableCard: { marginTop: 20, background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px 6px' },
  td: { borderBottom: '1px solid #f1f5f9', padding: '8px 6px' }
}
