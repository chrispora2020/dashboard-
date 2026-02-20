import axios from 'axios'
import { useState } from 'react'
import API_BASE from '../config'
import MapeoColumnas from './MapeoColumnas'

function normalizarNombreArchivo(nombre) {
  return (nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function detectarTipoLista(nombreArchivo) {
  const n = normalizarNombreArchivo(nombreArchivo)
  if (n.includes('converso')) return 'conversos'
  if (n.includes('joven')) return 'jovenes'
  if (n.includes('adult')) return 'adultos'
  if (n.includes('mision')) return 'misioneros'
  if (n.includes('asistencia') || n.includes('sacramental')) return 'asistencia'
  return null
}

export default function ImportacionConversos() {
  const [step, setStep] = useState('upload') // 'upload', 'procesando', 'mapeo', 'confirmacion', 'completado'
  const [uploadData, setUploadData] = useState(null)
  const [mapeoData, setMapeoData] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  // Conversos upload state
  const [conversoFile, setConversoFile] = useState(null)
  const [conversoUploading, setConversoUploading] = useState(false)
  const [conversoResult, setConversoResult] = useState(null)
  const [conversoError, setConversoError] = useState('')

  // Jóvenes upload state
  const [jovenFile, setJovenFile] = useState(null)
  const [jovenUploading, setJovenUploading] = useState(false)
  const [jovenResult, setJovenResult] = useState(null)
  const [jovenError, setJovenError] = useState('')

  // Adultos upload state
  const [adultoFile, setAdultoFile] = useState(null)
  const [adultoUploading, setAdultoUploading] = useState(false)
  const [adultoResult, setAdultoResult] = useState(null)
  const [adultoError, setAdultoError] = useState('')

  // Misioneros upload state
  const [misioneroFile, setMisioneroFile] = useState(null)
  const [misioneroUploading, setMisioneroUploading] = useState(false)
  const [misioneroResult, setMisioneroResult] = useState(null)
  const [misioneroError, setMisioneroError] = useState('')

  // Carga masiva
  const [loteFiles, setLoteFiles] = useState([])
  const [loteUploading, setLoteUploading] = useState(false)
  const [loteResults, setLoteResults] = useState([])

  const handleUploadComplete = async (data) => {
    console.log('Upload completado:', data)
    setUploadData(data)
    
    // Procesar automáticamente sin mostrar pantallas intermedias
    setStep('procesando')
    setImporting(true)

    try {
      // El backend ya hace el mapeo automático, solo llamamos a confirmar
      const result = await axios.post(
        `${API_BASE}/api/conversos/confirmar/${data.file_id}`
      )

      console.log('Importación completada automáticamente:', result.data)
      
      // Redirigir al dashboard inmediatamente
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)

    } catch (err) {
      console.error('Error en importación automática:', err)
      alert('Error al importar datos: ' + (err.response?.data?.detail || err.message))
      setStep('upload')
      setImporting(false)
    }
  }

  const handleMapeoComplete = async (data) => {
    console.log('Mapeo completado:', data)
    setMapeoData(data)
    setStep('confirmacion')
  }

  const handleConfirmarImportacion = async () => {
    setImporting(true)

    try {
      const { data } = await axios.post(
        `${API_BASE}/api/conversos/confirmar/${uploadData.file_id}`
      )

      console.log('Importación confirmada:', data)
      setImportResult(data)
      setStep('completado')

    } catch (err) {
      console.error('Error confirmando importación:', err)
      alert('Error al confirmar importación: ' + (err.response?.data?.detail || err.message))
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setStep('upload')
    setUploadData(null)
    setMapeoData(null)
    setImportResult(null)
    setConversoFile(null)
    setConversoResult(null)
    setConversoError('')
  }

  const handleConversoUpload = async (file) => {
    if (!file) return
    setConversoUploading(true)
    setConversoError('')
    setConversoResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      console.log('[CONVERSOS] Subiendo e importando:', file.name)
      const { data } = await axios.post(`${API_BASE}/api/conversos/import`, fd)
      console.log('[CONVERSOS] Importación completada:', data)
      setConversoResult(data)
      setConversoFile(null)
    } catch (err) {
      console.error('[CONVERSOS] Error al importar:', err)
      setConversoError(err.response?.data?.detail || err.message || 'Error al importar')
    } finally {
      setConversoUploading(false)
    }
  }

  const handleJovenesUpload = async (file) => {
    if (!file) return
    setJovenUploading(true)
    setJovenError('')
    setJovenResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const { data } = await axios.post(`${API_BASE}/api/jovenes/upload`, fd)
      setJovenResult(data)
      setJovenFile(null)
    } catch (err) {
      setJovenError(err.response?.data?.detail || err.message || 'Error al importar')
    } finally {
      setJovenUploading(false)
    }
  }

  const handleAdultosUpload = async (file) => {
    if (!file) return
    setAdultoUploading(true)
    setAdultoError('')
    setAdultoResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const { data } = await axios.post(`${API_BASE}/api/adultos/upload`, fd)
      setAdultoResult(data)
      setAdultoFile(null)
    } catch (err) {
      setAdultoError(err.response?.data?.detail || err.message || 'Error al importar')
    } finally {
      setAdultoUploading(false)
    }
  }

  const handleMisionerosUpload = async (file) => {
    if (!file) return
    setMisioneroUploading(true)
    setMisioneroError('')
    setMisioneroResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const { data } = await axios.post(`${API_BASE}/api/misioneros/upload`, fd)
      setMisioneroResult(data)
      setMisioneroFile(null)
    } catch (err) {
      setMisioneroError(err.response?.data?.detail || err.message || 'Error al importar')
    } finally {
      setMisioneroUploading(false)
    }
  }

  const handleAsistenciaUploadSimple = async (file, periodo = '2026') => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await axios.post(`${API_BASE}/api/asistencia/upload?periodo=${periodo}`, fd)
    return data
  }

  const handleLoteUpload = async () => {
    if (!loteFiles.length) return
    setLoteUploading(true)
    setLoteResults([])

    const results = []
    for (const file of loteFiles) {
      const tipo = detectarTipoLista(file.name)
      if (!tipo) {
        results.push({ archivo: file.name, tipo: 'desconocido', ok: false, mensaje: 'No se pudo identificar tipo por nombre' })
        continue
      }

      try {
        const fd = new FormData()
        fd.append('file', file)

        if (tipo === 'conversos') {
          const { data } = await axios.post(`${API_BASE}/api/conversos/import`, fd)
          setConversoResult(data)
          setConversoError('')
        } else if (tipo === 'jovenes') {
          const { data } = await axios.post(`${API_BASE}/api/jovenes/upload`, fd)
          setJovenResult(data)
          setJovenError('')
        } else if (tipo === 'adultos') {
          const { data } = await axios.post(`${API_BASE}/api/adultos/upload`, fd)
          setAdultoResult(data)
          setAdultoError('')
        } else if (tipo === 'misioneros') {
          const { data } = await axios.post(`${API_BASE}/api/misioneros/upload`, fd)
          setMisioneroResult(data)
          setMisioneroError('')
        } else if (tipo === 'asistencia') {
          await handleAsistenciaUploadSimple(file, '2026')
        }

        results.push({ archivo: file.name, tipo, ok: true, mensaje: 'Importado correctamente' })
      } catch (err) {
        results.push({
          archivo: file.name,
          tipo,
          ok: false,
          mensaje: err.response?.data?.detail || err.message || 'Error al importar'
        })
      }
    }

    setLoteResults(results)
    setLoteUploading(false)
  }

  // ── Asistencia Sacramental sub-component ──────────────────────────────────
  function AsistenciaCard() {
    const [asFile, setAsFile] = useState(null)
    const [asUploading, setAsUploading] = useState(false)
    const [asResult, setAsResult] = useState(null)
    const [asError, setAsError] = useState('')
    const [periodo, setPeriodo] = useState('2026')

    const handleUpload = async (file) => {
      if (!file) return
      setAsUploading(true)
      setAsError('')
      setAsResult(null)
      const fd = new FormData()
      fd.append('file', file)
      try {
        const { data } = await axios.post(
          `${API_BASE}/api/asistencia/upload?periodo=${periodo}`, fd
        )
        setAsResult(data)
        setAsFile(null)
      } catch (err) {
        setAsError(err.response?.data?.detail || err.message || 'Error al importar')
      } finally {
        setAsUploading(false)
      }
    }

    return (
      <div style={cardStyles.card}>
        <div style={cardStyles.cardHeader}>
          <span style={{...cardStyles.badge, background:'#fce7f3', color:'#9d174d'}}>Asistencia</span>
          <h3 style={cardStyles.cardTitle}>Asistencia Sacramental</h3>
          <p style={cardStyles.cardDesc}>
            Archivo .txt con líneas "Barrio N" (una por línea). El total se calcula automáticamente.
          </p>
        </div>
        <div style={{marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
          <label style={{fontSize:13,color:'#555'}}>Período:</label>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)}
            style={{padding:'4px 8px',borderRadius:6,border:'1px solid #ddd',fontSize:13}}>
            <option value="2026">2026</option>
            <option value="2026-Q1">2026 Q1</option>
            <option value="2026-Q2">2026 Q2</option>
            <option value="2026-Q3">2026 Q3</option>
            <option value="2026-Q4">2026 Q4</option>
          </select>
        </div>
        {asResult ? (
          <div style={cardStyles.successBox}>
            <strong>✓ Total registrado: {asResult.total} personas</strong>
            {asResult.desglose && Object.keys(asResult.desglose).length > 0 && (
              <ul style={{margin:'6px 0 0 0',paddingLeft:16,fontSize:13}}>
                {Object.entries(asResult.desglose).map(([b, v]) => (
                  <li key={b}>{b}: <strong>{v}</strong></li>
                ))}
              </ul>
            )}
            <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
              <button onClick={() => { window.location.href = '/' }} style={{...cardStyles.resetBtn, background:'#be185d', color:'#fff', borderColor:'#be185d'}}>
                Ver Dashboard
              </button>
              <button onClick={() => { setAsResult(null); setAsFile(null) }} style={cardStyles.resetBtn}>
                Cargar otro archivo
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={cardStyles.fileRow}>
              <label style={cardStyles.fileLabel}>
                <input
                  type="file"
                  accept=".txt,.csv"
                  style={{display:'none'}}
                  onChange={e => { setAsFile(e.target.files[0] || null); setAsError('') }}
                  disabled={asUploading}
                />
                <span style={cardStyles.fileBtn}>{asFile ? '📄 ' + asFile.name : '📂 Elegir archivo'}</span>
              </label>
              <button
                onClick={() => handleUpload(asFile)}
                disabled={!asFile || asUploading}
                style={{...cardStyles.importBtn, background: asFile && !asUploading ? '#be185d' : '#fbcfe8'}}
              >
                {asUploading ? '⏳ Procesando...' : 'Importar'}
              </button>
            </div>
            {asFile && !asUploading && (
              <p style={cardStyles.fileHint}>Archivo: <strong>{asFile.name}</strong></p>
            )}
          </>
        )}
        {asError && <p style={cardStyles.errorText}>⚠ {asError}</p>}
      </div>
    )
  }

  if (step === 'upload') {
    return (
      <div style={cardStyles.page}>
        <h2 style={cardStyles.pageTitle}>Cargar Listas</h2>
        <p style={cardStyles.pageSubtitle}>Cada lista es independiente. Cargá el archivo correspondiente en la sección que corresponde.</p>

        <div style={cardStyles.grid}>

          {/* Carga Masiva */}
          <div style={{...cardStyles.card, border:'2px dashed #cbd5e1', background:'#f8fafc'}}>
            <div style={cardStyles.cardHeader}>
              <span style={{...cardStyles.badge, background:'#e2e8f0', color:'#1e293b'}}>Carga Masiva</span>
              <h3 style={cardStyles.cardTitle}>Una sola entrada para multiples listas</h3>
              <p style={cardStyles.cardDesc}>
                Selecciona varios archivos y se procesan uno a uno.
                Para auto-detectar: conversos, jovenes, adultos, misioneros, asistencia.
              </p>
            </div>
            <div style={cardStyles.fileRow}>
              <label style={cardStyles.fileLabel}>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.csv,.xlsx,.xls,.txt"
                  style={{display:'none'}}
                  onChange={e => {
                    setLoteFiles(Array.from(e.target.files || []))
                    setLoteResults([])
                  }}
                  disabled={loteUploading}
                />
                <span style={cardStyles.fileBtn}>
                  {loteFiles.length ? `${loteFiles.length} archivo(s) seleccionados` : 'Elegir multiples archivos'}
                </span>
              </label>
              <button
                onClick={handleLoteUpload}
                disabled={!loteFiles.length || loteUploading}
                style={{...cardStyles.importBtn, background: loteFiles.length && !loteUploading ? '#334155' : '#94a3b8'}}
              >
                {loteUploading ? 'Procesando...' : 'Procesar todo'}
              </button>
            </div>
            {loteFiles.length > 0 && (
              <p style={cardStyles.fileHint}>Archivos: {loteFiles.map(f => f.name).join(' | ')}</p>
            )}
            {loteResults.length > 0 && (
              <div style={{fontSize:12}}>
                {loteResults.map((r, i) => (
                  <div key={`${r.archivo}-${i}`} style={{color: r.ok ? '#166534' : '#b91c1c'}}>
                    {r.ok ? 'OK' : 'ERROR'} [{r.tipo}] {r.archivo}: {r.mensaje}
                  </div>
                ))}
                <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
                  <button onClick={() => { window.location.href = '/' }} style={{...cardStyles.resetBtn, background:'#334155', color:'#fff', borderColor:'#334155'}}>Ver Dashboard</button>
                  <button onClick={() => { setLoteFiles([]); setLoteResults([]) }} style={cardStyles.resetBtn}>Limpiar</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Conversos ── */}
          <div style={cardStyles.card}>
            <div style={cardStyles.cardHeader}>
              <span style={{...cardStyles.badge, background:'#ede9fe', color:'#5b21b6'}}>Conversos</span>
              <h3 style={cardStyles.cardTitle}>Lista de Nuevos Conversos</h3>
              <p style={cardStyles.cardDesc}>Columnas esperadas: Nombre, Fecha de confirmación, Unidad, Sacerdocio, Estado de recomendación</p>
            </div>
            {conversoResult ? (
              <div style={cardStyles.successBox}>
                <strong>✓ Importados: {conversoResult.total} conversos</strong>
                <p style={{margin:'4px 0 0 0',fontSize:13}}>(reemplaza todos los datos anteriores)</p>
                {conversoResult.advertencias && conversoResult.advertencias.length > 0 && (
                  <p style={{margin:'4px 0 0 0',fontSize:12,color:'#92400e'}}>⚠ {conversoResult.advertencias.length} advertencia(s) — los datos fueron importados igualmente</p>
                )}
                <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
                  <button onClick={() => { window.location.href = '/' }} style={{...cardStyles.resetBtn, background:'#7c3aed', color:'#fff', borderColor:'#7c3aed'}}>Ver Dashboard</button>
                  <button onClick={() => { setConversoResult(null); setConversoFile(null) }} style={cardStyles.resetBtn}>Cargar otro archivo</button>
                </div>
              </div>
            ) : (
              <>
                <div style={cardStyles.fileRow}>
                  <label style={cardStyles.fileLabel}>
                    <input
                      type="file"
                      accept=".pdf,.csv,.xlsx,.xls"
                      style={{display:'none'}}
                      onChange={e => { setConversoFile(e.target.files[0] || null); setConversoError('') }}
                      disabled={conversoUploading}
                    />
                    <span style={cardStyles.fileBtn}>{conversoFile ? '📄 ' + conversoFile.name : '📂 Elegir archivo'}</span>
                  </label>
                  <button
                    onClick={() => handleConversoUpload(conversoFile)}
                    disabled={!conversoFile || conversoUploading}
                    style={{...cardStyles.importBtn, background: conversoFile && !conversoUploading ? '#7c3aed' : '#c4b5fd'}}
                  >
                    {conversoUploading ? '⏳ Importando...' : 'Importar'}
                  </button>
                </div>
                {conversoFile && !conversoUploading && (
                  <p style={cardStyles.fileHint}>Archivo seleccionado: <strong>{conversoFile.name}</strong></p>
                )}
              </>
            )}
            {conversoError && <p style={cardStyles.errorText}>⚠ {conversoError}</p>}
          </div>

          {/* ── Adultos Investidos ── */}
          <div style={cardStyles.card}>
            <div style={cardStyles.cardHeader}>
              <span style={{...cardStyles.badge, background:'#fef3c7', color:'#92400e'}}>Adultos</span>
              <h3 style={cardStyles.cardTitle}>Lista de Adultos Investidos con Recomendación</h3>
              <p style={cardStyles.cardDesc}>Columnas esperadas: Nombre, Sexo, Edad, Estado, Vencimiento, Unidad actual</p>
            </div>
            {adultoResult ? (
              <div style={cardStyles.successBox}>
                <strong>✓ Importados: {adultoResult.importados} adultos</strong>
                <p style={{margin:'4px 0 0 0',fontSize:13}}>(reemplaza todos los datos anteriores)</p>
                <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
                  <button onClick={() => { window.location.href = '/' }} style={{...cardStyles.resetBtn, background:'#d97706', color:'#fff', borderColor:'#d97706'}}>Ver Dashboard</button>
                  <button onClick={() => { setAdultoResult(null); setAdultoFile(null) }} style={cardStyles.resetBtn}>Cargar otro archivo</button>
                </div>
              </div>
            ) : (
              <>
                <div style={cardStyles.fileRow}>
                  <label style={cardStyles.fileLabel}>
                    <input
                      type="file"
                      accept=".pdf,.csv,.xlsx,.xls"
                      style={{display:'none'}}
                      onChange={e => { setAdultoFile(e.target.files[0] || null); setAdultoError('') }}
                      disabled={adultoUploading}
                    />
                    <span style={cardStyles.fileBtn}>{adultoFile ? '📄 ' + adultoFile.name : '📂 Elegir archivo'}</span>
                  </label>
                  <button
                    onClick={() => handleAdultosUpload(adultoFile)}
                    disabled={!adultoFile || adultoUploading}
                    style={{...cardStyles.importBtn, background: adultoFile && !adultoUploading ? '#d97706' : '#fcd34d'}}
                  >
                    {adultoUploading ? '⏳ Importando...' : 'Importar'}
                  </button>
                </div>
                {adultoFile && !adultoUploading && (
                  <p style={cardStyles.fileHint}>Archivo seleccionado: <strong>{adultoFile.name}</strong></p>
                )}
              </>
            )}
            {adultoError && <p style={cardStyles.errorText}>⚠ {adultoError}</p>}
          </div>

          {/* ── Misioneros ── */}
          <div style={cardStyles.card}>
            <div style={cardStyles.cardHeader}>
              <span style={{...cardStyles.badge, background:'#dbeafe', color:'#1e40af'}}>Misioneros</span>
              <h3 style={cardStyles.cardTitle}>Lista de Misioneros en el Campo</h3>
              <p style={cardStyles.cardDesc}>Formatos: PDF, CSV o Excel. Columnas: Nombre, Misión, Comenzó, Término esperado, Unidad actual</p>
            </div>
            {misioneroResult ? (
              <div style={cardStyles.successBox}>
                <strong>✓ Importados: {misioneroResult.total} misioneros</strong>
                {misioneroResult.mision_servicio > 0 && (
                  <p style={{margin:'4px 0 0 0',fontSize:13}}>Misión de servicio a la Iglesia: <strong>{misioneroResult.mision_servicio}</strong></p>
                )}
                <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
                  <button onClick={() => { window.location.href = '/' }} style={{...cardStyles.resetBtn, background:'#1d4ed8', color:'#fff', borderColor:'#1d4ed8'}}>Ver Dashboard</button>
                  <button onClick={() => { setMisioneroResult(null); setMisioneroFile(null) }} style={cardStyles.resetBtn}>Cargar otro archivo</button>
                </div>
              </div>
            ) : (
              <>
                <div style={cardStyles.fileRow}>
                  <label style={cardStyles.fileLabel}>
                    <input
                      type="file"
                      accept=".pdf,.csv,.xlsx,.xls,.txt"
                      style={{display:'none'}}
                      onChange={e => { setMisioneroFile(e.target.files[0] || null); setMisioneroError('') }}
                      disabled={misioneroUploading}
                    />
                    <span style={cardStyles.fileBtn}>{misioneroFile ? '📄 ' + misioneroFile.name : '📂 Elegir archivo'}</span>
                  </label>
                  <button
                    onClick={() => handleMisionerosUpload(misioneroFile)}
                    disabled={!misioneroFile || misioneroUploading}
                    style={{...cardStyles.importBtn, background: misioneroFile && !misioneroUploading ? '#1d4ed8' : '#93c5fd'}}
                  >
                    {misioneroUploading ? '⏳ Importando...' : 'Importar'}
                  </button>
                </div>
                {misioneroFile && !misioneroUploading && (
                  <p style={cardStyles.fileHint}>Archivo seleccionado: <strong>{misioneroFile.name}</strong></p>
                )}
              </>
            )}
            {misioneroError && <p style={cardStyles.errorText}>⚠ {misioneroError}</p>}
          </div>

          {/* ── Asistencia Sacramental ── */}
          <AsistenciaCard />

          {/* ── Jóvenes ── */}
          <div style={cardStyles.card}>
            <div style={cardStyles.cardHeader}>
              <span style={{...cardStyles.badge, background:'#dcfce7', color:'#166534'}}>Jóvenes</span>
              <h3 style={cardStyles.cardTitle}>Lista de Jóvenes con Recomendación</h3>
              <p style={cardStyles.cardDesc}>Columnas esperadas: Nombre, Sexo, Edad, Estado, Vencimiento, Unidad actual</p>
            </div>
            {jovenResult ? (
              <div style={cardStyles.successBox}>
                <strong>✓ Importados: {jovenResult.importados} jóvenes</strong>
                <p style={{margin:'4px 0 0 0',fontSize:13}}>(reemplaza todos los datos anteriores)</p>
                <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
                  <button onClick={() => { window.location.href = '/' }} style={{...cardStyles.resetBtn, background:'#16a34a', color:'#fff', borderColor:'#16a34a'}}>Ver Dashboard</button>
                  <button onClick={() => { setJovenResult(null); setJovenFile(null) }} style={cardStyles.resetBtn}>Cargar otro archivo</button>
                </div>
              </div>
            ) : (
              <>
                <div style={cardStyles.fileRow}>
                  <label style={cardStyles.fileLabel}>
                    <input
                      type="file"
                      accept=".pdf,.csv,.xlsx,.xls"
                      style={{display:'none'}}
                      onChange={e => { setJovenFile(e.target.files[0] || null); setJovenError('') }}
                      disabled={jovenUploading}
                    />
                    <span style={cardStyles.fileBtn}>{jovenFile ? '📄 ' + jovenFile.name : '📂 Elegir archivo'}</span>
                  </label>
                  <button
                    onClick={() => handleJovenesUpload(jovenFile)}
                    disabled={!jovenFile || jovenUploading}
                    style={{...cardStyles.importBtn, background: jovenFile && !jovenUploading ? '#16a34a' : '#86efac'}}
                  >
                    {jovenUploading ? '⏳ Importando...' : 'Importar'}
                  </button>
                </div>
                {jovenFile && !jovenUploading && (
                  <p style={cardStyles.fileHint}>Archivo seleccionado: <strong>{jovenFile.name}</strong></p>
                )}
              </>
            )}
            {jovenError && <p style={cardStyles.errorText}>⚠ {jovenError}</p>}
          </div>

        </div>
      </div>
    )
  }

  if (step === 'procesando') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{textAlign: 'center', padding: '60px 20px'}}>
            <div style={{fontSize: '48px', marginBottom: '20px'}}>⚡</div>
            <h2 style={{fontSize: '24px', color: '#333', marginBottom: '10px'}}>Procesando datos...</h2>
            <p style={{color: '#666', fontSize: '16px'}}>Importando y mapeando automáticamente</p>
            <p style={{color: '#666', fontSize: '14px', marginTop: '10px'}}>Serás redirigido al dashboard en un momento</p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'mapeo') {
    return (
      <MapeoColumnas
        uploadData={uploadData}
        onMapeoComplete={handleMapeoComplete}
        onBack={handleReset}
      />
    )
  }

  if (step === 'confirmacion') {
    // Mostrar mapeo automático de columnas de forma simple
    const mapeos = mapeoData?.mapeos || [];
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.stepIndicator}>
              <div style={styles.step} data-active="false">1. Upload</div>
              <div style={styles.stepDivider}>→</div>
              <div style={styles.step} data-active="false">2. Mapeo</div>
              <div style={styles.stepDivider}>→</div>
              <div style={styles.step} data-active="true">3. Confirmar</div>
            </div>
            <h2 style={styles.title}>✓ Validación Completada</h2>
          </div>

          <div style={styles.summary}>
            <div style={styles.summaryRow}>
              <strong>Archivo:</strong> {uploadData.filename}
            </div>
            <div style={styles.summaryRow}>
              <strong>Total de filas:</strong> {uploadData.total_filas}
            </div>
            <div style={styles.summaryRow}>
              <strong>Columnas mapeadas:</strong> {mapeos.length}
            </div>
            {mapeoData?.normalizar_automatico && (
              <div style={styles.summaryRow}>
                <strong>Normalización:</strong> ✓ Activada (automática)
              </div>
            )}
          </div>

          <div style={{marginBottom: 24}}>
            <h3 style={{fontSize: '18px', margin: '10px 0'}}>🗂 Mapeo de columnas detectado</h3>
            <table style={{width: '100%', borderCollapse: 'collapse', background: '#f9fafb', borderRadius: 8}}>
              <thead>
                <tr style={{background: '#f3f4f6'}}>
                  <th style={{padding: 8, textAlign: 'left'}}>Columna del archivo</th>
                  <th style={{padding: 8, textAlign: 'left'}}>Campo del sistema</th>
                </tr>
              </thead>
              <tbody>
                {mapeos.map((m, i) => (
                  <tr key={i} style={{borderBottom: '1px solid #e5e7eb'}}>
                    <td style={{padding: 8}}>{m.columna_fuente}</td>
                    <td style={{padding: 8}}>{m.campo_destino}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{fontSize: 14, color: '#6b7280', marginTop: 8}}>
              Revisa el mapeo automático. Si algún campo no es correcto, puedes volver y ajustarlo.
            </div>
          </div>

          <div style={styles.success}>
            <div style={styles.successIcon}>✓</div>
            <div style={styles.successText}>
              <strong>¿Listo para importar?</strong>
              <p>Al confirmar, se guardarán {uploadData.total_filas} registros de conversos en la base de datos.</p>
            </div>
          </div>

          <div style={styles.actions}>
            <button
              onClick={() => setStep('mapeo')}
              style={styles.buttonSecondary}
              disabled={importing}
            >
              ← Volver al mapeo
            </button>
            <button
              onClick={handleConfirmarImportacion}
              style={styles.buttonPrimary}
              disabled={importing}
            >
              {importing ? 'Importando...' : 'Confirmar Importación →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'completado') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>🎉 Importación Completada</h2>

          <div style={styles.success}>
            <div style={styles.successIconLarge}>🎉</div>
            <div style={styles.successText}>
              <strong style={{ fontSize: '20px' }}>¡Datos importados exitosamente!</strong>
              <p style={{ fontSize: '16px', marginTop: '10px' }}>
                {importResult?.personas_importadas || uploadData.total_filas} personas fueron importadas.
              </p>
            </div>
          </div>

          <div style={styles.nextSteps}>
            <h3 style={styles.nextStepsTitle}>Próximos pasos:</h3>
            <ul style={styles.nextStepsList}>
              <li>Ve al <a href="/" style={styles.link}>Dashboard</a> para ver los indicadores calculados</li>
              <li>Los KPIs se actualizarán automáticamente con los nuevos datos</li>
              <li>Revisa el breakdown por unidad y la tendencia mensual</li>
              <li>Si faltan datos de edad o sexo, completa el enriquecimiento</li>
            </ul>
          </div>

          <div style={styles.actions}>
            <button
              onClick={handleReset}
              style={styles.buttonSecondary}
            >
              Importar otro archivo
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={styles.buttonPrimary}
            >
              Ir al Dashboard →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

const styles = {
  container: {
    padding: '30px',
    maxWidth: '900px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    background: 'white',
    borderRadius: '8px',
    padding: '40px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  header: {
    marginBottom: '30px',
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  step: {
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '500',
    background: '#f3f4f6',
    color: '#6b7280',
  },
  stepDivider: {
    margin: '0 10px',
    color: '#d1d5db',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    color: '#111',
    textAlign: 'center',
  },
  summary: {
    background: '#f9fafb',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '30px',
  },
  summaryRow: {
    padding: '10px 0',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '15px',
    display: 'flex',
    justifyContent: 'space-between',
  },
  success: {
    display: 'flex',
    alignItems: 'center',
    background: '#d1fae5',
    borderLeft: '4px solid #10b981',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '30px',
  },
  successIcon: {
    fontSize: '48px',
    color: '#10b981',
    marginRight: '20px',
  },
  successIconLarge: {
    fontSize: '64px',
    marginRight: '20px',
  },
  successText: {
    flex: 1,
  },
  nextSteps: {
    background: '#f3f4f6',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '30px',
  },
  nextStepsTitle: {
    margin: '0 0 15px 0',
    fontSize: '18px',
    color: '#111',
  },
  nextStepsList: {
    margin: 0,
    paddingLeft: '20px',
  },
  link: {
    color: '#667eea',
    textDecoration: 'none',
    fontWeight: '600',
  },
  actions: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'flex-end',
    marginTop: '30px',
  },
  buttonPrimary: {
    padding: '12px 30px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    background: '#667eea',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  buttonSecondary: {
    padding: '12px 30px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#667eea',
    background: 'white',
    border: '2px solid #667eea',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
}

const cardStyles = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: 'Arial, sans-serif',
  },
  pageTitle: {
    margin: '0 0 6px 0',
    fontSize: 28,
    color: '#111',
  },
  pageSubtitle: {
    color: '#666',
    fontSize: 15,
    margin: '0 0 32px 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 24,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    padding: '24px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.03em',
    alignSelf: 'flex-start',
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    color: '#111',
  },
  cardDesc: {
    margin: 0,
    color: '#666',
    fontSize: 13,
    lineHeight: 1.5,
  },
  fileRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  fileLabel: {
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
  },
  fileBtn: {
    display: 'block',
    padding: '9px 14px',
    borderRadius: 8,
    border: '1px dashed #aaa',
    background: '#f9fafb',
    fontSize: 13,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  importBtn: {
    padding: '9px 20px',
    borderRadius: 8,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    transition: 'opacity 0.2s',
  },
  fileHint: {
    margin: 0,
    fontSize: 12,
    color: '#666',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
    fontSize: 13,
  },
  successBox: {
    background: '#ecfdf5',
    border: '1px solid #6ee7b7',
    borderRadius: 8,
    padding: 16,
    color: '#065f46',
  },
  resetBtn: {
    marginTop: 10,
    padding: '4px 12px',
    borderRadius: 6,
    border: '1px solid #aaa',
    cursor: 'pointer',
    background: '#fff',
    fontSize: 13,
  },
}

// Add hover styles via CSS
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  [data-active="true"] {
    background: #667eea !important;
    color: white !important;
  }
  button:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`
document.head.appendChild(styleSheet)
