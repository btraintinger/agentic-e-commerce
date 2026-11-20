# Time tracking

Commit messages record work with the [custom time ending](commits.md#our-custom-ending). The report totals that time by
Git commit author name.

After a successful local commit, the post-commit hook recalculates [TIME_TRACKING.md](../../TIME_TRACKING.md) and amends
that same commit to include the report. It does not include unrelated staged changes in the amendment. The report stays
at the repository root because the hooks expect it there; it is generated rather than maintained by hand.

Enable hooks once per clone:

```sh
git config core.hooksPath .githooks
```

The time report can also be printed without changing files:

```sh
sh scripts/time-report.sh
```

## Rebase and merge

Always merge PRs with **Rebase and merge**. Each commit retains its author and message, including its time entry,
so the report can attribute work to the right person.

The report reads every `| time:` entry in commit messages, including their bodies. Keep each time entry once on its
original commit. Do not copy commit time entries into another commit or combine commits with squash: that loses the
original author/time associations.

[Back to Git guide](README.md)
