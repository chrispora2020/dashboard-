import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import './detalle.css'
import KPIProgress from './KPIProgress'

export default function DetallePanel({ title, subtitle = 'Detalle del indicador', onClose, children, metrics }) {
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])

  function mantenerFoco(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const elements = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0)
    const first = elements[0]
    const last = elements[elements.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return createPortal(
    <dialog ref={dialogRef} className="detalle-panel" aria-labelledby={titleId}
      onKeyDown={mantenerFoco}
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="detalle-panel__surface">
        <header className="detalle-panel__header">
          <div><span className="detalle-eyebrow">{subtitle}</span><h2 id={titleId}>{title}</h2></div>
          <button type="button" className="detalle-close" onClick={onClose} aria-label="Cerrar detalle" autoFocus>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
          </button>
        </header>
        {metrics && <div className="detalle-panel__metrics"><KPIProgress {...metrics} /></div>}
        <div className="detalle-panel__body">{children}</div>
        <footer className="detalle-panel__footer"><span>Tu lugar en el dashboard se conserva</span><button type="button" className="detalle-back" onClick={onClose}>Volver al dashboard</button></footer>
      </div>
    </dialog>, document.body
  )
}
