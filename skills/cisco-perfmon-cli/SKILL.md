---
name: cisco-perfmon-cli
description: Use when collecting Cisco CUCM real-time performance counters via the cisco-perfmon CLI — CPU, memory, call statistics, device counts, and continuous monitoring with sparkline visualization.
license: MIT
metadata:
  author: sieteunoseis
  version: "1.0.0"
---

# cisco-perfmon CLI

CLI for collecting Cisco CUCM real-time performance counters via the PerfMon SOAP API. Supports one-shot collection, session-based polling, continuous monitoring with live sparkline visualization, and multiple output formats.

## Setup

Configure a cluster (one-time, interactive prompt for password — never pass credentials on the command line):

```bash
cisco-perfmon config add <name> --host <host> --username <user> --insecure
# You will be prompted securely for the password
cisco-perfmon config test
```

For Secret Server integration:

```bash
cisco-perfmon config add <name> --host '<ss:ID:host>' --username '<ss:ID:username>' --password '<ss:ID:password>' --insecure
```

Or use environment variables (set via your shell profile, a `.env` file, or a secrets manager — never hardcode credentials):

```bash
export CUCM_HOST=<host>
export CUCM_USERNAME=<user>
export CUCM_PASSWORD=<pass>
```

## Commands

### config -- Manage cluster configurations

```bash
cisco-perfmon config add <name> --host <host> --username <user>
# You will be prompted securely for the password
cisco-perfmon config use <name>
cisco-perfmon config list
cisco-perfmon config show
cisco-perfmon config remove <name>
cisco-perfmon config test
```

### list-objects -- List available perfmon counter objects

```bash
cisco-perfmon list-objects                          # all objects
cisco-perfmon list-objects --search "CallManager"   # filter by keyword
cisco-perfmon list-objects --format json             # JSON output
```

### list-instances -- List instances of a perfmon object

```bash
cisco-perfmon list-instances "Cisco CallManager"
cisco-perfmon list-instances "Process" --format json
```

### describe -- Get counter descriptions

```bash
cisco-perfmon describe "Cisco CallManager"
cisco-perfmon describe "Cisco CallManager" --counter CallsActive
cisco-perfmon describe "Cisco CallManager" --counter CallsActive --instance ""
```

### collect -- One-shot counter data collection

```bash
cisco-perfmon collect "Cisco CallManager"                                       # all counters
cisco-perfmon collect "Cisco CallManager" --counter CallsActive,CallsInProgress # specific counters
cisco-perfmon collect "Cisco CallManager" --instance ""                          # filter by instance
cisco-perfmon collect "Processor" --format json                                  # JSON output
cisco-perfmon collect "Memory" --format csv > memory.csv                         # export to CSV
```

### session -- Manage perfmon polling sessions

```bash
cisco-perfmon session open                          # get a session handle
cisco-perfmon session add <handle> --counters '[{"host":"cucm","object":"Cisco CallManager","counter":"CallsActive"}]'
cisco-perfmon session collect <handle>              # collect session data
cisco-perfmon session remove <handle> --counters '[...]'
cisco-perfmon session close <handle>
```

### watch -- Continuous monitoring with live sparklines

The watch command polls counters at a configurable interval and displays a live-updating table with sparkline visualizations showing value trends over the last 12 samples.

```bash
cisco-perfmon watch "Cisco CallManager"                                         # watch all counters
cisco-perfmon watch "Cisco CallManager" --counter CallsActive --interval 5      # specific counter, 5s interval
cisco-perfmon watch "Processor" --counter "% CPU Time" --instance "_Total"      # CPU monitoring
cisco-perfmon watch "Memory" --interval 30 --duration 300                       # 5-minute memory check
cisco-perfmon watch "Cisco CallManager" --format json --interval 10             # JSON output for piping
```

The table view shows: counter name, instance, current value, sparkline trend, min, max, and average. Press Ctrl+C to stop.

### doctor -- Configuration and connectivity health check

```bash
cisco-perfmon doctor                                # run all checks
cisco-perfmon doctor --insecure                     # with TLS skip
```

Checks: active cluster config, PerfMon API connectivity, counter object availability, config file permissions, audit trail size.

## Common Workflows

### Check system health

```bash
cisco-perfmon doctor
cisco-perfmon collect "Cisco CallManager" --format json
```

### Monitor calls during testing

```bash
cisco-perfmon watch "Cisco CallManager" --counter CallsActive,CallsInProgress,CallsAttempted --interval 5
```

### CPU investigation

```bash
cisco-perfmon watch "Processor" --counter "% CPU Time" --instance "_Total" --interval 10
cisco-perfmon collect "Processor" --format json
```

### List what counters are available

```bash
cisco-perfmon list-objects --search "Cisco"
cisco-perfmon list-instances "Cisco CallManager"
cisco-perfmon describe "Cisco CallManager" --counter CallsActive
```

### Export counter data to CSV

```bash
cisco-perfmon collect "Cisco CallManager" --format csv > callmanager.csv
```

### Session-based polling for selective counters

```bash
HANDLE=$(cisco-perfmon session open --format json | jq -r '.sessionHandle')
cisco-perfmon session add "$HANDLE" --counters '[{"host":"cucm-pub","object":"Cisco CallManager","counter":"CallsActive"}]'
cisco-perfmon session collect "$HANDLE"
cisco-perfmon session close "$HANDLE"
```

## Output Formats

- `--format table` (default) -- human-readable table
- `--format json` -- for scripting/parsing
- `--format toon` -- token-efficient for AI agents (recommended)
- `--format csv` -- for spreadsheets

## Global Flags

- `--host <host>` -- override CUCM hostname
- `--username <user>` -- override CUCM username
- `--password <pass>` -- override CUCM password
- `--cluster <name>` -- use a specific named cluster
- `--insecure` -- skip TLS certificate verification (required for self-signed certs)
- `--no-audit` -- disable audit logging for this command
- `--debug` -- enable debug logging
