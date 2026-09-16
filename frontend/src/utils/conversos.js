export function notificarImportacionConversos(resultado) {
  if (resultado.ok === false || resultado.success === false) {
    throw new Error(resultado.errores?.join('; ') || 'No se pudo guardar la lista de conversos.')
  }
  try {
    localStorage.removeItem('dashboard_kpis_resumen_cache')
    localStorage.setItem('conversos_ultima_importacion', String(Date.now()))
  } catch {
    // El dashboard consulta al servidor incluso sin almacenamiento local.
  }
  window.dispatchEvent(new Event('conversos-importados'))
}
