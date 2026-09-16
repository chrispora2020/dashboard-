import test from 'node:test'
import assert from 'node:assert/strict'
import { notificarImportacionConversos } from './conversos.js'

test('una importación guardada invalida la caché y notifica al dashboard', () => {
  const values = new Map([['dashboard_kpis_resumen_cache', '[{"actual":10}]']])
  globalThis.localStorage = {
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
  globalThis.window = new EventTarget()
  let notified = false
  window.addEventListener('conversos-importados', () => { notified = true })
  notificarImportacionConversos({ ok: true, total: 93 })
  assert.equal(values.has('dashboard_kpis_resumen_cache'), false)
  assert.equal(values.has('conversos_ultima_importacion'), true)
  assert.equal(notified, true)
})

test('una respuesta fallida no se presenta como importación exitosa', () => {
  assert.throws(() => notificarImportacionConversos({ success: false, errores: ['No guardado'] }), /No guardado/)
})
