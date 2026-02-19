import axios from 'axios'
import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import KPICard from './KPICard'

export default function Dashboard() {

  const [kpis, setKpis] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [periodoActual, setPeriodoActual] = useState('2026')
  const [trendData, setTrendData] = useState([])
  const [detalleKPI, setDetalleKPI] = useState(null)
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

  async function handleDetalleClick(kpi) {
    if (detalleOpen === kpi.id) {
      setDetalleOpen(null)
      return
    }
    setDetalleOpen(kpi.id)
    setDetalleKPI(null)
    try {
      const { data } = await axios.get(`http://localhost:8000/api/kpis/${kpi.id}?periodo=${periodoActual}`)
      setDetalleKPI(data)
    } catch (err) {
      setDetalleKPI({potenciales:[],reales:[]})
    }
  }
  
  console.log('Dashboard component rendering')

  useEffect(() => {
    fetchKPIs()
    fetchJovenesKPI()
    fetchAdultosKPI()
    fetchMisionerosKPI()
    fetchAsistenciaKPI()
  }, [periodoActual])

  async function fetchJovenesKPI() {
    try {
      const { data } = await axios.get('http://localhost:8000/api/jovenes/kpi')
      setKpiJovenes(data)
    } catch (e) {
      setKpiJovenes(null)
    }
  }

  async function fetchAdultosKPI() {
    try {
      const { data } = await axios.get('http://localhost:8000/api/adultos/kpi')
      setKpiAdultos(data)
    } catch (e) {
      setKpiAdultos(null)
    }
  }

  async function fetchMisionerosKPI() {
    try {
      const { data } = await axios.get('http://localhost:8000/api/misioneros/kpi')
      setKpiMisioneros(data)
    } catch (e) {
      setKpiMisioneros(null)
    }
  }

  async function fetchAsistenciaKPI() {
    try {
      const { data } = await axios.get(`http://localhost:8000/api/asistencia/kpi?periodo=${periodoActual}`)
      setKpiAsistencia(data)
      setAsistenciaInput(data.real > 0 ? String(data.real) : '')
    } catch (e) {
      setKpiAsistencia(null)
    }
  }

  async function guardarAsistencia() {
    const val = parseInt(asistenciaInput, 10)
    if (isNaN(val) || val < 0) return
    setAsistenciaSaving(true)
    try {
      await axios.post('http://localhost:8000/api/asistencia/registrar', { periodo: periodoActual, valor: val })
      await fetchAsistenciaKPI()
    } catch (e) {
      alert('Error al guardar: ' + (e.response?.data?.detail || e.message))
    } finally {
      setAsistenciaSaving(false)
    }
  }

  async function fetchKPIs() {
    setLoading(true)
    setError(null)

    try {
      // Fetch resumen de KPIs
      const { data } = await axios.get(`http://localhost:8000/api/kpis/resumen?periodo=${periodoActual}`)
      
      console.log('KPIs data received:', data)
      
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
      console.error('Error fetching KPIs:', err)
      setError(err.response?.data?.detail || 'Error al cargar KPIs')
      
      // Fallback a datos de ejemplo si hay error
      setKpis([
        { id: 1, title: 'Bautismos de Conversos', meta: 168, actual: 0, porcentaje: 0, unit: '', color: '#ef4444' },
        { id: 2, title: 'Conversos con Recomendación', meta: 100, actual: 0, porcentaje: 0, unit: '%', color: '#ef4444' },
        { id: 3, title: 'Conversos Ordenados', meta: 100, actual: 0, porcentaje: 0, unit: '%', color: '#ef4444' }
      ])
    } finally {
      setLoading(false)
    }
  }

  async function fetchTrend(indicadorId) {
    try {
      const { data } = await axios.get(`http://localhost:8000/api/kpis/${indicadorId}/tendencia?periodo=${periodoActual}`)
      
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
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}>⏳</div>
          <p>Cargando indicadores...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.filters}>
          <select 
            style={styles.select}
            value={periodoActual}
            onChange={(e) => setPeriodoActual(e.target.value)}
          >
            <option value="2026">2026 - Año completo</option>
            <option value="2026-Q1">2026 - Q1</option>
            <option value="2026-Q2">2026 - Q2</option>
            <option value="2026-Q3">2026 - Q3</option>
            <option value="2026-Q4">2026 - Q4</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={styles.error}>
          <strong>⚠️ Error:</strong> {error}
          <p style={{ marginTop: '10px', fontSize: '14px' }}>
            Mostrando datos en cero. Asegúrate de que el backend esté ejecutándose y que hayas importado datos de conversos.
          </p>
        </div>
      )}

      <h2 style={styles.sectionTitle}>Nuevos Conversos</h2>
      <div style={styles.grid}>
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
                potencial={kpi.potencial}
                comentario={kpi.comentario}
                unit={kpi.unit}
                color={kpi.color}
                onDetalleClick={() => handleDetalleClick(kpi)}
              />
              {detalleOpen === kpi.id && detalleKPI && (
                <div style={{background:'#f9fafb',border:'1px solid #ddd',borderRadius:8,padding:16,marginTop:8}}>
                  {/* Bautismos: mostrar lista completa de conversos */}
                  {detalleKPI.personas?.length > 0 ? (
                    <>
                      <strong>Lista completa ({detalleKPI.personas.length}):</strong>
                      <ul style={{margin:'8px 0'}}>
                        {detalleKPI.personas.map((p,i) => (
                          <li key={i}>{p.nombre} <span style={{color:'#666',fontSize:12}}>{p.unidad ? `(${p.unidad})` : ''}</span></li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      <strong>Potenciales ({detalleKPI.potenciales?.length || 0}):</strong>
                      <ul style={{margin:'8px 0 16px 0'}}>
                        {detalleKPI.potenciales?.length > 0 ? detalleKPI.potenciales.map((p,i) => (
                          <li key={i}>{p.nombre} <span style={{color:'#666',fontSize:12}}>{p.unidad ? `(${p.unidad})` : ''}</span></li>
                        )) : <li style={{color:'#999'}}>Sin potenciales</li>}
                      </ul>
                      <strong>Reales ({detalleKPI.reales?.length || 0}):</strong>
                      <ul style={{margin:'8px 0'}}>
                        {detalleKPI.reales?.length > 0 ? detalleKPI.reales.map((p,i) => (
                          <li key={i}>{p.nombre} <span style={{color:'#666',fontSize:12}}>{p.unidad ? `(${p.unidad})` : ''}</span></li>
                        )) : <li style={{color:'#999'}}>Sin reales</li>}
                      </ul>
                    </>
                  )}
                  <button onClick={()=>setDetalleOpen(null)} style={{marginTop:8,padding:'4px 12px',borderRadius:6,border:'1px solid #ddd',background:'#fff',cursor:'pointer'}}>Cerrar</button>
                </div>
              )}
            </div>
          ))
        )}

      </div>

      {/* ── Indicadores: Jóvenes · Adultos · Misioneros · Asistencia ── */}
      <div style={{marginTop: 32}}>
        <div style={styles.grid}>

          {/* Jóvenes con Recomendación */}
          {kpiJovenes && (
          <div>
            <h2 style={styles.sectionTitle}>Jóvenes con Recomendación</h2>
            <KPICard
              title="Jóvenes con Recomendación"
              meta={100}
              actual={kpiJovenes.real}
              potencial={kpiJovenes.real}
              comentario={`Activa: ${kpiJovenes.desglose?.activa ?? 0} · Vence pronto: ${kpiJovenes.desglose?.vence_pronto ?? 0}`}
              color={
                kpiJovenes.real >= 80 ? '#10b981'
                : kpiJovenes.real >= 50 ? '#f59e0b'
                : '#ef4444'
              }
              onDetalleClick={() => setDetalleJovenesOpen(v => !v)}
            />
            {detalleJovenesOpen && (
              <div style={{background:'#f9fafb',border:'1px solid #ddd',borderRadius:8,padding:16,marginTop:8}}>
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
                <button onClick={() => setDetalleJovenesOpen(false)} style={{marginTop:8,padding:'4px 12px',borderRadius:6,border:'1px solid #ddd',background:'#fff',cursor:'pointer'}}>Cerrar</button>
              </div>
            )}
          </div>
          )}

          {/* Adultos con Recomendación */}
          {kpiAdultos && (
          <div>
            <h2 style={styles.sectionTitle}>Adultos con Recomendación</h2>
            <KPICard
              title="Adultos con Recomendación"
              meta={390}
              actual={kpiAdultos.real}
              potencial={kpiAdultos.real}
              comentario={`Activa: ${kpiAdultos.desglose?.activa ?? 0} · Vence pronto: ${kpiAdultos.desglose?.vence_pronto ?? 0}`}
              color={
                kpiAdultos.real >= 312 ? '#10b981'
                : kpiAdultos.real >= 195 ? '#f59e0b'
                : '#ef4444'
              }
              onDetalleClick={() => setDetalleAdultosOpen(v => !v)}
            />
            {detalleAdultosOpen && (
              <div style={{background:'#f9fafb',border:'1px solid #ddd',borderRadius:8,padding:16,marginTop:8}}>
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
                <button onClick={() => setDetalleAdultosOpen(false)} style={{marginTop:8,padding:'4px 12px',borderRadius:6,border:'1px solid #ddd',background:'#fff',cursor:'pointer'}}>Cerrar</button>
              </div>
            )}
          </div>
          )}

          {/* Misioneros en el Campo */}
          <div>
            <h2 style={styles.sectionTitle}>Misioneros en el Campo</h2>
            <KPICard
              title="Misioneros en el Campo"
              meta={19}
              actual={kpiMisioneros?.real ?? 0}
              potencial={kpiMisioneros?.real ?? 0}
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
              <div style={{background:'#f9fafb',border:'1px solid #ddd',borderRadius:8,padding:16,marginTop:8}}>
                {kpiMisioneros?.personas?.length > 0 && (<>
                  <strong style={{fontSize:14}}>Misioneros en el campo ({kpiMisioneros.real}):</strong>
                  <table style={{width:'100%',borderCollapse:'collapse',marginTop:8,fontSize:13}}>
                    <thead>
                      <tr style={{background:'#f3f4f6',textAlign:'left'}}>
                        <th style={{padding:'6px 8px'}}>Nombre</th>
                        <th style={{padding:'6px 8px'}}>Misión</th>
                        <th style={{padding:'6px 8px'}}>Comenzó</th>
                        <th style={{padding:'6px 8px'}}>Término</th>
                        <th style={{padding:'6px 8px'}}>Unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpiMisioneros.personas.map((p, i) => (
                        <tr key={i} style={{borderBottom:'1px solid #e5e7eb'}}>
                          <td style={{padding:'5px 8px'}}>{p.nombre}</td>
                          <td style={{padding:'5px 8px',fontSize:12,color:'#374151'}}>{p.mision || '-'}</td>
                          <td style={{padding:'5px 8px',fontSize:12,color:'#666'}}>{p.comenzo || '-'}</td>
                          <td style={{padding:'5px 8px',fontSize:12,color:'#666'}}>{p.termino_esperado || '-'}</td>
                          <td style={{padding:'5px 8px',fontSize:12,color:'#666'}}>{p.unidad_actual || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>)}
                {kpiMisioneros?.personas_servicio?.length > 0 && (
                  <div style={{marginTop:16}}>
                    <strong style={{fontSize:14}}>Misioneros de servicio a la Iglesia ({kpiMisioneros.sub_servicio}):</strong>
                    <table style={{width:'100%',borderCollapse:'collapse',marginTop:8,fontSize:13}}>
                      <thead>
                        <tr style={{background:'#eff6ff',textAlign:'left'}}>
                          <th style={{padding:'6px 8px'}}>Nombre</th>
                          <th style={{padding:'6px 8px'}}>Comenzó</th>
                          <th style={{padding:'6px 8px'}}>Término</th>
                          <th style={{padding:'6px 8px'}}>Unidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpiMisioneros.personas_servicio.map((p, i) => (
                          <tr key={i} style={{borderBottom:'1px solid #e5e7eb',background:'#f8faff'}}>
                            <td style={{padding:'5px 8px'}}>{p.nombre}</td>
                            <td style={{padding:'5px 8px',fontSize:12,color:'#666'}}>{p.comenzo || '-'}</td>
                            <td style={{padding:'5px 8px',fontSize:12,color:'#666'}}>{p.termino_esperado || '-'}</td>
                            <td style={{padding:'5px 8px',fontSize:12,color:'#1e40af'}}>{p.unidad_actual || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button onClick={() => setDetalleMisionerosOpen(false)} style={{marginTop:10,padding:'4px 12px',borderRadius:6,border:'1px solid #ddd',background:'#fff',cursor:'pointer'}}>Cerrar</button>
              </div>
            )}
          </div>

          {/* Asistencia Sacramental */}
          <div>
            <h2 style={styles.sectionTitle}>Asistencia Sacramental</h2>
            <KPICard
              title="Asistencia Sacramental"
              meta={550}
              actual={kpiAsistencia?.real ?? 0}
              potencial={kpiAsistencia?.real ?? 0}
              color={
                (kpiAsistencia?.real ?? 0) >= 495 ? '#10b981'
                : (kpiAsistencia?.real ?? 0) >= 330 ? '#f59e0b'
                : '#ef4444'
              }
              onDetalleClick={kpiAsistencia?.real > 0 ? () => setDetalleAsistenciaOpen(v => !v) : undefined}
            />
            {detalleAsistenciaOpen && kpiAsistencia?.desglose && Object.keys(kpiAsistencia.desglose).length > 0 && (
              <div style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:12,marginTop:8}}>
                <strong style={{fontSize:13,color:'#374151'}}>Desglose por barrio:</strong>
                <table style={{width:'100%',borderCollapse:'collapse',marginTop:6,fontSize:13}}>
                  <tbody>
                    {Object.entries(kpiAsistencia.desglose).map(([barrio, valor]) => (
                      <tr key={barrio} style={{borderBottom:'1px solid #e5e7eb'}}>
                        <td style={{padding:'4px 0',color:'#555'}}>{barrio}</td>
                        <td style={{padding:'4px 0',textAlign:'right',fontWeight:600,color:'#1e40af'}}>{valor}</td>
                      </tr>
                    ))}
                    <tr style={{borderTop:'2px solid #cbd5e1'}}>
                      <td style={{padding:'5px 0',fontWeight:700}}>Total</td>
                      <td style={{padding:'5px 0',textAlign:'right',fontWeight:700,color:'#1e40af'}}>{kpiAsistencia.real}</td>
                    </tr>
                  </tbody>
                </table>
                <button onClick={() => setDetalleAsistenciaOpen(false)} style={{marginTop:8,padding:'4px 12px',borderRadius:6,border:'1px solid #ddd',background:'#fff',cursor:'pointer'}}>Cerrar</button>
              </div>
            )}
            {(!kpiAsistencia || kpiAsistencia.real === 0) && (
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
        <p style={styles.infoText}>
          ℹ️ {kpis.length > 0 && kpis[0].actual > 0 
            ? 'Indicadores calculados automáticamente desde los datos importados.' 
            : 'No hay datos aún. Ve a Conversos para importar tu primera lista.'}
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '30px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif'
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
    gap: '10px'
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '40px'
  },
  chartSection: {
    background: 'white',
    borderRadius: '8px',
    padding: '25px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '30px'
  },
  chartTitle: {
    margin: '0 0 20px 0',
    fontSize: '18px',
    color: '#333'
  },
  info: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '15px 20px'
  },
  infoText: {
    margin: 0,
    color: '#1e40af',
    fontSize: '14px',
    lineHeight: '1.6'
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
  error: {
    background: '#fee2e2',
    border: '1px solid #ef4444',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
    color: '#991b1b',
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 20px',
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
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
