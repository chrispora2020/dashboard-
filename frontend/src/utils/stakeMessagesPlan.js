export const PLAN_STORAGE_KEY = 'stake_messages_plan_cache'

export const DEFAULT_QUARTER_ID = '2026-q2'

export const DEFAULT_PLAN = {
  activeQuarterId: DEFAULT_QUARTER_ID,
  quarters: {
    [DEFAULT_QUARTER_ID]: {
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
    }
  }
}

export function normalizePlanPayload(rawPlan) {
  if (rawPlan?.quarters && typeof rawPlan.quarters === 'object') {
    const quarterKeys = Object.keys(rawPlan.quarters)
    const activeQuarterId = rawPlan.activeQuarterId && rawPlan.quarters[rawPlan.activeQuarterId]
      ? rawPlan.activeQuarterId
      : quarterKeys[0] || DEFAULT_QUARTER_ID

    return {
      activeQuarterId,
      quarters: rawPlan.quarters
    }
  }

  const legacyQuarter = rawPlan && Object.keys(rawPlan).length
    ? rawPlan
    : DEFAULT_PLAN.quarters[DEFAULT_QUARTER_ID]

  return {
    activeQuarterId: DEFAULT_QUARTER_ID,
    quarters: {
      [DEFAULT_QUARTER_ID]: legacyQuarter
    }
  }
}
