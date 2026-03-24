# CLI Reference

## Commands

### list-objects -- List available perfmon counter objects

```bash
cisco-perfmon list-objects                          # all objects
cisco-perfmon list-objects --search "CallManager"   # filter by keyword
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
```

### collect -- One-shot counter data collection

```bash
cisco-perfmon collect "Cisco CallManager"                                         # all counters
cisco-perfmon collect "Cisco CallManager" --counter CallsActive,CallsInProgress   # specific counters
cisco-perfmon collect "Cisco CallManager" --instance ""                            # filter by instance
cisco-perfmon collect "Memory" --format csv > memory.csv                           # export to CSV
```

### session -- Manage perfmon polling sessions

For fine-grained control over which counters to poll:

```bash
cisco-perfmon session open                                                        # get a session handle
cisco-perfmon session add <handle> --counters '[{"host":"cucm","object":"Cisco CallManager","counter":"CallsActive"}]'
cisco-perfmon session collect <handle>                                             # collect session data
cisco-perfmon session remove <handle> --counters '[...]'                           # remove counters
cisco-perfmon session close <handle>                                               # close session
```

### watch -- Continuous monitoring with live sparklines

The `watch` command polls counters at a configurable interval and renders a live-updating table with sparkline visualizations showing trends over the last 12 samples.

```bash
cisco-perfmon watch "Cisco CallManager"                                           # watch all counters
cisco-perfmon watch "Cisco CallManager" --counter CallsActive --interval 5        # 5-second polling
cisco-perfmon watch "Processor" --counter "% CPU Time" --instance "_Total"        # CPU monitoring
cisco-perfmon watch "Memory" --interval 30 --duration 300                         # 5-minute memory check
```

The table view displays:

| Column    | Description                        |
|-----------|------------------------------------|
| counter   | Counter name                       |
| instance  | Instance name                      |
| value     | Current value                      |
| sparkline | Visual trend (last 12 samples)     |
| min       | Minimum observed value             |
| max       | Maximum observed value             |
| avg       | Average across samples             |

Press `Ctrl+C` to stop. A final summary shows iteration count and total duration.

### doctor -- Configuration and connectivity health check

```bash
cisco-perfmon doctor
cisco-perfmon doctor --insecure
```

Runs checks against: active cluster config, PerfMon API connectivity, counter object availability, config file permissions, and audit trail size.

## Global Flags

| Flag                | Description                                    |
|---------------------|------------------------------------------------|
| `--format <type>`   | Output format: table, json, toon, csv          |
| `--host <host>`     | Override CUCM hostname                         |
| `--username <user>` | Override CUCM username                         |
| `--password <pass>` | Override CUCM password                         |
| `--cluster <name>`  | Use a specific named cluster                   |
| `--insecure`        | Skip TLS certificate verification              |
| `--no-audit`        | Disable audit logging for this command         |
| `--debug`           | Enable debug logging                           |

## Output Formats

- `--format table` (default) -- human-readable table
- `--format json` -- structured JSON for scripting
- `--format toon` -- token-efficient format for AI agents
- `--format csv` -- comma-separated values for spreadsheets
