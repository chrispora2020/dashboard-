import test from 'node:test'
import assert from 'node:assert/strict'
import { addQuarter, DEFAULT_PLAN, normalizePlanPayload } from './stakeMessagesPlan.js'
import { groupCouncilMembers } from './councilGroups.js'

test('new quarter preserves history and survives the shared view/editor normalization', () => {
  const before = JSON.stringify(DEFAULT_PLAN)
  const next = addQuarter(DEFAULT_PLAN, 2027, 1, DEFAULT_PLAN.quarters['2026-q2'])
  assert.equal(JSON.stringify(DEFAULT_PLAN), before)
  assert.equal(next.activeQuarterId, '2027-q1')
  assert.deepEqual(normalizePlanPayload(JSON.parse(JSON.stringify(next))), next)
  assert.deepEqual(next.quarters['2027-q1'].months.map(month => month.monthLabel), ['Enero', 'Febrero', 'Marzo'])
  for (const month of next.quarters['2027-q1'].months) {
    const date = new Date(`${month.sundayDate}T12:00:00`)
    assert.equal(date.getDay(), 0)
    assert.ok(date.getDate() >= 15 && date.getDate() <= 21)
    assert.equal(month.topicUrl, '')
    assert.ok(month.units.every(unit => unit.speaker === ''))
  }
})

test('rejects duplicate periods, including old IDs, and invalid input', () => {
  assert.throws(() => addQuarter(DEFAULT_PLAN, 2026, 4), /ya existe/)
  assert.throws(() => addQuarter({ quarters: { legacy: { months: [{ sundayDate: '2027-01-17' }] } } }, 2027, 1), /ya existe/)
  for (const [year, quarter] of [['', 1], [2027, 5], [2027.5, 1]]) assert.throws(() => addQuarter(DEFAULT_PLAN, year, quarter))
})

test('grouping includes multiple memberships and unassigned members', () => {
  const committees = [{ id: 'a', name: 'Adultos' }, { id: 'j', name: 'Jóvenes' }]
  const leaders = [{ id: '1', committeeIds: ['a', 'j'] }, { id: '2', committeeIds: [] }, { id: '3', committeeIds: ['old'] }]
  const groups = groupCouncilMembers(leaders, committees)
  assert.deepEqual(groups.map(group => group.leaders.map(leader => leader.id)), [['1'], ['1'], ['2', '3']])
  assert.equal(groups[2].name, 'Sin comité')
  assert.deepEqual(groupCouncilMembers([], committees), [])
})
