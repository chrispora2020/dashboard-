import { useMemo, useState } from 'react'

const STORAGE_KEY = 'ministering_interviews_raw_text'

function getCurrentQuarterInfo() {
  const now = new Date()
  const month = now.getMonth() + 1
  const quarter = Math.ceil(month / 3)
  const year = now.getFullYear()
  const quarterRanges = {
    1: 'enero a marzo',
    2: 'abril a junio',
    3: 'julio a septiembre',
    4: 'octubre a diciembre'
  }

  return {
    quarter,
    year,
    label: `Trimestre ${quarter}`,
    rangeLabel: quarterRanges[quarter]
  }
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

function parseMinisteringText(rawText = '') {
  const lines = rawText
    .split('\n')
    .map((line) => line.replace(/\\n/g, '').trim())
    .filter(Boolean)

  let currentSection = null
  const totals = {
    brothers: null,
    sisters: null
  }

  for (const line of lines) {
    const normalized = line.toLowerCase()

    if (normalized.includes('hermanos ministrantes')) {
      currentSection = 'brothers'
      continue
    }

    if (normalized.includes('hermanas ministrantes')) {
      currentSection = 'sisters'
      continue
    }

    if (!currentSection || totals[currentSection]) {
      continue
    }

    const ratio = extractRatioFromLine(line)
    if (ratio) {
      totals[currentSection] = ratio
    }
  }

  return totals
}

function calcPercent(data) {
  if (!data || !data.total) return 0
  return Math.round((data.interviewed / data.total) * 100)
}

function CircularStat({ percent, ratio, color }) {
  const size = 126
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const safePercent = Math.max(0, Math.min(100, percent))
  const dashoffset = circumference - (safePercent / 100) * circumference

  return (
    <div style={styles.chartWrap}>
      <svg width={size} height={size} style={styles.svg}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={styles.centerText}>
        <div style={styles.percent}>{percent}%</div>
        <div style={styles.ratio}>{ratio}</div>
      </div>
    </div>
  )
}

export default function MinisteringInterviewsCard() {
  const quarterInfo = getCurrentQuarterInfo()
  const [rawText, setRawText] = useState(() => localStorage.getItem(STORAGE_KEY) || '')

  const parsed = useMemo(() => parseMinisteringText(rawText), [rawText])

  const brothersPercent = calcPercent(parsed.brothers)
  const sistersPercent = calcPercent(parsed.sisters)

  const brothersRatio = parsed.brothers ? `${parsed.brothers.interviewed} / ${parsed.brothers.total}` : '-- / --'
  const sistersRatio = parsed.sisters ? `${parsed.sisters.interviewed} / ${parsed.sisters.total}` : '-- / --'

  function handleTextChange(value) {
    setRawText(value)
    localStorage.setItem(STORAGE_KEY, value)
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const content = await file.text()
    handleTextChange(content)
  }

  return (
    <section style={styles.container}>
      <h3 style={styles.title}>Entrevistas de ministración</h3>
      <p style={styles.subtitle}>
        Trimestre actual: <strong>{quarterInfo.label} {quarterInfo.year}</strong> ({quarterInfo.rangeLabel}).
      </p>

      <div style={styles.statsRow}>
        <div style={styles.statCol}>
          <CircularStat percent={brothersPercent} ratio={brothersRatio} color="#0f6b82" />
          <div style={styles.linkLike}>Hermanos</div>
        </div>

        <div style={styles.statCol}>
          <CircularStat percent={sistersPercent} ratio={sistersRatio} color="#0f6b82" />
          <div style={styles.linkLike}>Hermanas</div>
        </div>
      </div>

      <div style={styles.inputBlock}>
        <label style={styles.label}>Cargar TXT de ejemplo</label>
        <input type="file" accept=".txt" onChange={handleFileChange} style={styles.fileInput} />
      </div>

      <div style={styles.inputBlock}>
        <label style={styles.label}>O pegar texto manualmente</label>
        <textarea
          value={rawText}
          onChange={(event) => handleTextChange(event.target.value)}
          style={styles.textarea}
          placeholder="Pegá aquí el bloque de 'Hermanos ministrantes' y 'Hermanas ministrantes'"
        />
      </div>
    </section>
  )
}

const styles = {
  container: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    maxWidth: 720
  },
  title: {
    margin: 0,
    fontSize: 30,
    color: '#1f2937'
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 14,
    color: '#4b5563'
  },
  statsRow: {
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
    justifyContent: 'center',
    background: '#f3f4f6',
    borderRadius: 8,
    padding: '14px 10px'
  },
  statCol: {
    minWidth: 170,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  chartWrap: {
    position: 'relative',
    width: 126,
    height: 126
  },
  svg: {
    display: 'block'
  },
  centerText: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#111827'
  },
  percent: {
    fontSize: 36,
    lineHeight: 1,
    marginBottom: 4
  },
  ratio: {
    fontSize: 19,
    color: '#374151'
  },
  linkLike: {
    marginTop: 10,
    color: '#0f6b82',
    fontWeight: 600,
    fontSize: 31
  },
  inputBlock: {
    marginTop: 12
  },
  label: {
    display: 'block',
    marginBottom: 6,
    color: '#374151',
    fontWeight: 600
  },
  fileInput: {
    width: '100%'
  },
  textarea: {
    width: '100%',
    minHeight: 130,
    resize: 'vertical',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: 10,
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  }
}
