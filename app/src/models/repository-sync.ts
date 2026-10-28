/**
 * The step of a group-wide update (check out master, fetch, pull) that a
 * repository is currently going through.
 */
export type RepositorySyncStep = 'checkout' | 'fetch' | 'pull'

const labels: Readonly<Record<RepositorySyncStep, string>> = {
  checkout: 'Switching',
  fetch: 'Fetching',
  pull: 'Pulling',
}

const descriptions: Readonly<Record<RepositorySyncStep, string>> = {
  checkout: 'Switching to the master branch',
  fetch: 'Fetching changes',
  pull: 'Pulling changes',
}

/** A short label for the step, shown in the repository list. */
export const getRepositorySyncStepLabel = (step: RepositorySyncStep) =>
  labels[step]

/** A longer description of the step, used in tooltips. */
export const getRepositorySyncStepDescription = (step: RepositorySyncStep) =>
  descriptions[step]
