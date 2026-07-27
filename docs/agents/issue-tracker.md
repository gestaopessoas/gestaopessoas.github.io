# Issue Tracker

Issues are tracked in **GitHub Issues** on this repository:  
`https://github.com/gestaopessoas/gestaopessoas.github.io`

## Using the tracker

Use the `gh` CLI to create and manage issues:

```sh
# List open issues
gh issue list

# Create a new issue
gh issue create --title "..." --body "..." --label "ready-for-agent"

# View an issue
gh issue view <number>

# Close an issue
gh issue close <number>
```

## Triage labels

| Label | Meaning |
|---|---|
| `needs-triage` | Newly filed, not yet reviewed |
| `needs-info` | Blocked waiting for more information |
| `ready-for-agent` | Fully specified, an agent can pick it up |
| `ready-for-human` | Needs human review or decision |
| `wontfix` | Will not be implemented |

## PRs as a request surface

Off — external PRs are not part of the triage queue.
