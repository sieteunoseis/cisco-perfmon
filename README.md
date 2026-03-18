# cisco-perfmon

Simple library to pull Perfmon stats from a Cisco CUCM via SOAP.

[![npm](https://img.shields.io/npm/v/cisco-perfmon)](https://www.npmjs.com/package/cisco-perfmon)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Perfmon API reference: [Cisco PerfMon API Reference](https://developer.cisco.com/docs/sxml/#!perfmon-api-reference)

## Installation

```bash
npm i --save cisco-perfmon
```

## Requirements

Node.js 18+ is required (uses the built-in Fetch API).

If you are using self-signed certificates on Cisco VOS products you may need to disable TLS verification. **Only do this in a lab environment.**

```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Usage

### CommonJS

```javascript
const perfMonService = require("cisco-perfmon");
```

### ESM

```javascript
import perfMonService from "cisco-perfmon";
```

### Basic example

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

## Constructor

```javascript
new perfMonService(host, username, password, options, retry)
```

| Parameter  | Type    | Default | Description                                      |
|------------|---------|---------|--------------------------------------------------|
| `host`     | string  | —       | CUCM IP or FQDN                                  |
| `username` | string  | —       | AXL/admin username (omit if using SSO cookie)    |
| `password` | string  | —       | Password (omit if using SSO cookie)              |
| `options`  | object  | `{}`    | See options below                                |
| `retry`    | boolean | `true`  | Enable/disable automatic retry                   |

### Options

| Option       | Type   | Default | Description                                                           |
|--------------|--------|---------|-----------------------------------------------------------------------|
| `retries`    | number | `3`     | Max retry attempts. Falls back to `PM_RETRY` env var.                 |
| `retryDelay` | number | `5000`  | Delay in ms between retries. Falls back to `PM_RETRY_DELAY` env var.  |
| `Cookie`     | string | —       | Session cookie for SSO authentication                                 |
| _any header_ | string | —       | Additional HTTP headers merged into every request                     |

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

## Rate Limiting

CUCM enforces an 80 requests/minute limit on Perfmon. This library automatically detects that SOAP fault and applies exponential backoff (30s → 60s → 120s) before retrying.

## Cookie Management

Cookies returned by CUCM are automatically captured and reused for subsequent requests.

```javascript
// Get the current stored cookie
const cookie = service.getCookie();

// Set a cookie manually (e.g. from a prior session)
service.setCookie("JSESSIONIDSSO=abc123");
```

## Methods

### `collectCounterData(host, object)`

Collect counter data without a session.

```javascript
const result = await service.collectCounterData("cucm01-pub", "Cisco CallManager");
// result.results => [{ host, object, instance, counter, value, cstatus }, ...]
```

### `collectSessionData(sessionHandle)`

Collect data for an open session.

```javascript
const result = await service.collectSessionData(sessionHandle);
```

### `listCounter(host, filtered?)`

List all available counters on a host, with optional name filtering.

```javascript
const result = await service.listCounter("cucm01-pub");
const filtered = await service.listCounter("cucm01-pub", ["Cisco CallManager", "Memory"]);
```

### `listInstance(host, object)`

List instances of a perfmon object.

```javascript
const result = await service.listInstance("cucm01-pub", "Cisco CallManager");
```

### `openSession()` / `closeSession(sessionHandle)`

Open and close a polling session.

```javascript
const opened = await service.openSession();
const sessionHandle = opened.results;
// ... collect data ...
await service.closeSession(sessionHandle);
```

### `addCounter(sessionHandle, counter)` / `removeCounter(sessionHandle, counter)`

Add or remove counters from an open session. Accepts a single counter object or an array.

```javascript
await service.addCounter(sessionHandle, {
  host: "cucm01-pub",
  object: "Cisco CallManager",
  instance: "",
  counter: "CallsActive",
});
```

### `queryCounterDescription(counter)`

Get the description of a counter.

```javascript
const result = await service.queryCounterDescription({
  host: "cucm01-pub",
  object: "Cisco CallManager",
  instance: "",
  counter: "CallsActive",
});
```

## Output Examples

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

## Environment Variables

These are supported as fallbacks when constructor options are not provided:

| Variable          | Description                          | Default |
|-------------------|--------------------------------------|---------|
| `PM_RETRY`        | Max retry attempts                   | `3`     |
| `PM_RETRY_DELAY`  | Delay in ms between retries          | `5000`  |

## Examples

```bash
npm run test
```

Tests use [Cisco DevNet Sandbox](https://devnetsandbox.cisco.com/) credentials.
