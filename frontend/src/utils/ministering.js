export const MINISTERING_STORAGE_KEY = 'ministering_interviews_raw_text'

function normalizeLine(line = '') {
  return line
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractRatioFromLine(line) {
  const match = line.match(/(\d+)\s*\/\s*(\d+)/)
  if (!match) return null

  const interviewed = Number(match[1])
  const total = Number(match[2])

  if (!Number.isFinite(interviewed) || !Number.isFinite(total) || total <= 0) {
    return null
  }

  return { interviewed, total }
}

function extractLabelFromRatioLine(line = '') {
  const ratioMatch = line.match(/(\d+)\s*\/\s*(\d+)/)
  if (!ratioMatch) return ''
  const label = line.slice(0, ratioMatch.index).trim()
  return cleanUnitLabel(label)
}

function detectSection(normalizedLine) {
  if (normalizedLine.includes('hermanos ministrantes')) return 'brothers'
  if (normalizedLine.includes('hermanas ministrantes')) return 'sisters'
  return null
}

function cleanUnitLabel(label = '') {
  return label
    .replace(/total de.*$/i, '')
    .replace(/compa(?:ñ|n)erismos?(?:\s+entrevistados?)?/iu, '')
    .replace(/entrevistados?/i, '')
    .replace(/:\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function calcPercent(data) {
  if (!data || !data.total) return 0
  return Math.round((data.interviewed / data.total) * 100)
}

export function parseMinisteringText(rawText = '') {
  const lines = rawText
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean)

  const result = {
    brothers: { total: null, units: [] },
    sisters: { total: null, units: [] }
  }

  let currentSection = null
  let previousLabel = ''

  for (const line of lines) {
    const normalized = line.toLowerCase()
    const detectedSection = detectSection(normalized)

    if (detectedSection) {
      currentSection = detectedSection
      previousLabel = ''
      continue
    }

    if (!currentSection) {
      continue
    }

    const ratio = extractRatioFromLine(line)
    if (!ratio) {
      previousLabel = line
      continue
    }

    const labelFromCurrentLine = extractLabelFromRatioLine(line)
    const rawLabel = labelFromCurrentLine || cleanUnitLabel(previousLabel)
    const unitName = rawLabel || `${currentSection === 'brothers' ? 'Hermanos' : 'Hermanas'} ${result[currentSection].units.length + 1}`
    const detail = {
      unidad: unitName,
      interviewed: ratio.interviewed,
      total: ratio.total,
      percent: calcPercent(ratio)
    }

    if (!result[currentSection].total) {
      result[currentSection].total = { ...ratio, percent: detail.percent }
    }

    result[currentSection].units.push(detail)
    previousLabel = ''
  }

  return result
}

export function getMinisteringSummary(parsed) {
  const brothers = parsed?.brothers?.total
  const sisters = parsed?.sisters?.total

  const brothersPercent = brothers?.percent ?? 0
  const sistersPercent = sisters?.percent ?? 0

  const overallPercent =
    brothers && sisters
      ? Math.round((brothersPercent + sistersPercent) / 2)
      : brothersPercent || sistersPercent || 0

  return {
    brothersPercent,
    sistersPercent,
    overallPercent,
    brothersRatio: brothers ? `${brothers.interviewed} / ${brothers.total}` : '-- / --',
    sistersRatio: sisters ? `${sisters.interviewed} / ${sisters.total}` : '-- / --'
  }
}
