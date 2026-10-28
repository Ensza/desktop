import assert from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as React from 'react'

import { Repository } from '../../../src/models/repository'
import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import { RepositoryListItem } from '../../../src/ui/repositories-list/repository-list-item'
import { Repositoryish } from '../../../src/ui/repositories-list/group-repositories'
import { render, fireEvent, screen, waitFor } from '../../helpers/ui/render'
import { IMatches } from '../../../src/lib/fuzzy-find'
import {
  advanceTimersBy,
  enableTestTimers,
  resetTestTimers,
} from '../../helpers/ui/timers'

const noMatches: IMatches = { title: [], subtitle: [] }
const fixtureRepositoryPath = '/tmp/desktop-fixture'

const noop = () => {}

function createRepository(alias: string | null = null) {
  const owner = new Owner('octocat', 'https://api.github.com', 1)
  const gitHubRepository = new GitHubRepository('desktop', owner, 99)

  return new Repository(
    fixtureRepositoryPath,
    123,
    gitHubRepository,
    false,
    alias
  )
}

describe('RepositoryListItem', () => {
  beforeEach(() => {
    enableTestTimers(['setTimeout'])
  })

  afterEach(() => {
    resetTestTimers()
  })

  it('renders the repository name and status indicators', () => {
    const repository = createRepository()
    const view = render(
      <RepositoryListItem
        repository={repository}
        needsDisambiguation={false}
        matches={noMatches}
        aheadBehind={{ ahead: 2, behind: 1 }}
        changedFilesCount={3}
        checked={false}
        selectionActive={false}
        onToggleChecked={noop}
        syncStep={null}
      />
    )

    const name = view.container.querySelector('.name')
    const aheadBehind = view.container.querySelector('.ahead-behind')
    const changeIndicator = view.container.querySelector(
      '.change-indicator-wrapper'
    )

    assert.equal(name?.textContent, 'desktop')
    assert.notEqual(aheadBehind, null)
    assert.notEqual(changeIndicator, null)
    assert.equal(aheadBehind?.querySelectorAll('svg').length, 2)
  })

  it('renders owner prefix and alias when disambiguation is required', () => {
    const repository = createRepository('desktop-app')
    const view = render(
      <RepositoryListItem
        repository={repository}
        needsDisambiguation={true}
        matches={noMatches}
        aheadBehind={null}
        changedFilesCount={0}
        checked={false}
        selectionActive={false}
        onToggleChecked={noop}
        syncStep={null}
      />
    )

    const prefix = view.container.querySelector('.prefix')
    const name = view.container.querySelector('.name')

    assert.equal(prefix?.textContent, 'octocat/')
    assert.equal(name?.textContent, 'octocat/desktop-app')
  })

  it('shows tooltip content for the repository full name, alias, and path', async () => {
    const repository = createRepository('desktop-app')
    const view = render(
      <RepositoryListItem
        repository={repository}
        needsDisambiguation={true}
        matches={noMatches}
        aheadBehind={null}
        changedFilesCount={0}
        checked={false}
        selectionActive={false}
        onToggleChecked={noop}
        syncStep={null}
      />
    )

    const row = view.container.querySelector('.repository-list-item')

    assert.notEqual(row, null)

    if (row === null) {
      throw new Error('Expected repository row to be rendered')
    }

    fireEvent.mouseEnter(row, { clientX: 20, clientY: 20 })
    fireEvent.mouseMove(row, { clientX: 20, clientY: 20 })
    advanceTimersBy(400)

    await waitFor(() => {
      assert.ok(screen.getByText('octocat/desktop', { selector: 'strong' }))
      assert.ok(screen.getByText(fixtureRepositoryPath))
    })
  })

  it('renders a checkbox which reports when the repository is toggled', () => {
    const repository = createRepository()
    let toggled: Repositoryish | null = null

    const onToggleChecked = (repository: Repositoryish) => {
      toggled = repository
    }

    const view = render(
      <RepositoryListItem
        repository={repository}
        needsDisambiguation={false}
        matches={noMatches}
        aheadBehind={null}
        changedFilesCount={0}
        checked={false}
        selectionActive={false}
        onToggleChecked={onToggleChecked}
        syncStep={null}
      />
    )

    const checkbox = view.container.querySelector<HTMLInputElement>(
      '.repository-list-item-checkbox input'
    )

    assert.notEqual(checkbox, null)

    if (checkbox === null) {
      throw new Error('Expected checkbox to be rendered')
    }

    assert.equal(checkbox.checked, false)

    fireEvent.click(checkbox)

    assert.equal(toggled, repository)
  })

  it('shows which step of a group update the repository is on', () => {
    const repository = createRepository()
    const view = render(
      <RepositoryListItem
        repository={repository}
        needsDisambiguation={false}
        matches={noMatches}
        aheadBehind={{ ahead: 1, behind: 1 }}
        changedFilesCount={2}
        checked={false}
        selectionActive={false}
        onToggleChecked={noop}
        syncStep="fetch"
      />
    )

    assert.equal(
      view.container.querySelector('.repository-sync-state')?.textContent,
      'Fetching'
    )

    // The regular indicators are replaced while the repository is being updated
    assert.equal(view.container.querySelector('.ahead-behind'), null)
    assert.equal(
      view.container.querySelector('.change-indicator-wrapper'),
      null
    )
  })
})
