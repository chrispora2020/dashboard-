export const PLAN_STORAGE_KEY = 'stake_messages_plan_cache'

export const DEFAULT_QUARTER_ID = '2026-q3'
const PREVIOUS_DEFAULT_QUARTER_ID = '2026-q2'

const DEFAULT_UNITS = [
  'Los Ceibos',
  'Libia',
  'Belloni',
  'B. Italia',
  'Toledo',
  'B.14',
  'Pando'
]

function buildEditableMonth(id, monthLabel, sundayDate) {
  return {
    id,
    monthLabel,
    sundayDate,
    topicUrl: '',
    topicTitle: 'Tema de conferencia',
    topicPreviewTitle: '',
    topicPreviewImage: '',
    topicPreviewDescription: '',
    notes: '',
    units: DEFAULT_UNITS.map((unit) => ({ unit, speaker: '' }))
  }
}

export const DEFAULT_PLAN = {
  activeQuarterId: DEFAULT_QUARTER_ID,
  quarters: {
    [PREVIOUS_DEFAULT_QUARTER_ID]: {
      quarterLabel: 'Plan trimestral Abril - Junio 2026',
      introMessage: 'Muy buenas noches queridos líderes de la Estaca Maroñas, este domingo tendremos mensaje de estaca 😉',
      closingMessage: 'Les recordamos que todos lo puedan preparar por las dudas.',
      months: [
        {
          id: 'abril',
          monthLabel: 'Abril',
          sundayDate: '2026-04-19',
          topicUrl: 'https://www.churchofjesuschrist.org/study/general-conference/2025/10/13browning?lang=spa',
          topicTitle: 'Tema de conferencia',
          topicPreviewTitle: '',
          topicPreviewImage: '',
          topicPreviewDescription: '',
          notes: '',
          units: [
            { unit: 'Los Ceibos', speaker: 'Prs María Elena' },
            { unit: 'Libia', speaker: 'Richard Alvez' },
            { unit: 'Belloni', speaker: 'Prs Silva' },
            { unit: 'B. Italia', speaker: 'Ruth Santos' },
            { unit: 'Toledo', speaker: 'Antonio González' },
            { unit: 'B.14', speaker: 'Joaquín Acosta' },
            { unit: 'Pando', speaker: 'Conferencia (sin mensaje de estaca)' }
          ]
        },
        {
          id: 'mayo',
          monthLabel: 'Mayo',
          sundayDate: '2026-05-17',
          topicUrl: 'https://www.churchofjesuschrist.org/study/general-conference/2025/10/13browning?lang=spa',
          topicTitle: 'Tema de conferencia',
          topicPreviewTitle: '',
          topicPreviewImage: '',
          topicPreviewDescription: '',
          notes: '',
          units: [
            { unit: 'Los Ceibos', speaker: 'Prs María Elena' },
            { unit: 'Libia', speaker: 'Richard Alvez' },
            { unit: 'Belloni', speaker: 'Prs Silva' },
            { unit: 'B. Italia', speaker: 'Ruth Santos' },
            { unit: 'Toledo', speaker: 'Antonio González' },
            { unit: 'B.14', speaker: 'Joaquín Acosta' },
            { unit: 'Pando', speaker: 'Pablo Morales' }
          ]
        },
        {
          id: 'junio',
          monthLabel: 'Junio',
          sundayDate: '2026-06-21',
          topicUrl: 'https://www.churchofjesuschrist.org/study/general-conference/2025/10/13browning?lang=spa',
          topicTitle: 'Tema de conferencia',
          topicPreviewTitle: '',
          topicPreviewImage: '',
          topicPreviewDescription: '',
          notes: '',
          units: [
            { unit: 'Los Ceibos', speaker: 'Prs María Elena' },
            { unit: 'Libia', speaker: 'Richard Alvez' },
            { unit: 'Belloni', speaker: 'Prs Silva' },
            { unit: 'B. Italia', speaker: 'Ruth Santos' },
            { unit: 'Toledo', speaker: 'Antonio González' },
            { unit: 'B.14', speaker: 'Joaquín Acosta' },
            { unit: 'Pando', speaker: 'Pablo Morales' }
          ]
        }
      ]
    },
    [DEFAULT_QUARTER_ID]: {
      quarterLabel: 'Plan trimestral Julio - Septiembre 2026',
      introMessage: 'Muy buenas noches queridos líderes de la Estaca Maroñas, este domingo tendremos mensaje de estaca 😉',
      closingMessage: 'Les recordamos que todos lo puedan preparar por las dudas.',
      months: [
        buildEditableMonth('julio', 'Julio', '2026-07-19'),
        buildEditableMonth('agosto', 'Agosto', '2026-08-16'),
        buildEditableMonth('septiembre', 'Septiembre', '2026-09-20')
      ]
    },
    '2026-q4': {
      quarterLabel: 'Plan trimestral Octubre - Diciembre 2026',
      introMessage: 'Muy buenas noches queridos líderes de la Estaca Maroñas, este domingo tendremos mensaje de estaca 😉',
      closingMessage: 'Les recordamos que todos lo puedan preparar por las dudas.',
      months: [
        buildEditableMonth('octubre', 'Octubre', '2026-10-18'),
        buildEditableMonth('noviembre', 'Noviembre', '2026-11-15'),
        buildEditableMonth('diciembre', 'Diciembre', '2026-12-20')
      ]
    }
  }
}

function mergeWithDefaultQuarters(plan) {
  const quarters = {
    ...DEFAULT_PLAN.quarters,
    ...(plan.quarters || {})
  }
  const activeQuarterId = plan.activeQuarterId === PREVIOUS_DEFAULT_QUARTER_ID && !plan.quarters?.[DEFAULT_QUARTER_ID]
    ? DEFAULT_QUARTER_ID
    : plan.activeQuarterId

  return {
    activeQuarterId: quarters[activeQuarterId] ? activeQuarterId : DEFAULT_QUARTER_ID,
    quarters
  }
}

export function normalizePlanPayload(rawPlan) {
  if (rawPlan?.quarters && typeof rawPlan.quarters === 'object') {
    const quarterKeys = Object.keys(rawPlan.quarters)
    const activeQuarterId = rawPlan.activeQuarterId && rawPlan.quarters[rawPlan.activeQuarterId]
      ? rawPlan.activeQuarterId
      : quarterKeys[0] || DEFAULT_QUARTER_ID

    return mergeWithDefaultQuarters({
      activeQuarterId,
      quarters: rawPlan.quarters
    })
  }

  const legacyQuarter = rawPlan && Object.keys(rawPlan).length
    ? rawPlan
    : DEFAULT_PLAN.quarters[PREVIOUS_DEFAULT_QUARTER_ID]

  return mergeWithDefaultQuarters({
    activeQuarterId: DEFAULT_QUARTER_ID,
    quarters: {
      [PREVIOUS_DEFAULT_QUARTER_ID]: legacyQuarter
    }
  })
}
