import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import API_BASE from '../config'
import {
  COUNCIL_ASSIGNMENTS_STORAGE_KEY,
  DEFAULT_COUNCIL_ASSIGNMENTS_PLAN,
  normalizeCouncilAssignmentsPayload
} from '../utils/councilAssignments'

const API_PATH = '/api/council-assignments'

function LeaderCard({ leader, unitName, committeesMap, draggable, onDragStart }) {
  return (
    <article
      style={{ ...styles.leaderCard, ...(draggable ? styles.leaderCardDraggable : {}) }}
      draggable={draggable}
      onDragStart={(event) => onDragStart?.(event, leader.id)}
    >
      <p style={styles.leaderName}>
        {leader.name}
        {leader.isTraveler ? <span title="Miembro viajante" style={styles.travelerIcon}>🧭</span> : null}
      </p>
      {leader.assignmentTitle ? <p style={styles.leaderSubtitle}>{leader.assignmentTitle}</p> : null}
      <p style={styles.metaText}>Unidad: {unitName || 'Sin unidad'}</p>
      <p style={styles.metaText}>
        Comité: {leader.committeeIds.map((id) => committeesMap[id]).filter(Boolean).join(', ') || 'Sin comité'}
      </p>
      {!leader.isHighCouncil ? <p style={styles.tagOther}>Otro líder</p> : null}
    </article>
  )
}

