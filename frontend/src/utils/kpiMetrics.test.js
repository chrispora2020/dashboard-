import test from 'node:test'
import assert from 'node:assert/strict'
import { getKpiMetrics } from './kpiMetrics.js'

test('bautismos: avance contra meta numérica', () => {
  const kpi = getKpiMetrics({ actual: 93, meta: 168 })
  assert.equal(kpi.valor, 93)
  assert.equal(kpi.avance, 93 / 168 * 100)
  assert.equal(kpi.tienePotencial, false)
})
test('cobertura y cumplimiento distinguen potencial de meta', () => {
  const kpi = getKpiMetrics({ actual: 30, potencial: 60, meta: 80, unit: '%' })
  assert.equal(kpi.valor, 50)
  assert.equal(kpi.avance, 62.5)
  assert.equal(kpi.pendiente, 30)
})
test('porcentaje ya calculado y meta excedida', () => {
  assert.equal(getKpiMetrics({ actual: 75, meta: 100, unit: '%' }).avance, 75)
  const kpi = getKpiMetrics({ actual: 200, meta: 100 })
  assert.equal(kpi.avance, 200)
  assert.equal(kpi.progreso, 100)
})
test('sin potencial o meta no produce infinitos', () => {
  assert.equal(getKpiMetrics({ actual: 0, potencial: 0, meta: 100, unit: '%' }).avance, 0)
  assert.equal(getKpiMetrics({ actual: 0, meta: 0 }).avance, null)
})
