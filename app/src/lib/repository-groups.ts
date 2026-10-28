import {
  IRepositoryGroup,
  RepositoryGroupAssignments,
} from '../models/repository-group'
import { getObject, setObject } from './local-storage'
import { isRecord } from './is-record'

/** Local storage key holding the array of user-created repository groups. */
export const repositoryGroupsKey = 'repository-groups'

/** Local storage key holding the repository id to group id assignments. */
export const repositoryGroupAssignmentsKey = 'repository-group-assignments'

/**
 * Create a new unique identifier for a repository group.
 */
export function createRepositoryGroupId(): string {
  return crypto.randomUUID()
}

function isRepositoryGroup(value: unknown): value is IRepositoryGroup {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0
  )
}

/**
 * Read the user-created repository groups from local storage.
 *
 * Any persisted value which doesn't look like a valid list of groups (or
 * individual entries that don't) is discarded rather than throwing, this way a
 * corrupted entry can never prevent the repository list from rendering.
 */
export function loadRepositoryGroups(): ReadonlyArray<IRepositoryGroup> {
  const stored = getObject<unknown>(repositoryGroupsKey)

  if (!Array.isArray(stored)) {
    return []
  }

  const groups = stored.filter(isRepositoryGroup)
  const seen = new Set<string>()

  return groups
    .filter(group => {
      if (seen.has(group.id)) {
        return false
      }

      seen.add(group.id)
      return true
    })
    .map(group => ({ id: group.id, name: group.name.trim() }))
}

/** Persist the provided list of repository groups in local storage. */
export function saveRepositoryGroups(groups: ReadonlyArray<IRepositoryGroup>) {
  setObject(repositoryGroupsKey, [...groups])
}

/**
 * Read the persisted repository id to group id assignments from local storage.
 *
 * Entries which aren't valid (non-numeric repository ids, empty group ids or
 * anything that isn't a string) are ignored.
 */
export function loadRepositoryGroupAssignments(): RepositoryGroupAssignments {
  const stored = getObject<unknown>(repositoryGroupAssignmentsKey)
  const assignments = new Map<number, string>()

  if (!isRecord(stored)) {
    return assignments
  }

  for (const [key, value] of Object.entries(stored)) {
    const repositoryId = Number(key)

    if (
      !Number.isSafeInteger(repositoryId) ||
      repositoryId < 0 ||
      typeof value !== 'string' ||
      value.length === 0
    ) {
      continue
    }

    assignments.set(repositoryId, value)
  }

  return assignments
}

/** Persist the provided repository id to group id assignments. */
export function saveRepositoryGroupAssignments(
  assignments: RepositoryGroupAssignments
) {
  const stored: Record<string, string> = {}

  for (const [repositoryId, groupId] of assignments) {
    stored[repositoryId] = groupId
  }

  setObject(repositoryGroupAssignmentsKey, stored)
}

/**
 * Drop any assignment which points to a group that no longer exists.
 *
 * This keeps the persisted state consistent after a group is deleted (or if
 * local storage was edited by hand) so that repositories always end up in a
 * group that's actually rendered in the list.
 */
export function normalizeRepositoryGroupAssignments(
  assignments: RepositoryGroupAssignments,
  groups: ReadonlyArray<IRepositoryGroup>
): RepositoryGroupAssignments {
  const groupIds = new Set(groups.map(group => group.id))
  const normalized = new Map<number, string>()

  for (const [repositoryId, groupId] of assignments) {
    if (groupIds.has(groupId)) {
      normalized.set(repositoryId, groupId)
    }
  }

  return normalized
}

/**
 * Return a new assignments map with the given repository placed in the given
 * group, or removed from any group when `groupId` is null.
 */
export function setRepositoryGroupAssignment(
  assignments: RepositoryGroupAssignments,
  repositoryId: number,
  groupId: string | null
): RepositoryGroupAssignments {
  const updated = new Map(assignments)

  if (groupId === null) {
    updated.delete(repositoryId)
  } else {
    updated.set(repositoryId, groupId)
  }

  return updated
}
