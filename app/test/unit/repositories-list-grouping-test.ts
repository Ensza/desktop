import { describe, it } from 'node:test'
import assert from 'node:assert'
import { groupRepositories } from '../../src/ui/repositories-list/group-repositories'
import { Repository, ILocalRepositoryState } from '../../src/models/repository'
import { CloningRepository } from '../../src/models/cloning-repository'
import { IRepositoryGroup } from '../../src/models/repository-group'
import { RepositorySyncStep } from '../../src/models/repository-sync'
import { gitHubRepoFixture } from '../helpers/github-repo-builder'

describe('repository list grouping', () => {
  const repositories: Array<Repository | CloningRepository> = [
    new Repository('repo1', 1, null, false),
    new Repository(
      'repo2',
      2,
      gitHubRepoFixture({ owner: 'me', name: 'my-repo2' }),
      false
    ),
    new Repository(
      'repo3',
      3,
      gitHubRepoFixture({
        owner: '',
        name: 'my-repo3',
        endpoint: 'https://github.big-corp.com/api/v3',
      }),
      false
    ),
  ]

  const cache = new Map<number, ILocalRepositoryState>()

  it('groups repositories by owners/Enterprise/Other', () => {
    const grouped = groupRepositories(repositories, cache, [])
    assert.equal(grouped.length, 3)

    assert.equal(grouped[0].identifier.kind, 'dotcom')
    assert.equal((grouped[0].identifier as any).owner.login, 'me')
    assert.equal(grouped[0].items.length, 1)

    let item = grouped[0].items[0]
    assert.equal(item.repository.path, 'repo2')

    assert.equal(grouped[1].identifier.kind, 'enterprise')
    assert.equal(grouped[1].items.length, 1)

    item = grouped[1].items[0]
    assert.equal(item.repository.path, 'repo3')

    assert.equal(grouped[2].identifier.kind, 'other')
    assert.equal(grouped[2].items.length, 1)

    item = grouped[2].items[0]
    assert.equal(item.repository.path, 'repo1')
  })

  it('sorts repositories alphabetically within each group', () => {
    const repoA = new Repository('a', 1, null, false)
    const repoB = new Repository(
      'b',
      2,
      gitHubRepoFixture({ owner: 'me', name: 'b' }),
      false
    )
    const repoC = new Repository('c', 2, null, false)
    const repoD = new Repository(
      'd',
      2,
      gitHubRepoFixture({ owner: 'me', name: 'd' }),
      false
    )
    const repoZ = new Repository('z', 3, null, false)

    const grouped = groupRepositories(
      [repoC, repoB, repoZ, repoD, repoA],
      cache,
      []
    )
    assert.equal(grouped.length, 2)

    assert.equal(grouped[0].identifier.kind, 'dotcom')
    assert.equal((grouped[0].identifier as any).owner.login, 'me')
    assert.equal(grouped[0].items.length, 2)

    let items = grouped[0].items
    assert.equal(items[0].repository.path, 'b')
    assert.equal(items[1].repository.path, 'd')

    assert.equal(grouped[1].identifier.kind, 'other')
    assert.equal(grouped[1].items.length, 3)

    items = grouped[1].items
    assert.equal(items[0].repository.path, 'a')
    assert.equal(items[1].repository.path, 'c')
    assert.equal(items[2].repository.path, 'z')
  })

  it('only disambiguates Enterprise repositories', () => {
    const repoA = new Repository(
      'repo',
      1,
      gitHubRepoFixture({ owner: 'user1', name: 'repo' }),
      false
    )
    const repoB = new Repository(
      'repo',
      2,
      gitHubRepoFixture({ owner: 'user2', name: 'repo' }),
      false
    )
    const repoC = new Repository(
      'enterprise-repo',
      3,
      gitHubRepoFixture({
        owner: 'business',
        name: 'enterprise-repo',
        endpoint: 'https://ghe.io/api/v3',
      }),
      false
    )
    const repoD = new Repository(
      'enterprise-repo',
      3,
      gitHubRepoFixture({
        owner: 'silliness',
        name: 'enterprise-repo',
        endpoint: 'https://ghe.io/api/v3',
      }),
      false
    )

    const grouped = groupRepositories([repoA, repoB, repoC, repoD], cache, [])
    assert.equal(grouped.length, 3)

    assert.equal(grouped[0].identifier.kind, 'dotcom')
    assert.equal((grouped[0].identifier as any).owner.login, 'user1')
    assert.equal(grouped[0].items.length, 1)

    assert.equal(grouped[1].identifier.kind, 'dotcom')
    assert.equal((grouped[1].identifier as any).owner.login, 'user2')
    assert.equal(grouped[1].items.length, 1)

    assert.equal(grouped[2].identifier.kind, 'enterprise')
    assert.equal(grouped[2].items.length, 2)

    assert.equal(grouped[0].items[0].text[0], 'repo')
    assert(!grouped[0].items[0].needsDisambiguation)

    assert.equal(grouped[1].items[0].text[0], 'repo')
    assert(!grouped[1].items[0].needsDisambiguation)

    assert.equal(grouped[2].items[0].text[0], 'enterprise-repo')
    assert(grouped[2].items[0].needsDisambiguation)

    assert.equal(grouped[2].items[1].text[0], 'enterprise-repo')
    assert(grouped[2].items[1].needsDisambiguation)
  })

  describe('custom groups', () => {
    const workGroup: IRepositoryGroup = { id: 'work', name: 'Work' }

    it('places repositories assigned to a custom group in that group', () => {
      const repoA = new Repository(
        'a',
        1,
        gitHubRepoFixture({ owner: 'me', name: 'a' }),
        false
      )
      const repoB = new Repository(
        'b',
        2,
        gitHubRepoFixture({ owner: 'me', name: 'b' }),
        false
      )

      const grouped = groupRepositories(
        [repoA, repoB],
        cache,
        [],
        [workGroup],
        new Map([[1, workGroup.id]])
      )

      assert.equal(grouped.length, 2)

      assert.equal(grouped[0].identifier.kind, 'custom')
      assert.equal((grouped[0].identifier as any).group.name, 'Work')
      assert.deepEqual(
        grouped[0].items.map(i => i.repository.path),
        ['a']
      )

      assert.equal(grouped[1].identifier.kind, 'dotcom')
      assert.equal((grouped[1].identifier as any).owner.login, 'me')
      assert.deepEqual(
        grouped[1].items.map(i => i.repository.path),
        ['b']
      )
    })

    it('falls back to the automatic grouping when the group no longer exists', () => {
      const repo = new Repository(
        'a',
        1,
        gitHubRepoFixture({ owner: 'me', name: 'a' }),
        false
      )

      const grouped = groupRepositories(
        [repo],
        cache,
        [],
        [],
        new Map([[1, 'deleted-group']])
      )

      assert.equal(grouped.length, 1)
      assert.equal(grouped[0].identifier.kind, 'dotcom')
      assert.equal(grouped[0].items.length, 1)
    })

    it('lists custom groups after recent and before owner groups', () => {
      const repositories = Array.from(
        { length: 8 },
        (_, i) =>
          new Repository(
            `repo${i}`,
            i + 1,
            gitHubRepoFixture({ owner: `owner${i}`, name: `repo${i}` }),
            false
          )
      )

      const grouped = groupRepositories(
        repositories,
        cache,
        [8],
        [workGroup],
        new Map([[8, workGroup.id]])
      )

      assert.equal(grouped[0].identifier.kind, 'recent')
      assert.equal(grouped[1].identifier.kind, 'custom')
      assert.deepEqual(
        grouped[1].items.map(i => i.repository.path),
        ['repo7']
      )
      assert.equal(grouped[2].identifier.kind, 'dotcom')
    })

    it('keeps unassigned repositories out of custom groups', () => {
      const repo = new Repository(
        'a',
        1,
        gitHubRepoFixture({ owner: 'me', name: 'a' }),
        false
      )

      const grouped = groupRepositories(
        [repo],
        cache,
        [],
        [workGroup],
        new Map()
      )

      assert.equal(grouped.length, 1)
      assert.equal(grouped[0].identifier.kind, 'dotcom')
    })

    it('disambiguates repositories with duplicate names in a custom group', () => {
      const repoA = new Repository(
        'repo',
        1,
        gitHubRepoFixture({ owner: 'user1', name: 'repo' }),
        false
      )
      const repoB = new Repository(
        'repo',
        2,
        gitHubRepoFixture({ owner: 'user2', name: 'repo' }),
        false
      )

      const grouped = groupRepositories(
        [repoA, repoB],
        cache,
        [],
        [workGroup],
        new Map([
          [1, workGroup.id],
          [2, workGroup.id],
        ])
      )

      assert.equal(grouped.length, 1)
      assert.equal(grouped[0].identifier.kind, 'custom')
      assert.deepEqual(
        grouped[0].items.map(i => i.needsDisambiguation),
        [true, true]
      )
    })
  })

  it('exposes the group update step of each repository', () => {
    const repoA = new Repository(
      'a',
      1,
      gitHubRepoFixture({ owner: 'me', name: 'a' }),
      false
    )
    const repoB = new Repository(
      'b',
      2,
      gitHubRepoFixture({ owner: 'me', name: 'b' }),
      false
    )

    const grouped = groupRepositories(
      [repoA, repoB],
      cache,
      [],
      [],
      new Map(),
      new Map<number, RepositorySyncStep>([[1, 'fetch']])
    )

    assert.equal(grouped[0].items[0].syncStep, 'fetch')
    assert.equal(grouped[0].items[1].syncStep, null)
  })
})
