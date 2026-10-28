import * as React from 'react'
import classNames from 'classnames'

import { commitGrammar, RepositoryListItem } from './repository-list-item'
import {
  groupRepositories,
  IRepositoryListItem,
  Repositoryish,
  RepositoryListGroup,
  getGroupKey,
} from './group-repositories'
import { IFilterListGroup } from '../lib/filter-list'
import { IMatches } from '../../lib/fuzzy-find'
import { ILocalRepositoryState, Repository } from '../../models/repository'
import {
  IRepositoryGroup,
  RepositoryGroupAssignments,
} from '../../models/repository-group'
import { RepositorySyncStep } from '../../models/repository-sync'
import { Dispatcher } from '../dispatcher'
import { Button } from '../lib/button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { showContextualMenu } from '../../lib/menu-item'
import { IMenuItem } from '../../lib/menu-item'
import { PopupType } from '../../models/popup'
import { encodePathAsUrl } from '../../lib/path'
import { TooltippedContent } from '../lib/tooltipped-content'
import memoizeOne from 'memoize-one'
import { KeyboardShortcut } from '../keyboard-shortcut/keyboard-shortcut'
import { generateRepositoryListContextMenu } from '../repositories-list/repository-list-item-context-menu'
import { enableWorktreeSupport } from '../../lib/feature-flag'
import { SectionFilterList } from '../lib/section-filter-list'
import { assertNever } from '../../lib/fatal-error'
import { IAheadBehind } from '../../models/branch'

const BlankSlateImage = encodePathAsUrl(__dirname, 'static/empty-no-repo.svg')

interface IRepositoriesListProps {
  readonly selectedRepository: Repositoryish | null
  readonly repositories: ReadonlyArray<Repositoryish>
  readonly recentRepositories: ReadonlyArray<number>

  /** The custom repository groups created by the user, in display order. */
  readonly repositoryGroups: ReadonlyArray<IRepositoryGroup>

  /** The group each repository belongs to, keyed by repository id. */
  readonly repositoryGroupAssignments: RepositoryGroupAssignments

  /**
   * The step of a group-wide update each repository is currently going
   * through, keyed by repository id.
   */
  readonly repositorySyncSteps: ReadonlyMap<number, RepositorySyncStep>

  /** A cache of the latest repository state values, keyed by the repository id */
  readonly localRepositoryStateLookup: ReadonlyMap<
    number,
    ILocalRepositoryState
  >

  /** Called when a repository has been selected. */
  readonly onSelectionChanged: (repository: Repositoryish) => void

  /** Whether the user has enabled the setting to confirm removing a repository from the app */
  readonly askForConfirmationOnRemoveRepository: boolean

  /** Called when the repository should be removed. */
  readonly onRemoveRepository: (repository: Repositoryish) => void

  /** Called when the repository should be shown in Finder/Explorer/File Manager. */
  readonly onShowRepository: (repository: Repositoryish) => void

  /** Called when the repository should be opened on GitHub in the default web browser. */
  readonly onViewOnGitHub: (repository: Repositoryish) => void

  /** Called when the repository should be shown in the shell. */
  readonly onOpenInShell: (repository: Repositoryish) => void

  /** Called when the repository should be opened in an external editor */
  readonly onOpenInExternalEditor: (repository: Repositoryish) => void

  /** The current external editor selected by the user */
  readonly externalEditorLabel?: string

  /** The label for the user's preferred shell. */
  readonly shellLabel?: string

  /** The callback to fire when the filter text has changed */
  readonly onFilterTextChanged: (text: string) => void

  /** The text entered by the user to filter their repository list */
  readonly filterText: string

  readonly dispatcher: Dispatcher
}

interface IRepositoriesListState {
  readonly newRepositoryMenuExpanded: boolean
  readonly selectedItem: IRepositoryListItem | null
  /**
   * The ids of the repositories which the user has checked in order to perform
   * a bulk action (such as putting several repositories in a group at once).
   */
  readonly checkedRepositoryIds: ReadonlySet<number>

  /**
   * The id of the group whose repositories are currently being checked out,
   * fetched and pulled, if any.
   */
  readonly syncingGroupId: string | null
}

const RowHeight = 29

/**
 * Group headers get some extra height so that the group name and its action
 * button aren't crammed against the top and bottom of the row.
 */
