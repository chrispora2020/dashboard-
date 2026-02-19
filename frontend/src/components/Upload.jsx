import axios from 'axios'
import { useEffect, useState } from 'react'
import API_BASE from '../config'

export default function Upload() {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchFiles()
  }, [])

  async function fetchFiles() {
    try {
      const { data } = await axios.get(`${API_BASE}/api/files`)
      setFiles(data)
    } catch (e) {
      console.error(e)
    }
  }

  async function handleUpload(e) {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setUploading(true)
    setMessage('')

    try {
      const formData = new FormData()
      for (const file of selectedFiles) {
        formData.append('files', file)
      }

      await axios.post(`${API_BASE}/api/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setMessage(`✓ ${selectedFiles.length} archivo(s) cargado(s) exitosamente`)
      fetchFiles()
    } catch (err) {
      setMessage(`✗ Error: ${err.response?.data?.detail || 'Error de conexión'}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.pageTitle}>Cargar PDFs</h2>
      </div>

      <div style={styles.uploadCard}>
        <div style={styles.dropZone}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={styles.icon}>
            <path d="M7 18V15M12 18V12M17 18V9M7 22H17C18.0609 22 19.0783 21.5786 19.8284 20.8284C20.5786 20.0783 21 19.0609 21 18V6C21 4.93913 20.5786 3.92172 19.8284 3.17157C19.0783 2.42143 18.0609 2 17 2H7C5.93913 2 4.92172 2.42143 4>17157 3.17157C3.42143 3.92172 3 4.93913 3 6V18C3 19.0609 3.42143 20.0783 4.17157 20.8284C4.92172 21.5786 5.93913 22 7 22Z" 
              stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          
          <h3 style={styles.dropTitle}>Selecciona archivos PDF</h3>
          <p style={styles.dropText}>Arrastra archivos aquí o haz clic para seleccionar</p>
          
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleUpload}
            disabled={uploading}
            style={styles.fileInput}
            id="fileInput"
          />
          
          <label htmlFor="fileInput" style={styles.uploadBtn}>
            {uploading ? 'Cargando...' : 'Seleccionar PDFs'}
          </label>
        </div>

        {message && (
          <div style={{
            ...styles.message,
            background: message.includes('✓') ? '#d1fae5' : '#fee2e2',
            color: message.includes('✓') ? '#065f46' : '#991b1b'
          }}>
            {message}
          </div>
        )}
      </div>

      <div style={styles.historyCard}>
        <h3 style={styles.historyTitle}>Historial de Cargas</h3>
        
        {files.length === 0 ? (
          <p style={styles.emptyText}>No hay archivos cargados aún</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>Archivo</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {files.map(file => (
                <tr key={file.id} style={styles.tableRow}>
                  <td style={styles.td}>{file.filename}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      background: file.status === 'processed' ? '#d1fae5' : file.status === 'uploaded' ? '#fef3c7' : '#fee2e2',
                      color: file.status === 'processed' ? '#065f46' : file.status === 'uploaded' ? '#92400e' : '#991b1b'
                    }}>
                      {file.status === 'processed' ? '✓ Procesado' : file.status === 'uploaded' ? '⏳ Cargado' : '✗ Error'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {file.uploaded_at ? new Date(file.uploaded_at).toLocaleString('es-AR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '30px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    marginBottom: '30px'
  },
  pageTitle: {
    margin: 0,
    fontSize: '28px',
    color: '#333'
  },
  uploadCard: {
    background: 'white',
    borderRadius: '8px',
    padding: '40px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '30px'
  },
  dropZone: {
    border: '2px dashed #ddd',
    borderRadius: '8px',
    padding: '60px 40px',
    textAlign: 'center',
    transition: 'border-color 0.3s'
  },
  icon: {
    marginBottom: '20px'
  },
  dropTitle: {
    margin: '0 0 10px 0',
    fontSize: '20px',
    color: '#333'
  },
  dropText: {
    margin: '0 0 25px 0',
    color: '#666',
    fontSize: '14px'
  },
  fileInput: {
    display: 'none'
  },
  uploadBtn: {
    display: 'inline-block',
    padding: '12px 30px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    border: 'none'
  },
  message: {
    marginTop: '20px',
    padding: '15px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500'
  },
  historyCard: {
    background: 'white',
    borderRadius: '8px',
    padding: '25px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  historyTitle: {
    margin: '0 0 20px 0',
    fontSize: '20px',
    color: '#333'
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: '40px 0'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableHeader: {
    background: '#f9fafb',
    borderBottom: '2px solid #e5e7eb'
  },
  th: {
    padding: '12px 15px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151'
  },
  tableRow: {
    borderBottom: '1px solid #f3f4f6'
  },
  td: {
    padding: '15px',
    fontSize: '14px',
    color: '#4b5563'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600'
  }
}
