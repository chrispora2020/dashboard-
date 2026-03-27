import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import API_BASE from '../config'
import {
  COUNCIL_ASSIGNMENTS_STORAGE_KEY,
  DEFAULT_COUNCIL_ASSIGNMENTS_PLAN,
  normalizeCouncilAssignmentsPayload
} from '../utils/councilAssignments'

const API_PATH = '/api/council-assignments'

function slugifyLeaderId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function LeaderCard({ leader, unitNames, committeesMap }) {
  return (
    <article style={styles.leaderCard}>
      <p style={styles.leaderName}>
        {leader.name}
        {leader.isTraveler ? <span title="Miembro viajante" style={styles.travelerIcon}>🧭</span> : null}
      </p>
      {leader.assignmentTitle ? <p style={styles.leaderSubtitle}>{leader.assignmentTitle}</p> : null}
      <p style={styles.metaText}>Barrios: {unitNames.length ? unitNames.join(', ') : 'Sin barrios asignados'}</p>
      <p style={styles.metaText}>
        Comité: {leader.committeeIds.map((id) => committeesMap[id]).filter(Boolean).join(', ') || 'Sin comité'}
      </p>
    </article>
  )
}

export default function CouncilAssignments({ canEdit }) {
  const [plan, setPlan] = useState(DEFAULT_COUNCIL_ASSIGNMENTS_PLAN)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [newLeaderName, setNewLeaderName] = useState('')
  const [newLeaderTitle, setNewLeaderTitle] = useState('')
  const [newLeaderType, setNewLeaderType] = useState('high-council')

  const unitsMap = useMemo(() => Object.fromEntries(plan.units.map((unit) => [unit.id, unit.name])), [plan.units])
  const committeesMap = useMemo(() => Object.fromEntries(plan.committees.map((committee) => [committee.id, committee.name])), [plan.committees])

  useEffect(() => {
    async function loadPlan() {
      try {
        const { data } = await axios.get(`${API_BASE}${API_PATH}`)
        const normalized = normalizeCouncilAssignmentsPayload(data?.plan)
        setPlan(normalized)
        localStorage.setItem(COUNCIL_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(normalized))
      } catch (error) {
        const cached = localStorage.getItem(COUNCIL_ASSIGNMENTS_STORAGE_KEY)
        if (cached) {
          setPlan(normalizeCouncilAssignmentsPayload(JSON.parse(cached)))
        }
      } finally {
        setLoading(false)
      }
    }

    loadPlan()
  }, [])

  const leaders = useMemo(
    () => plan.leaders.map((leader) => ({ ...leader, unitIds: Array.isArray(leader.unitIds) ? leader.unitIds : [] })),
    [plan.leaders]
  )

  const highCouncilLeaders = useMemo(() => leaders.filter((leader) => leader.isHighCouncil), [leaders])

  const highCouncilByUnit = useMemo(() => {
    return plan.units.map((unit) => ({
      ...unit,
      leaders: highCouncilLeaders.filter((leader) => leader.unitIds.includes(unit.id))
    }))
  }, [highCouncilLeaders, plan.units])

  const committeesWithLeaders = useMemo(() => {
    return plan.committees.map((committee) => ({
      ...committee,
      leaders: leaders.filter((leader) => leader.committeeIds.includes(committee.id))
    }))
  }, [leaders, plan.committees])

  function toggleLeaderUnit(leaderId, unitId) {
    setPlan((prev) => ({
      ...prev,
      leaders: prev.leaders.map((leader) => {
        if (leader.id !== leaderId || !leader.isHighCouncil) return leader

        const currentUnitIds = Array.isArray(leader.unitIds)
          ? leader.unitIds
          : (leader.unitId ? [leader.unitId] : [])
        const isAssigned = currentUnitIds.includes(unitId)
        const nextUnitIds = isAssigned
          ? currentUnitIds.filter((id) => id !== unitId)
          : [...currentUnitIds, unitId]

        return {
          ...leader,
          unitIds: nextUnitIds,
          unitId: nextUnitIds[0] || ''
        }
      })
    }))
  }

  function toggleTraveler(leaderId) {
    setPlan((prev) => ({
      ...prev,
      leaders: prev.leaders.map((leader) => (leader.id === leaderId ? { ...leader, isTraveler: !leader.isTraveler } : leader))
    }))
  }

  function toggleCommittee(leaderId, committeeId) {
    setPlan((prev) => ({
      ...prev,
      leaders: prev.leaders.map((leader) => {
        if (leader.id !== leaderId) return leader

        const hasCommittee = leader.committeeIds.includes(committeeId)
        return {
          ...leader,
          committeeIds: hasCommittee
            ? leader.committeeIds.filter((id) => id !== committeeId)
            : [...leader.committeeIds, committeeId]
        }
      })
    }))
  }


  function updateLeaderField(leaderId, field, value) {
    setPlan((prev) => ({
      ...prev,
      leaders: prev.leaders.map((leader) => (leader.id === leaderId ? { ...leader, [field]: value } : leader))
    }))
  }

  function addLeader() {
    const cleanName = newLeaderName.trim()
    if (!cleanName) {
      setStatus('⚠️ Escribe el nombre del miembro para agregarlo.')
      return
    }

    const baseId = slugifyLeaderId(cleanName) || `lider-${Date.now()}`
    const idExists = plan.leaders.some((leader) => leader.id === baseId)
    const nextId = idExists ? `${baseId}-${Date.now()}` : baseId

    const leaderToAdd = {
      id: nextId,
      name: cleanName,
      assignmentTitle: newLeaderTitle.trim(),
      isHighCouncil: newLeaderType === 'high-council',
      isTraveler: false,
      unitId: '',
      unitIds: [],
      committeeIds: []
    }

    setPlan((prev) => ({ ...prev, leaders: [...prev.leaders, leaderToAdd] }))
    setNewLeaderName('')
    setNewLeaderTitle('')
    setNewLeaderType('high-council')
    setStatus(`✅ Se agregó a ${cleanName}.`)
  }

  async function savePlan() {
    setSaving(true)
    setStatus('')

    try {
      await axios.post(`${API_BASE}${API_PATH}`, { plan })
      localStorage.setItem(COUNCIL_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(plan))
      setStatus('✅ Asignaciones guardadas correctamente.')
    } catch (error) {
      setStatus(`❌ No se pudo guardar: ${error.response?.data?.detail || error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={styles.page}>Cargando asignaciones...</div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerCard}>
        <h2 style={styles.title}>Asignación de Sumo Consejo y comités</h2>
        <p style={styles.subtitle}>Pantalla de edición de asignaciones para Presidencia.</p>

      </div>

      {canEdit ? (
        <div style={styles.sectionCard}>
          <h3 style={styles.sectionTitle}>Editor para Presidencia</h3>
          <p style={styles.hint}>Ahora puedes asignar varios barrios al mismo miembro del Sumo Consejo y marcar si es viajante.</p>

          <div style={styles.addLeaderBox}>
            <h4 style={styles.unitTitle}>Agregar miembro</h4>
            <div style={styles.addLeaderGrid}>
              <label style={styles.inputLabel}>
                Nombre
                <input
                  type="text"
                  value={newLeaderName}
                  onChange={(event) => setNewLeaderName(event.target.value)}
                  placeholder="Nombre completo"
                  style={styles.textInput}
                />
              </label>

              <label style={styles.inputLabel}>
                Llamamiento / asignación
                <input
                  type="text"
                  value={newLeaderTitle}
                  onChange={(event) => setNewLeaderTitle(event.target.value)}
                  placeholder="Ej: Presidente de ..."
                  style={styles.textInput}
                />
              </label>

              <label style={styles.inputLabel}>
                Tipo de miembro
                <select
                  value={newLeaderType}
                  onChange={(event) => setNewLeaderType(event.target.value)}
                  style={styles.selectInput}
                >
                  <option value="high-council">Miembro del Sumo Consejo</option>
                  <option value="other-leader">Otro líder (solo comités)</option>
                </select>
              </label>
            </div>
            <button type="button" style={styles.addBtn} onClick={addLeader}>Agregar miembro</button>
          </div>

          <div style={styles.committeeBox}>
            <h4 style={styles.unitTitle}>Asignaciones de barrios (solo Sumo Consejo)</h4>
            {leaders.map((leader) => (
              <div key={`units-${leader.id}`} style={styles.committeeRow}>
                <div style={styles.committeeHeader}>
                  <div style={styles.leaderInfoInputs}>
                    <label style={styles.inputLabel}>
                      Nombre
                      <input
                        type="text"
                        value={leader.name}
                        onChange={(event) => updateLeaderField(leader.id, 'name', event.target.value)}
                        style={styles.textInput}
                      />
                    </label>
                    <label style={styles.inputLabel}>
                      Llamamiento / asignación
                      <input
                        type="text"
                        value={leader.assignmentTitle}
                        onChange={(event) => updateLeaderField(leader.id, 'assignmentTitle', event.target.value)}
                        style={styles.textInput}
                      />
                    </label>
                  </div>
                  <label style={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={leader.isTraveler}
                      onChange={() => toggleTraveler(leader.id)}
                    />
                    Viajante
                  </label>
                </div>

                {leader.isHighCouncil ? (
                  <div style={styles.committeeChecks}>
                    {plan.units.map((unit) => (
                      <label key={`${leader.id}-${unit.id}`} style={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={leader.unitIds.includes(unit.id)}
                          onChange={() => toggleLeaderUnit(leader.id, unit.id)}
                        />
                        {unit.name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p style={styles.emptyHint}>Este miembro no se asigna a barrios; solo participa en comités.</p>
                )}
              </div>
            ))}
          </div>

          <div style={styles.committeeBox}>
            <h4 style={styles.unitTitle}>Asignaciones de comités</h4>
            {leaders.map((leader) => (
              <div key={`committee-${leader.id}`} style={styles.committeeRow}>
                <div style={styles.committeeHeader}>
                  <div style={styles.leaderInfoInputs}>
                    <label style={styles.inputLabel}>
                      Nombre
                      <input
                        type="text"
                        value={leader.name}
                        onChange={(event) => updateLeaderField(leader.id, 'name', event.target.value)}
                        style={styles.textInput}
                      />
                    </label>
                    <label style={styles.inputLabel}>
                      Llamamiento / asignación
                      <input
                        type="text"
                        value={leader.assignmentTitle}
                        onChange={(event) => updateLeaderField(leader.id, 'assignmentTitle', event.target.value)}
                        style={styles.textInput}
                      />
                    </label>
                    <label style={styles.inputLabel}>
                      Tipo
                      <select
                        value={leader.isHighCouncil ? 'high-council' : 'other-leader'}
                        onChange={(event) => updateLeaderField(leader.id, 'isHighCouncil', event.target.value === 'high-council')}
                        style={styles.selectInput}
                      >
                        <option value="high-council">Sumo Consejo</option>
                        <option value="other-leader">Otro líder</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div style={styles.committeeChecks}>
                  {plan.committees.map((committee) => (
                    <label key={`${leader.id}-${committee.id}`} style={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={leader.committeeIds.includes(committee.id)}
                        onChange={() => toggleCommittee(leader.id, committee.id)}
                      />
                      {committee.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.actionsRow}>
            <button type="button" style={styles.saveBtn} onClick={savePlan} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar asignaciones'}
            </button>
            {status ? <span style={styles.status}>{status}</span> : null}
          </div>
        </div>
      ) : (
        <div style={styles.sectionCard}>
          <h3 style={styles.sectionTitle}>Vista de asignaciones</h3>
          <p style={styles.hint}>Estas asignaciones pueden ser consultadas tanto por Consejo como por Presidencia.</p>

          <div style={styles.committeeBox}>
            <h4 style={styles.unitTitle}>Asignaciones de barrios (Sumo Consejo)</h4>
            <div style={styles.unitsGrid}>
              {highCouncilByUnit.map((unit) => (
                <section key={unit.id} style={styles.unitColumn}>
                  <h5 style={styles.unitTitle}>{unit.name}</h5>
                  {unit.leaders.length ? (
                    unit.leaders.map((leader) => (
                      <LeaderCard
                        key={`${unit.id}-${leader.id}`}
                        leader={leader}
                        unitNames={leader.unitIds.map((id) => unitsMap[id]).filter(Boolean)}
                        committeesMap={committeesMap}
                      />
                    ))
                  ) : (
                    <p style={styles.emptyHint}>Sin miembros asignados.</p>
                  )}
                </section>
              ))}
            </div>
          </div>

          <div style={styles.committeeBox}>
            <h4 style={styles.unitTitle}>Asignaciones de comités</h4>
            <div style={styles.unitsGrid}>
              {committeesWithLeaders.map((committee) => (
                <section key={committee.id} style={styles.unitColumn}>
                  <h5 style={styles.unitTitle}>{committee.name}</h5>
                  {committee.leaders.length ? (
                    committee.leaders.map((leader) => (
                      <LeaderCard
                        key={`${committee.id}-${leader.id}`}
                        leader={leader}
                        unitNames={leader.unitIds.map((id) => unitsMap[id]).filter(Boolean)}
                        committeesMap={committeesMap}
                      />
                    ))
                  ) : (
                    <p style={styles.emptyHint}>Sin miembros asignados.</p>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px'
  },
  unitColumn: {
    border: '1px dashed #cbd5e1',
    borderRadius: '10px',
    padding: '10px',
    background: '#f8fafc',
    minHeight: '140px'
  },
  unitTitle: { marginTop: 0, marginBottom: '10px', color: '#1e293b' },
  emptyHint: { color: '#64748b', fontSize: '14px' },
  leaderCard: {
    border: '1px solid #dbeafe',
    borderRadius: '10px',
    padding: '10px',
    marginBottom: '8px',
    background: '#fff'
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
  textInput: { border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 10px', fontSize: '14px' },
  selectInput: { border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 10px', fontSize: '14px', background: '#fff' },
  committeeLeaderName: { color: '#0f172a', fontWeight: 600 },
  committeeChecks: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  checkLabel: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#334155', fontSize: '14px' },
  actionsRow: { marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  addBtn: { border: '1px solid #0b7ea8', borderRadius: '8px', background: '#ecfeff', color: '#0b7ea8', padding: '8px 12px', cursor: 'pointer', marginTop: '12px' },
  saveBtn: {
    border: 'none',
    borderRadius: '8px',
    background: '#0b7ea8',
    color: '#fff',
    padding: '10px 16px',
    cursor: 'pointer'
  },
  status: { color: '#0f172a', fontWeight: 600 }
}
