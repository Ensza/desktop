/**
 * A user-created group of repositories which is displayed as a section in the
 * repository list.
 *
 * Groups are a presentation concern only, they have no relation to the
 * repositories themselves and are stored locally in the renderer.
 */
export interface IRepositoryGroup {
  /** A stable identifier for the group, unique among all groups. */
  readonly id: string

  /** The user-facing name of the group. */
  readonly name: string
}

/**
 * A mapping of repository (database) ids to the id of the custom group the
 * repository has been placed in. Repositories which aren't present in the map
 * are grouped by owner/host like they always have been.
 */
export type RepositoryGroupAssignments = ReadonlyMap<number, string>
