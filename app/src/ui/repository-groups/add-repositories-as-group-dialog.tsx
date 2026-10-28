import * as React from 'react'
import * as Path from 'path'

import { Dispatcher } from '../dispatcher'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { PopupType } from '../../models/popup'

interface IAddRepositoriesAsGroupProps {
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void

  /** The folders which the user dropped onto the app. */
  readonly paths: ReadonlyArray<string>
}

interface IAddRepositoriesAsGroupState {
  /** Whether the dropped folders are currently being added. */
  readonly isAdding: boolean
}

/**
 * Asks whether several folders which were dropped onto the app should be added
 * as a repository group, rather than being added to the repository list one by
 * one.
 */
export class AddRepositoriesAsGroup extends React.Component<
  IAddRepositoriesAsGroupProps,
  IAddRepositoriesAsGroupState
> {
  public state: IAddRepositoriesAsGroupState = { isAdding: false }

  public render() {
    const count = this.props.paths.length
    const { isAdding } = this.state

    const title = __DARWIN__ ? 'Add Repositories' : 'Add repositories'
    const addAsGroup = __DARWIN__ ? 'Add as Group' : 'Add as group'
    const addSeparately = __DARWIN__ ? 'Add Separately' : 'Add separately'

    return (
      <Dialog
        id="add-repositories-as-group"
        title={title}
        loading={isAdding}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onAddAsGroup}
      >
        <DialogContent>
          <p>
            You dropped {count} folders onto GitHub Desktop. Would you like to
            add them as a group?
          </p>
          <ul className="add-repositories-as-group-list">
            {this.props.paths.map(path => (
              <li key={path}>{Path.basename(path)}</li>
            ))}
          </ul>
          {isAdding ? (
            <p className="add-repositories-as-group-progress">
              <Octicon
                symbol={octicons.sync}
                className="add-repositories-as-group-spinner"
              />
              Adding repositories…
            </p>
          ) : (
            <p className="description">
              Groups are shown as their own section in the repository list and
              can be renamed or removed at any time.
            </p>
          )}
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={addAsGroup}
            cancelButtonText={addSeparately}
            okButtonDisabled={isAdding}
            cancelButtonDisabled={isAdding}
            onCancelButtonClick={this.onAddSeparately}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onAddAsGroup = () => {
    void this.addRepositories(true)
  }

  private onAddSeparately = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    void this.addRepositories(false)
  }

  private async addRepositories(createGroup: boolean) {
    if (this.state.isAdding) {
      return
    }

    // Adding repositories can take a moment (Desktop inspects every folder), so
    // let the user know that something is happening before we await it.
    this.setState({ isAdding: true })

    const { dispatcher, paths } = this.props
    const repositories = await dispatcher.addRepositories([...paths])

    this.props.onDismissed()

    if (repositories.length === 0) {
      return
    }

    dispatcher.recordAddExistingRepository()
    await dispatcher.selectRepository(repositories[0])

    if (createGroup) {
      dispatcher.showPopup({
        type: PopupType.CreateRepositoryGroup,
        repositories,
      })
    }
  }
}
