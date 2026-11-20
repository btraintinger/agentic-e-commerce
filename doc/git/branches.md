# Branches and pull requests

`main` is the shared integration branch. Changes reach it through pull requests, with a green CI build. There is no
separate `develop` branch. Our workflow does not allow force-pushes to `main`.

## Branch names

A branch covers one issue and uses a change type, its GitHub number and a short topic:

```text
<type>/<issue-number>/<short-topic>
```

Choose the type that describes the change:

- `feature` for new functionality
- `fix` for bug fixes
- `docs` for documentation changes
- `refactor` for restructuring code without changing behavior
- `test` for test changes
- `chore` for maintenance and tooling

Use lowercase words separated by hyphens for the short topic. The number is the GitHub issue number, not the local US number.

Examples:

```text
feature/60/cart-validation
fix/61/shipping-calculation
docs/62/branch-naming
```

## A normal change

1. Use an existing issue that covers the change. If none exists, create one using the appropriate template in
   `.github/ISSUE_TEMPLATE`: [Bug report](../../.github/ISSUE_TEMPLATE/bug_report.yml) for bugs or
   [Task or feature](../../.github/ISSUE_TEMPLATE/task_or_feature.yml) for other work. Fill in all required fields when creating an issue.
2. Update your local `main` and create an issue branch from it.
3. Make commits using the [commit format](commits.md).
4. Push the branch and open a pull request into `main` using the [PR template](../../.github/pull_request_template.md).
   Fill in its Summary and Related issue sections. A draft PR can make unfinished work visible early.
5. Describe the result and checks, and link the issue. `Refs #60` links it; `Closes #60` is for a PR that fully resolves
   it.
6. Address review feedback and wait for a green CI build.
7. Use GitHub’s **Rebase and merge**, then remove the merged branch.

If `main` changes during the work, fetch the latest changes and rebase the issue branch onto `origin/main`. Resolve
conflicts on the issue branch. After rebasing an already-pushed branch, update it with `git push --force-with-lease`;
coordinate first if someone else uses that branch. Never force-push `main`.

## PR titles and merging

PR titles use Conventional Commits, for example:

```text
feat(bookings): accept and reject booking requests
```

Each commit keeps its own [issue reference and time ending](commits.md#our-custom-ending). The PR title describes the
whole change; it does not replace the individual commit messages.

Always use **Rebase and merge**. Do not squash commits or create a merge commit. Keeping individual commits preserves
each author’s recorded time; see [time tracking](time-tracking.md#rebase-and-merge).

[Back to Git guide](README.md)
