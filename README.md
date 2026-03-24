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

Node.js 18+ is required. If using self-signed certificates, use the `--insecure` CLI flag.

## Quick Start

```bash
# Configure a cluster
cisco-perfmon config add lab --host cucm-pub.example.com --username admin --password secret --insecure

# Verify connectivity
cisco-perfmon doctor

# Collect CallManager counters
cisco-perfmon collect "Cisco CallManager"

# Watch counters live with sparklines
cisco-perfmon watch "Cisco CallManager" --counter CallsActive,CallsInProgress --interval 5
```

## Configuration

```bash
cisco-perfmon config add <name> --host <host> --username <user> --password <pass> [--insecure]
cisco-perfmon config use <name>       # switch active cluster
cisco-perfmon config list             # list all clusters
cisco-perfmon config show             # show active cluster (masks passwords)
cisco-perfmon config remove <name>    # remove a cluster
cisco-perfmon config test             # test connectivity
```

Auth precedence: CLI flags > env vars (`CUCM_HOST`, `CUCM_USERNAME`, `CUCM_PASSWORD`) > config file.

Config stored at `~/.cisco-perfmon/config.json`. Supports [ss-cli](https://github.com/sieteunoseis/ss-cli) `<ss:ID:field>` placeholders.

## CLI Commands

| Command | Description |
|---------|-------------|
| `list-objects` | List available perfmon counter objects |
| `list-instances <object>` | List instances of a perfmon object |
| `describe <object>` | Get counter descriptions |
| `collect <object>` | One-shot counter data collection |
| `session` | Manage perfmon polling sessions |
| `watch <object>` | Live monitoring with sparklines |
| `doctor` | Check connectivity and health |

See [full CLI reference](docs/cli.md) for detailed command options, session management, and watch mode.

## Global Flags

| Flag | Description |
|------|-------------|
| `--format table\|json\|toon\|csv` | Output format (default: table) |
| `--host <host>` | Override CUCM hostname |
| `--username <user>` | Override CUCM username |
| `--password <pass>` | Override CUCM password |
| `--cluster <name>` | Use a specific named cluster |
| `--insecure` | Skip TLS certificate verification |
| `--no-audit` | Disable audit logging for this command |
| `--debug` | Enable debug logging |

## Library API

```javascript
const perfMonService = require("cisco-perfmon");
const service = new perfMonService("10.10.20.1", "administrator", "ciscopsdt");

// Collect counters
const result = await service.collectCounterData("cucm01-pub", "Cisco CallManager");
console.log(result.results);

// List available objects and instances
await service.listCounter("cucm01-pub");
await service.listInstance("cucm01-pub", "Cisco CallManager");
```

See [full API documentation](docs/api.md) for all methods, session management, rate limiting, cookie handling, and retry configuration.

## Related Tools

| Package | Description |
|---------|-------------|
| [cisco-axl](https://www.npmjs.com/package/cisco-axl) | Cisco CUCM AXL API library and CLI |
| [cisco-risport](https://www.npmjs.com/package/cisco-risport) | Cisco CUCM RisPort70 real-time device status |
| [cisco-ucce](https://www.npmjs.com/package/cisco-ucce) | Cisco UCCE monitoring and troubleshooting CLI |

## Giving Back

If you found this helpful, consider:

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/automatebldrs)

## License

MIT
