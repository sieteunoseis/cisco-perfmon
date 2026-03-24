# Library API Reference

## Setup

```javascript
// CommonJS
const perfMonService = require("cisco-perfmon");

// ESM
import perfMonService from "cisco-perfmon";
```

## Constructor

```javascript
new perfMonService(host, username, password, options, retry)
```

| Parameter  | Type    | Default | Description                                      |
|------------|---------|---------|--------------------------------------------------|
| `host`     | string  | --      | CUCM IP or FQDN                                  |
| `username` | string  | --      | AXL/admin username (omit if using SSO cookie)    |
| `password` | string  | --      | Password (omit if using SSO cookie)              |
| `options`  | object  | `{}`    | See options below                                |
| `retry`    | boolean | `true`  | Enable/disable automatic retry                   |

### Options

| Option       | Type   | Default | Description                                                           |
|--------------|--------|---------|-----------------------------------------------------------------------|
| `retries`    | number | `3`     | Max retry attempts. Falls back to `PM_RETRY` env var.                 |
| `retryDelay` | number | `5000`  | Delay in ms between retries. Falls back to `PM_RETRY_DELAY` env var.  |
| `Cookie`     | string | --      | Session cookie for SSO authentication                                 |
| _any header_ | string | --      | Additional HTTP headers merged into every request                     |

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

## Methods

### `collectCounterData(host, object)`

Collect counter data without a session.

```javascript
const result = await service.collectCounterData("cucm01-pub", "Cisco CallManager");
// result.results => [{ host, object, instance, counter, value, cstatus }, ...]
```

### `collectSessionData(sessionHandle)`

Collect data for an open session.

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

Add or remove counters from an open session.

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

## Rate Limiting

CUCM enforces an 80 requests/minute limit on Perfmon. This library automatically detects that SOAP fault and applies exponential backoff (30s -> 60s -> 120s) before retrying.

## Cookie Management

Cookies returned by CUCM are automatically captured and reused for subsequent requests.

```javascript
const cookie = service.getCookie();
service.setCookie("JSESSIONIDSSO=abc123");
```

## Environment Variables

| Variable          | Description                          | Default |
|-------------------|--------------------------------------|---------|
| `PM_RETRY`        | Max retry attempts                   | `3`     |
| `PM_RETRY_DELAY`  | Delay in ms between retries          | `5000`  |
