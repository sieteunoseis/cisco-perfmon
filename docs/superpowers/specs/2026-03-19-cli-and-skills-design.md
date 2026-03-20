# cisco-perfmon CLI & Skills.sh Integration Design

**Date:** 2026-03-19
**Status:** Draft
**Package:** cisco-perfmon (https://github.com/sieteunoseis/cisco-perfmon)

## Overview

Add CLI functionality and a skills.sh skill to the existing cisco-perfmon library package. The CLI wraps the `perfMonService` class to expose Cisco CUCM performance monitoring from the command line — collecting counters, managing sessions, listing objects, and watching live metrics. A skills.sh skill teaches AI agents how to use the CLI effectively.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Packaging | CLI built into existing package | Single repo, library and CLI always in lockstep. CLI code only loaded via bin entry point — library consumers unaffected. Same pattern as cisco-dime and cisco-axl. |
| CLI framework | Commander.js | Consistent with cisco-dime and cisco-axl. No `enablePositionalOptions()` — use `optsWithGlobals()` in subcommand actions. |
| Command structure | Flat commands + `session` subgroup | Flat for one-shot ops (collect, list-objects, list-instances, describe, watch), grouped for multi-step session lifecycle. Matches how operators actually use perfmon. |
| Auth/config | CLI flags > env vars > config file | Admins get persistent config, devs/CI get env vars, per-command overrides always available. |
| Multi-cluster | Named clusters with `config add/use` | Admins manage multiple CUCM environments (lab, staging, prod). |
| Secret Server | Optional `<ss:ID:field>` placeholder resolution | No plaintext passwords on disk if ss-cli is available. |
| Output formats | table, json, toon, csv | table=admins, json=scripting, toon=AI agents (token-efficient), csv=Excel workflows. |
| No `--cucm-version` | Perfmon API is version-agnostic | The PerfmonService2 endpoint works the same across CUCM versions. |
| Watch command | Polls `collectCounterData` on interval | Convenience wrapper for live monitoring; not a separate API — just repeated one-shot calls. |
| TLS handling | `--insecure` flag | Most CUCM environments use self-signed certs. |
| Audit trail | `~/.cisco-perfmon/audit.jsonl` | Logs all CLI operations with 10MB rotation. Consistent with cisco-dime. |
| TOON formatter | Async via dynamic `import()` | `@toon-format/toon` is ESM-only. Uses `await import()` bridge from CJS. |
| Session handles | Passed as positional args | Session handles are opaque strings returned by `openSession()`. Users copy-paste them into subsequent session commands — no local session state stored. |
| Cookie scoping | Single instance per command invocation | Unlike multi-endpoint services, the perfmon service uses one endpoint per cluster host. Cookie stored on the `perfMonService` instance for the lifetime of the CLI command. |
| Config source language | Plain JavaScript in `cli/` | No build step needed. Imports library from `main.js`. |
| Skills scope | CLI usage skill only | Library API is well-documented via types/JSDoc already. |

## Scope Boundaries

- **In scope:** Perfmon operations exposed via `perfMonService` class
- **Out of scope:** AXL, DIME, Risport — those stay in their own libraries
- **Existing library consumers** are completely unaffected

## API Surface Wrapped

The library exports a single `perfMonService` class:

| Method | CLI command |
|--------|-------------|
| `listCounter(host, filtered?)` | `list-objects [--filter]` |
| `listInstance(host, object)` | `list-instances <object>` |
| `queryCounterDescription(counter)` | `describe <object> <counter>` |
| `collectCounterData(host, object)` | `collect <object>` |
| `openSession()` | `session open` |
| `addCounter(sessionHandle, counter)` | `session add <handle> <object> --counter <name>` |
| `collectSessionData(sessionHandle)` | `session collect <handle>` |
| `removeCounter(sessionHandle, counter)` | `session remove <handle> <object> --counter <name>` |
| `closeSession(sessionHandle)` | `session close <handle>` |
| — (repeated collectCounterData) | `watch <object>` |

## Feature Comparison with cisco-cucm-mcp Perfmon Tools

The cisco-cucm-mcp package exposes 8 perfmon tools via MCP protocol. This CLI provides equivalent coverage:

| MCP Tool | CLI Command | Notes |
|----------|-------------|-------|
| `perfmon_list_counter` | `list-objects [--filter]` | CLI adds optional keyword filter |
| `perfmon_list_instance` | `list-instances <object>` | 1:1 equivalent |
| `perfmon_collect_counter_data` | `collect <object>` | CLI adds `--instance` scoping |
| `perfmon_open_session` | `session open` | CLI prints session handle for copy-paste |
| `perfmon_add_counter` | `session add <handle> <object> --counter <name>` | CLI adds `--instance` |
| `perfmon_collect_session_data` | `session collect <handle>` | 1:1 equivalent |
| `perfmon_remove_counter` | `session remove <handle> <object> --counter <name>` | 1:1 equivalent |
| `perfmon_close_session` | `session close <handle>` | 1:1 equivalent |
| — (not in MCP) | `describe <object> <counter>` | CLI-only: wraps `queryCounterDescription` |
| — (not in MCP) | `watch <object>` | CLI-only: live polling convenience |

The CLI adds two commands the MCP server doesn't expose: `describe` and `watch`.

## Command Structure

```
cisco-perfmon <command> [options]
```

### Config Commands

```bash
cisco-perfmon config add <name> --host <h> --username <u> --password <p>
cisco-perfmon config use <name>           # set active cluster
cisco-perfmon config list                 # list all clusters
cisco-perfmon config show                 # show active cluster (masks passwords)
cisco-perfmon config remove <name>        # remove a cluster
cisco-perfmon config test                 # test connection via listCounter
```

**Notes:**
- `--host`, `--username`, `--password` are global flags read via `cmd.optsWithGlobals()` in the `add` action
- `config test` calls `listCounter()` and reports count of available objects

### List Objects

```bash
cisco-perfmon list-objects                         # all perfmon objects
cisco-perfmon list-objects --filter "CallManager"  # keyword filter (case-insensitive)
```

Output includes: `name` of each perfmon object (e.g., `Cisco CallManager`, `Memory`, `Processor`).

### List Instances

```bash
cisco-perfmon list-instances Processor
cisco-perfmon list-instances "Cisco CallManager"
```

Output includes: instance names (e.g., `0`, `1` for CPU cores).

### Describe Counter

```bash
cisco-perfmon describe Processor PercentCPUTime
cisco-perfmon describe Memory "% VM Used"
```

Output: counter description text from CUCM.

### Collect (One-Shot)

```bash
cisco-perfmon collect Processor                     # all counters, all instances
cisco-perfmon collect Processor --instance 0        # specific instance
cisco-perfmon collect "Cisco CallManager"
cisco-perfmon collect Memory --format json
```

Output rows: `host`, `object`, `instance`, `counter`, `value`, `cstatus`.

### Session Commands

Multi-step workflow for sustained polling without re-authenticating each call:

```bash
# 1. Open a session
cisco-perfmon session open
# → Session handle: abc123def456

# 2. Add counters to the session
cisco-perfmon session add abc123def456 Processor --counter PercentCPUTime
cisco-perfmon session add abc123def456 Processor --instance 0 --counter PercentCPUTime
cisco-perfmon session add abc123def456 Memory --counter Total

# 3. Collect data for all registered counters
cisco-perfmon session collect abc123def456

# 4. Remove a counter
cisco-perfmon session remove abc123def456 Processor --counter PercentCPUTime

# 5. Close the session
cisco-perfmon session close abc123def456
```

### Watch (Live Polling)

```bash
cisco-perfmon watch Processor                              # poll every 10s, indefinitely
cisco-perfmon watch Processor --interval 5                 # poll every 5s
cisco-perfmon watch Processor --count 10                   # stop after 10 collections
cisco-perfmon watch "Cisco CallManager" --interval 30      # poll every 30s
cisco-perfmon watch Memory --format json --count 3         # JSON output, 3 times
```

Behavior:
- Calls `collectCounterData()` repeatedly at `--interval` seconds (default: 10)
- Clears and reprints the table on each poll (live-updating via ANSI escape codes) in table mode
- In json/csv/toon mode, prints each collection as a new block separated by a timestamp line
- `--count 0` means poll indefinitely (default)
- Ctrl+C exits cleanly

### Global Flags

```text
--format table|json|toon|csv   (default: table)
--host <host>                  (override config/env)
--username <user>              (override config/env)
--password <pass>              (override config/env)
--cluster <name>               (use a specific named cluster)
--insecure                     (skip TLS certificate verification)
--no-audit                     (disable audit logging for this command)
--debug                        (enable debug logging)
```

**CLI meta:**
- `cisco-perfmon --version` — prints package version
- `cisco-perfmon --help` — auto-generated by Commander.js

## Configuration & Authentication

### Precedence (highest to lowest)

1. CLI flags (`--host`, `--username`, `--password`, `--cluster`)
2. Environment variables (`CUCM_HOST` or `CUCM_HOSTNAME`, `CUCM_USERNAME`, `CUCM_PASSWORD`)
3. Config file (`~/.cisco-perfmon/config.json`) — active cluster or `--cluster` named cluster

### Config File Layout

```
~/.cisco-perfmon/
  config.json       (0600 permissions)
  audit.jsonl       (audit trail, 10MB rotation)
```

```json
{
  "activeCluster": "prod",
  "clusters": {
    "lab": {
      "host": "10.0.0.1",
      "username": "admin",
      "password": "plaintext-or-ss-ref",
      "insecure": true
    },
    "prod": {
      "host": "<ss:2301:host>",
      "username": "<ss:2301:username>",
      "password": "<ss:2301:password>"
    }
  }
}
```

### Secret Server Integration (Optional)

Any config value can use `<ss:ID:field>` placeholders. Resolved via `ss-cli get <ID> --format json`. If ss-cli is unavailable, emits a clear error. Plain values work without ss-cli.

### Environment Variables

```bash
export CUCM_HOST=10.0.0.1
export CUCM_USERNAME=admin
export CUCM_PASSWORD=secret
cisco-perfmon collect Processor
```

Both `CUCM_HOST` and `CUCM_HOSTNAME` are accepted.

## Output Formatting

Four formats via `--format` flag (default: `table`):

### Table (default — human-friendly)

```
$ cisco-perfmon collect Processor
┌───────────┬───────────┬──────────┬──────────────────┬───────┬─────────┐
│ host      │ object    │ instance │ counter          │ value │ cstatus │
├───────────┼───────────┼──────────┼──────────────────┼───────┼─────────┤
│ 10.0.0.1  │ Processor │ 0        │ PercentCPUTime   │ 3     │ 1       │
│ 10.0.0.1  │ Processor │ 1        │ PercentCPUTime   │ 5     │ 1       │
└───────────┴───────────┴──────────┴──────────────────┴───────┴─────────┘
2 results found
```

### JSON (scriptable)

```
$ cisco-perfmon collect Processor --format json
[
  {"host":"10.0.0.1","object":"Processor","instance":"0","counter":"PercentCPUTime","value":"3","cstatus":"1"},
  {"host":"10.0.0.1","object":"Processor","instance":"1","counter":"PercentCPUTime","value":"5","cstatus":"1"}
]
```

### TOON (token-efficient for AI agents)

```
$ cisco-perfmon collect Processor --format toon
[2]{host,object,instance,counter,value,cstatus}:
  10.0.0.1,Processor,0,PercentCPUTime,3,1
  10.0.0.1,Processor,1,PercentCPUTime,5,1
```

### CSV (Excel/spreadsheet workflows)

```
$ cisco-perfmon collect Processor --format csv
host,object,instance,counter,value,cstatus
10.0.0.1,Processor,0,PercentCPUTime,3,1
10.0.0.1,Processor,1,PercentCPUTime,5,1
```

### Behavior Notes

- Single-item results render as key-value pairs in table mode, full object in JSON/TOON
- Errors always output to stderr as plain text regardless of `--format`
- Watch command in table mode uses `\x1b[2J\x1b[0f` to clear and redraw

## Error Handling

```bash
# Auth failure
$ cisco-perfmon collect Processor
Error: Authentication failed.
Hint: Run "cisco-perfmon config test" to verify your credentials.

# No config set
$ cisco-perfmon collect Processor
Error: No cluster configured. Set one up with:
  cisco-perfmon config add <name> --host <h> --username <u> --password <p>
  Or set environment variables: CUCM_HOST, CUCM_USERNAME, CUCM_PASSWORD

# Rate limit hit (library retries, but after max retries)
$ cisco-perfmon collect Processor
Error: Exceeded allowed rate for Perfmon (80 req/min).
Hint: Wait 30 seconds and try again, or reduce polling frequency with --interval.

# Object not found
$ cisco-perfmon list-instances BadObject
Error: Object "BadObject" not found on this cluster.
Hint: Run "cisco-perfmon list-objects" to see available objects.

# ss-cli placeholder but ss-cli not available
$ cisco-perfmon collect Processor
Error: Config contains Secret Server references (<ss:...>) but ss-cli is not available.
Install with: npm install -g @sieteunoseis/ss-cli
```

**Behavior:**
- Errors go to stderr, always plain text regardless of `--format`
- Exit code 0 on success, 1 on error
- Actionable hints where possible
- `--debug` sets `process.env.DEBUG = "cisco-perfmon"`

## Audit Trail

All CLI operations that call the Perfmon API are logged to a JSONL audit file.

**Location:** `~/.cisco-perfmon/audit.jsonl` (one JSON object per line)

**Log entry format:**
```json
{"timestamp":"2026-03-19T18:30:00.000Z","cluster":"10.0.0.1","command":"collect","args":"Processor","duration_ms":245,"status":"success","rows":16}
{"timestamp":"2026-03-19T18:30:10.000Z","cluster":"10.0.0.1","command":"session open","duration_ms":120,"status":"success"}
{"timestamp":"2026-03-19T18:30:20.000Z","cluster":"10.0.0.1","command":"watch","args":"Processor","duration_ms":60000,"status":"success","iterations":6}
```

**What's logged:** timestamp, cluster host, command name, args, duration, status, row count where applicable. **Never logged:** passwords or credentials.

**Controls:**
- `--no-audit` disables logging for a single command
- Log rotation: >10MB triggers rotate to `audit.jsonl.1`

## File Structure

```
cisco-perfmon/
├── bin/
│   └── cisco-perfmon.js           # CLI entry point (#!/usr/bin/env node)
├── cli/
│   ├── index.js                   # Commander program setup, global flags, registers commands
│   ├── commands/
│   │   ├── config.js              # config add/use/list/show/remove/test
│   │   ├── list-objects.js        # list-objects [--filter]
│   │   ├── list-instances.js      # list-instances <object>
│   │   ├── describe.js            # describe <object> <counter>
│   │   ├── collect.js             # collect <object> [--instance]
│   │   ├── session.js             # session open/add/collect/remove/close
│   │   └── watch.js               # watch <object> [--interval] [--count]
│   ├── formatters/
│   │   ├── table.js               # cli-table3
│   │   ├── json.js                # JSON.stringify pretty
│   │   ├── toon.js                # @toon-format/toon (ESM via async import)
│   │   └── csv.js                 # csv-stringify
│   └── utils/
│       ├── config.js              # ~/.cisco-perfmon/config.json R/W, ss-cli resolution
│       ├── connection.js          # flags > env > config precedence, perfMonService factory
│       ├── audit.js               # JSONL audit logging + 10MB rotation
│       └── output.js              # printResult/printError dispatch
├── skills/
│   └── cisco-perfmon-cli/
│       └── SKILL.md               # skills.sh skill definition
├── main.js                        # existing library (unchanged)
├── main.mjs                       # existing (unchanged)
├── package.json                   # adds bin field + new deps
└── ...
```

## New Dependencies

| Package | Purpose |
|---------|---------|
| `commander` | CLI framework |
| `cli-table3` | Table output formatting |
| `@toon-format/toon` | TOON output format (ESM-only) |
| `csv-stringify` | CSV output format |
| `update-notifier` | Notify users of new versions (ESM-only, dynamic import) |

## package.json Changes

```json
{
  "bin": {
    "cisco-perfmon": "./bin/cisco-perfmon.js"
  }
}
```

New deps added to `dependencies`. Library consumers who only `require('cisco-perfmon')` never load CLI code.

## Skills.sh Integration

### Skill Location

`skills/cisco-perfmon-cli/SKILL.md`

### Installation

```bash
npx skillsadd sieteunoseis/cisco-perfmon
```

### Skill Content Covers

- How to configure a cluster (`cisco-perfmon config add ...` or env vars)
- One-shot collection (`collect`, `list-objects`, `list-instances`, `describe`)
- Session workflow (open → add counters → collect → close)
- Live monitoring (`watch`)
- Output format recommendation (`--format toon` for AI, `--format json` for parsing)
- Common patterns and troubleshooting

## Reusable Patterns from cisco-axl/cisco-dime

| Pattern | Source | Applied Here |
|---------|--------|-------------|
| Commander.js without `enablePositionalOptions()` | cisco-dime | All subcommands use `optsWithGlobals()` |
| `config add` reads global opts manually | cisco-dime | `cmd.optsWithGlobals()` with manual validation |
| update-notifier async import pattern | cisco-dime | `import("update-notifier").then(...)` |
| Multi-cluster config file | cisco-axl | `~/.cisco-perfmon/config.json` |
| Config precedence: flags > env > file | Both | `resolveConfig(flags)` in `connection.js` |
| `<ss:ID:field>` Secret Server support | Both | In `config.js` via execSync ss-cli |
| Four output formatters | Both | table/json/toon/csv, all async-safe |
| TOON async import bridge | cisco-axl | `await import("@toon-format/toon")` |
| JSONL audit with 10MB rotation | cisco-dime | Same pattern, different path |
| `--no-audit` flag | cisco-dime | `program.opts().audit !== false` check |
| `printError` with contextual hints | Both | Error message pattern matching |
| `NODE_TLS_REJECT_UNAUTHORIZED=0` | Both | Set when `--insecure` or cluster.insecure |
| Array returns always | cisco-axl spec | `collectCounterData` result is always array |
| `CUCM_HOST` and `CUCM_HOSTNAME` both accepted | Both | In `connection.js` env resolution |
