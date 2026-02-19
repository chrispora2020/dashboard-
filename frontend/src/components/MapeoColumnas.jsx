import { useState } from 'react'

const CAMPOS_DISPONIBLES = [
  { value: 'nombre_preferencia', label: 'Nombre', required: true },
  { value: 'fecha_confirmacion', label: 'Fecha de Confirmación', required: true },
  { value: 'unidad', label: 'Unidad', required: true },
  { value: 'sacerdocio', label: 'Sacerdocio', required: false },
  { value: 'estado_recomendacion_raw', label: 'Estado de Recomendación', required: false },
  { value: 'llamamientos', label: 'Llamamientos', required: false },
  { value: 'fecha_nacimiento', label: 'Fecha de Nacimiento', required: false, important: true },
  { value: 'sexo', label: 'Sexo', required: false, important: true },
]


import { useEffect } from 'react'

export default function MapeoColumnas({ uploadData, onMapeoComplete, onBack }) {
  const [mapeos, setMapeos] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [normalizarAutomatico, setNormalizarAutomatico] = useState(true)

  const { file_id, filename, total_filas, columnas_detectadas, preview_data } = uploadData

  // Mapeo automático al cargar y salto automático si todo está mapeado
  useEffect(() => {
    const variantes = {
      nombre_preferencia: ['nombre', 'nombre_preferencia', 'nombre preferencia', 'lista nuevos conversos'],
      fecha_confirmacion: ['fecha confirmacion', 'fecha_confirmación', 'fecha de la confirmacion', 'fecha de la confirmación'],
      unidad: ['unidad'],
      sacerdocio: ['sacerdocio'],
      estado_recomendacion_raw: ['estado recomendacion', 'estado_recomendacion', 'estado_recomendacion_raw', 'recomendacion', 'estado de la recomendación'],
      llamamientos: ['llamamientos'],
      fecha_nacimiento: ['fecha nacimiento', 'fecha_nacimiento'],
      sexo: ['sexo', 'edad']
    }
    const sugerido = {}
    
    // Paso 1: Mapeo por nombre
    columnas_detectadas.forEach(col => {
      const colNorm = String(col).toLowerCase().replace(/\s+/g, ' ').trim()
      for (const [campo, aliasArr] of Object.entries(variantes)) {
        if (aliasArr.some(alias => colNorm.includes(alias))) {
          sugerido[col] = campo
          break
        }
      }
    })
    
    // Paso 2: Mapeo para columnas genéricas (col_X) que no se mapearon
    const mapeoGenerico = {
      'col_1': 'nombre_preferencia',
      'col_2': 'sexo',
      'col_3': 'sacerdocio',
      'col_4': 'estado_recomendacion_raw',
      'col_5': 'llamamientos',
      'col_6': 'unidad',
      'col_7': 'fecha_confirmacion'
    }
    columnas_detectadas.forEach(col => {
      if (!sugerido[col] && mapeoGenerico[col]) {
        sugerido[col] = mapeoGenerico[col]
      }
    })
    
    setMapeos(sugerido)

    // Avanzar automáticamente sin mostrar la pantalla de mapeo
    const mapeosArray = Object.entries(sugerido)
      .filter(([_, destino]) => destino)
      .map(([fuente, destino]) => ({
        columna_fuente: fuente,
        campo_destino: destino,
        tipo_dato: 'string',
        transformacion: null
      }))
    
    // Llamar a onMapeoComplete inmediatamente para avanzar
    setTimeout(() => {
      if (onMapeoComplete) {
        onMapeoComplete({ file_id, mapeos: mapeosArray, normalizar_automatico: normalizarAutomatico })
      }
    }, 100)
  }, [columnas_detectadas, file_id, normalizarAutomatico, onMapeoComplete])

  const handleMapeoChange = (columnaFuente, campoDestino) => {
    setMapeos(prev => ({
      ...prev,
      [columnaFuente]: campoDestino
    }))
  }

  const mapeoInverso = Object.entries(mapeos).reduce((acc, [fuente, destino]) => {
    acc[destino] = fuente
    return acc
  }, {})

  const camposRequeridos = CAMPOS_DISPONIBLES.filter(c => c.required)
  const camposMapeadosRequeridos = camposRequeridos.filter(c => mapeoInverso[c.value])
  const todosMapeados = camposRequeridos.length === camposMapeadosRequeridos.length

  // Mostrar loading mientras se hace el mapeo automático
  return (
    <div style={{maxWidth: '900px', margin: '0 auto', padding: '30px', fontFamily: 'Arial, sans-serif'}}>
      <div style={{textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
        <div style={{fontSize: '48px', marginBottom: '20px'}}>🔗</div>
        <h2 style={{fontSize: '24px', color: '#333', marginBottom: '10px'}}>Mapeando columnas automáticamente...</h2>
        <p style={{color: '#666', fontSize: '16px'}}>Por favor espera un momento</p>
      </div>
    </div>
  )
}