export default function CouncilAssignments({ canEdit }) {
  const [plan, setPlan] = useState(DEFAULT_COUNCIL_ASSIGNMENTS_PLAN)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [activeTab, setActiveTab] = useState(canEdit ? 'editar' : 'miembros')

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

  const leadersByUnit = useMemo(() => {
    return plan.units.map((unit) => ({
      ...unit,
      leaders: plan.leaders.filter((leader) => leader.unitId === unit.id)
    }))
  }, [plan])

  const unassignedLeaders = useMemo(() => plan.leaders.filter((leader) => !leader.unitId), [plan.leaders])
  const travelers = useMemo(() => plan.leaders.filter((leader) => leader.isTraveler), [plan.leaders])

  function assignUnit(leaderId, unitId) {
    setPlan((prev) => ({
      ...prev,
      leaders: prev.leaders.map((leader) => (leader.id === leaderId ? { ...leader, unitId } : leader))
    }))
  }

  function handleDragStart(event, leaderId) {
    event.dataTransfer.setData('text/plain', leaderId)
  }

  function handleDropUnit(event, unitId) {
    event.preventDefault()
    const leaderId = event.dataTransfer.getData('text/plain')
    if (!leaderId) return
    assignUnit(leaderId, unitId)
  }

  function handleDropUnassigned(event) {
    event.preventDefault()
    const leaderId = event.dataTransfer.getData('text/plain')
    if (!leaderId) return
    assignUnit(leaderId, '')
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
        <p style={styles.subtitle}>Vista clara por unidad, comité y estado viajante. El icono 🧭 identifica miembros viajantes.</p>

        <div style={styles.tabsRow}>
          <button type="button" style={{ ...styles.tabBtn, ...(activeTab === 'miembros' ? styles.tabBtnActive : {}) }} onClick={() => setActiveTab('miembros')}>Miembros</button>
          {canEdit ? (
            <button type="button" style={{ ...styles.tabBtn, ...(activeTab === 'editar' ? styles.tabBtnActive : {}) }} onClick={() => setActiveTab('editar')}>Editar (drag & drop)</button>
          ) : null}
        </div>
      </div>

      {activeTab === 'miembros' ? (
        <div style={styles.sectionCard}>
          <h3 style={styles.sectionTitle}>Unidades y miembros asignados</h3>
          <div style={styles.unitsGrid}>
            {leadersByUnit.map((unit) => (
              <section key={unit.id} style={styles.unitColumn}>
                <h4 style={styles.unitTitle}>{unit.name}</h4>
                {unit.leaders.length ? unit.leaders.map((leader) => (
                  <LeaderCard key={leader.id} leader={leader} unitName={unitsMap[leader.unitId]} committeesMap={committeesMap} />
                )) : <p style={styles.emptyHint}>Sin asignaciones.</p>}
              </section>
            ))}

            <section style={styles.unitColumn}>
              <h4 style={styles.unitTitle}>Sin unidad</h4>
              {unassignedLeaders.length ? unassignedLeaders.map((leader) => (
                <LeaderCard key={leader.id} leader={leader} unitName="" committeesMap={committeesMap} />
              )) : <p style={styles.emptyHint}>Todos están asignados.</p>}
            </section>

            <section style={styles.unitColumn}>
              <h4 style={styles.unitTitle}>Sector viajante</h4>
              {travelers.length ? travelers.map((leader) => (
                <LeaderCard key={leader.id} leader={leader} unitName={unitsMap[leader.unitId]} committeesMap={committeesMap} />
              )) : <p style={styles.emptyHint}>No hay viajantes configurados.</p>}
            </section>
          </div>
        </div>
      ) : null}

      {activeTab === 'editar' && canEdit ? (
        <div style={styles.sectionCard}>
          <h3 style={styles.sectionTitle}>Editor para Presidencia</h3>
          <p style={styles.hint}>Arrastra un miembro hacia una unidad o al cuadro “Sin unidad”. También puedes marcar sus comités.</p>

          <div style={styles.unitsGrid}>
            {leadersByUnit.map((unit) => (
              <section
                key={unit.id}
                style={styles.unitColumn}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDropUnit(event, unit.id)}
              >
                <h4 style={styles.unitTitle}>{unit.name}</h4>
                {unit.leaders.length ? unit.leaders.map((leader) => (
                  <LeaderCard
                    key={leader.id}
                    leader={leader}
                    unitName={unitsMap[leader.unitId]}
                    committeesMap={committeesMap}
                    draggable
                    onDragStart={handleDragStart}
                  />
                )) : <p style={styles.emptyHint}>Arrastra miembros aquí.</p>}
              </section>
            ))}

            <section
              style={styles.unitColumn}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDropUnassigned}
            >
              <h4 style={styles.unitTitle}>Sin unidad</h4>
              {unassignedLeaders.length ? unassignedLeaders.map((leader) => (
                <LeaderCard
                  key={leader.id}
                  leader={leader}
                  unitName=""
                  committeesMap={committeesMap}
                  draggable
                  onDragStart={handleDragStart}
                />
              )) : <p style={styles.emptyHint}>No hay miembros sin unidad.</p>}
            </section>
          </div>

          <div style={styles.committeeBox}>
            <h4 style={styles.unitTitle}>Comités</h4>
            {plan.leaders.map((leader) => (
              <div key={`committee-${leader.id}`} style={styles.committeeRow}>
                <span style={styles.committeeLeaderName}>{leader.name}</span>
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
      ) : null}
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
  tabsRow: { marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' },
  tabBtn: { border: '1px solid #cbd5e1', background: '#fff', borderRadius: '999px', padding: '8px 14px', cursor: 'pointer' },
  tabBtnActive: { background: '#0b7ea8', color: '#fff', borderColor: '#0b7ea8' },
  sectionCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e2e8f0'
  },
  sectionTitle: { marginTop: 0, color: '#0f172a' },
  hint: { marginTop: '-4px', color: '#64748b' },
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
  leaderCardDraggable: { cursor: 'grab' },
  leaderName: { margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0f172a' },
  travelerIcon: { fontSize: '15px' },
  leaderSubtitle: { margin: '3px 0 0', color: '#334155', fontSize: '13px' },
  metaText: { margin: '4px 0 0', color: '#475569', fontSize: '12px' },
  tagOther: { margin: '6px 0 0', color: '#92400e', fontSize: '12px', fontWeight: 600 },
  committeeBox: { marginTop: '18px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' },
  committeeRow: { borderBottom: '1px solid #f1f5f9', padding: '8px 0', display: 'grid', gap: '8px' },
  committeeLeaderName: { color: '#0f172a', fontWeight: 600 },
  committeeChecks: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  checkLabel: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#334155', fontSize: '14px' },
  actionsRow: { marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
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
