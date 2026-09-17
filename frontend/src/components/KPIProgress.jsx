import { formatKpi, getKpiMetrics } from '../utils/kpiMetrics'
export default function KPIProgress({ actual = 0, potencial, meta = 0, unit = '', pendientes, compact = false }) {
  const metric = getKpiMetrics({ actual, potencial, meta, unit })
  return (
    <div className={`kpi-progress kpi-progress--${metric.estado} ${compact ? 'kpi-progress--compact' : ''}`}>
      <div className="kpi-progress__values">
        <div><span>Real</span><strong>{formatKpi(actual)}{unit === '%' && potencial == null ? '%' : ''}</strong></div>
        {potencial != null && <div><span>Potencial</span><strong>{formatKpi(potencial)}</strong></div>}
        <div><span>Meta</span><strong>{formatKpi(meta)}{unit === '%' ? '%' : ''}</strong></div>
        {pendientes != null && <div className="kpi-progress__pending"><span>Pendientes</span><strong>{formatKpi(pendientes)}</strong></div>}
      </div>
      <div className="kpi-progress__label"><span>Avance hacia la meta</span><strong>{metric.avance == null ? 'Sin meta' : `${formatKpi(metric.avance)}%`}</strong></div>
      <div className={`kpi-track kpi-track--${metric.estado}`} role="progressbar" aria-label="Avance hacia la meta" aria-valuenow={metric.progreso} aria-valuemin={0} aria-valuemax={100} aria-valuetext={metric.avance == null ? 'Sin meta' : `${formatKpi(metric.avance)}% de la meta`}><span style={{ width: `${metric.progreso}%` }} /></div>
    </div>
  )
}
