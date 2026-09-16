import { useId, useState } from 'react'

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
  const [busqueda, setBusqueda] = useState('')
  const searchId = useId()
  const bautismos = detalle.indicador === 'bautismos_conversos'
  const recomendacion = detalle.indicador === 'conversos_recomendacion'
  const personas = (bautismos ? detalle.personas : detalle.reales) || []
  const faltantes = detalle.faltantes || []
  const grupos = agruparPorUnidad(personas)
  const titulo = bautismos ? 'Bautismos por unidad' : recomendacion ? 'Con recomendación activa por unidad' : 'Ordenados por unidad'
  const normalizar = value => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
  const consulta = normalizar(busqueda.trim())
  const pendientes = faltantes.filter(p => normalizar(`${p.nombre} ${p.unidad || 'Sin unidad registrada'}`).includes(consulta))

  return (
    <>
      <div className="detalle-stats">
        <div className="detalle-stat"><strong>{personas.length}</strong><span>{bautismos ? 'Bautismos registrados' : recomendacion ? 'Con recomendación activa' : 'Conversos ordenados'}</span></div>
        <div className="detalle-stat"><strong>{grupos.length}</strong><span>Unidades con registros</span></div>
        {!bautismos && <div className="detalle-stat detalle-stat--pending"><strong>{faltantes.length}</strong><span>Pendientes de seguimiento</span></div>}
      </div>
      <section className="detalle-section">
        <h3>{titulo}</h3>
        {personas.length > 0 ? (
          <table className="detalle-units">
            <thead><tr><th scope="col">Unidad</th><th scope="col">Cantidad</th></tr></thead>
            <tbody>{grupos.map(([unidad, miembros]) => (
              <tr key={unidad}><td>{unidad}</td><td><span className="detalle-count">{miembros.length}</span></td></tr>
            ))}</tbody>
            <tfoot><tr><th scope="row">Total</th><td><strong>{personas.length}</strong></td></tr></tfoot>
          </table>
        ) : <p className="detalle-empty">No hay registros en este período.</p>}
      </section>
      {!bautismos && (
        <section className="detalle-section">
          <span className="detalle-eyebrow">Seguimiento por unidad</span>
          <h3>{recomendacion ? 'Pendientes de recomendación activa' : 'Pendientes de ordenación'} ({faltantes.length})</h3>
          {recomendacion && <p>Conversos mayores de 11 años sin estado de recomendación «Activa».</p>}
          {faltantes.length === 0 ? <p className="detalle-empty">No hay pendientes en este período.</p> : (
            <>
              <label htmlFor={searchId} style={{ fontSize: 12, color: '#64748b' }}>Buscar por nombre o unidad</label>
              <input id={searchId} className="detalle-search" type="search" placeholder="Escribe un nombre o una unidad…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              {consulta && <p role="status">{pendientes.length} de {faltantes.length} pendientes</p>}
              {pendientes.length === 0 && <p className="detalle-empty">No encontramos coincidencias para esa búsqueda.</p>}
              {agruparPorUnidad(pendientes).map(([unidad, miembros]) => (
                <div key={unidad} className="detalle-pending-group">
                  <h4>{unidad}<span className="detalle-count">{miembros.length}</span></h4>
                  <ul>{[...miembros].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((persona, i) => (
                    <li key={persona.id || i}>{persona.nombre}</li>
                  ))}</ul>
                </div>
              ))}
            </>
          )}
        </section>
      )}
    </>
  )
}
