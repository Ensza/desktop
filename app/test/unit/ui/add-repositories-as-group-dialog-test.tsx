import assert from 'node:assert'
import { it, TestContext } from 'node:test'
import * as React from 'react'

import { Repository } from '../../../src/models/repository'
import { PopupType } from '../../../src/models/popup'
import { Dispatcher } from '../../../src/ui/dispatcher'
import { AddRepositoriesAsGroup } from '../../../src/ui/repository-groups/add-repositories-as-group-dialog'
import { fireEvent, render, screen, waitFor } from '../../helpers/ui/render'

const repository = new Repository('/repo', 1, null, false)

/**
 * Dialogs tell the main process that they opened, which isn't available in the
 * test environment.
 */
async function silenceDialogIpc(t: TestContext) {
  const electron = await import('electron')
  const previousSend = electron.ipcRenderer.send

  electron.ipcRenderer.send = (() => {}) as typeof electron.ipcRenderer.send

  t.after(() => {
    electron.ipcRenderer.send = previousSend
  })
}

function createDispatcher() {
  const addedPaths = new Array<ReadonlyArray<string>>()
  const popups = new Array<unknown>()

  const dispatcher = {
    addRepositories: async (paths: ReadonlyArray<string>) => {
      addedPaths.push(paths)
      return [repository]
    },
    recordAddExistingRepository: () => {},
    selectRepository: async () => {},
    showPopup: (popup: unknown) => {
      popups.push(popup)
    },
  } as unknown as Dispatcher

  return { dispatcher, addedPaths, popups }
}

it('adds the dropped folders as a group when asked', async t => {
  await silenceDialogIpc(t)

  const { dispatcher, addedPaths, popups } = createDispatcher()
  let dismissedCount = 0

  render(
    <AddRepositoriesAsGroup
      dispatcher={dispatcher}
      paths={['/one', '/two']}
      onDismissed={() => dismissedCount++}
    />
  )

  fireEvent.click(
    screen.getByRole('button', { name: /add as group/i, hidden: true })
  )

  await waitFor(() => {
    assert.equal(popups.length, 1)
  })

  assert.deepEqual(addedPaths, [['/one', '/two']])
  assert.deepEqual(popups[0], {
    type: PopupType.CreateRepositoryGroup,
    repositories: [repository],
  })
  assert.equal(dismissedCount, 1)
})

it('adds the dropped folders without a group when asked to add separately', async t => {
  await silenceDialogIpc(t)

  const { dispatcher, addedPaths, popups } = createDispatcher()
  let dismissedCount = 0

  render(
    <AddRepositoriesAsGroup
      dispatcher={dispatcher}
      paths={['/one', '/two']}
      onDismissed={() => dismissedCount++}
    />
  )

  fireEvent.click(
    screen.getByRole('button', { name: /add separately/i, hidden: true })
  )

  await waitFor(() => {
    assert.equal(dismissedCount, 1)
  })

  assert.deepEqual(addedPaths, [['/one', '/two']])
  assert.equal(popups.length, 0)
})

it('lists the folders which were dropped', async t => {
  await silenceDialogIpc(t)

  const { dispatcher } = createDispatcher()

  const view = render(
    <AddRepositoriesAsGroup
      dispatcher={dispatcher}
      paths={['/repos/alpha', '/repos/beta']}
      onDismissed={() => {}}
    />
  )

  const items = Array.from(
    view.container.querySelectorAll('.add-repositories-as-group-list li')
  ).map(li => li.textContent)

  assert.deepEqual(items, ['alpha', 'beta'])
})

it('shows progress and disables the buttons while adding', async t => {
  await silenceDialogIpc(t)

  let resolveAdd: (repositories: ReadonlyArray<Repository>) => void = () => {}
  let added = false

  const dispatcher = {
    addRepositories: () => {
      added = true
      return new Promise<ReadonlyArray<Repository>>(resolve => {
        resolveAdd = resolve
      })
    },
    recordAddExistingRepository: () => {},
    selectRepository: async () => {},
    showPopup: () => {},
  } as unknown as Dispatcher

  render(
    <AddRepositoriesAsGroup
      dispatcher={dispatcher}
      paths={['/one', '/two']}
      onDismissed={() => {}}
    />
  )

  fireEvent.click(
    screen.getByRole('button', { name: /add as group/i, hidden: true })
  )

  await waitFor(() => {
    assert.equal(added, true)
    assert.notEqual(screen.queryByText(/adding repositories/i), null)
  })

  const button = screen.getByRole('button', {
    name: /add as group/i,
    hidden: true,
  })

  assert.equal(button.getAttribute('aria-disabled'), 'true')

  // Let the pending add finish so nothing is left hanging
  resolveAdd([repository])
})
