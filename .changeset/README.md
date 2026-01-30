# Changesets

This project uses [changesets](https://github.com/changesets/changesets) for version management.

Changesets are auto-generated based on branch naming conventions:

| Branch Prefix | Version Bump |
|---------------|--------------|
| `feat/`, `feature/` | minor |
| `fix/`, `bugfix/`, `hotfix/` | patch |
| `breaking/` | major |
| `chore/`, `docs/`, `refactor/`, `perf/`, `test/`, `style/`, `ci/`, `build/` | patch |

Example: `feat/add-scene-transitions` creates a minor version bump changeset.
