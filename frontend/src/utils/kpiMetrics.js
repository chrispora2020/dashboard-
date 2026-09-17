export function getKpiMetrics({ actual = 0, potencial, meta = 0, unit = '' }) {
  const porcentual = unit === '%'
  const tienePotencial = potencial != null
  const valor = porcentual && tienePotencial ? (potencial > 0 ? actual / potencial * 100 : 0) : actual
  const avance = meta > 0 ? valor / meta * 100 : null
  return { porcentual, tienePotencial, valor, avance,
    progreso: Math.max(0, Math.min(100, avance ?? 0)),
    pendiente: tienePotencial ? Math.max(0, potencial - actual) : null,
    estado: avance >= 100 ? 'success' : avance >= 70 ? 'progress' : 'attention' }
}
export const formatKpi = value => new Intl.NumberFormat('es-UY', { maximumFractionDigits: 1 }).format(value ?? 0)
