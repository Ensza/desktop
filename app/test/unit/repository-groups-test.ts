import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert'

import {
  loadRepositoryGroupAssignments,
  loadRepositoryGroups,
  normalizeRepositoryGroupAssignments,
  repositoryGroupAssignmentsKey,
  repositoryGroupsKey,
  saveRepositoryGroupAssignments,
  saveRepositoryGroups,
  setRepositoryGroupAssignment,
} from '../../src/lib/repository-groups'

describe('repository groups persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns no groups when nothing has been stored', () => {
    assert.deepEqual(loadRepositoryGroups(), [])
    assert.equal(loadRepositoryGroupAssignments().size, 0)
  })

  it('round-trips groups through local storage', () => {
    const groups = [
      { id: 'a', name: 'Work' },
      { id: 'b', name: 'Personal' },
    ]

    saveRepositoryGroups(groups)

    assert.deepEqual(loadRepositoryGroups(), groups)
  })

  it('ignores persisted values which are not a list of groups', () => {
    localStorage.setItem(repositoryGroupsKey, JSON.stringify({ id: 'a' }))

    assert.deepEqual(loadRepositoryGroups(), [])
  })

  it('ignores individual groups which are not valid', () => {
    localStorage.setItem(
      repositoryGroupsKey,
      JSON.stringify([
        { id: 'a', name: 'Work' },
        { id: '', name: 'Empty id' },
        { id: 'b', name: '   ' },
        { id: 'c' },
        'nope',
        null,
      ])
    )

    assert.deepEqual(loadRepositoryGroups(), [{ id: 'a', name: 'Work' }])
  })

  it('drops groups with duplicate ids', () => {
    localStorage.setItem(
      repositoryGroupsKey,
      JSON.stringify([
        { id: 'a', name: 'Work' },
        { id: 'a', name: 'Work again' },
      ])
    )

    assert.deepEqual(loadRepositoryGroups(), [{ id: 'a', name: 'Work' }])
  })

  it('round-trips assignments through local storage', () => {
    saveRepositoryGroupAssignments(
      new Map([
        [1, 'a'],
        [2, 'b'],
      ])
    )

    const assignments = loadRepositoryGroupAssignments()

    assert.equal(assignments.size, 2)
    assert.equal(assignments.get(1), 'a')
    assert.equal(assignments.get(2), 'b')
  })

  it('ignores assignments which are not valid', () => {
    localStorage.setItem(
      repositoryGroupAssignmentsKey,
      JSON.stringify({
        1: 'a',
        'not-a-number': 'a',
        '-1': 'a',
        2: '',
        3: 42,
      })
    )

    const assignments = loadRepositoryGroupAssignments()

    assert.equal(assignments.size, 1)
    assert.equal(assignments.get(1), 'a')
  })

  it('normalizes assignments which point to missing groups', () => {
    const assignments = normalizeRepositoryGroupAssignments(
      new Map([
        [1, 'a'],
        [2, 'deleted'],
      ]),
      [{ id: 'a', name: 'Work' }]
    )

    assert.equal(assignments.size, 1)
    assert.equal(assignments.get(1), 'a')
  })

  it('sets and clears a single assignment', () => {
    const assigned = setRepositoryGroupAssignment(new Map(), 1, 'a')
    assert.equal(assigned.get(1), 'a')

    const cleared = setRepositoryGroupAssignment(assigned, 1, null)
    assert.equal(cleared.size, 0)

    // The original map is never mutated
    assert.equal(assigned.get(1), 'a')
  })
})