const GroupHeaderRowHeight = 38

/**
 * The external editors which a whole group of repositories can be opened in.
 * These must match the names returned by the editor lookup in
 * `app/src/lib/editors`.
 */
const visualStudioCodeEditorName = 'Visual Studio Code'
const cursorEditorName = 'Cursor'

/**
 * Iterate over all groups until a list item is found that matches
 * the id of the provided repository.
 */
function findMatchingListItem(
  groups: ReadonlyArray<
    IFilterListGroup<IRepositoryListItem, RepositoryListGroup>
  >,
  selectedRepository: Repositoryish | null
) {
  if (selectedRepository !== null) {
    for (const group of groups) {
      for (const item of group.items) {
        if (item.repository.id === selectedRepository.id) {
          return item
        }
      }
    }
  }

  return null
}

/** The list of user-added repositories. */
export class RepositoriesList extends React.Component<
  IRepositoriesListProps,
  IRepositoriesListState
> {
  /**
   * A memoized function for grouping repositories for display
   * in the FilterList. The group will not be recomputed as long
   * as the provided list of repositories is equal to the last
   * time the method was called (reference equality).
   */
  private getRepositoryGroups = memoizeOne(
    (
      repositories: ReadonlyArray<Repositoryish> | null,
      localRepositoryStateLookup: ReadonlyMap<number, ILocalRepositoryState>,
      recentRepositories: ReadonlyArray<number>,
      repositoryGroups: ReadonlyArray<IRepositoryGroup>,
      repositoryGroupAssignments: RepositoryGroupAssignments,
      repositorySyncSteps: ReadonlyMap<number, RepositorySyncStep>
    ) =>
      repositories === null
        ? []
        : groupRepositories(
            repositories,
            localRepositoryStateLookup,
            recentRepositories,
            repositoryGroups,
            repositoryGroupAssignments,
            repositorySyncSteps
          )
  )

  /**
   * A memoized function for finding the selected list item based
   * on an IAPIRepository instance. The selected item will not be
   * recomputed as long as the provided list of repositories and
   * the selected data object is equal to the last time the method
   * was called (reference equality).
   *
   * See findMatchingListItem for more details.
   */
  private getSelectedListItem = memoizeOne(findMatchingListItem)

  public constructor(props: IRepositoriesListProps) {
    super(props)

    this.state = {
      newRepositoryMenuExpanded: false,
      selectedItem: null,
      checkedRepositoryIds: new Set<number>(),
      syncingGroupId: null,
    }
  }

  /**
   * Group headers need a little more vertical room than the repository rows so
   * that the group name and its action button aren't crammed against the top
   * and bottom of the row. Header rows are the ones without an item.
   */
  private getRowHeight = (info: {
    readonly item: IRepositoryListItem | null
  }): number => (info.item === null ? GroupHeaderRowHeight : RowHeight)

  private renderItem = (item: IRepositoryListItem, matches: IMatches) => {
    const repository = item.repository
    return (
      <RepositoryListItem
        key={repository.id}
        repository={repository}
        needsDisambiguation={item.needsDisambiguation}
        matches={matches}
        aheadBehind={item.aheadBehind}
        changedFilesCount={item.changedFilesCount}
        checked={this.state.checkedRepositoryIds.has(repository.id)}
        selectionActive={this.state.checkedRepositoryIds.size > 0}
        onToggleChecked={this.onToggleChecked}
        syncStep={item.syncStep}
      />
    )
  }

  private getAheadBehindTooltip = (aheadBehind: IAheadBehind | null) => {
    if (aheadBehind === null) {
      return null
    }

    const { ahead, behind } = aheadBehind

    if (behind === 0 && ahead === 0) {
      return null
    }

    return (
      'The currently checked out branch is' +
      (behind ? ` ${commitGrammar(behind)} behind ` : '') +
      (behind && ahead ? 'and' : '') +
      (ahead ? ` ${commitGrammar(ahead)} ahead of ` : '') +
      'its tracked branch.'
    )
  }

  private renderRowFocusTooltip = (
    item: IRepositoryListItem
  ): JSX.Element | string | null => {
    const { repository, aheadBehind, changedFilesCount } = item
    const gitHubRepo =
      repository instanceof Repository ? repository.gitHubRepository : null
    const alias = repository instanceof Repository ? repository.alias : null
    const realName = gitHubRepo ? gitHubRepo.fullName : repository.name
    const aheadBehindTooltip = this.getAheadBehindTooltip(aheadBehind)
    const hasChanges = changedFilesCount > 0
    const uncommittedChangesTooltip = hasChanges
      ? `There are uncommitted changes in this repository.`
      : null

    const ahead = aheadBehind?.ahead ?? 0
    const behind = aheadBehind?.behind ?? 0

    return (
      <div className="repository-list-item-tooltip list-item-tooltip">
        <div>
          <div className="label">Full Name: </div>
          {realName}
          {alias && <> ({alias})</>}
        </div>
        <div>
          <div className="label">Path: </div>
          {repository.path}
        </div>
        {aheadBehindTooltip && (
          <div>
            <div className="label">
              <div className="ahead-behind">
                {ahead > 0 && <Octicon symbol={octicons.arrowUp} />}
                {behind > 0 && <Octicon symbol={octicons.arrowDown} />}
              </div>
            </div>
            {aheadBehindTooltip}
          </div>
        )}
        {uncommittedChangesTooltip && (
          <div>
            <div className="label">
              <span className="change-indicator-wrapper">
                <Octicon symbol={octicons.dotFill} />
              </span>
            </div>
            {uncommittedChangesTooltip}
          </div>
        )}
      </div>
    )
  }

  private getGroupLabel(group: RepositoryListGroup) {
    const { kind } = group
    if (kind === 'enterprise') {
      return group.host
    } else if (kind === 'other') {
      return 'Other'
    } else if (kind === 'dotcom') {
      return group.owner.login
    } else if (kind === 'recent') {
      return 'Recent'
    } else if (kind === 'custom') {
      return group.group.name
    } else {
      assertNever(kind, `Unknown repository group kind ${kind}`)
    }
  }

  private onGroupHeaderContextMenu = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    const groupId = event.currentTarget.dataset.repositoryGroupId
    const group = this.props.repositoryGroups.find(g => g.id === groupId)

    if (group === undefined) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    showContextualMenu([
      {
        label: __DARWIN__
          ? 'Check Out Master, Fetch and Pull'
          : 'Check out master, fetch and pull',
        enabled: this.state.syncingGroupId === null,
        action: () => {
          void this.syncGroup(group.id)
        },
      },
      { type: 'separator' },
      {
        label: __DARWIN__
          ? 'Open All in Visual Studio Code'
          : 'Open all in Visual Studio Code',
        action: () => {
          void this.props.dispatcher.openRepositoriesInExternalEditor(
            this.getGroupRepositories(group.id),
            visualStudioCodeEditorName,
            { name: group.name, id: group.id }
          )
        },
      },
      {
        label: __DARWIN__ ? 'Open All in Cursor' : 'Open all in Cursor',
        action: () => {
          void this.props.dispatcher.openRepositoriesInExternalEditor(
            this.getGroupRepositories(group.id),
            cursorEditorName,
            { name: group.name, id: group.id }
          )
        },
      },
      { type: 'separator' },
      {
        label: __DARWIN__ ? 'Rename Group…' : 'Rename group…',
        action: () => this.onRenameRepositoryGroup(group),
      },
      { type: 'separator' },
      {
        label: __DARWIN__ ? 'Delete Group' : 'Delete group',
        action: () => this.props.dispatcher.deleteRepositoryGroup(group.id),
      },
    ])
  }

  private renderGroupHeader = (group: RepositoryListGroup) => {
    const label = this.getGroupLabel(group)

    if (group.kind === 'custom') {
      const groupId = group.group.id
      const isSyncing = this.state.syncingGroupId === groupId
      const syncButtonLabel = `Check out master, fetch and pull all repositories in ${label}`

      return (
        <div
          key={getGroupKey(group)}
          className={classNames(
            'filter-list-group-header',
            'repository-group-header',
            { syncing: isSyncing }
          )}
          data-repository-group-id={groupId}
          onContextMenu={this.onGroupHeaderContextMenu}
        >
          <Octicon
            symbol={octicons.fileDirectoryFill}
            className="repository-group-icon"
          />
          <TooltippedContent
            tooltip={label}
            onlyWhenOverflowed={true}
            className="repository-group-name"
          >
            {label}
          </TooltippedContent>
          <Button
            className="repository-group-sync-button"
            onClick={this.onSyncGroupClick}
            disabled={this.state.syncingGroupId !== null}
            ariaLabel={syncButtonLabel}
            tooltip={syncButtonLabel}
          >
            <Octicon
              symbol={octicons.sync}
              className={isSyncing ? 'repository-group-spinning' : undefined}
            />
          </Button>
        </div>
      )
    }

    return (
      <TooltippedContent
        key={getGroupKey(group)}
        className="filter-list-group-header"
        tooltip={label}
        onlyWhenOverflowed={true}
        tagName="div"
      >
        {label}
      </TooltippedContent>
    )
  }

  private onSyncGroupClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const groupId =
      event.currentTarget
        .closest('[data-repository-group-id]')
        ?.getAttribute('data-repository-group-id') ?? undefined

    if (groupId !== undefined) {
      void this.syncGroup(groupId)
    }
  }

  /** The repositories which have been assigned to the given group. */
  private getGroupRepositories = (groupId: string): ReadonlyArray<Repository> =>
    this.props.repositories.filter(
      (repository): repository is Repository =>
        repository instanceof Repository &&
        this.props.repositoryGroupAssignments.get(repository.id) === groupId
    )

  /**
   * Check out master, fetch and pull every repository in the group.
   *
   * Only one group can be updated at a time.
   */
  private syncGroup = async (groupId: string) => {
    if (this.state.syncingGroupId !== null) {
      return
    }

    const repositories = this.getGroupRepositories(groupId)

    if (repositories.length === 0) {
      return
    }

    this.setState({ syncingGroupId: groupId })

    try {
      await this.props.dispatcher.syncRepositoryGroup(repositories)
    } finally {
      this.setState({ syncingGroupId: null })
    }
  }

  private onItemClick = (item: IRepositoryListItem) => {
    const hasIndicator =
      item.changedFilesCount > 0 ||
      (item.aheadBehind !== null
        ? item.aheadBehind.ahead > 0 || item.aheadBehind.behind > 0
        : false)
    this.props.dispatcher.recordRepoClicked(hasIndicator)
    this.props.onSelectionChanged(item.repository)
  }

  private onItemContextMenu = (
    item: IRepositoryListItem,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.preventDefault()

    const items = generateRepositoryListContextMenu({
      onRemoveRepository: this.props.onRemoveRepository,
      onShowRepository: this.props.onShowRepository,
      onOpenInShell: this.props.onOpenInShell,
      onOpenInExternalEditor: this.props.onOpenInExternalEditor,
      askForConfirmationOnRemoveRepository:
        this.props.askForConfirmationOnRemoveRepository,
      externalEditorLabel: this.props.externalEditorLabel,
      onChangeRepositoryAlias: this.onChangeRepositoryAlias,
      onRemoveRepositoryAlias: this.onRemoveRepositoryAlias,
      onViewOnGitHub: this.props.onViewOnGitHub,
      onCreateWorktree: enableWorktreeSupport()
        ? this.onCreateWorktree
        : undefined,
      onShowWorktrees: enableWorktreeSupport()
        ? this.onShowWorktrees
        : undefined,
      repository: item.repository,
      repositoryGroups: this.props.repositoryGroups,
      currentRepositoryGroupId:
        item.repository instanceof Repository
          ? this.props.repositoryGroupAssignments.get(item.repository.id) ??
            null
          : null,
      onSetRepositoryGroup: this.onSetRepositoryGroup,
      onCreateRepositoryGroup: this.onCreateRepositoryGroup,
      shellLabel: this.props.shellLabel,
    })

    showContextualMenu(items)
  }

  private onSetRepositoryGroup = (
    repository: Repository,
    groupId: string | null
  ) => {
    this.props.dispatcher.setRepositoryGroup(repository, groupId)
  }

  private onCreateRepositoryGroup = (repository: Repository) => {
    this.props.dispatcher.showPopup({
      type: PopupType.CreateRepositoryGroup,
      repositories: [repository],
    })
  }

  private onRenameRepositoryGroup = (group: IRepositoryGroup) => {
    this.props.dispatcher.showPopup({
      type: PopupType.RenameRepositoryGroup,
      groupId: group.id,
      initialName: group.name,
    })
  }

  private getItemAriaLabel = (item: IRepositoryListItem) => item.repository.name
  private getGroupAriaLabelGetter =
    (
      groups: ReadonlyArray<
        IFilterListGroup<IRepositoryListItem, RepositoryListGroup>
      >
    ) =>
    (group: number) =>
      this.getGroupLabel(groups[group].identifier)

  public render() {
    const groups = this.getRepositoryGroups(
      this.props.repositories,
      this.props.localRepositoryStateLookup,
      this.props.recentRepositories,
      this.props.repositoryGroups,
      this.props.repositoryGroupAssignments,
      this.props.repositorySyncSteps
    )

    // So there's two types of selection at play here. There's the repository
    // selection for the whole app and then there's the keyboard selection in
    // the list itself. If the user has selected a repository using keyboard
    // navigation we want to honor that selection. If the user hasn't selected a
    // repository yet we'll select the repository currently selected in the app.
    const selectedItem =
      this.state.selectedItem ??
      this.getSelectedListItem(groups, this.props.selectedRepository)

    return (
      <div className="repository-list">
        <SectionFilterList<IRepositoryListItem, RepositoryListGroup>
          rowHeight={this.getRowHeight}
          selectedItem={selectedItem}
          filterText={this.props.filterText}
          onFilterTextChanged={this.props.onFilterTextChanged}
          renderItem={this.renderItem}
          renderRowFocusTooltip={this.renderRowFocusTooltip}
          renderGroupHeader={this.renderGroupHeader}
          onItemClick={this.onItemClick}
          renderPostFilter={this.renderPostFilter}
          renderNoItems={this.renderNoItems}
          groups={groups}
          invalidationProps={{
            repositories: this.props.repositories,
            filterText: this.props.filterText,
            repositoryGroups: this.props.repositoryGroups,
            repositoryGroupAssignments: this.props.repositoryGroupAssignments,
            repositorySyncSteps: this.props.repositorySyncSteps,
            checkedRepositoryIds: this.state.checkedRepositoryIds,
          }}
          onItemContextMenu={this.onItemContextMenu}
          getGroupAriaLabel={this.getGroupAriaLabelGetter(groups)}
          getItemAriaLabel={this.getItemAriaLabel}
          onSelectionChanged={this.onSelectionChanged}
        />
      </div>
    )
  }

  private onSelectionChanged = (selectedItem: IRepositoryListItem | null) => {
    this.setState({ selectedItem })
  }

  private renderPostFilter = () => {
    const checkedCount = this.state.checkedRepositoryIds.size

    if (checkedCount > 0) {
      return (
        <Button
          className="bulk-selection-button"
          onClick={this.onBulkSelectionButtonClick}
        >
          {checkedCount} selected
          <Octicon symbol={octicons.triangleDown} />
        </Button>
      )
    }

    return (
      <Button
        className="new-repository-button"
        onClick={this.onNewRepositoryButtonClick}
        ariaExpanded={this.state.newRepositoryMenuExpanded}
        onKeyDown={this.onNewRepositoryButtonKeyDown}
      >
        Add
        <Octicon symbol={octicons.triangleDown} />
      </Button>
    )
  }

  private onToggleChecked = (repository: Repositoryish) => {
    const checkedRepositoryIds = new Set(this.state.checkedRepositoryIds)

    if (checkedRepositoryIds.has(repository.id)) {
      checkedRepositoryIds.delete(repository.id)
    } else {
      checkedRepositoryIds.add(repository.id)
    }

    this.setState({ checkedRepositoryIds })
  }

  /** The repositories (in list order) which are currently checked. */
  private getCheckedRepositories = (): ReadonlyArray<Repository> =>
    this.props.repositories.filter(
      (repository): repository is Repository =>
        repository instanceof Repository &&
        this.state.checkedRepositoryIds.has(repository.id)
    )

  private onSelectAllRepositories = () => {
    const checkedRepositoryIds = new Set<number>()

    for (const repository of this.props.repositories) {
      if (repository instanceof Repository) {
        checkedRepositoryIds.add(repository.id)
      }
    }

    this.setState({ checkedRepositoryIds })
  }

  private onClearCheckedRepositories = () => {
    this.setState({ checkedRepositoryIds: new Set<number>() })
  }

  private onBulkSelectionButtonClick = () => {
    const repositories = this.getCheckedRepositories()

    if (repositories.length === 0) {
      return
    }

    const items: Array<IMenuItem> = []

    for (const group of this.props.repositoryGroups) {
      items.push({
        label: group.name,
        type: 'checkbox',
        checked: repositories.every(
          repository =>
            this.props.repositoryGroupAssignments.get(repository.id) ===
            group.id
        ),
        action: () => {
          this.props.dispatcher.setRepositoriesGroup(repositories, group.id)
          this.onClearCheckedRepositories()
        },
      })
    }

    if (items.length > 0) {
      items.push({ type: 'separator' })
    }

    items.push(
      {
        label: __DARWIN__ ? 'New Group…' : 'New group…',
        action: () => {
          this.props.dispatcher.showPopup({
            type: PopupType.CreateRepositoryGroup,
            repositories,
          })
          this.onClearCheckedRepositories()
        },
      },
      {
        label: __DARWIN__ ? 'Remove from Group' : 'Remove from group',
        action: () => {
          this.props.dispatcher.setRepositoriesGroup(repositories, null)
          this.onClearCheckedRepositories()
        },
      },
      { type: 'separator' },
      {
        label: __DARWIN__
          ? 'Select All Repositories'
          : 'Select all repositories',
        action: this.onSelectAllRepositories,
      },
      {
        label: __DARWIN__ ? 'Clear Selection' : 'Clear selection',
        action: this.onClearCheckedRepositories,
      }
    )

    showContextualMenu(items)
  }

  private onNewRepositoryButtonKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    if (event.key === 'ArrowDown') {
      this.onNewRepositoryButtonClick()
    }
  }

  private renderNoItems = () => {
    return (
      <div className="no-items no-results-found">
        <img src={BlankSlateImage} className="blankslate-image" alt="" />
        <div className="title">Sorry, I can't find that repository</div>

        <div className="protip">
          ProTip! Press{' '}
          <div className="kbd-shortcut">
            <KeyboardShortcut darwinKeys={['⌘', 'O']} keys={['Ctrl', 'O']} />
          </div>{' '}
          to quickly add a local repository, and{' '}
          <div className="kbd-shortcut">
            <KeyboardShortcut
              darwinKeys={['⇧', '⌘', 'O']}
              keys={['Ctrl', 'Shift', 'O']}
            />
          </div>{' '}
          to clone from anywhere within the app
        </div>
      </div>
    )
  }

  private onNewRepositoryButtonClick = () => {
    const items: IMenuItem[] = [
      {
        label: __DARWIN__ ? 'Clone Repository…' : 'Clone repository…',
        action: this.onCloneRepository,
      },
      {
        label: __DARWIN__ ? 'Create New Repository…' : 'Create new repository…',
        action: this.onCreateNewRepository,
      },
      {
        label: __DARWIN__
          ? 'Add Existing Repository…'
          : 'Add existing repository…',
        action: this.onAddExistingRepository,
      },
    ]

    this.setState({ newRepositoryMenuExpanded: true })
    showContextualMenu(items).then(() => {
      this.setState({ newRepositoryMenuExpanded: false })
    })
  }

  private onCloneRepository = () => {
    this.props.dispatcher.showPopup({
      type: PopupType.CloneRepository,
      initialURL: null,
    })
  }

  private onAddExistingRepository = () => {
    this.props.dispatcher.showPopup({ type: PopupType.AddRepository })
  }

  private onCreateNewRepository = () => {
    this.props.dispatcher.showPopup({ type: PopupType.CreateRepository })
  }

  private onChangeRepositoryAlias = (repository: Repository) => {
    this.props.dispatcher.showPopup({
      type: PopupType.ChangeRepositoryAlias,
      repository,
    })
  }

  private onRemoveRepositoryAlias = (repository: Repository) => {
    this.props.dispatcher.changeRepositoryAlias(repository, null)
  }

  private onCreateWorktree = (repository: Repository) => {
    this.props.dispatcher.showPopup({
      type: PopupType.AddWorktree,
      repository,
    })
  }

  private onShowWorktrees = (repository: Repository) => {
    this.props.dispatcher.selectRepository(repository)
    this.props.dispatcher.showWorktreesFoldout()
  }
}
