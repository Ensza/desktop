# GitHub Desktop (Unofficial)

> **This is an unofficial fork.** It is not affiliated with, sponsored by,
> endorsed by, or supported by GitHub, Inc. It is a modified build of the
> open-source [GitHub Desktop](https://github.com/desktop/desktop) project.
> If you want the real thing, get it from
> [desktop.github.com](https://desktop.github.com).

A personal fork of [GitHub Desktop](https://desktop.github.com) maintained by
[Ensza](https://github.com/Ensza), based on the 3.6.10 line, which adds
repository groups — a way to organize several repositories and act on all of
them at once.

- Upstream project: <https://github.com/desktop/desktop>
- Fork source: <https://github.com/Ensza/desktop>
- License: [MIT](./LICENSE) · attribution details in [NOTICE](./NOTICE)

## What's different from GitHub Desktop?

### Repository groups

The repository list gains a group section. Each group can be created, renamed
and deleted from the UI, and repositories are added to it with the checkboxes
that appear on every row plus the "N selected" menu.

- **Bulk sync** — check out the default branch on every repository in the group,
  then fetch, then pull. It aborts with a warning if a repository has
  uncommitted changes instead of clobbering them.
- **Per-repository progress** — while a group is syncing, each row reports
  `Switching…`, `Fetching…` or `Pulling…` so it is obvious where it stopped.
- **Open the group in an editor** — launches VS Code or Cursor with a generated
  multi-root `.code-workspace` file (written to `%TEMP%`), so every repository
  in the group opens in one window. Also available from the group's context
  menu.
- **Add folders as a group** — drop two or more folders onto the repository
  list and you are asked whether to add them as a group, with a progress
  indicator while they are added.

Groups and their membership are stored in `localStorage`, so they live in the
application profile rather than in any repository.

### Fork housekeeping

- **Own identity** — this build installs to
  `%LOCALAPPDATA%\GitHubDesktopUnofficial` with its own uninstall entry,
  notification identity and publisher, so it can be installed side by side with
  the official GitHub Desktop instead of overwriting it.
- **No self-updates** — the build ships without an update feed, so it can never
  replace itself with the official release. The update UI is hidden rather than
  left permanently broken. See [Installing and updating](#installing-and-updating).
- **Labelled everywhere** — window title, About dialog, installer splash and
  executable metadata all say *GitHub Desktop (Unofficial)*.

## Requirements

- Windows x64. This is what the fork is built and tested on; upstream's macOS
  and Linux build paths are untouched but untested here.
- Node.js and the repository's vendored Yarn (see below).

## Building

Environment setup (Node, dependencies, native modules) is the same as upstream:
see [`docs/contributing/setup.md`](./docs/contributing/setup.md). Then:

```powershell
# development build, then launch it
yarn build:dev
yarn start

# production build (prod icons, no -dev suffix, own profile)
yarn build:prod

# Windows installer (Squirrel) — run after build:prod
yarn package
```

If `yarn` is not on your `PATH`, the vendored copy works the same way:

```powershell
node vendor/yarn-1.21.1.js build:dev
node vendor/yarn-1.21.1.js start
```

Build output:

| Build | Output |
| --- | --- |
| `build:dev` | `dist\GitHubDesktopUnofficial-dev-win32-x64\GitHubDesktopUnofficial-dev.exe` |
| `build:prod` | `dist\GitHubDesktopUnofficial-win32-x64\GitHubDesktopUnofficial.exe` |
| `package` | `dist\GitHubDesktopUnofficialSetup-x64.exe`, `…Setup-x64.msi`, `…-full.nupkg`, `RELEASES` |

Notes:

- Close the app before building — the build deletes `dist\` and fails with
  `EPERM` if a previous instance is still running from it.
- `package` packages whatever is already in `dist\`, so always run
  `build:prod` first.
- Renderer changes under `app/src` are picked up by a reload while
  `yarn start` is running; main-process, static asset and `app/package.json`
  changes need a fresh `build:dev`.

## Installing and updating

Running `dist\GitHubDesktopUnofficialSetup-x64.exe` installs into
`%LOCALAPPDATA%\GitHubDesktopUnofficial\app-<version>` and adds its own Start
menu shortcut and uninstall entry. Uninstalling only removes this fork.

Updating is **not** done in-app. Bump the version, rebuild, repackage and run
the newer `Setup.exe`: Squirrel installs the new `app-<version>` next to the old
one, repoints the shortcuts and cleans up the previous version. Settings live in
the application profile, so an update does not touch them.

To enable real in-app updates you would have to host the Squirrel feed
(`RELEASES` plus the `*-full.nupkg` files) yourself and build with
`DESKTOP_E2E_UPDATES_URL` pointing at it. Without that variable the update feed
is empty by design.

## Where settings live

| Build | Profile directory |
| --- | --- |
| Development | `%APPDATA%\GitHub Desktop (Unofficial)-dev` |
| Production | `%APPDATA%\GitHub Desktop (Unofficial)` |

These are separate from the official GitHub Desktop profiles, so the two apps do
not share repository lists, accounts or groups. Copying a profile directory
across is enough to move settings between the two flavours.

## Versioning and changelog

Versions look like `3.6.10-unofficial2`: the upstream version this build is
based on, followed by the fork's own release counter. Released changes are
listed in [`changelog.json`](./changelog.json); `yarn validate-changelog` checks
that file.

## Getting help

- Bugs in this fork (groups, editor launching, packaging) belong at
  <https://github.com/Ensza/desktop/issues>.
- Bugs in the underlying GitHub Desktop behaviour belong upstream at
  <https://github.com/desktop/desktop/issues>, but note that maintainers there
  do not support builds produced by forks.
- Documentation for the base product: <https://docs.github.com/en/desktop>.

## License and trademarks

**[MIT](./LICENSE)** — the original work is Copyright (c) GitHub, Inc. and the
license text is kept unmodified; see [NOTICE](./NOTICE) for the attribution and
modification notice for this fork.

The MIT license grant is not for GitHub's trademarks, which include the logo
designs. GitHub reserves all trademark and copyright rights in and to all GitHub
trademarks. The icons under [`app/static/logos`](app/static/logos) are GitHub's
and are used here only to identify the upstream project this fork is built from.

GitHub® and its stylized versions and the Invertocat mark are GitHub's
Trademarks or registered Trademarks.

