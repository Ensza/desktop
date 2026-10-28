import { mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

/** A multi-folder workspace to open in an external editor. */
export interface IEditorWorkspace {
  /** The user-facing name of the workspace, used as the window title. */
  readonly name: string
  /** A stable identifier for the workspace, used to group its files. */
  readonly id: string
}

const invalidFileNameCharacters = /[<>:"/\\|?*\u0000-\u001F]/g

/** Turn the workspace name into a file name editors will show as the title. */
const getWorkspaceFileName = (name: string) => {
  const sanitized = name.replace(invalidFileNameCharacters, '-').trim()

  return sanitized.length > 0
    ? `${sanitized.slice(0, 80)}.code-workspace`
    : 'workspace.code-workspace'
}

/**
 * Write a multi-root workspace file for the given folders and return its path.
 *
 * Editors open a workspace file as a named workspace, which means the window
 * title becomes the name of that file instead of an anonymous
 * "Untitled (Workspace)". It also means the editor remembers (and restores)
 * this workspace by path rather than a temporary file it generated itself,
 * which it may later delete.
 *
 * The file lives in a per-workspace folder inside the OS temporary directory
 * and is rewritten every time it's opened, so it always reflects the current
 * contents of the workspace.
 */
export async function writeEditorWorkspaceFile(
  workspace: IEditorWorkspace,
  folders: ReadonlyArray<string>
): Promise<string> {
  const directory = join(
    tmpdir(),
    'github-desktop-workspaces',
    workspace.id.slice(0, 8)
  )
  const filePath = join(directory, getWorkspaceFileName(workspace.name))

  await mkdir(directory, { recursive: true })
  await writeFile(
    filePath,
    JSON.stringify({ folders: folders.map(path => ({ path })) }, null, '\t'),
    'utf8'
  )

  return filePath
}
