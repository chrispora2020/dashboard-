import axios from 'axios'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import API_BASE from '../config'
import { COUNCIL_ASSIGNMENTS_STORAGE_KEY, DEFAULT_COUNCIL_ASSIGNMENTS_PLAN, normalizeCouncilAssignmentsPayload } from '../utils/councilAssignments'

const API_PATH = '/api/council-assignments'
const textFields = [
  ['name', 'Miembro'], ['assignmentTitle', 'Llamamientos'],
  ['additionalResponsibility', 'Responsabilidad adicional'],
  ['referent', 'Referente'], ['observations', 'Observaciones']
]

export default function CouncilAssignments({ canEdit, viewSection = 'all' }) {
  const [plan, setPlan] = useState(DEFAULT_COUNCIL_ASSIGNMENTS_PLAN)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data } = await axios.get(`${API_BASE}${API_PATH}`)
        if (!active) return
        const next = normalizeCouncilAssignmentsPayload(data.plan)
        setPlan(next)
        localStorage.setItem(COUNCIL_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        if (!active) return
        setLoadFailed(true)
        setStatus('No se pudo cargar el servidor. Se muestra una copia local o los datos del Excel; la edición está deshabilitada. Recarga para reintentar.')
        try {
          const cached = localStorage.getItem(COUNCIL_ASSIGNMENTS_STORAGE_KEY)
          if (cached) setPlan(normalizeCouncilAssignmentsPayload(JSON.parse(cached)))
        } catch { /* La copia dañada no reemplaza los datos iniciales. */ }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function change(next) {
    setPlan(next)
    setDirty(true)
    setStatus('Cambios pendientes de guardar.')
  }
  function update(id, field, value) {
    change({ ...plan, leaders: plan.leaders.map(leader => leader.id === id ? { ...leader, [field]: value } : leader) })
  }
  function toggle(id, field, value) {
    const leader = plan.leaders.find(item => item.id === id)
    const current = leader[field] || []
    const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value]
    change({ ...plan, leaders: plan.leaders.map(item => item.id === id
      ? { ...item, [field]: next, ...(field === 'unitIds' ? { unitId: next[0] || '' } : {}) } : item) })
  }
  function add() {
    change({ ...plan, leaders: [...plan.leaders, {
      id: crypto.randomUUID(), name: '', assignmentTitle: '', additionalResponsibility: '',
      isHighCouncil: true, isTraveler: false, unitId: '', unitIds: [], committeeIds: [],
      assignments: [], referent: '', observations: ''
    }] })
  }
  function remove(leader) {
    if (window.confirm(`¿Quitar a ${leader.name || 'este miembro'}? Se aplicará al guardar.`)) {
      change({ ...plan, leaders: plan.leaders.filter(item => item.id !== leader.id) })
    }
  }
  async function save() {
    if (plan.leaders.some(leader => !leader.name.trim())) {
      setStatus('Completa el nombre de todos los miembros antes de guardar.')
      return
    }
    setSaving(true)
    try {
      const { data } = await axios.post(`${API_BASE}${API_PATH}`, { plan })
      const next = normalizeCouncilAssignmentsPayload(data.plan)
      setPlan(next)
      localStorage.setItem(COUNCIL_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(next))
      setDirty(false)
      setStatus('Asignaciones guardadas correctamente.')
    } catch (error) {
      setStatus(error.response?.data?.detail || 'No se pudo guardar. Tus cambios siguen en pantalla; vuelve a intentarlo.')
    } finally { setSaving(false) }
  }
  function loadExcel() {
    if (window.confirm('¿Cargar los 11 miembros y las asignaciones del Excel? Reemplazará el contenido del editor. Revisa los datos y pulsa Guardar para aplicarlos.')) {
      change(normalizeCouncilAssignmentsPayload(structuredClone(DEFAULT_COUNCIL_ASSIGNMENTS_PLAN)))
    }
  }
  const names = (ids, options) => (ids || []).map(id => options.find(option => option.id === id)?.name || id).join(', ') || '—'
  const visible = plan.leaders.filter(leader => (viewSection === 'committees' || leader.isHighCouncil)
    && `${leader.name} ${leader.assignmentTitle} ${leader.referent} ${(leader.assignments || []).join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const leave = event => { if (dirty && !window.confirm('Hay cambios sin guardar. ¿Salir y descartarlos?')) event.preventDefault() }

  if (loading) return <div className="workspace-page" style={styles.page}>Cargando asignaciones...</div>
  return <div className="workspace-page" style={styles.page}>
    <header className="workspace-surface" style={styles.headerCard}>
      <h2 style={styles.title}>{canEdit ? 'Editar asignaciones' : 'Asignaciones del Sumo Consejo'}</h2>
      <p style={styles.subtitle}>{canEdit ? 'Administración de miembros y asignaciones · Solo Presidencia' : 'Consulta de llamamientos, barrios, comités y responsabilidades.'}</p>
      <div style={styles.actionsRow}>
        <Link to="/asignaciones/sumo-consejo" onClick={leave}>Ver asignaciones</Link>
        {localStorage.getItem('dashboard_role') === 'presidencia' && <Link to="/asignaciones/editar">Editar asignaciones</Link>}
      </div>
    </header>
    {status && <p role="status" style={styles.status}>{status}</p>}
    {canEdit ? <fieldset disabled={saving || loadFailed} style={styles.sectionCard}>
      <legend>Editor para Presidencia</legend>
      <p>Los cambios se aplican al pulsar Guardar asignaciones.</p>
      <div style={styles.actionsRow}>
        <button type="button" style={styles.addBtn} onClick={add}>Agregar miembro</button>
        <button type="button" style={styles.restoreBtn} onClick={loadExcel}>Cargar datos del Excel</button>
      </div>
      <datalist id="council-referents">{plan.referentOptions.map(option => <option key={option} value={option} />)}</datalist>
      <datalist id="council-assignments">{plan.assignmentOptions.map(option => <option key={option} value={option} />)}</datalist>
      {plan.leaders.map(leader => <article key={leader.id} style={styles.committeeBox}>
        <div style={styles.addLeaderGrid}>
          {textFields.map(([field, label]) => <label key={field} style={styles.inputLabel}>{label}
            {field === 'observations' ? <textarea style={styles.textInput} value={leader[field] || ''} onChange={event => update(leader.id, field, event.target.value)} />
              : <input style={styles.textInput} value={leader[field] || ''} list={field === 'referent' ? 'council-referents' : undefined} onChange={event => update(leader.id, field, event.target.value)} />}
          </label>)}
          <label style={styles.inputLabel}>Tipo de miembro<select style={styles.selectInput} value={leader.isHighCouncil ? 'council' : 'other'} onChange={event => update(leader.id, 'isHighCouncil', event.target.value === 'council')}>
            <option value="council">Sumo Consejo</option><option value="other">Otro líder (comités)</option>
          </select></label>
        </div>
        <p>Asignaciones (hasta tres; puedes escribir otra opción)</p>
        <div style={styles.addLeaderGrid}>{Array.from({ length: Math.max(3, (leader.assignments || []).length) }, (_, index) => <label key={index} style={styles.inputLabel}>Asignación {index + 1}
          <input style={styles.textInput} list="council-assignments" value={leader.assignments?.[index] || ''} onChange={event => {
            const values = [...(leader.assignments || [])]; values[index] = event.target.value; update(leader.id, 'assignments', values)
          }} />
        </label>)}</div>
        {leader.isHighCouncil && <fieldset style={styles.committeeBox}><legend>Barrios y ramas</legend><div style={styles.committeeChecks}>{plan.units.map(unit => <label key={unit.id} style={styles.checkLabel}>
          <input type="checkbox" checked={leader.unitIds.includes(unit.id)} onChange={() => toggle(leader.id, 'unitIds', unit.id)} />{unit.name}
        </label>)}</div></fieldset>}
        <fieldset style={styles.committeeBox}><legend>Comités</legend><div style={styles.committeeChecks}>{plan.committees.map(committee => <label key={committee.id} style={styles.checkLabel}>
          <input type="checkbox" checked={leader.committeeIds.includes(committee.id)} onChange={() => toggle(leader.id, 'committeeIds', committee.id)} />{committee.name}
        </label>)}</div></fieldset>
        <div style={styles.actionsRow}><label style={styles.checkLabel}><input type="checkbox" checked={leader.isTraveler} onChange={event => update(leader.id, 'isTraveler', event.target.checked)} />Viajante</label>
          <button type="button" style={styles.restoreBtn} onClick={() => remove(leader)}>Quitar miembro</button></div>
      </article>)}
      {!plan.leaders.length && <p>No hay miembros. Puedes agregar uno o cargar los datos del Excel.</p>}
      <div style={styles.actionsRow}><button type="button" style={styles.saveBtn} onClick={save} disabled={!dirty || saving}>{saving ? 'Guardando...' : 'Guardar asignaciones'}</button></div>
    </fieldset> : <section style={styles.sectionCard}>
      <label style={styles.inputLabel}>Buscar miembro, llamamiento, asignación o referente<input type="search" value={search} onChange={event => setSearch(event.target.value)} style={styles.textInput} /></label>
      <p>{visible.length} miembros · 🧭 Viajante</p>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
        <thead><tr>{['Miembro', 'Llamamientos', 'Responsabilidad adicional', 'Barrio asignado', 'Comité', 'Asignación', 'Referente', 'Observaciones'].map(title => <th key={title} scope="col" style={{ padding: 12, background: '#f1f5f9', minWidth: 140 }}>{title}</th>)}</tr></thead>
        <tbody>{visible.map(leader => <tr key={leader.id}>{[
          leader.name + (leader.isTraveler ? ' 🧭' : ''), leader.assignmentTitle,
          leader.additionalResponsibility, names(leader.unitIds, plan.units), names(leader.committeeIds, plan.committees),
          (leader.assignments || []).filter(Boolean).join(', '), leader.referent, leader.observations
        ].map((value, index) => <td key={index} style={{ padding: 12, borderBottom: '1px solid #e2e8f0', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{value || '—'}</td>)}</tr>)}</tbody>
      </table></div>
      {!visible.length && <p>No hay miembros para mostrar.</p>}
      {viewSection === 'committees' && plan.committees.map(committee => <section key={committee.id} style={styles.committeeBox}>
        <h3>{committee.name}</h3><p>{visible.filter(leader => leader.committeeIds.includes(committee.id)).map(leader => leader.name).join(', ') || 'Sin miembros asignados.'}</p>
      </section>)}
    </section>}
  </div>
}

const styles = {
  page: {
    padding: '24px',
    display: 'grid',
    gap: '16px'
  },
  headerCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e2e8f0'
  },
  title: { margin: 0, color: '#0f172a' },
  subtitle: { marginTop: '6px', marginBottom: 0, color: '#475569' },
  legend: { marginTop: '8px', marginBottom: 0, color: '#334155', fontSize: '13px' },
  sectionCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e2e8f0'
  },
  sectionTitle: { marginTop: 0, color: '#0f172a' },
  hint: { marginTop: '-4px', color: '#64748b' },
  addLeaderBox: { marginTop: '18px', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' },
  addLeaderGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  unitsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
    gap: '14px'
  },
  committeesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '14px'
  },
  unitColumn: {
    border: '1px solid #dbe7f5',
    borderRadius: '14px',
    padding: '14px',
    background: 'linear-gradient(180deg, #fbfdff 0%, #f8fbff 100%)',
    minHeight: '140px',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.05)'
  },
  unitTitle: { marginTop: 0, marginBottom: '12px', color: '#1e293b' },
  committeeNameTitle: { marginTop: 0, marginBottom: '12px', color: '#1e293b', fontSize: '22px', lineHeight: 1.2 },
  emptyHint: { color: '#64748b', fontSize: '14px' },
  leaderCardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px'
  },
  leaderCard: {
    border: '1px solid #dbeafe',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: 0,
    background: '#fff',
    boxShadow: '0 4px 14px rgba(30, 64, 175, 0.08)'
  },
  leaderName: { margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0f172a' },
  travelerIcon: { fontSize: '15px' },
  leaderSubtitle: { margin: '3px 0 0', color: '#334155', fontSize: '13px' },
  metaText: { margin: '4px 0 0', color: '#475569', fontSize: '12px' },
  committeeBox: { marginTop: '18px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' },
  committeeRow: { borderBottom: '1px solid #f1f5f9', padding: '8px 0', display: 'grid', gap: '8px' },
  committeeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8px', flexWrap: 'wrap' },
  leaderInfoInputs: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', flex: '1 1 420px' },
  inputLabel: { display: 'grid', gap: '4px', color: '#334155', fontSize: '13px' },
  textInput: { border: '1px solid #cbd5e1', borderRadius: '14px', padding: '8px 10px', fontSize: '14px' },
  selectInput: { border: '1px solid #cbd5e1', borderRadius: '14px', padding: '8px 10px', fontSize: '14px', background: '#fff' },
  committeeLeaderName: { color: '#0f172a', fontWeight: 600 },
  committeeChecks: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  checkLabel: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#334155', fontSize: '14px' },
  actionsRow: { marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  addBtn: { border: '1px solid #0b7ea8', borderRadius: '14px', background: '#ecfeff', color: '#0b7ea8', padding: '8px 12px', cursor: 'pointer', marginTop: '12px' },
  saveBtn: {
    border: 'none',
    borderRadius: '14px',
    background: '#0b7ea8',
    color: '#fff',
    padding: '10px 16px',
    cursor: 'pointer'
  },
  restoreBtn: {
    border: '1px solid #b45309',
    borderRadius: '14px',
    background: '#fffbeb',
    color: '#b45309',
    padding: '10px 16px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  status: { color: '#0f172a', fontWeight: 600 }
}
