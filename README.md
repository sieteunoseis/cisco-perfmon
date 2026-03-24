# cisco-perfmon

[![npm version](https://img.shields.io/npm/v/cisco-perfmon.svg)](https://www.npmjs.com/package/cisco-perfmon)
[![CI](https://github.com/sieteunoseis/cisco-perfmon/actions/workflows/release.yml/badge.svg)](https://github.com/sieteunoseis/cisco-perfmon/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/cisco-perfmon.svg)](https://nodejs.org)
[![Skills](https://img.shields.io/badge/skills.sh-cisco--perfmon--cli-blue)](https://skills.sh/sieteunoseis/cisco-perfmon)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-orange?logo=buy-me-a-coffee)](https://buymeacoffee.com/automatebldrs)

A library and CLI for collecting real-time performance counters from Cisco CUCM via the PerfMon SOAP API.

Perfmon API reference: [Cisco PerfMon API Reference](https://developer.cisco.com/docs/sxml/#!perfmon-api-reference)

## Installation

```bash
npm install cisco-perfmon
```

### Global CLI install

```bash
npm install -g cisco-perfmon
```

Or run without installing:

```bash
npx cisco-perfmon --help
```

### AI Agent Skills

```bash
npx skills add sieteunoseis/cisco-perfmon
```

## Requirements

Node.js 18+ is required (uses the built-in Fetch API).

If you are using self-signed certificates on Cisco VOS products you may need to disable TLS verification. **Only do this in a lab environment.**

```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Quick Start

```bash
# Configure a cluster
cisco-perfmon config add lab --host cucm-pub.example.com --username admin --password secret --insecure

# Verify connectivity
cisco-perfmon doctor

# List available counter objects
cisco-perfmon list-objects

# Collect CallManager counters
cisco-perfmon collect "Cisco CallManager"

# Watch counters live with sparklines
cisco-perfmon watch "Cisco CallManager" --counter CallsActive,CallsInProgress --interval 5
```

## Configuration

```bash
cisco-perfmon config add <name> --host <host> --username <user> --password <pass>
cisco-perfmon config use <name>          # switch active cluster
cisco-perfmon config list                # list all clusters
cisco-perfmon config show                # show active cluster details
cisco-perfmon config remove <name>       # remove a cluster
cisco-perfmon config test                # test connectivity
```

Supports Secret Server integration for credential management:

```bash
cisco-perfmon config add <name> --host '<ss:ID:host>' --username '<ss:ID:username>' --password '<ss:ID:password>'
```

Or use environment variables instead of config files:

```bash
export CUCM_HOST=cucm-pub.example.com
export CUCM_USERNAME=admin
export CUCM_PASSWORD=secret
```

Connection precedence: CLI flags > environment variables > config file.

## CLI Commands

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

The `watch` command is the standout feature for real-time monitoring. It polls counters at a configurable interval and renders a live-updating table with sparkline visualizations showing trends over the last 12 samples.

```bash
cisco-perfmon watch "Cisco CallManager"                                           # watch all counters
cisco-perfmon watch "Cisco CallManager" --counter CallsActive --interval 5        # 5-second polling
cisco-perfmon watch "Processor" --counter "% CPU Time" --instance "_Total"        # CPU monitoring
cisco-perfmon watch "Memory" --interval 30 --duration 300                         # 5-minute memory check
```

The table view displays:

| Column    | Description                    |
| --------- | ------------------------------ |
| counter   | Counter name                   |
| instance  | Instance name                  |
| value     | Current value                  |
| sparkline | Visual trend (last 12 samples) |
| min       | Minimum observed value         |
| max       | Maximum observed value         |
| avg       | Average across samples         |

Press `Ctrl+C` to stop. A final summary shows iteration count and total duration.

### doctor -- Configuration and connectivity health check

```bash
cisco-perfmon doctor
cisco-perfmon doctor --insecure
```

Runs checks against: active cluster config, PerfMon API connectivity, counter object availability, config file permissions, and audit trail size.

## Global Flags

| Flag                | Description                            |
| ------------------- | -------------------------------------- |
| `--format <type>`   | Output format: table, json, toon, csv  |
| `--host <host>`     | Override CUCM hostname                 |
| `--username <user>` | Override CUCM username                 |
| `--password <pass>` | Override CUCM password                 |
| `--cluster <name>`  | Use a specific named cluster           |
| `--insecure`        | Skip TLS certificate verification      |
| `--no-audit`        | Disable audit logging for this command |
| `--debug`           | Enable debug logging                   |

## Output Formats

All commands support four output formats via the `--format` flag:

- `--format table` (default) -- human-readable table
- `--format json` -- structured JSON for scripting
- `--format toon` -- token-efficient format for AI agents
- `--format csv` -- comma-separated values for spreadsheets

## Audit Trail

All operations are logged to `~/.cisco-perfmon/audit.jsonl` (JSONL format). Credentials are never logged. Use `--no-audit` to skip.

## Library API

### Setup

```javascript
// CommonJS
const perfMonService = require("cisco-perfmon");

// ESM
import perfMonService from "cisco-perfmon";
```

### Constructor

```javascript
new perfMonService(host, username, password, options, retry);
```

| Parameter  | Type    | Default | Description                                   |
| ---------- | ------- | ------- | --------------------------------------------- |
| `host`     | string  | --      | CUCM IP or FQDN                               |
| `username` | string  | --      | AXL/admin username (omit if using SSO cookie) |
| `password` | string  | --      | Password (omit if using SSO cookie)           |
| `options`  | object  | `{}`    | See options below                             |
| `retry`    | boolean | `true`  | Enable/disable automatic retry                |

#### Options

| Option       | Type   | Default | Description                                                          |
| ------------ | ------ | ------- | -------------------------------------------------------------------- |
| `retries`    | number | `3`     | Max retry attempts. Falls back to `PM_RETRY` env var.                |
| `retryDelay` | number | `5000`  | Delay in ms between retries. Falls back to `PM_RETRY_DELAY` env var. |
| `Cookie`     | string | --      | Session cookie for SSO authentication                                |
| _any header_ | string | --      | Additional HTTP headers merged into every request                    |

```javascript
// Custom retry settings
const service = new perfMonService("10.10.20.1", "admin", "pass", {
  retries: 5,
  retryDelay: 2000,
});

// SSO cookie auth (no username/password needed)
const service = new perfMonService("10.10.20.1", "", "", {
  Cookie: "JSESSIONIDSSO=abc123",
});
```

### Basic Example

```javascript
const perfMonService = require("cisco-perfmon");

const service = new perfMonService("10.10.20.1", "administrator", "ciscopsdt");

const counter = {
  host: "cucm01-pub",
  object: "Cisco CallManager",
  instance: "",
  counter: "CallsActive",
};

const result = await service.collectCounterData(counter.host, counter.object);
console.log(result.results);
```

### Methods

#### `collectCounterData(host, object)`

Collect counter data without a session.

```javascript
const result = await service.collectCounterData(
  "cucm01-pub",
  "Cisco CallManager",
);
// result.results => [{ host, object, instance, counter, value, cstatus }, ...]
```

#### `collectSessionData(sessionHandle)`

Collect data for an open session.

```javascript
const result = await service.collectSessionData(sessionHandle);
```

#### `listCounter(host, filtered?)`

List all available counters on a host, with optional name filtering.

```javascript
const result = await service.listCounter("cucm01-pub");
const filtered = await service.listCounter("cucm01-pub", [
  "Cisco CallManager",
  "Memory",
]);
```

#### `listInstance(host, object)`

List instances of a perfmon object.

```javascript
const result = await service.listInstance("cucm01-pub", "Cisco CallManager");
```

#### `openSession()` / `closeSession(sessionHandle)`

Open and close a polling session.

```javascript
const opened = await service.openSession();
const sessionHandle = opened.results;
// ... collect data ...
await service.closeSession(sessionHandle);
```

#### `addCounter(sessionHandle, counter)` / `removeCounter(sessionHandle, counter)`

Add or remove counters from an open session. Accepts a single counter object or an array.

```javascript
await service.addCounter(sessionHandle, {
  host: "cucm01-pub",
  object: "Cisco CallManager",
  instance: "",
  counter: "CallsActive",
});
```

#### `queryCounterDescription(counter)`

Get the description of a counter.

```javascript
const result = await service.queryCounterDescription({
  host: "cucm01-pub",
  object: "Cisco CallManager",
  instance: "",
  counter: "CallsActive",
});
```

### Rate Limiting

CUCM enforces an 80 requests/minute limit on Perfmon. This library automatically detects that SOAP fault and applies exponential backoff (30s -> 60s -> 120s) before retrying.

### Cookie Management

Cookies returned by CUCM are automatically captured and reused for subsequent requests.

```javascript
// Get the current stored cookie
const cookie = service.getCookie();

// Set a cookie manually (e.g. from a prior session)
service.setCookie("JSESSIONIDSSO=abc123");
```

### Output Examples

```javascript
// Success
{
  host: 'cucm01-pub',
  object: 'Cisco CallManager',
  instance: '',
  counter: 'PRIChannelsActive',
  value: '0',
  cstatus: '1'
}

// Rate limit error (automatically retried with backoff)
{
  status: 500,
  code: 'Internal Server Error',
  host: 'cucm01-pub',
  message: 'Exceeded allowed rate for Perfmon information. Current allowed rate for perfmon information is 80 requests per minute.'
}
```

### Environment Variables

These are supported as fallbacks when constructor options are not provided:

| Variable         | Description                 | Default |
| ---------------- | --------------------------- | ------- |
| `PM_RETRY`       | Max retry attempts          | `3`     |
| `PM_RETRY_DELAY` | Delay in ms between retries | `5000`  |

## Related Tools

| Package                                                      | Description                                  |
| ------------------------------------------------------------ | -------------------------------------------- |
| [cisco-axl](https://www.npmjs.com/package/cisco-axl)         | Cisco CUCM AXL API library and CLI           |
| [cisco-risport](https://www.npmjs.com/package/cisco-risport) | Cisco CUCM RisPort70 real-time device status |
| [cisco-ise](https://www.npmjs.com/package/cisco-ise)         | Cisco ISE ERS API library and CLI            |

## Testing

```bash
npm test                  # run unit tests
npm run test:integration  # run integration tests (requires CUCM)
```

## Giving Back

If you found this helpful, consider:

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/automatebldrs)

## License

MIT
