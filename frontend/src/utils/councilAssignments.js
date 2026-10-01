export const COUNCIL_ASSIGNMENTS_STORAGE_KEY = 'council_assignments_plan'

import seed from './councilAssignmentsSeed.json'

export const DEFAULT_COUNCIL_ASSIGNMENTS_PLAN = seed

export function normalizeCouncilAssignmentsPayload(plan) {
  if (!plan || typeof plan !== 'object') {
    return DEFAULT_COUNCIL_ASSIGNMENTS_PLAN
  }

  const units = Array.isArray(plan.units) ? plan.units : DEFAULT_COUNCIL_ASSIGNMENTS_PLAN.units
  const committees = Array.isArray(plan.committees) ? plan.committees : DEFAULT_COUNCIL_ASSIGNMENTS_PLAN.committees
  const leadersRaw = Array.isArray(plan.leaders) ? plan.leaders : DEFAULT_COUNCIL_ASSIGNMENTS_PLAN.leaders

  const leaders = leadersRaw
    .filter((leader) => leader && typeof leader === 'object')
    .map((leader) => ({
      id: String(leader.id || ''),
      name: String(leader.name || ''),
      additionalResponsibility: String(leader.additionalResponsibility || ''),
      assignments: Array.isArray(leader.assignments) ? leader.assignments.map(String) : [],
      referent: String(leader.referent || ''),
      observations: String(leader.observations || ''),
      assignmentTitle: String(leader.assignmentTitle || ''),
      isHighCouncil: Boolean(leader.isHighCouncil),
      isTraveler: Boolean(leader.isTraveler),
      unitId: String(leader.unitId || ''),
      unitIds: Array.isArray(leader.unitIds)
        ? leader.unitIds.map((unitId) => String(unitId || '')).filter(Boolean)
        : (leader.unitId ? [String(leader.unitId)] : []),
      committeeIds: Array.isArray(leader.committeeIds) ? leader.committeeIds : []
    }))

  return {
    assignmentOptions: Array.isArray(plan.assignmentOptions) ? plan.assignmentOptions : seed.assignmentOptions,
    referentOptions: Array.isArray(plan.referentOptions) ? plan.referentOptions : seed.referentOptions,
    units,
    committees,
    leaders
  }
}
