import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFile, rm } from 'fs/promises'
import { dirname } from 'path'

import { writeEditorWorkspaceFile } from '../../src/lib/editors/workspace-file'

describe('editor workspace file', () => {
  it('writes a multi-root workspace containing the given folders', async () => {
    const workspace = { id: 'test-workspace-a1b2c3d4', name: 'My Group' }

    const filePath = await writeEditorWorkspaceFile(workspace, [
      'E:/one',
      'E:/two',
    ])

    try {
      const contents = JSON.parse(await readFile(filePath, 'utf8'))

      assert.deepEqual(contents, {
        folders: [{ path: 'E:/one' }, { path: 'E:/two' }],
      })

      // The file name is what the editor shows as the window title
      assert.ok(filePath.endsWith('My Group.code-workspace'), filePath)
    } finally {
      await rm(dirname(filePath), { recursive: true, force: true })
    }
  })

  it('replaces characters which cannot be used in a file name', async () => {
    const workspace = { id: 'test-workspace-e5f6a7b8', name: 'a/b' }

    const filePath = await writeEditorWorkspaceFile(workspace, ['x', 'y'])

    try {
      assert.ok(filePath.endsWith('a-b.code-workspace'), filePath)
    } finally {
      await rm(dirname(filePath), { recursive: true, force: true })
    }
  })

  it('rewrites the file so it reflects the current folders', async () => {
    const workspace = { id: 'test-workspace-c9d0e1f2', name: 'Changing' }

    const first = await writeEditorWorkspaceFile(workspace, ['E:/one'])
    const second = await writeEditorWorkspaceFile(workspace, [
      'E:/one',
      'E:/three',
    ])

    try {
      assert.equal(first, second)

      const contents = JSON.parse(await readFile(second, 'utf8'))

      assert.deepEqual(contents, {
        folders: [{ path: 'E:/one' }, { path: 'E:/three' }],
      })
    } finally {
      await rm(dirname(first), { recursive: true, force: true })
    }
  })
})
