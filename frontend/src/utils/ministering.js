export const MINISTERING_STORAGE_KEY = 'ministering_interviews_raw_text'
export const MINISTERING_API_PATH = '/api/ministering'

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

function isLikelyUnitLine(line = '') {
  const cleaned = cleanUnitLabel(line)
  if (!cleaned) return false

  const normalized = cleaned.toLowerCase()
  if (isMetaLine(normalized)) return false

  return /^(barrio|rama|distrito|unidad)\b/i.test(cleaned)
}

function isMetaLine(normalizedLine = '') {
  return (
    normalizedLine.includes('companerismos entrevistados') ||
    normalizedLine.includes('compañerismos entrevistados') ||
    normalizedLine.includes('total de companerismos') ||
    normalizedLine.includes('total de compañerismos') ||
    normalizedLine.startsWith('trimestre') ||
    normalizedLine.startsWith('estaca ')
  )
}

function isPercentOnlyLine(line = '') {
  return /^\d+\s*%\s*\d*\s*%?\s*$/u.test(line.trim())
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
  let lastUnitCandidate = ''

  for (const line of lines) {
    const normalized = line.toLowerCase()
    const detectedSection = detectSection(normalized)

    if (detectedSection) {
      currentSection = detectedSection
      lastUnitCandidate = ''
      continue
    }

    if (!currentSection) {
      continue
    }

    if (isLikelyUnitLine(line)) {
      lastUnitCandidate = cleanUnitLabel(line)
      continue
    }

    const ratio = extractRatioFromLine(line)
    if (!ratio) {
      if (isPercentOnlyLine(line) || isMetaLine(normalized)) {
        continue
      }
      continue
    }

    const labelFromCurrentLine = extractLabelFromRatioLine(line)
    const rawLabel = labelFromCurrentLine || lastUnitCandidate
    const hasTotal = Boolean(result[currentSection].total)
    const isUnitRatio = Boolean(rawLabel) && !isMetaLine(rawLabel.toLowerCase())
    const unitName = isUnitRatio
      ? rawLabel
      : `${currentSection === 'brothers' ? 'Hermanos' : 'Hermanas'} ${result[currentSection].units.length + 1}`
    const detail = {
      unidad: unitName,
      interviewed: ratio.interviewed,
      total: ratio.total,
      percent: calcPercent(ratio)
    }

    if (!hasTotal) {
      result[currentSection].total = { ...ratio, percent: detail.percent }
    }

    if (isUnitRatio || hasTotal) {
      result[currentSection].units.push(detail)
    }

    lastUnitCandidate = ''
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
