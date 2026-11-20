# Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) with our own issue and time ending:

```text
<type>(<optional-scope>): <short description>, refs #<issue-number> | time: <duration>
```

The description says what changed, briefly and concretely. The scope names the affected area, such as `bookings`,
`account` or `ui`; it can be omitted.

## Common types

| Type       | Meaning                                       |
|------------|-----------------------------------------------|
| `feat`     | A new feature                                 |
| `fix`      | A bug fix                                     |
| `docs`     | Documentation                                 |
| `refactor` | Code restructuring without changing behaviour |
| `test`     | Tests                                         |
| `style`    | Formatting without changing behaviour         |
| `build`    | Build configuration or dependencies           |
| `ci`       | CI workflows                                  |
| `chore`    | Other maintenance                             |

## Our custom ending

`refs #60` links the change to GitHub issue #60

The last part is always a time tag:

```text
| time: 30m
| time: 2h
| time: 1h30m
```

Use whole hours/minutes, with no space between them. Decimal hours such as `1.5h` are not supported. Record time spent
on this commit, not the running total for the issue. If several issues are relevant, list their references before one
time tag.

The local hook checks for an issue number and a time tag at the end of a line. Conventional Commit types/scopes are a
team convention; the current hook does not validate them. Messages starting with `Merge` or `Revert`, and commits
changing only `TIME_TRACKING.md`, are exempt from the hook’s issue/time checks.

[Back to Git guide](README.md)
