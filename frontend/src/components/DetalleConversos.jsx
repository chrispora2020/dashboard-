function agruparPorUnidad(personas) {
  const grupos = new Map()
  personas.forEach(persona => {
    const unidad = persona.unidad?.trim() || 'Sin unidad registrada'
    if (!grupos.has(unidad)) grupos.set(unidad, [])
    grupos.get(unidad).push(persona)
  })
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))
}

export default function DetalleConversos({ detalle }) {
  const bautismos = detalle.indicador === 'bautismos_conversos'
  const recomendacion = detalle.indicador === 'conversos_recomendacion'
  const personas = (bautismos ? detalle.personas : detalle.reales) || []
  const faltantes = detalle.faltantes || []
  const titulo = bautismos ? 'Bautismos por unidad' : recomendacion ? 'Con recomendación activa por unidad' : 'Ordenados por unidad'

  return (
    <>
      <strong>{titulo} ({personas.length})</strong>
      {personas.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '12px 0' }}>
          <thead><tr><th scope="col" style={{ textAlign: 'left' }}>Unidad</th><th scope="col" style={{ textAlign: 'right' }}>Cantidad</th></tr></thead>
          <tbody>
            {agruparPorUnidad(personas).map(([unidad, miembros]) => (
              <tr key={unidad} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 0' }}>{unidad}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{miembros.length}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th scope="row" style={{ textAlign: 'left' }}>Total</th><td style={{ textAlign: 'right', fontWeight: 700 }}>{personas.length}</td></tr></tfoot>
        </table>
      ) : <p>No hay registros en este período.</p>}
      {!bautismos && (
        <section style={{ marginTop: 20, borderTop: '2px solid #f59e0b', paddingTop: 12 }}>
          <strong>{recomendacion ? 'Pendientes de recomendación activa' : 'Pendientes de ordenación'} ({faltantes.length})</strong>
          {recomendacion && <p style={{ fontSize: 13, color: '#4b5563' }}>Conversos mayores de 11 años sin estado de recomendación «Activa».</p>}
          {faltantes.length === 0 ? <p>No hay pendientes en este período.</p> : (
            agruparPorUnidad(faltantes).map(([unidad, miembros]) => (
              <div key={unidad} style={{ marginTop: 12 }}>
                <strong>{unidad} ({miembros.length})</strong>
                <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
                  {[...miembros].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((persona, i) => (
                    <li key={persona.id || i}>{persona.nombre}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}
    </>
  )
}
