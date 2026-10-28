import { spawn, SpawnOptions } from 'child_process'
import { dirname, join } from 'path'
import { pathExists } from '../path-exists'
import { ExternalEditorError, FoundEditor } from './shared'
import { IEditorWorkspace, writeEditorWorkspaceFile } from './workspace-file'
import {
  expandTargetPathArgument,
  ICustomIntegration,
  parseCustomIntegrationArguments,
} from '../custom-integration'

async function launchEditor(
  editorPath: string,
  args: readonly string[],
  editorName: string,
  spawnAsDarwinApp: boolean,
  env?: NodeJS.ProcessEnv
) {
  const exists = await pathExists(editorPath)
  const label = __DARWIN__ ? 'Settings' : 'Options'
  if (!exists) {
    throw new ExternalEditorError(
      `Could not find executable for ${editorName} at path '${editorPath}'. Please open ${label} and select an available editor.`,
      { openPreferences: true }
    )
  }

  return new Promise<void>((resolve, reject) => {
    const opts: SpawnOptions = {
      // Make sure the editor processes are detached from the Desktop app.
      // Otherwise, some editors (like Notepad++) will be killed when the
      // Desktop app is closed.
      detached: true,
      stdio: 'ignore',
      env: env ?? process.env,
    }

    const child = spawnAsDarwinApp
      ? spawn('open', ['-a', editorPath, ...args], opts)
      : spawn(editorPath, args, opts)

    child.on('error', reject)
    child.on('spawn', resolve)
    child.unref() // Don't wait for editor to exit
  }).catch((e: unknown) => {
    log.error(
      `Error while launching ${editorName}`,
      e instanceof Error ? e : undefined
    )
    throw new ExternalEditorError(
      e && typeof e === 'object' && 'code' in e && e.code === 'EACCES'
        ? `GitHub Desktop doesn't have the proper permissions to start ${editorName}. Please open ${label} and try another editor.`
        : `Something went wrong while trying to start ${editorName}. Please open ${label} and try another editor.`,
      { openPreferences: true }
    )
  })
}

/**
 * Open a given file or folder in the desired external editor.
 *
 * @param fullPath A folder or file path to pass as an argument when launching the editor.
 * @param editor The external editor to launch.
 */
export const launchExternalEditor = (fullPath: string, editor: FoundEditor) =>
  launchEditor(editor.path, [fullPath], `'${editor.editor}'`, __DARWIN__)

/**
 * Path to the CLI script bundled with VS Code based editors.
 *
 * Launching the executable directly with arguments isn't supported by all of
 * them (Cursor, for example, silently exits instead of opening the folders).
 * Their shell shims (`code.cmd`, `cursor.cmd`) work around this by running the
 * Electron binary as Node with this script, which then hands the paths over to
 * the editor (starting it if necessary).
 */
const getEditorCliScriptPath = (editorPath: string) =>
  join(dirname(editorPath), 'resources', 'app', 'out', 'cli.js')

/**
 * Editors which default to a non-editor workbench on startup. Cursor opens its
 * "Agents" (glass) window instead of the folders it was asked for, in which
 * case the request is silently dropped, so we ask it for a classic window.
 */
const editorsRequiringClassicWindow = ['cursor']

const isCursor = (editor: FoundEditor) =>
  editorsRequiringClassicWindow.includes(editor.editor.toLowerCase())

/**
 * Open multiple folders in the desired external editor.
 *
 * When a workspace is provided the folders are written to a `.code-workspace`
 * file which is then opened instead of the folders themselves. Editors present
 * that as a named workspace (the file name becomes the window title) that they
 * can restore later, rather than an anonymous "Untitled (Workspace)".
 *
 * @param fullPaths The folder or file paths to open in the editor.
 * @param editor The external editor to launch.
 * @param workspace The name and id of the workspace the paths belong to.
 */
export const launchExternalEditorWithPaths = async (
  fullPaths: ReadonlyArray<string>,
  editor: FoundEditor,
  workspace?: IEditorWorkspace
) => {
  const editorName = `'${editor.editor}'`
  const paths =
    fullPaths.length > 1 && workspace !== undefined
      ? [await writeEditorWorkspaceFile(workspace, fullPaths)]
      : [...fullPaths]

  if (__WIN32__) {
    const cliScriptPath = getEditorCliScriptPath(editor.path)

    if (await pathExists(cliScriptPath)) {
      // `--new-window` matters for two reasons:
      //
      //  - Some editors (Cursor) may restore a non-editor window (their agent
      //    or chat window) or focus an existing window, in which case a plain
      //    folder request can be silently dropped.
      //  - Without it the folders may be merged into whichever window happens
      //    to be active, so a different set of folders than the one requested
      //    can appear.
      return launchEditor(
        editor.path,
        [
          cliScriptPath,
          '--new-window',
          // Cursor otherwise opens its Agents workbench, which can't show the
          // folders and drops the request
          ...(isCursor(editor) ? ['--classic'] : []),
          ...paths,
        ],
        editorName,
        false,
        {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          VSCODE_DEV: '',
        }
      )
    }
  }

  return launchEditor(editor.path, paths, editorName, __DARWIN__)
}

/**
 * Open a given file or folder in the desired custom external editor.
 *
 * @param fullPath A folder or file path to pass as an argument when launching the editor.
 * @param customEditor The external editor to launch.
 */
export const launchCustomExternalEditor = (
  fullPath: string,
  customEditor: ICustomIntegration
) => {
  const argv = parseCustomIntegrationArguments(customEditor.arguments)

  // Replace instances of RepoPathArgument with fullPath in customEditor.arguments
  const args = expandTargetPathArgument(argv, fullPath)

  // In macOS we can use `open` if it's an app (i.e. if we have a bundleID),
  // which will open the right executable file for us, we only need the path
  // to the editor .app folder.
  const spawnAsDarwinApp = __DARWIN__ && customEditor.bundleID !== undefined
  const editorName = `custom editor at path '${customEditor.path}'`

  return launchEditor(customEditor.path, args, editorName, spawnAsDarwinApp)
}
