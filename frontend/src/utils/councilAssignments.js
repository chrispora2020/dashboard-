export const COUNCIL_ASSIGNMENTS_STORAGE_KEY = 'council_assignments_plan'

export const DEFAULT_COUNCIL_ASSIGNMENTS_PLAN = {
  units: [
    { id: 'libia', name: 'Libia' },
    { id: 'barrio-14', name: 'Barrio 14' },
    { id: 'los-ceibos', name: 'Los Ceibos' },
    { id: 'belloni', name: 'Belloni' },
    { id: 'bella-italia', name: 'Bella Italia' },
    { id: 'pando', name: 'Pando' },
    { id: 'toledo', name: 'Toledo' }
  ],
  committees: [
    { id: 'jovenes', name: 'Comité de Jóvenes' },
    { id: 'adultos', name: 'Comité de Adultos' }
  ],
  leaders: [
    { id: 'richard-alvez', name: 'Richard Alvez', assignmentTitle: 'Historiador', isHighCouncil: true, isTraveler: false, unitId: '', committeeIds: [] },
    { id: 'mauricio-alvez', name: 'Mauricio Alvez', assignmentTitle: 'Secretario de Estaca', isHighCouncil: true, isTraveler: true, unitId: '', committeeIds: [] },
    { id: 'fabian-arias', name: 'Fabian Arias', assignmentTitle: 'Presidente de Hombres Jóvenes', isHighCouncil: true, isTraveler: true, unitId: '', committeeIds: ['jovenes'] },
    { id: 'andres-benitez', name: 'Andrés Benítez', assignmentTitle: 'Primer Consejero Hombres Jóvenes', isHighCouncil: true, isTraveler: true, unitId: '', committeeIds: ['jovenes'] },
    { id: 'juan-carlos-gonzalez', name: 'Juan Carlos Gonzalez', assignmentTitle: '', isHighCouncil: true, isTraveler: false, unitId: '', committeeIds: [] },
    { id: 'antonio-gonzalez', name: 'Antonio Gonzalez', assignmentTitle: '', isHighCouncil: true, isTraveler: true, unitId: '', committeeIds: [] },
    { id: 'pablo-morales', name: 'Pablo Morales', assignmentTitle: '', isHighCouncil: true, isTraveler: false, unitId: '', committeeIds: [] },
    { id: 'jairo-paladino', name: 'Jairo Paladino', assignmentTitle: '', isHighCouncil: true, isTraveler: false, unitId: '', committeeIds: [] },
    { id: 'walter-punales', name: 'Walter Puñales', assignmentTitle: 'Presidente de Escuela Dominical', isHighCouncil: true, isTraveler: true, unitId: '', committeeIds: ['adultos'] },
    { id: 'joaquin-acota', name: 'Joaquin Acota', assignmentTitle: 'Primer Consejero de Rama', isHighCouncil: true, isTraveler: false, unitId: '', committeeIds: [] },
    { id: 'fany-peraca', name: 'Fany Peraca', assignmentTitle: 'Presidenta Sociedad de Socorro', isHighCouncil: false, isTraveler: false, unitId: '', committeeIds: ['adultos'] },
    { id: 'ruth-santos', name: 'Ruth Santos', assignmentTitle: 'Presidenta Mujeres Jóvenes', isHighCouncil: false, isTraveler: false, unitId: '', committeeIds: ['jovenes'] }
  ]
}

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
      assignmentTitle: String(leader.assignmentTitle || ''),
      isHighCouncil: Boolean(leader.isHighCouncil),
      isTraveler: Boolean(leader.isTraveler),
      unitId: String(leader.unitId || ''),
      committeeIds: Array.isArray(leader.committeeIds) ? leader.committeeIds : []
    }))

  return {
    units,
    committees,
    leaders: leaders.length ? leaders : DEFAULT_COUNCIL_ASSIGNMENTS_PLAN.leaders
  }
}
