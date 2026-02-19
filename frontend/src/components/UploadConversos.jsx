import axios from 'axios'
import { useState } from 'react'
import API_BASE from '../config'

export default function UploadConversos({ onUploadComplete }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (selectedFile) => {
    setError('')
    
    // Validar tipo de archivo
    const validTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    if (!validTypes.includes(selectedFile.type)) {
      setError('Tipo de archivo no válido. Use PDF, CSV o Excel (.xlsx)')
      return
    }
    
    // Validar tamaño (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('El archivo es muy grande. Máximo 10MB')
      return
    }
    
    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Seleccione un archivo primero')
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      console.log('Uploading file:', file.name)

      const { data } = await axios.post(
        `${API_BASE}/api/conversos/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      console.log('Upload response:', data)
      
      // Llamar callback con los datos del archivo subido
      if (onUploadComplete) {
        onUploadComplete(data)
      }

    } catch (err) {
      console.error('Upload error:', err)
      setError(err.response?.data?.detail || 'Error al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📁 Subir Lista de Nuevos Conversos</h2>

      <div
        style={{
          ...styles.dropZone,
          ...(dragActive ? styles.dropZoneActive : {}),
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-input"
          style={styles.fileInput}
          onChange={(e) => e.target.files[0] && handleFileChange(e.target.files[0])}
          accept=".pdf,.csv,.xlsx,.xls"
        />
        
        <label htmlFor="file-input" style={styles.dropLabel}>
          <div style={styles.icon}>📄</div>
          <div style={styles.dropText}>
            {file ? (
              <>
                <strong>{file.name}</strong>
                <br />
                <span style={styles.fileSize}>
                  {(file.size / 1024).toFixed(2)} KB
                </span>
              </>
            ) : (
              <>
                Arrastra tu archivo aquí o haz clic para seleccionar
                <br />
                <span style={styles.formatText}>
                  Formatos: Excel (.xlsx, .xls), CSV, PDF
                </span>
              </>
            )}
          </div>
        </label>
      </div>

      {error && (
        <div style={styles.error}>
          ⚠️ {error}
        </div>
      )}

      {file && !error && (
        <div style={styles.actions}>
          <button
            onClick={() => setFile(null)}
            style={styles.buttonSecondary}
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            style={styles.buttonPrimary}
            disabled={uploading}
          >
            {uploading ? 'Procesando...' : 'Continuar →'}
          </button>
        </div>
      )}

      <div style={styles.info}>
        <h4 style={styles.infoTitle}>ℹ️ Información</h4>
        <ul style={styles.infoList}>
          <li>El archivo debe contener la lista de nuevos conversos</li>
          <li>Columnas esperadas: Nombre, Fecha de confirmación, Unidad, Sacerdocio, Estado de recomendación</li>
          <li>Opcionalmente: Fecha de nacimiento, Sexo, Llamamientos</li>
          <li>En el siguiente paso podrás mapear las columnas de tu archivo</li>
        </ul>
      </div>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '30px',
    fontFamily: 'Arial, sans-serif'
  },
  title: {
    fontSize: '24px',
    marginBottom: '30px',
    color: '#333'
  },
  dropZone: {
    border: '3px dashed #ccc',
    borderRadius: '12px',
    padding: '60px 40px',
    textAlign: 'center',
    background: '#fafafa',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginBottom: '20px'
  },
  dropZoneActive: {
    borderColor: '#667eea',
    background: '#f0f4ff'
  },
  fileInput: {
    display: 'none'
  },
  dropLabel: {
    cursor: 'pointer',
    display: 'block'
  },
  icon: {
    fontSize: '48px',
    marginBottom: '15px'
  },
  dropText: {
    fontSize: '16px',
    color: '#666',
    lineHeight: '1.6'
  },
  formatText: {
    fontSize: '14px',
    color: '#999',
    marginTop: '10px',
    display: 'inline-block'
  },
  fileSize: {
    fontSize: '14px',
    color: '#999'
  },
  error: {
    background: '#fee',
    border: '1px solid #fcc',
    borderRadius: '8px',
    padding: '15px',
    color: '#c33',
    marginBottom: '20px'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '15px',
    marginBottom: '30px'
  },
  buttonPrimary: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    ':hover': {
      transform: 'translateY(-2px)'
    }
  },
  buttonSecondary: {
    background: 'white',
    color: '#666',
    border: '2px solid #ddd',
    padding: '12px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer'
  },
  info: {
    background: '#e3f2fd',
    border: '1px solid #90caf9',
    borderRadius: '8px',
    padding: '20px'
  },
  infoTitle: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    color: '#1976d2'
  },
  infoList: {
    margin: 0,
    paddingLeft: '20px',
    color: '#1565c0',
    fontSize: '14px',
    lineHeight: '1.8'
  }
}
