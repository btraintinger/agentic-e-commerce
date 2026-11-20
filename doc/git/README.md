# Working with Git

We work on issue branches and bring changes into `main` through pull requests using **Rebase and merge**. Commits
describe the change, reference its issue and record the time spent.

- [Branches and pull requests](branches.md)
- [Commit messages and custom endings](commits.md)
- [Time tracking](time-tracking.md)

Enable the project hooks once after cloning:

```sh
git config core.hooksPath .githooks
```

Before opening a PR, finish the implementation, run the relevant checks, review the issue’s acceptance criteria and
update affected documentation. Keep passwords, tokens and other secrets out of commits.
