import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import API_BASE from '../config'
import {
  COUNCIL_ASSIGNMENTS_STORAGE_KEY,
  DEFAULT_COUNCIL_ASSIGNMENTS_PLAN,
  normalizeCouncilAssignmentsPayload
} from '../utils/councilAssignments'

const API_PATH = '/api/council-assignments'

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
      {!leader.isHighCouncil ? <p style={styles.tagOther}>Solo para comité</p> : null}
    </article>
  )
}

export default function CouncilAssignments({ canEdit }) {
  const [plan, setPlan] = useState(DEFAULT_COUNCIL_ASSIGNMENTS_PLAN)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [activeTab, setActiveTab] = useState(canEdit ? 'ver' : 'ver')

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
        <p style={styles.subtitle}>Separamos la vista de asignaciones de la pantalla de edición.</p>

        <div style={styles.tabsRow}>
          <button type="button" style={{ ...styles.tabBtn, ...(activeTab === 'ver' ? styles.tabBtnActive : {}) }} onClick={() => setActiveTab('ver')}>Ver asignaciones</button>
          {canEdit ? (
            <button type="button" style={{ ...styles.tabBtn, ...(activeTab === 'editar' ? styles.tabBtnActive : {}) }} onClick={() => setActiveTab('editar')}>Editar</button>
          ) : null}
        </div>
      </div>

      {activeTab === 'ver' ? (
        <div style={styles.sectionCard}>
          <h3 style={styles.sectionTitle}>Distribución de miembros de Sumo Consejo</h3>
          <div style={styles.unitsGrid}>
            {highCouncilByUnit.map((unit) => (
              <section key={unit.id} style={styles.unitColumn}>
                <h4 style={styles.unitTitle}>{unit.name}</h4>
                {unit.leaders.length ? unit.leaders.map((leader) => (
                  <LeaderCard
                    key={leader.id}
                    leader={leader}
                    unitNames={leader.unitIds.map((unitId) => unitsMap[unitId]).filter(Boolean)}
                    committeesMap={committeesMap}
                  />
                )) : <p style={styles.emptyHint}>Sin miembros asignados.</p>}
              </section>
            ))}
          </div>

          <h3 style={{ ...styles.sectionTitle, marginTop: '20px' }}>Distribución de comités</h3>
          <div style={styles.unitsGrid}>
            {committeesWithLeaders.map((committee) => (
              <section key={committee.id} style={styles.unitColumn}>
                <h4 style={styles.unitTitle}>{committee.name}</h4>
                {committee.leaders.length ? committee.leaders.map((leader) => (
                  <LeaderCard
                    key={`${committee.id}-${leader.id}`}
                    leader={leader}
                    unitNames={leader.unitIds.map((unitId) => unitsMap[unitId]).filter(Boolean)}
                    committeesMap={committeesMap}
                  />
                )) : <p style={styles.emptyHint}>Sin miembros en este comité.</p>}
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'editar' && canEdit ? (
        <div style={styles.sectionCard}>
          <h3 style={styles.sectionTitle}>Editor para Presidencia</h3>
          <p style={styles.hint}>Ahora puedes asignar varios barrios al mismo miembro del Sumo Consejo y marcar si es viajante.</p>

          <div style={styles.committeeBox}>
            <h4 style={styles.unitTitle}>Asignaciones de barrios (solo Sumo Consejo)</h4>
            {leaders.map((leader) => (
              <div key={`units-${leader.id}`} style={styles.committeeRow}>
                <div style={styles.committeeHeader}>
                  <span style={styles.committeeLeaderName}>{leader.name}</span>
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
  leaderName: { margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0f172a' },
  travelerIcon: { fontSize: '15px' },
  leaderSubtitle: { margin: '3px 0 0', color: '#334155', fontSize: '13px' },
  metaText: { margin: '4px 0 0', color: '#475569', fontSize: '12px' },
  tagOther: { margin: '6px 0 0', color: '#92400e', fontSize: '12px', fontWeight: 600 },
  committeeBox: { marginTop: '18px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' },
  committeeRow: { borderBottom: '1px solid #f1f5f9', padding: '8px 0', display: 'grid', gap: '8px' },
  committeeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
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
