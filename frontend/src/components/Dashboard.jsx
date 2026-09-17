import axios from 'axios'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import API_BASE from '../config'
import KPICard from './KPICard'
import DetalleConversos from './DetalleConversos'
import DetallePanel from './DetallePanel'
import { getMinisteringSummary, MINISTERING_API_PATH, MINISTERING_STORAGE_KEY, parseMinisteringText } from '../utils/ministering'

const KPI_JOVENES_STORAGE_KEY = 'dashboard_kpi_jovenes_cache'
const KPI_ADULTOS_STORAGE_KEY = 'dashboard_kpi_adultos_cache'
const KPI_MISIONEROS_STORAGE_KEY = 'dashboard_kpi_misioneros_cache'
const KPI_ASISTENCIA_STORAGE_KEY = 'dashboard_kpi_asistencia_cache'

function readCachedJSON(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallbackValue
    return JSON.parse(raw)
  } catch {
    return fallbackValue
  }
}

function writeCachedJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // noop
  }
}

export default function Dashboard() {

  const [kpis, setKpis] = useState([])
  const [loading, setLoading] = useState(true)
  const kpiRequest = useRef(0)
  const [listaConversos, setListaConversos] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [periodoActual, setPeriodoActual] = useState('2026')
  const [trendData, setTrendData] = useState([])
  const [detalleKPI, setDetalleKPI] = useState(null)
  const [detalleError, setDetalleError] = useState(null)
  const [detalleIntento, setDetalleIntento] = useState(0)
  const [detalleOpen, setDetalleOpen] = useState(null)
  const [kpiJovenes, setKpiJovenes] = useState(null)
  const [detalleJovenesOpen, setDetalleJovenesOpen] = useState(false)
  const [kpiAdultos, setKpiAdultos] = useState(null)
  const [detalleAdultosOpen, setDetalleAdultosOpen] = useState(false)
  const [kpiMisioneros, setKpiMisioneros] = useState(null)
  const [detalleMisionerosOpen, setDetalleMisionerosOpen] = useState(false)
  const [detalleAsistenciaOpen, setDetalleAsistenciaOpen] = useState(false)
  const [kpiAsistencia, setKpiAsistencia] = useState(null)
  const [asistenciaInput, setAsistenciaInput] = useState('')
  const [asistenciaSaving, setAsistenciaSaving] = useState(false)
  const [detalleMinisteringOpen, setDetalleMinisteringOpen] = useState(false)
  const [ministeringRawText, setMinisteringRawText] = useState(() => localStorage.getItem(MINISTERING_STORAGE_KEY) || '')
  const indicadoresRef = useRef(null)
  const ministeringParsed = useMemo(() => parseMinisteringText(ministeringRawText), [ministeringRawText])
  const ministeringSummary = useMemo(() => getMinisteringSummary(ministeringParsed), [ministeringParsed])
  const barriosOrdenados = useMemo(() => Object.keys(kpiAsistencia?.desglose || {}), [kpiAsistencia])

  const getMinisteringUnitName = (unitName, index) => {
    if (!unitName) return barriosOrdenados[index] || ''
    const isFallbackLabel = /^(Hermanos|Hermanas)\s+\d+$/i.test(unitName.trim())
    if (isFallbackLabel && barriosOrdenados[index]) {
      return barriosOrdenados[index]
    }
    return unitName
  }

  const resumenGeneralData = [
    ...kpis.map((kpi) => ({
      nombre: kpi.title,
      actual: kpi.actual ?? 0,
      meta: kpi.meta ?? 0
    })),
    ...(kpiJovenes ? [{ nombre: 'Jóvenes con Recomendación', actual: kpiJovenes.real ?? 0, meta: 100 }] : []),
    ...(kpiAdultos ? [{ nombre: 'Adultos con Recomendación', actual: kpiAdultos.real ?? 0, meta: 390 }] : []),
    ...(kpiMisioneros ? [{ nombre: 'Misioneros en el Campo', actual: kpiMisioneros.real ?? 0, meta: 19 }] : []),
    ...(kpiAsistencia ? [{ nombre: 'Asistencia Sacramental', actual: kpiAsistencia.real ?? 0, meta: 550 }] : [])
  ].filter((indicador) => indicador.meta > 0)

  function handleDetalleClick(kpi) {
    setDetalleKPI(null)
    setDetalleError(null)
    setDetalleOpen(kpi.id)
  }

  useEffect(() => {
    if (!detalleOpen) return
    const controller = new AbortController()
    setDetalleKPI(null)
    setDetalleError(null)
    axios.get(`${API_BASE}/api/kpis/${detalleOpen}`, {
      params: { periodo: periodoActual }, signal: controller.signal, timeout: 30000
    }).then(({ data }) => {
      if (!controller.signal.aborted) setDetalleKPI(data)
    }).catch(() => {
      if (!controller.signal.aborted) setDetalleError('No pudimos cargar el detalle. Intenta nuevamente.')
    })
    return () => controller.abort()
  }, [detalleOpen, periodoActual, detalleIntento])

  console.log('Dashboard component rendering')

  useEffect(() => {
    fetchJovenesKPI()
    fetchAdultosKPI()
    fetchMisionerosKPI()
    fetchAsistenciaKPI()
  }, [periodoActual])

  useEffect(() => {
    const refresh = () => {
      if (!document.querySelector('dialog[open]')) fetchKPIs()
    }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('conversos-importados', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      kpiRequest.current += 1
      window.removeEventListener('focus', refresh)
      window.removeEventListener('conversos-importados', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [periodoActual])

  useEffect(() => {
    async function syncMinistering() {
      try {
        const { data } = await axios.get(`${API_BASE}${MINISTERING_API_PATH}`)
        const persistedText = data?.text || ''
        setMinisteringRawText(persistedText)
        localStorage.setItem(MINISTERING_STORAGE_KEY, persistedText)
      } catch (err) {
        setMinisteringRawText(localStorage.getItem(MINISTERING_STORAGE_KEY) || '')
      }
    }

    syncMinistering()
    window.addEventListener('storage', syncMinistering)
    window.addEventListener('focus', syncMinistering)

    return () => {
      window.removeEventListener('storage', syncMinistering)
      window.removeEventListener('focus', syncMinistering)
    }
  }, [])

  async function fetchJovenesKPI() {
    try {
      const { data } = await axios.get(`${API_BASE}/api/jovenes/kpi`)
      setKpiJovenes(data)
      writeCachedJSON(KPI_JOVENES_STORAGE_KEY, data)
    } catch (e) {
      const cached = readCachedJSON(KPI_JOVENES_STORAGE_KEY, null)
      setKpiJovenes(cached)
    }
  }

  async function fetchAdultosKPI() {
    try {
      const { data } = await axios.get(`${API_BASE}/api/adultos/kpi`)
      setKpiAdultos(data)
      writeCachedJSON(KPI_ADULTOS_STORAGE_KEY, data)
    } catch (e) {
      const cached = readCachedJSON(KPI_ADULTOS_STORAGE_KEY, null)
      setKpiAdultos(cached)
    }
  }

  async function fetchMisionerosKPI() {
    try {
      const { data } = await axios.get(`${API_BASE}/api/misioneros/kpi`)
      console.log('[MISIONEROS KPI]', JSON.stringify(data, null, 2))
      setKpiMisioneros(data)
      writeCachedJSON(KPI_MISIONEROS_STORAGE_KEY, data)
    } catch (e) {
      console.error('[MISIONEROS KPI] Error:', e)
      const cached = readCachedJSON(KPI_MISIONEROS_STORAGE_KEY, null)
      setKpiMisioneros(cached)
    }
  }

  async function fetchAsistenciaKPI() {
    try {
      const { data } = await axios.get(`${API_BASE}/api/asistencia/kpi?periodo=${periodoActual}`)
      setKpiAsistencia(data)
      setAsistenciaInput(data.real > 0 ? String(data.real) : '')
      writeCachedJSON(KPI_ASISTENCIA_STORAGE_KEY, data)
    } catch (e) {
      const cached = readCachedJSON(KPI_ASISTENCIA_STORAGE_KEY, null)
      setKpiAsistencia(cached)
      setAsistenciaInput(cached?.real > 0 ? String(cached.real) : '')
    }
  }

  async function guardarAsistencia() {
    const val = parseInt(asistenciaInput, 10)
    if (isNaN(val) || val < 0) return
    setAsistenciaSaving(true)
    try {
      await axios.post(`${API_BASE}/api/asistencia/registrar`, { periodo: periodoActual, valor: val })
      await fetchAsistenciaKPI()
    } catch (e) {
      alert('Error al guardar: ' + (e.response?.data?.detail || e.message))
    } finally {
      setAsistenciaSaving(false)
    }
  }

  async function fetchKPIs() {
    const request = ++kpiRequest.current
    setLoading(true)
    setRefreshing(true)
    setKpis([])
    setListaConversos(null)
    setDetalleOpen(null)
    setDetalleKPI(null)
    setTrendData([])
    setError(null)

    try {
      // Fetch resumen de KPIs
      const { data } = await axios.get(`${API_BASE}/api/kpis/resumen?periodo=${periodoActual}`, {
        timeout: 45000,
        params: { _refresh: Date.now() }
      })
      
      if (request !== kpiRequest.current) return
      setListaConversos(data.lista_conversos || null)
      
      // Mapear los datos del backend al formato del frontend
      const mappedKPIs = data.indicadores.map(ind => ({
        id: ind.indicador_id,
        title: ind.nombre,
        meta: ind.meta,
        actual: ind.valor_real,
        potencial: ind.potencial,
        porcentaje: ind.porcentaje_logro,
        comentario: ind.comentario || '',
        unit: ind.nombre.includes('Porcentaje') || ind.nombre.includes('Recomendación') || ind.nombre.includes('Ordenados') ? '%' : '',
        color: ind.semaforo === 'verde' ? '#10b981' : ind.semaforo === 'amarillo' ? '#f59e0b' : '#ef4444'
      }))

      setKpis(mappedKPIs)

      // Fetch tendencia para el primer indicador
      if (data.indicadores.length > 0) {
        const firstIndicador = data.indicadores[0]
        fetchTrend(firstIndicador.indicador_id)
      }

    } catch (err) {
      if (request !== kpiRequest.current) return
      setError(err.response?.data?.detail || 'No se pudieron consultar los indicadores actualizados.')
      setKpis([])
    } finally {
      if (request === kpiRequest.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  async function fetchTrend(indicadorId) {
    try {
      const { data } = await axios.get(`${API_BASE}/api/kpis/${indicadorId}/tendencia?periodo=${periodoActual}`)
      
      const mapped = data.tendencia.map(t => ({
        periodo: t.periodo_nombre,
        valor: t.valor_real,
        meta: t.meta
      }))

      setTrendData(mapped)
    } catch (err) {
      console.error('Error fetching trend:', err)
      setTrendData([])
    }
  }

  if (loading) {
    return (
      <div className="dashboard-page" style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}>⏳</div>
          <p>Cargando indicadores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page" style={styles.container}>
      <div className="dashboard-heading">
        <div><span className="page-eyebrow">VISIÓN GENERAL</span><h1>Unidos en el progreso</h1><p>Una mirada clara a nuestras metas y a quienes necesitan seguimiento.</p></div>
        <div className="dashboard-period"><label htmlFor="dashboard-period">Período de seguimiento</label><div style={styles.filters}>
          <select id="dashboard-period"
            style={styles.select}
            value={periodoActual}
            onChange={(e) => setPeriodoActual(e.target.value)}
          >
            <option value="2026">2026 - Año completo</option>
            <option value="Q1 2026">2026 - Q1</option>
            <option value="Q2 2026">2026 - Q2</option>
            <option value="Q3 2026">2026 - Q3</option>
            <option value="Q4 2026">2026 - Q4</option>
          </select>
        </div></div>
      </div>

      <div ref={indicadoresRef}>
        {refreshing && (
          <div style={styles.refreshingBanner}>
            <span style={styles.spinnerInline}>⏳</span> Actualizando indicadores...
          </div>
        )}
        {error && (
        <div style={styles.error}>
          <strong>⚠️ Error:</strong> {error}
          <button onClick={fetchKPIs} style={{ marginLeft: 12 }}>Reintentar</button>
          <p style={{ marginTop: '10px', fontSize: '14px' }}>
            No se muestran cifras anteriores. Vuelve a consultar para obtener los datos guardados.
          </p>
        </div>
        )}

        <h2 style={styles.sectionTitle}>Nuevos Conversos</h2>
        {listaConversos && (
          <p className="dashboard-list-status">Lista guardada: <strong>{listaConversos.total}</strong> conversos.
            {' '}En {periodoActual}: <strong>{listaConversos.en_periodo}</strong>.
            {listaConversos.fuera_periodo > 0 && ` Fuera del período o sin fecha: ${listaConversos.fuera_periodo}.`}
          </p>
        )}
        <div className="kpi-grid" style={styles.grid}>
        {kpis.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No hay indicadores disponibles.</p>
            <p>Ve a <a href="/conversos" style={styles.link}>Conversos</a> para importar datos.</p>
          </div>
        ) : (
          kpis.map(kpi => (
            <div key={kpi.id}>
              <KPICard
                title={kpi.title}
                meta={kpi.meta}
                actual={kpi.actual}
                potencial={kpi.unit === '%' ? kpi.potencial : undefined}
                comentario={kpi.comentario}
                unit={kpi.unit}
                color={kpi.color}
                onDetalleClick={() => handleDetalleClick(kpi)}
              />
              {detalleOpen === kpi.id && (
                <DetallePanel title={kpi.title} metrics={{ actual: detalleKPI?.resumen?.real ?? kpi.actual, potencial: kpi.unit === '%' ? (detalleKPI?.resumen?.potencial ?? kpi.potencial) : undefined, meta: detalleKPI?.resumen?.meta ?? kpi.meta, unit: kpi.unit, pendientes: kpi.unit === '%' ? (detalleKPI?.faltantes?.length ?? Math.max(0, kpi.potencial - kpi.actual)) : undefined }} subtitle={`Nuevos conversos · ${periodoActual}`} onClose={() => setDetalleOpen(null)}>
                  {detalleError ? (
                    <div className="detalle-empty" role="alert">
                      <p>{detalleError}</p>
                      <button type="button" className="detalle-back" onClick={() => setDetalleIntento(n => n + 1)}>Reintentar</button>
                    </div>
                  ) : detalleKPI ? <DetalleConversos detalle={detalleKPI} /> : (
                    <div className="detalle-loading" role="status">Cargando detalle…</div>
                  )}
                </DetallePanel>
              )}
            </div>
          ))
        )}

        </div>

      {/* ── Indicadores: Jóvenes · Adultos · Misioneros · Asistencia ── */}
      <div style={{marginTop: 32}}>
        <div className="kpi-grid" style={styles.grid}>

          {/* Jóvenes con Recomendación */}
          {kpiJovenes && (
          <div>
            <h2 style={styles.sectionTitle}>Jóvenes con Recomendación</h2>
            <KPICard
              meta={100}
              actual={kpiJovenes.real}
              potencial={kpiJovenes.potencial}
              unit="%"
              comentario={`Activa: ${kpiJovenes.desglose?.activa ?? 0} · Vence pronto: ${kpiJovenes.desglose?.vence_pronto ?? 0}`}
              color={
                kpiJovenes.real >= 80 ? '#10b981'
                : kpiJovenes.real >= 50 ? '#f59e0b'
                : '#ef4444'
              }
              onDetalleClick={() => setDetalleJovenesOpen(v => !v)}
            />
            {detalleJovenesOpen && (
              <DetallePanel title="Jóvenes con Recomendación" metrics={{ actual: kpiJovenes.real, potencial: kpiJovenes.potencial, meta: 100, unit: '%', pendientes: Math.max(0, kpiJovenes.potencial - kpiJovenes.real) }} onClose={() => setDetalleJovenesOpen(false)}>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
                  {[
                    { label:'Activas',        key:'activa',       bg:'#dcfce7', color:'#166534' },
                    { label:'Vencen pronto',  key:'vence_pronto', bg:'#fef9c3', color:'#854d0e' },
                    { label:'Vencidas',       key:'vencida',      bg:'#fee2e2', color:'#991b1b' },
                    { label:'Canceladas',     key:'cancelada',    bg:'#f3f4f6', color:'#374151' },
                    { label:'No bautizados',  key:'no_bautizado', bg:'#ede9fe', color:'#5b21b6' },
                    { label:'Sin estado',     key:'sin_estado',   bg:'#f1f5f9', color:'#475569' },
                  ].map(({ label, key, bg, color }) => {
                    const n = kpiJovenes.desglose?.[key] ?? 0
                    if (!n) return null
                    return (
                      <span key={key} style={{display:'inline-flex',alignItems:'center',gap:6,background:bg,color,borderRadius:20,padding:'4px 12px',fontSize:13,fontWeight:600}}>
                        {label}
                        <span style={{background:color,color:'#fff',borderRadius:'50%',width:20,height:20,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700}}>{n}</span>
                      </span>
                    )
                  })}
                </div>
                <strong>Con recomendación activa ({(kpiJovenes.desglose?.activa ?? 0) + (kpiJovenes.desglose?.vence_pronto ?? 0)}):</strong>
                <ul style={{margin:'8px 0 16px 0'}}>
                  {[...(kpiJovenes.personas?.activa ?? []), ...(kpiJovenes.personas?.vence_pronto ?? [])].length > 0
                    ? [...(kpiJovenes.personas?.activa ?? []), ...(kpiJovenes.personas?.vence_pronto ?? [])].map((p, i) => (
                        <li key={i}>{p.nombre} <span style={{color:'#666',fontSize:12}}>{p.unidad ? `(${p.unidad})` : ''}{p.vencimiento ? ` · vence ${p.vencimiento}` : ''}</span></li>
                      ))
                    : <li style={{color:'#999'}}>Ninguno</li>}
                </ul>
                {(kpiJovenes.desglose?.vencida ?? 0) > 0 && (<>
                  <strong>Vencidas ({kpiJovenes.desglose.vencida}):</strong>
                  <ul style={{margin:'8px 0 16px 0'}}>
                    {(kpiJovenes.personas?.vencida ?? []).map((p, i) => (
                      <li key={i} style={{color:'#ef4444'}}>{p.nombre} <span style={{fontSize:12}}>{p.unidad ? `(${p.unidad})` : ''}</span></li>
                    ))}
                  </ul>
                </>)}
              </DetallePanel>
            )}
          </div>
          )}

          {/* Adultos con Recomendación */}
          {kpiAdultos && (
          <div>
            <h2 style={styles.sectionTitle}>Adultos con Recomendación</h2>
            <KPICard
              meta={390}
              actual={kpiAdultos.real}
              potencial={kpiAdultos.potencial}
              comentario={`Activa: ${kpiAdultos.desglose?.activa ?? 0} · Vence pronto: ${kpiAdultos.desglose?.vence_pronto ?? 0}`}
              color={
                kpiAdultos.real >= 312 ? '#10b981'
                : kpiAdultos.real >= 195 ? '#f59e0b'
                : '#ef4444'
              }
              onDetalleClick={() => setDetalleAdultosOpen(v => !v)}
            />
            {detalleAdultosOpen && (
              <DetallePanel title="Adultos con Recomendación" metrics={{ actual: kpiAdultos.real, potencial: kpiAdultos.potencial, meta: 390, pendientes: Math.max(0, kpiAdultos.potencial - kpiAdultos.real) }} onClose={() => setDetalleAdultosOpen(false)}>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
                  {[
                    { label:'Activas',       key:'activa',       bg:'#dcfce7', color:'#166534' },
                    { label:'Vencen pronto', key:'vence_pronto', bg:'#fef9c3', color:'#854d0e' },
                    { label:'Vencidas',      key:'vencida',      bg:'#fee2e2', color:'#991b1b' },
                    { label:'Canceladas',    key:'cancelada',    bg:'#f3f4f6', color:'#374151' },
                    { label:'Sin estado',    key:'sin_estado',   bg:'#f1f5f9', color:'#475569' },
                  ].map(({ label, key, bg, color }) => {
                    const n = kpiAdultos.desglose?.[key] ?? 0
                    if (!n) return null
                    return (
                      <span key={key} style={{display:'inline-flex',alignItems:'center',gap:6,background:bg,color,borderRadius:20,padding:'4px 12px',fontSize:13,fontWeight:600}}>
                        {label}
                        <span style={{background:color,color:'#fff',borderRadius:'50%',width:20,height:20,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700}}>{n}</span>
                      </span>
                    )
                  })}
                </div>
                <strong>Con recomendación activa ({(kpiAdultos.desglose?.activa ?? 0) + (kpiAdultos.desglose?.vence_pronto ?? 0)}):</strong>
                <ul style={{margin:'8px 0 16px 0'}}>
                  {[...(kpiAdultos.personas?.activa ?? []), ...(kpiAdultos.personas?.vence_pronto ?? [])].length > 0
                    ? [...(kpiAdultos.personas?.activa ?? []), ...(kpiAdultos.personas?.vence_pronto ?? [])].map((p, i) => (
                        <li key={i}>{p.nombre} <span style={{color:'#666',fontSize:12}}>{p.unidad ? `(${p.unidad})` : ''}{p.vencimiento ? ` · vence ${p.vencimiento}` : ''}</span></li>
                      ))
                    : <li style={{color:'#999'}}>Ninguno</li>}
                </ul>
                {(kpiAdultos.desglose?.vencida ?? 0) > 0 && (<>
                  <strong>Vencidas ({kpiAdultos.desglose.vencida}):</strong>
                  <ul style={{margin:'8px 0 16px 0'}}>
                    {(kpiAdultos.personas?.vencida ?? []).map((p, i) => (
                      <li key={i} style={{color:'#ef4444'}}>{p.nombre} <span style={{fontSize:12}}>{p.unidad ? `(${p.unidad})` : ''}</span></li>
                    ))}
                  </ul>
                </>)}
              </DetallePanel>
            )}
          </div>
          )}

          {/* Misioneros en el Campo */}
          <div>
            <h2 style={styles.sectionTitle}>Misioneros en el Campo</h2>
            <KPICard
              meta={19}
              actual={kpiMisioneros?.real ?? 0}
              color={
                (kpiMisioneros?.real ?? 0) >= 17 ? '#10b981'
                : (kpiMisioneros?.real ?? 0) >= 10 ? '#f59e0b'
                : '#ef4444'
              }
              comentario={kpiMisioneros?.sub_servicio > 0
                ? `+ ${kpiMisioneros.sub_servicio} misioneros de servicio a la Iglesia`
                : (kpiMisioneros?.real > 0 ? '' : 'Sin datos cargados aún')
              }
              onDetalleClick={kpiMisioneros?.real > 0 || kpiMisioneros?.sub_servicio > 0 ? () => setDetalleMisionerosOpen(v => !v) : undefined}
            />
            {detalleMisionerosOpen && (
              <DetallePanel title="Misioneros en el Campo" metrics={{ actual: kpiMisioneros?.real ?? 0, meta: 19 }} onClose={() => setDetalleMisionerosOpen(false)}>
                {/* Misioneros en el Campo */}
                {(kpiMisioneros.personas?.length > 0) && (
                  <>
                    <strong style={{fontSize:13,color:'#1e3a5f'}}>En el Campo ({kpiMisioneros.personas.length})</strong>
                    <table style={{width:'100%',borderCollapse:'collapse',marginTop:6,marginBottom:16}}>
                      <thead>
                        <tr style={{background:'#f3f4f6',borderBottom:'1px solid #ddd'}}>
                          <th style={{textAlign:'left',padding:'5px 8px',fontSize:12}}>Nombre</th>
                          <th style={{textAlign:'left',padding:'5px 8px',fontSize:12}}>Misión</th>
                          <th style={{textAlign:'left',padding:'5px 8px',fontSize:12}}>Comienzo</th>
                          <th style={{textAlign:'left',padding:'5px 8px',fontSize:12}}>Término esp.</th>
                          <th style={{textAlign:'left',padding:'5px 8px',fontSize:12}}>Unidad actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpiMisioneros.personas.map((p, i) => (
                          <tr key={i} style={{borderBottom:'1px solid #e5e7eb'}}>
                            <td style={{padding:'5px 8px',fontSize:13}}>{p.nombre}</td>
                            <td style={{padding:'5px 8px',fontSize:12,color:'#2563eb'}}>{p.mision || '-'}</td>
                            <td style={{padding:'5px 8px',fontSize:12,color:'#666'}}>{p.comenzo || '-'}</td>
                            <td style={{padding:'5px 8px',fontSize:12,color:'#666'}}>{p.termino_esperado || '-'}</td>
                            <td style={{padding:'5px 8px',fontSize:12,color:'#1e40af'}}>{p.unidad_actual || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {/* Misioneros de Servicio a la Iglesia */}
                {(kpiMisioneros.personas_servicio?.length > 0) && (
                  <>
                    <strong style={{fontSize:13,color:'#6b21a8'}}>Servicio a la Iglesia ({kpiMisioneros.personas_servicio.length})</strong>
                    <table style={{width:'100%',borderCollapse:'collapse',marginTop:6}}>
                      <thead>
                        <tr style={{background:'#f5f3ff',borderBottom:'1px solid #ddd'}}>
                          <th style={{textAlign:'left',padding:'5px 8px',fontSize:12}}>Nombre</th>
                          <th style={{textAlign:'left',padding:'5px 8px',fontSize:12}}>Comienzo</th>
                          <th style={{textAlign:'left',padding:'5px 8px',fontSize:12}}>Término esp.</th>
                          <th style={{textAlign:'left',padding:'5px 8px',fontSize:12}}>Unidad actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpiMisioneros.personas_servicio.map((p, i) => (
                          <tr key={i} style={{borderBottom:'1px solid #e5e7eb',background:'#faf5ff'}}>
                            <td style={{padding:'5px 8px',fontSize:13}}>{p.nombre}</td>
                            <td style={{padding:'5px 8px',fontSize:12,color:'#666'}}>{p.comenzo || '-'}</td>
                            <td style={{padding:'5px 8px',fontSize:12,color:'#666'}}>{p.termino_esperado || '-'}</td>
                            <td style={{padding:'5px 8px',fontSize:12,color:'#6b21a8'}}>{p.unidad_actual || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </DetallePanel>
            )}
          </div>

          {/* Asistencia Sacramental */}
          <div>
            <h2 style={styles.sectionTitle}>Asistencia Sacramental</h2>
            <KPICard
              meta={550}
              actual={kpiAsistencia?.real ?? 0}
              color={
                (kpiAsistencia?.real ?? 0) >= 495 ? '#10b981'
                : (kpiAsistencia?.real ?? 0) >= 330 ? '#f59e0b'
                : '#ef4444'
              }
              onDetalleClick={kpiAsistencia?.real > 0 ? () => setDetalleAsistenciaOpen(v => !v) : undefined}
            />
            {detalleAsistenciaOpen && (
              <DetallePanel title="Asistencia Sacramental" metrics={{ actual: kpiAsistencia?.real ?? 0, meta: 550 }} onClose={() => setDetalleAsistenciaOpen(false)}>
                <strong style={{fontSize:13,color:'#374151'}}>Desglose por barrio:</strong>
                <table style={{width:'100%',borderCollapse:'collapse',marginTop:6,fontSize:13}}>
                  <tbody>
                    {Object.entries(kpiAsistencia?.desglose || {}).map(([barrio, valor]) => (
                      <tr key={barrio} style={{borderBottom:'1px solid #e5e7eb'}}>
                        <td style={{padding:'4px 0',color:'#555'}}>{barrio}</td>
                        <td style={{padding:'4px 0',textAlign:'right',fontWeight:600,color:'#1e40af'}}>{valor}</td>
                      </tr>
                    ))}
                    <tr style={{borderTop:'2px solid #cbd5e1'}}>
                      <td style={{padding:'5px 0',fontWeight:700}}>Total</td>
                      <td style={{padding:'5px 0',textAlign:'right',fontWeight:700,color:'#1e40af'}}>{kpiAsistencia?.real ?? 0}</td>
                    </tr>
                  </tbody>
                </table>
                {Object.keys(kpiAsistencia?.desglose || {}).length === 0 && <p className="detalle-empty">No hay desglose por barrio disponible.</p>}
              </DetallePanel>
            )}
            {(!kpiAsistencia || kpiAsistencia.real === 0) && (
              <p style={{fontSize:12,color:'#999',marginTop:8}}>
                Sin datos. Cargá el archivo en <a href="/conversos" style={{color:'#667eea'}}>Cargar Listas</a>.
              </p>
            )}
          </div>

          <div>
            <h2 style={styles.sectionTitle}>Entrevistas de ministración</h2>
            <KPICard
              meta={100}
              actual={ministeringSummary.overallPercent}
              unit={'%'}
              comentario={`Hombres: ${ministeringSummary.brothersPercent}% (${ministeringSummary.brothersRatio}) · Mujeres: ${ministeringSummary.sistersPercent}% (${ministeringSummary.sistersRatio})`}
              breakdown={[
                {
                  key: 'brothers',
                  label: 'Hombres',
                  actual: ministeringParsed.brothers?.total?.interviewed ?? 0,
                  potential: ministeringParsed.brothers?.total?.total ?? 0,
                  color: '#0f6b82'
                },
                {
                  key: 'sisters',
                  label: 'Mujeres',
                  actual: ministeringParsed.sisters?.total?.interviewed ?? 0,
                  potential: ministeringParsed.sisters?.total?.total ?? 0,
                  color: '#7c3aed'
                }
              ]}
              color={
                ministeringSummary.overallPercent >= 80 ? '#10b981'
                : ministeringSummary.overallPercent >= 50 ? '#f59e0b'
                : '#ef4444'
              }
              onDetalleClick={ministeringRawText ? () => setDetalleMinisteringOpen(v => !v) : undefined}
            />
            {detalleMinisteringOpen && ministeringRawText && (
              <DetallePanel title="Entrevistas de ministración" metrics={{ actual: ministeringSummary.overallPercent, meta: 100, unit: '%' }} onClose={() => setDetalleMinisteringOpen(false)}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:16}}>
                  {[
                    { key: 'brothers', title: 'Hombres', color: '#0f6b82' },
                    { key: 'sisters', title: 'Mujeres', color: '#7c3aed' }
                  ].map((section) => {
                    const data = ministeringParsed[section.key]
                    return (
                      <div key={section.key} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,padding:10}}>
                        <strong style={{color:section.color}}>{section.title} ({data.total ? `${data.total.interviewed}/${data.total.total}` : '--/--'})</strong>
                        <table style={{width:'100%',marginTop:8,borderCollapse:'collapse',fontSize:13}}>
                          <thead>
                            <tr style={{background:'#f3f4f6'}}>
                              <th style={{textAlign:'left',padding:'4px 6px'}}>Barrio</th>
                              <th style={{textAlign:'right',padding:'4px 6px'}}>%</th>
                              <th style={{textAlign:'right',padding:'4px 6px'}}>Entrev.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(data.units || []).slice(1).map((u, i) => (
                              <tr key={`${section.key}-${i}`} style={{borderBottom:'1px solid #eef2f7'}}>
                                <td style={{padding:'4px 6px'}}>{getMinisteringUnitName(u.unidad, i)}</td>
                                <td style={{padding:'4px 6px',textAlign:'right',fontWeight:600,color:section.color}}>{u.percent}%</td>
                                <td style={{padding:'4px 6px',textAlign:'right'}}>{u.interviewed}/{u.total}</td>
                              </tr>
                            ))}
                            {(data.units || []).length <= 1 && (
                              <tr>
                                <td colSpan={3} style={{padding:'6px',color:'#999'}}>Sin detalle por barrio.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              </DetallePanel>
            )}
            {!ministeringRawText && (
              <p style={{fontSize:12,color:'#999',marginTop:8}}>
                Sin datos. Cargá el archivo en <a href="/conversos" style={{color:'#667eea'}}>Cargar Listas</a>.
              </p>
            )}
          </div>

        </div>
      </div>

      {trendData.length > 0 && (
        <div style={styles.chartSection}>
          <h3 style={styles.chartTitle}>Tendencia Mensual - {kpis[0]?.title}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="valor" 
                stroke="#667eea" 
                strokeWidth={3}
                name="Real"
              />
              <Line 
                type="monotone" 
                dataKey="meta" 
                stroke="#d1d5db" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Meta"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

        <div style={styles.info}>
        <h3 style={styles.summaryChartTitle}>Resumen general de indicadores</h3>
        {resumenGeneralData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={resumenGeneralData} margin={{ top: 10, right: 10, left: 10, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nombre" angle={-20} textAnchor="end" interval={0} height={95} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="meta" name="Meta" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="#667eea" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={styles.emptySummary}>Sin datos para mostrar.</p>
        )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '32px 24px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: 'var(--font-ui)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px'
  },
  pageTitle: {
    margin: 0,
    fontSize: '28px',
    color: '#333'
  },
  filters: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  select: {
    padding: '8px 15px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px',
    cursor: 'pointer'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
    gap: '20px',
    marginBottom: '40px'
  },
  chartSection: {
    background: 'white',
    borderRadius: '20px',
    padding: '25px',
    boxShadow: 'var(--shadow-card)',
    marginBottom: '30px'
  },
  chartTitle: {
    margin: '0 0 20px 0',
    fontSize: '18px',
    color: '#333'
  },
  info: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    padding: '15px 20px'
  },
  summaryChartTitle: {
    margin: '0 0 14px 0',
    color: '#1e3a8a',
    fontSize: '16px'
  },
  emptySummary: {
    margin: 0,
    color: '#64748b',
    fontSize: '14px'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  spinner: {
    fontSize: '48px',
    marginBottom: '20px',
    animation: 'spin 2s linear infinite',
  },
  spinnerInline: {
    display: 'inline-block',
    animation: 'spin 1.3s linear infinite',
  },
  refreshingBanner: {
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    padding: '10px 14px',
    marginBottom: '12px',
    fontSize: '14px',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  error: {
    background: '#fee2e2',
    border: '1px solid #ef4444',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '20px',
    color: '#991b1b',
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 20px',
    background: 'white',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-card)',
  },
  link: {
    color: '#667eea',
    fontWeight: '600',
    textDecoration: 'none',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '18px',
    color: '#333',
    fontWeight: '600'
  }
}

// Add keyframe animation for spinner
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`
if (!document.head.querySelector('[data-dashboard-styles]')) {
  styleSheet.setAttribute('data-dashboard-styles', '')
  document.head.appendChild(styleSheet)
}
