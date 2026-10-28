import * as React from 'react'

import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { TextBox } from '../lib/text-box'

export enum RepositoryGroupDialogMode {
  Create = 'Create',
  Rename = 'Rename',
}

interface IRepositoryGroupDialogProps {
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void

  /** Whether a new group is being created or an existing one is being renamed. */
  readonly mode: RepositoryGroupDialogMode

  /** The name the text box is pre-populated with. */
  readonly initialName: string

  /** The id of the group being renamed. Required when mode is Rename. */
  readonly groupId?: string

  /**
   * The repositories to add to the group when creating it. Used both by the
   * repository context menu and by the multi-selection action bar.
   */
  readonly repositories?: ReadonlyArray<Repository>

  /** Names of the existing groups, used to avoid duplicate names. */
  readonly existingNames: ReadonlyArray<string>
}

interface IRepositoryGroupDialogState {
  readonly name: string
}

/** The dialog used to create a new repository group or rename an existing one. */
export class RepositoryGroupDialog extends React.Component<
  IRepositoryGroupDialogProps,
  IRepositoryGroupDialogState
> {
  public constructor(props: IRepositoryGroupDialogProps) {
    super(props)

    this.state = { name: props.initialName }
  }

  private get isCreate() {
    return this.props.mode === RepositoryGroupDialogMode.Create
  }

  private get trimmedName() {
    return this.state.name.trim()
  }

  private get isValidName() {
    const name = this.trimmedName

    if (name.length === 0) {
      return false
    }

    // Group names are used as section headers so duplicate names would be
    // confusing. Names are compared case insensitively since that's how they
    // read in the list.
    return !this.props.existingNames.some(
      existing => existing.toLowerCase() === name.toLowerCase()
    )
  }

  public render() {
    const verb = this.isCreate ? 'Create' : 'Rename'
    const title = __DARWIN__ ? `${verb} Group` : `${verb} group`

    return (
      <Dialog
        id="repository-group"
        title={title}
        onDismissed={this.props.onDismissed}
        onSubmit={this.submit}
      >
        <DialogContent>
          <p>
            {this.isCreate
              ? 'Choose a name for the new group. Repositories can be moved between groups at any time from their context menu.'
              : 'Choose a new name for this group.'}
          </p>
          <TextBox
            ariaLabel="Group name"
            value={this.state.name}
            onValueChanged={this.onNameChanged}
          />
          {this.trimmedName.length > 0 && !this.isValidName && (
            <p className="description">
              A group named "{this.trimmedName}" already exists.
            </p>
          )}
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={title}
            okButtonDisabled={!this.isValidName}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onNameChanged = (name: string) => {
    this.setState({ name })
  }

  private submit = () => {
    if (!this.isValidName) {
      return
    }

    const { mode, groupId, repositories } = this.props

    if (mode === RepositoryGroupDialogMode.Create) {
      this.props.dispatcher.createRepositoryGroup(
        this.trimmedName,
        repositories ?? []
      )
    } else if (groupId !== undefined) {
      this.props.dispatcher.renameRepositoryGroup(groupId, this.trimmedName)
    }

    this.props.onDismissed()
  }
}
