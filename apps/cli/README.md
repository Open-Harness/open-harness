# DAO CLI

Workflow runner CLI for executing autonomous agent workflows from YAML configurations.

## Installation

```bash
bun install
```

## Usage

### Run a Workflow

Execute a workflow from a YAML configuration file:

```bash
bun run dao run workflow.yaml
```

With options:

```bash
bun run dao run workflow.yaml --project-dir ./my_project --max-iterations 5 --no-monologue
```

### Generate Configuration

Interactive configuration generator:

```bash
bun run dao init
```

Quick start with template:

```bash
bun run dao init --template autonomous-coding --output workflow.yaml
```

### Check Progress

Show workflow progress status:

```bash
bun run dao status ./my_project
```

Output as JSON:

```bash
bun run dao status ./my_project --json
```

### Validate Configuration

Validate a workflow configuration file:

```bash
bun run dao validate workflow.yaml
```

## Workflow Configuration

Example `workflow.yaml`:

```yaml
workflow:
  name: autonomous-coding
  projectDir: ./my_project
  maxIterations: 10
  autoContinueDelay: 3000

agents:
  initializer:
    model: sonnet
    permissions:
      mode: bypassPermissions
      allowDangerous: true
  builder:
    model: haiku
    permissions:
      mode: bypassPermissions
      allowDangerous: true
  narrator:
    enabled: true
    bufferSize: 15

dataSources:
  - name: features
    type: json-file
    path: ./feature_list.json

execution:
  workOn: features
  strategy: sequential
```

## Development

```bash
# Type check
bun run typecheck

# Lint
bun run lint

# Lint and fix
bun run lint:fix
```
