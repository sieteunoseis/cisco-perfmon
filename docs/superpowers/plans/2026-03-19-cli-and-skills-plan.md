# cisco-perfmon CLI & Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CLI (`cisco-perfmon`) and skills.sh skill to the existing cisco-perfmon npm library, enabling admins, developers, and AI agents to interact with Cisco CUCM performance monitoring from the command line.

**Architecture:** Commander.js CLI in plain JS under `cli/`, with a `bin/cisco-perfmon.js` entry point. The CLI imports the library from `main.js`. Four output formatters (table, json, toon, csv). Multi-cluster config stored at `~/.cisco-perfmon/config.json` with optional Secret Server placeholder resolution. A `skills/` folder provides an AI-agent-facing skill for skills.sh.

**Tech Stack:** Commander.js, cli-table3, @toon-format/toon, csv-stringify, update-notifier, Node.js (plain JS for CLI code)

**Spec:** `docs/superpowers/specs/2026-03-19-cli-and-skills-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `bin/cisco-perfmon.js` | CLI entry point (`#!/usr/bin/env node`), loads `cli/index.js` |
| `cli/index.js` | Commander program setup, version, global flags, registers all commands |
| `cli/utils/config.js` | Read/write `~/.cisco-perfmon/config.json`, `<ss:ID:field>` resolution, password masking |
| `cli/utils/connection.js` | Resolve config (flags > env > file), create `perfMonService` instance |
| `cli/utils/audit.js` | JSONL audit logging + 10MB rotation |
| `cli/utils/output.js` | Format and print results using selected formatter, handle errors to stderr |
| `cli/formatters/table.js` | Table formatter using cli-table3 |
| `cli/formatters/json.js` | JSON formatter (pretty-print) |
| `cli/formatters/toon.js` | TOON formatter using @toon-format/toon (async import) |
| `cli/formatters/csv.js` | CSV formatter using csv-stringify |
| `cli/commands/config.js` | `config add/use/list/show/remove/test` subcommands |
| `cli/commands/list-objects.js` | `list-objects [--filter]` |
| `cli/commands/list-instances.js` | `list-instances <object>` |
| `cli/commands/describe.js` | `describe <object> <counter>` |
| `cli/commands/collect.js` | `collect <object> [--instance]` |
| `cli/commands/session.js` | `session open/add/collect/remove/close` |
| `cli/commands/watch.js` | `watch <object> [--interval] [--count]` |
| `skills/cisco-perfmon-cli/SKILL.md` | skills.sh skill definition for AI agents |
| `test/cli/config.test.js` | Tests for config utils |
| `test/cli/connection.test.js` | Tests for connection resolution |
| `test/cli/formatters.test.js` | Tests for all four formatters |

---

## Task 1: Install Dependencies & Update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install CLI dependencies**

```bash
npm install commander cli-table3 @toon-format/toon csv-stringify update-notifier
```

- [ ] **Step 2: Add bin field to package.json**

Add to package.json:

```json
"bin": {
  "cisco-perfmon": "./bin/cisco-perfmon.js"
}
```

- [ ] **Step 3: Create bin entry point**

Create `bin/cisco-perfmon.js`:

```js
#!/usr/bin/env node
require("../cli/index.js");
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json bin/cisco-perfmon.js
git commit -m "feat: add CLI dependencies and bin entry point"
```

---

## Task 2: Config Utility (`cli/utils/config.js`)

**Files:**
- Create: `cli/utils/config.js`
- Create: `test/cli/config.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/cli/config.test.js`:

```js
const assert = require("node:assert/strict");
const { describe, it, beforeEach, afterEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

let configModule;
let testDir;

describe("config utility", () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cisco-perfmon-test-"));
    process.env.CISCO_PERFMON_CONFIG_DIR = testDir;
    delete require.cache[require.resolve("../../cli/utils/config.js")];
    configModule = require("../../cli/utils/config.js");
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.CISCO_PERFMON_CONFIG_DIR;
  });

  it("addCluster creates config file and sets active cluster", () => {
    configModule.addCluster("lab", { host: "10.0.0.1", username: "admin", password: "secret" });
    const config = configModule.loadConfig();
    assert.equal(config.activeCluster, "lab");
    assert.equal(config.clusters.lab.host, "10.0.0.1");
  });

  it("addCluster second cluster does not overwrite active", () => {
    configModule.addCluster("lab", { host: "10.0.0.1", username: "admin", password: "secret" });
    configModule.addCluster("prod", { host: "10.0.0.2", username: "admin", password: "secret" });
    const config = configModule.loadConfig();
    assert.equal(config.activeCluster, "lab");
  });

  it("useCluster switches active cluster", () => {
    configModule.addCluster("lab", { host: "10.0.0.1", username: "admin", password: "secret" });
    configModule.addCluster("prod", { host: "10.0.0.2", username: "admin", password: "secret" });
    configModule.useCluster("prod");
    assert.equal(configModule.loadConfig().activeCluster, "prod");
  });

  it("useCluster throws for unknown cluster", () => {
    assert.throws(() => configModule.useCluster("nonexistent"), /not found/);
  });

  it("removeCluster removes a cluster", () => {
    configModule.addCluster("lab", { host: "10.0.0.1", username: "admin", password: "secret" });
    configModule.removeCluster("lab");
    assert.equal(configModule.loadConfig().clusters.lab, undefined);
  });

  it("getActiveCluster returns resolved cluster config", () => {
    configModule.addCluster("lab", { host: "10.0.0.1", username: "admin", password: "secret" });
    const cluster = configModule.getActiveCluster();
    assert.equal(cluster.host, "10.0.0.1");
    assert.equal(cluster.name, "lab");
  });

  it("maskPassword replaces password with asterisks", () => {
    assert.equal(configModule.maskPassword("secret"), "******");
    assert.equal(configModule.maskPassword("<ss:123:password>"), "<ss:123:password>");
  });

  it("hasSsPlaceholders detects <ss:ID:field> patterns", () => {
    assert.equal(configModule.hasSsPlaceholders({ password: "<ss:123:password>" }), true);
    assert.equal(configModule.hasSsPlaceholders({ password: "plaintext" }), false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/cli/config.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement config utility**

Create `cli/utils/config.js`:

```js
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execSync } = require("node:child_process");

const SS_PLACEHOLDER_RE = /<ss:(\d+):(\w+)>/g;

function getConfigDir() {
  return process.env.CISCO_PERFMON_CONFIG_DIR || path.join(os.homedir(), ".cisco-perfmon");
}

function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

function loadConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { activeCluster: null, clusters: {} };
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function addCluster(name, opts) {
  const config = loadConfig();
  config.clusters[name] = { host: opts.host, username: opts.username, password: opts.password };
  if (opts.insecure) { config.clusters[name].insecure = true; }
  if (!config.activeCluster) { config.activeCluster = name; }
  saveConfig(config);
}

function useCluster(name) {
  const config = loadConfig();
  if (!config.clusters[name]) {
    throw new Error(`Cluster "${name}" not found. Run "cisco-perfmon config list" to see available clusters.`);
  }
  config.activeCluster = name;
  saveConfig(config);
}

function removeCluster(name) {
  const config = loadConfig();
  if (!config.clusters[name]) { throw new Error(`Cluster "${name}" not found.`); }
  delete config.clusters[name];
  if (config.activeCluster === name) {
    const remaining = Object.keys(config.clusters);
    config.activeCluster = remaining.length > 0 ? remaining[0] : null;
  }
  saveConfig(config);
}

function getActiveCluster(clusterName) {
  const config = loadConfig();
  const name = clusterName || config.activeCluster;
  if (!name || !config.clusters[name]) { return null; }
  return { name, ...config.clusters[name] };
}

function listClusters() {
  const config = loadConfig();
  return { activeCluster: config.activeCluster, clusters: config.clusters };
}

function maskPassword(password) {
  if (!password) return "";
  if (SS_PLACEHOLDER_RE.test(password)) { SS_PLACEHOLDER_RE.lastIndex = 0; return password; }
  return "*".repeat(password.length);
}

function hasSsPlaceholders(obj) {
  for (const value of Object.values(obj)) {
    if (typeof value === "string" && SS_PLACEHOLDER_RE.test(value)) {
      SS_PLACEHOLDER_RE.lastIndex = 0; return true;
    }
  }
  return false;
}

function resolveSsPlaceholders(obj) {
  const resolved = { ...obj };
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value !== "string") continue;
    SS_PLACEHOLDER_RE.lastIndex = 0;
    resolved[key] = value.replace(SS_PLACEHOLDER_RE, (match, id, field) => {
      try {
        const output = execSync(`ss-cli get ${id} --format json`, { encoding: "utf-8", timeout: 10000 });
        const secret = JSON.parse(output);
        if (secret[field] !== undefined) return secret[field];
        if (Array.isArray(secret.items)) {
          const item = secret.items.find((i) => i.fieldName === field || i.slug === field);
          if (item) return item.itemValue;
        }
        throw new Error(`Field "${field}" not found in secret ${id}`);
      } catch (err) {
        if (err.message.includes("ENOENT") || err.message.includes("not found")) {
          throw new Error(`Config contains Secret Server references (<ss:...>) but ss-cli is not available. Install with: npm install -g @sieteunoseis/ss-cli`);
        }
        throw err;
      }
    });
  }
  return resolved;
}

module.exports = {
  getConfigDir, loadConfig, saveConfig, addCluster, useCluster, removeCluster,
  getActiveCluster, listClusters, maskPassword, hasSsPlaceholders, resolveSsPlaceholders,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/cli/config.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/utils/config.js test/cli/config.test.js
git commit -m "feat: add config utility with multi-cluster support"
```

---

## Task 3: Connection Utility (`cli/utils/connection.js`)

**Files:**
- Create: `cli/utils/connection.js`
- Create: `test/cli/connection.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/cli/connection.test.js`:

```js
const assert = require("node:assert/strict");
const { describe, it, beforeEach, afterEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

let testDir;

describe("connection utility", () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cisco-perfmon-conn-test-"));
    process.env.CISCO_PERFMON_CONFIG_DIR = testDir;
    delete require.cache[require.resolve("../../cli/utils/config.js")];
    delete require.cache[require.resolve("../../cli/utils/connection.js")];
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.CISCO_PERFMON_CONFIG_DIR;
    delete process.env.CUCM_HOST;
    delete process.env.CUCM_HOSTNAME;
    delete process.env.CUCM_USERNAME;
    delete process.env.CUCM_PASSWORD;
  });

  it("resolves from environment variables", () => {
    process.env.CUCM_HOST = "10.0.0.1";
    process.env.CUCM_USERNAME = "admin";
    process.env.CUCM_PASSWORD = "secret";
    const { resolveConfig } = require("../../cli/utils/connection.js");
    const result = resolveConfig({});
    assert.equal(result.host, "10.0.0.1");
    assert.equal(result.username, "admin");
  });

  it("accepts CUCM_HOSTNAME as alias for CUCM_HOST", () => {
    process.env.CUCM_HOSTNAME = "10.0.0.2";
    process.env.CUCM_USERNAME = "admin";
    process.env.CUCM_PASSWORD = "secret";
    const { resolveConfig } = require("../../cli/utils/connection.js");
    const result = resolveConfig({});
    assert.equal(result.host, "10.0.0.2");
  });

  it("CLI flags take precedence over env vars", () => {
    process.env.CUCM_HOST = "10.0.0.1";
    process.env.CUCM_USERNAME = "admin";
    process.env.CUCM_PASSWORD = "secret";
    const { resolveConfig } = require("../../cli/utils/connection.js");
    const result = resolveConfig({ host: "10.0.0.9", username: "override", password: "override" });
    assert.equal(result.host, "10.0.0.9");
  });

  it("throws when no config available", () => {
    const { resolveConfig } = require("../../cli/utils/connection.js");
    assert.throws(() => resolveConfig({}), /No cluster configured/);
  });

  it("resolves from config file", () => {
    const configUtil = require("../../cli/utils/config.js");
    configUtil.addCluster("lab", { host: "10.0.0.1", username: "admin", password: "secret" });
    const { resolveConfig } = require("../../cli/utils/connection.js");
    const result = resolveConfig({});
    assert.equal(result.host, "10.0.0.1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/cli/connection.test.js
```

- [ ] **Step 3: Implement connection utility**

Create `cli/utils/connection.js`:

```js
const configUtil = require("./config.js");

function resolveConfig(flags) {
  const env = {
    host: process.env.CUCM_HOST || process.env.CUCM_HOSTNAME || undefined,
    username: process.env.CUCM_USERNAME || undefined,
    password: process.env.CUCM_PASSWORD || undefined,
  };

  let fileConfig = {};
  const cluster = configUtil.getActiveCluster(flags.cluster || undefined);
  if (cluster) { fileConfig = cluster; }

  const resolved = {
    host: flags.host || env.host || fileConfig.host,
    username: flags.username || env.username || fileConfig.username,
    password: flags.password || env.password || fileConfig.password,
    insecure: flags.insecure || fileConfig.insecure || false,
  };

  if (!resolved.host || !resolved.username || !resolved.password) {
    throw new Error(
      "No cluster configured. Set one up with:\n" +
      "  cisco-perfmon config add <name> --host <h> --username <u> --password <p>\n" +
      "  Or set environment variables: CUCM_HOST, CUCM_USERNAME, CUCM_PASSWORD"
    );
  }

  if (configUtil.hasSsPlaceholders(resolved)) {
    const resolvedSecrets = configUtil.resolveSsPlaceholders(resolved);
    Object.assign(resolved, resolvedSecrets);
  }

  return resolved;
}

function createService(connConfig) {
  const perfMonService = require("../../main.js");
  return new perfMonService(connConfig.host, connConfig.username, connConfig.password);
}

module.exports = { resolveConfig, createService };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/cli/connection.test.js
```

- [ ] **Step 5: Commit**

```bash
git add cli/utils/connection.js test/cli/connection.test.js
git commit -m "feat: add connection utility with config precedence"
```

---

## Task 4: Audit Utility (`cli/utils/audit.js`)

**Files:**
- Create: `cli/utils/audit.js`

- [ ] **Step 1: Implement audit utility**

Create `cli/utils/audit.js`:

```js
const fs = require("node:fs");
const path = require("node:path");
const { getConfigDir } = require("./config.js");

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getAuditPath() { return path.join(getConfigDir(), "audit.jsonl"); }

function rotateIfNeeded(auditPath) {
  try {
    const stats = fs.statSync(auditPath);
    if (stats.size >= MAX_FILE_SIZE) {
      const rotated = auditPath + ".1";
      if (fs.existsSync(rotated)) { fs.unlinkSync(rotated); }
      fs.renameSync(auditPath, rotated);
    }
  } catch { /* file doesn't exist yet */ }
}

function log(entry) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
  const auditPath = getAuditPath();
  rotateIfNeeded(auditPath);
  fs.appendFileSync(auditPath, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n");
}

module.exports = { log };
```

- [ ] **Step 2: Commit**

```bash
git add cli/utils/audit.js
git commit -m "feat: add audit JSONL logging with rotation"
```

---

## Task 5: Formatters

**Files:**
- Create: `cli/formatters/table.js`
- Create: `cli/formatters/json.js`
- Create: `cli/formatters/toon.js`
- Create: `cli/formatters/csv.js`
- Create: `test/cli/formatters.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/cli/formatters.test.js`:

```js
const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

describe("formatters", () => {
  describe("table formatter", () => {
    it("formats array of objects as table string", () => {
      const fmt = require("../../cli/formatters/table.js");
      const result = fmt([{ name: "Processor", value: "3" }]);
      assert.ok(result.includes("name"));
      assert.ok(result.includes("Processor"));
    });

    it("returns 'No results found' for empty array", () => {
      const fmt = require("../../cli/formatters/table.js");
      assert.equal(fmt([]), "No results found");
    });

    it("formats single object as key-value table", () => {
      const fmt = require("../../cli/formatters/table.js");
      const result = fmt({ host: "10.0.0.1", object: "Processor" });
      assert.ok(result.includes("host"));
      assert.ok(result.includes("10.0.0.1"));
    });
  });

  describe("json formatter", () => {
    it("formats array as pretty JSON", () => {
      const fmt = require("../../cli/formatters/json.js");
      const result = fmt([{ name: "Processor" }]);
      assert.ok(result.includes('"name"'));
      assert.ok(result.includes('"Processor"'));
    });
  });

  describe("csv formatter", () => {
    it("formats array as CSV with header", () => {
      const fmt = require("../../cli/formatters/csv.js");
      const result = fmt([{ host: "10.0.0.1", value: "3" }]);
      assert.ok(result.includes("host,value"));
      assert.ok(result.includes("10.0.0.1"));
    });
  });

  describe("toon formatter", () => {
    it("formats array as TOON string", async () => {
      const fmt = require("../../cli/formatters/toon.js");
      const result = await fmt([{ host: "10.0.0.1", value: "3" }]);
      assert.ok(typeof result === "string");
      assert.ok(result.length > 0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/cli/formatters.test.js
```

- [ ] **Step 3: Implement formatters**

Create `cli/formatters/table.js`:

```js
const Table = require("cli-table3");

function formatTable(data) {
  if (Array.isArray(data)) { return formatListTable(data); }
  return formatItemTable(data);
}

function formatListTable(rows) {
  if (rows.length === 0) return "No results found";
  const columns = Object.keys(rows[0]);
  const table = new Table({ head: columns });
  for (const row of rows) { table.push(columns.map((col) => String(row[col] ?? ""))); }
  return `${table.toString()}\n${rows.length} result${rows.length !== 1 ? "s" : ""} found`;
}

function formatItemTable(item) {
  const table = new Table();
  for (const [key, value] of Object.entries(item)) {
    const displayValue = typeof value === "object" && value !== null
      ? JSON.stringify(value, null, 2)
      : String(value ?? "");
    table.push({ [key]: displayValue });
  }
  return table.toString();
}

module.exports = formatTable;
```

Create `cli/formatters/json.js`:

```js
function formatJson(data) {
  return JSON.stringify(data, null, 2);
}
module.exports = formatJson;
```

Create `cli/formatters/toon.js`:

```js
async function formatToon(data) {
  const { encode } = await import("@toon-format/toon");
  return encode(data);
}
module.exports = formatToon;
```

Create `cli/formatters/csv.js`:

```js
const { stringify } = require("csv-stringify/sync");

function formatCsv(data) {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  return stringify(rows, { header: true, columns });
}
module.exports = formatCsv;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/cli/formatters.test.js
```

- [ ] **Step 5: Commit**

```bash
git add cli/formatters/ test/cli/formatters.test.js
git commit -m "feat: add table/json/toon/csv formatters"
```

---

## Task 6: Output Utility (`cli/utils/output.js`)

**Files:**
- Create: `cli/utils/output.js`

- [ ] **Step 1: Implement output utility**

Create `cli/utils/output.js`:

```js
const formatTable = require("../formatters/table.js");
const formatJson = require("../formatters/json.js");
const formatToon = require("../formatters/toon.js");
const formatCsv = require("../formatters/csv.js");

const formatters = { table: formatTable, json: formatJson, toon: formatToon, csv: formatCsv };

async function printResult(data, format) {
  const formatter = formatters[format || "table"];
  if (!formatter) { throw new Error(`Unknown format "${format}". Valid: table, json, toon, csv`); }
  const output = await Promise.resolve(formatter(data));
  console.log(output);
}

function printError(err) {
  const message = err.message || String(err);
  process.stderr.write(`Error: ${message}\n`);
  if (message.includes("Authentication failed") || message.includes("401") || message.includes("403")) {
    process.stderr.write('Hint: Run "cisco-perfmon config test" to verify your credentials.\n');
  } else if (message.includes("No cluster configured")) {
    // already has instructions in the message
  } else if (message.includes("Exceeded allowed rate")) {
    process.stderr.write("Hint: Wait 30 seconds and try again, or reduce polling frequency with --interval.\n");
  } else if (message.includes("not found") || message.includes("Not Found")) {
    process.stderr.write('Hint: Run "cisco-perfmon list-objects" to see available objects.\n');
  }
  process.exitCode = 1;
}

module.exports = { printResult, printError };
```

- [ ] **Step 2: Commit**

```bash
git add cli/utils/output.js
git commit -m "feat: add output utility with format dispatch and error hints"
```

---

## Task 7: CLI Entry Point (`cli/index.js`)

**Files:**
- Create: `cli/index.js`

- [ ] **Step 1: Implement CLI entry point**

Create `cli/index.js`:

```js
const { Command } = require("commander");
const pkg = require("../package.json");

import("update-notifier").then(({ default: updateNotifier }) => {
  updateNotifier({ pkg }).notify();
}).catch(() => {});

const program = new Command();

program
  .name("cisco-perfmon")
  .description("CLI for Cisco CUCM Performance Monitoring via SOAP")
  .version(pkg.version)
  .option("--format <type>", "output format: table, json, toon, csv", "table")
  .option("--host <host>", "CUCM hostname (overrides config/env)")
  .option("--username <user>", "CUCM username (overrides config/env)")
  .option("--password <pass>", "CUCM password (overrides config/env)")
  .option("--cluster <name>", "use a specific named cluster")
  .option("--insecure", "skip TLS certificate verification")
  .option("--no-audit", "disable audit logging for this command")
  .option("--debug", "enable debug logging");

require("./commands/config.js")(program);
require("./commands/list-objects.js")(program);
require("./commands/list-instances.js")(program);
require("./commands/describe.js")(program);
require("./commands/collect.js")(program);
require("./commands/session.js")(program);
require("./commands/watch.js")(program);

program.parse();
```

- [ ] **Step 2: Commit**

```bash
git add cli/index.js
git commit -m "feat: add CLI entry point with global flags"
```

---

## Task 8: Config Command (`cli/commands/config.js`)

**Files:**
- Create: `cli/commands/config.js`

- [ ] **Step 1: Implement config command**

Create `cli/commands/config.js`:

```js
const configUtil = require("../utils/config.js");
const { printResult, printError } = require("../utils/output.js");

module.exports = function (program) {
  const config = program.command("config").description("Manage CUCM cluster configurations");

  config
    .command("add <name>")
    .description("Add a CUCM cluster (requires global --host, --username, --password)")
    .option("--insecure", "skip TLS verification for this cluster")
    .action((name, opts, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const host = globalOpts.host;
        const username = globalOpts.username;
        const password = globalOpts.password;
        if (!host) throw new Error("Missing required option: --host");
        if (!username) throw new Error("Missing required option: --username");
        if (!password) throw new Error("Missing required option: --password");
        const clusterOpts = { host, username, password };
        if (opts.insecure || globalOpts.insecure) clusterOpts.insecure = true;
        configUtil.addCluster(name, clusterOpts);
        console.log(`Cluster "${name}" added successfully.`);
      } catch (err) { printError(err); }
    });

  config
    .command("use <name>")
    .description("Set the active cluster")
    .action((name) => {
      try { configUtil.useCluster(name); console.log(`Active cluster set to "${name}".`); }
      catch (err) { printError(err); }
    });

  config
    .command("list")
    .description("List all configured clusters")
    .action(async () => {
      try {
        const { activeCluster, clusters } = configUtil.listClusters();
        const rows = Object.entries(clusters).map(([name, c]) => ({
          name, active: name === activeCluster ? "*" : "", host: c.host, username: c.username,
        }));
        if (rows.length === 0) { console.log("No clusters configured. Run: cisco-perfmon config add <name> ..."); return; }
        await printResult(rows, program.opts().format);
      } catch (err) { printError(err); }
    });

  config
    .command("show")
    .description("Show active cluster details (masks passwords)")
    .action(async () => {
      try {
        const cluster = configUtil.getActiveCluster(program.opts().cluster);
        if (!cluster) { console.log("No active cluster. Run: cisco-perfmon config add <name> ..."); return; }
        await printResult({ ...cluster, password: configUtil.maskPassword(cluster.password) }, program.opts().format);
      } catch (err) { printError(err); }
    });

  config
    .command("remove <name>")
    .description("Remove a cluster")
    .action((name) => {
      try { configUtil.removeCluster(name); console.log(`Cluster "${name}" removed.`); }
      catch (err) { printError(err); }
    });

  config
    .command("test")
    .description("Test connection to the active cluster via listCounter")
    .action(async () => {
      try {
        const globalOpts = program.opts();
        const { resolveConfig, createService } = require("../utils/connection.js");
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        const svc = createService(connConfig);
        const result = await svc.listCounter(connConfig.host);
        const count = Array.isArray(result.results) ? result.results.length : 0;
        console.log(`Connection successful. Found ${count} perfmon object(s).`);
      } catch (err) { printError(err); }
    });
};
```

- [ ] **Step 2: Commit**

```bash
git add cli/commands/config.js
git commit -m "feat: add config command (add/use/list/show/remove/test)"
```

---

## Task 9: List-Objects Command (`cli/commands/list-objects.js`)

**Files:**
- Create: `cli/commands/list-objects.js`

- [ ] **Step 1: Implement list-objects command**

Create `cli/commands/list-objects.js`:

```js
const { resolveConfig, createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  program
    .command("list-objects")
    .description("List available perfmon objects on the cluster")
    .option("--filter <keyword>", "filter objects by keyword (case-insensitive)")
    .action(async (opts) => {
      const start = Date.now();
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        if (globalOpts.debug) { process.env.DEBUG = "cisco-perfmon"; }

        const svc = createService(connConfig);
        const result = await svc.listCounter(connConfig.host);
        let objects = Array.isArray(result.results) ? result.results : [];

        if (opts.filter) {
          const keyword = opts.filter.toLowerCase();
          objects = objects.filter((o) => (o.Name || o).toLowerCase().includes(keyword));
        }

        const rows = objects.map((o) => ({ name: o.Name || o }));

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "list-objects", filter: opts.filter || null, duration_ms: Date.now() - start, status: "success", rows: rows.length });
        }

        await printResult(rows, globalOpts.format);
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({ command: "list-objects", duration_ms: Date.now() - start, status: "error", error: err.message });
        }
        printError(err);
      }
    });
};
```

- [ ] **Step 2: Commit**

```bash
git add cli/commands/list-objects.js
git commit -m "feat: add list-objects command"
```

---

## Task 10: List-Instances Command (`cli/commands/list-instances.js`)

**Files:**
- Create: `cli/commands/list-instances.js`

- [ ] **Step 1: Implement list-instances command**

Create `cli/commands/list-instances.js`:

```js
const { resolveConfig, createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  program
    .command("list-instances <object>")
    .description("List instances of a perfmon object")
    .action(async (object) => {
      const start = Date.now();
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        if (globalOpts.debug) { process.env.DEBUG = "cisco-perfmon"; }

        const svc = createService(connConfig);
        const result = await svc.listInstance(connConfig.host, object);
        const instances = Array.isArray(result.results) ? result.results : (result.results ? [result.results] : []);
        const rows = instances.map((i) => ({ instance: i.Name || i }));

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "list-instances", args: object, duration_ms: Date.now() - start, status: "success", rows: rows.length });
        }

        await printResult(rows, globalOpts.format);
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({ command: "list-instances", args: object, duration_ms: Date.now() - start, status: "error", error: err.message });
        }
        printError(err);
      }
    });
};
```

- [ ] **Step 2: Commit**

```bash
git add cli/commands/list-instances.js
git commit -m "feat: add list-instances command"
```

---

## Task 11: Describe Command (`cli/commands/describe.js`)

**Files:**
- Create: `cli/commands/describe.js`

- [ ] **Step 1: Implement describe command**

Create `cli/commands/describe.js`:

```js
const { resolveConfig, createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  program
    .command("describe <object> <counter>")
    .description("Get description of a specific perfmon counter")
    .action(async (object, counter) => {
      const start = Date.now();
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        if (globalOpts.debug) { process.env.DEBUG = "cisco-perfmon"; }

        const svc = createService(connConfig);
        const result = await svc.queryCounterDescription({
          host: connConfig.host,
          object,
          counter,
        });

        const description = result.results
          ? (typeof result.results === "string" ? result.results : JSON.stringify(result.results))
          : "No description available.";

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "describe", args: `${object} ${counter}`, duration_ms: Date.now() - start, status: "success" });
        }

        await printResult({ object, counter, description }, globalOpts.format);
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({ command: "describe", args: `${object} ${counter}`, duration_ms: Date.now() - start, status: "error", error: err.message });
        }
        printError(err);
      }
    });
};
```

- [ ] **Step 2: Commit**

```bash
git add cli/commands/describe.js
git commit -m "feat: add describe command for counter descriptions"
```

---

## Task 12: Collect Command (`cli/commands/collect.js`)

**Files:**
- Create: `cli/commands/collect.js`

- [ ] **Step 1: Implement collect command**

Create `cli/commands/collect.js`:

```js
const { resolveConfig, createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  program
    .command("collect <object>")
    .description("One-shot collection of all counters for a perfmon object")
    .option("--instance <name>", "filter to a specific instance")
    .action(async (object, opts) => {
      const start = Date.now();
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        if (globalOpts.debug) { process.env.DEBUG = "cisco-perfmon"; }

        const svc = createService(connConfig);
        const result = await svc.collectCounterData(connConfig.host, object);
        let rows = Array.isArray(result.results) ? result.results : (result.results ? [result.results] : []);

        if (opts.instance) {
          rows = rows.filter((r) => r.instance === opts.instance);
        }

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "collect", args: object, duration_ms: Date.now() - start, status: "success", rows: rows.length });
        }

        await printResult(rows, globalOpts.format);
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({ command: "collect", args: object, duration_ms: Date.now() - start, status: "error", error: err.message });
        }
        printError(err);
      }
    });
};
```

- [ ] **Step 2: Commit**

```bash
git add cli/commands/collect.js
git commit -m "feat: add collect command for one-shot counter data"
```

---

## Task 13: Session Command (`cli/commands/session.js`)

**Files:**
- Create: `cli/commands/session.js`

- [ ] **Step 1: Implement session command**

Create `cli/commands/session.js`:

```js
const { resolveConfig, createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  const session = program.command("session").description("Manage perfmon polling sessions");

  session
    .command("open")
    .description("Open a new perfmon session")
    .action(async (opts, cmd) => {
      const start = Date.now();
      try {
        const globalOpts = cmd.optsWithGlobals();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }

        const svc = createService(connConfig);
        const result = await svc.openSession();
        const handle = result.results;

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "session open", duration_ms: Date.now() - start, status: "success" });
        }

        if (globalOpts.format === "table" || globalOpts.format === undefined) {
          console.log(`Session handle: ${handle}`);
        } else {
          await printResult({ sessionHandle: handle }, globalOpts.format);
        }
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({ command: "session open", duration_ms: Date.now() - start, status: "error", error: err.message });
        }
        printError(err);
      }
    });

  session
    .command("add <sessionHandle> <object>")
    .description("Add a counter to a session")
    .requiredOption("--counter <name>", "counter name to add")
    .option("--instance <name>", "specific instance")
    .action(async (sessionHandle, object, opts, cmd) => {
      const start = Date.now();
      try {
        const globalOpts = cmd.optsWithGlobals();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }

        const counter = { host: connConfig.host, object, counter: opts.counter };
        if (opts.instance) { counter.instance = opts.instance; }

        const svc = createService(connConfig);
        await svc.addCounter(sessionHandle, counter);

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "session add", args: `${object} ${opts.counter}`, duration_ms: Date.now() - start, status: "success" });
        }

        console.log(`Counter added to session ${sessionHandle}.`);
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({ command: "session add", duration_ms: Date.now() - start, status: "error", error: err.message });
        }
        printError(err);
      }
    });

  session
    .command("collect <sessionHandle>")
    .description("Collect data for all counters in a session")
    .action(async (sessionHandle, opts, cmd) => {
      const start = Date.now();
      try {
        const globalOpts = cmd.optsWithGlobals();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }

        const svc = createService(connConfig);
        const result = await svc.collectSessionData(sessionHandle);
        const rows = Array.isArray(result.results) ? result.results : (result.results ? [result.results] : []);

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "session collect", duration_ms: Date.now() - start, status: "success", rows: rows.length });
        }

        await printResult(rows, globalOpts.format);
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({ command: "session collect", duration_ms: Date.now() - start, status: "error", error: err.message });
        }
        printError(err);
      }
    });

  session
    .command("remove <sessionHandle> <object>")
    .description("Remove a counter from a session")
    .requiredOption("--counter <name>", "counter name to remove")
    .option("--instance <name>", "specific instance")
    .action(async (sessionHandle, object, opts, cmd) => {
      const start = Date.now();
      try {
        const globalOpts = cmd.optsWithGlobals();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }

        const counter = { host: connConfig.host, object, counter: opts.counter };
        if (opts.instance) { counter.instance = opts.instance; }

        const svc = createService(connConfig);
        await svc.removeCounter(sessionHandle, counter);

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "session remove", args: `${object} ${opts.counter}`, duration_ms: Date.now() - start, status: "success" });
        }

        console.log(`Counter removed from session ${sessionHandle}.`);
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({ command: "session remove", duration_ms: Date.now() - start, status: "error", error: err.message });
        }
        printError(err);
      }
    });

  session
    .command("close <sessionHandle>")
    .description("Close a perfmon session")
    .action(async (sessionHandle, opts, cmd) => {
      const start = Date.now();
      try {
        const globalOpts = cmd.optsWithGlobals();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }

        const svc = createService(connConfig);
        await svc.closeSession(sessionHandle);

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "session close", duration_ms: Date.now() - start, status: "success" });
        }

        console.log(`Session ${sessionHandle} closed.`);
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({ command: "session close", duration_ms: Date.now() - start, status: "error", error: err.message });
        }
        printError(err);
      }
    });
};
```

- [ ] **Step 2: Commit**

```bash
git add cli/commands/session.js
git commit -m "feat: add session command (open/add/collect/remove/close)"
```

---

## Task 14: Watch Command (`cli/commands/watch.js`)

**Files:**
- Create: `cli/commands/watch.js`

- [ ] **Step 1: Implement watch command**

Create `cli/commands/watch.js`:

```js
const { resolveConfig, createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  program
    .command("watch <object>")
    .description("Repeatedly collect counter data at an interval (live monitoring)")
    .option("--interval <seconds>", "polling interval in seconds", "10")
    .option("--count <n>", "number of collections (0 = indefinite)", "0")
    .action(async (object, opts) => {
      const start = Date.now();
      const interval = parseInt(opts.interval, 10) * 1000;
      const maxCount = parseInt(opts.count, 10);
      let iterations = 0;

      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        if (globalOpts.debug) { process.env.DEBUG = "cisco-perfmon"; }

        const svc = createService(connConfig);
        const isTable = !globalOpts.format || globalOpts.format === "table";

        const collect = async () => {
          const result = await svc.collectCounterData(connConfig.host, object);
          const rows = Array.isArray(result.results) ? result.results : (result.results ? [result.results] : []);
          iterations++;

          if (isTable) {
            process.stdout.write("\x1b[2J\x1b[0f");
            process.stdout.write(`cisco-perfmon watch ${object} — ${new Date().toISOString()} (poll #${iterations})\n\n`);
          } else {
            process.stdout.write(`\n--- ${new Date().toISOString()} (poll #${iterations}) ---\n`);
          }

          await printResult(rows, globalOpts.format);
        };

        await collect();

        const run = async () => {
          while (maxCount === 0 || iterations < maxCount) {
            await new Promise((resolve) => setTimeout(resolve, interval));
            await collect();
          }
        };

        await run();

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "watch", args: object, duration_ms: Date.now() - start, status: "success", iterations });
        }
      } catch (err) {
        if (err.code === "ERR_USE_AFTER_CLOSE" || err.message === "interrupted") return;
        if (program.opts().audit !== false) {
          audit.log({ command: "watch", args: object, duration_ms: Date.now() - start, status: "error", error: err.message, iterations });
        }
        printError(err);
      }
    });
};
```

- [ ] **Step 2: Commit**

```bash
git add cli/commands/watch.js
git commit -m "feat: add watch command for live polling"
```

---

## Task 15: Skills.sh Skill (`skills/cisco-perfmon-cli/SKILL.md`)

**Files:**
- Create: `skills/cisco-perfmon-cli/SKILL.md`

- [ ] **Step 1: Create skills directory and SKILL.md**

Create `skills/cisco-perfmon-cli/SKILL.md`:

```markdown
---
name: cisco-perfmon-cli
description: Use when monitoring Cisco CUCM performance metrics — collecting counter data, listing perfmon objects/instances, managing polling sessions, and watching live metrics via the cisco-perfmon CLI.
---

# cisco-perfmon CLI

CLI for querying Cisco CUCM Performance Monitoring (Perfmon) data via SOAP.

## Setup

Configure a cluster (one-time):

```bash
cisco-perfmon config add <name> --host <host> --username <user> --password <pass> --insecure
cisco-perfmon config test
```

Or use environment variables:

```bash
export CUCM_HOST=10.0.0.1
export CUCM_USERNAME=admin
export CUCM_PASSWORD=secret
```

## Discover Available Objects

```bash
cisco-perfmon list-objects
cisco-perfmon list-objects --filter "CallManager"
```

## List Instances of an Object

```bash
cisco-perfmon list-instances Processor
cisco-perfmon list-instances "Cisco CallManager"
```

## Describe a Counter

```bash
cisco-perfmon describe Processor PercentCPUTime
```

## One-Shot Collection

```bash
cisco-perfmon collect Processor
cisco-perfmon collect Processor --instance 0
cisco-perfmon collect "Cisco CallManager"
cisco-perfmon collect Memory --format json
```

Output fields: `host`, `object`, `instance`, `counter`, `value`, `cstatus`

## Session-Based Collection

For sustained polling without re-authenticating:

```bash
# Open a session
cisco-perfmon session open
# → Session handle: abc123def456

# Add counters
cisco-perfmon session add abc123def456 Processor --counter PercentCPUTime
cisco-perfmon session add abc123def456 Memory --counter Total

# Collect all registered counters
cisco-perfmon session collect abc123def456

# Close when done
cisco-perfmon session close abc123def456
```

## Live Monitoring

```bash
cisco-perfmon watch Processor                   # poll every 10s indefinitely
cisco-perfmon watch Processor --interval 5      # poll every 5s
cisco-perfmon watch Processor --count 10        # stop after 10 collections
cisco-perfmon watch Memory --format json        # JSON output
```

## Output Formats

| Format | Use When |
|--------|----------|
| `--format table` | Human viewing (default) |
| `--format json` | Parsing or scripting |
| `--format toon` | AI agent consumption (token-efficient) |
| `--format csv` | Spreadsheet/Excel workflows |

Prefer `--format toon` for AI agent consumption. Use `--format json` when you need to parse the output programmatically.

## Common Patterns

### Check CPU utilization on all cores

```bash
cisco-perfmon collect Processor --format toon
```

### Monitor memory over time

```bash
cisco-perfmon watch Memory --interval 30 --format json
```

### Get all CallManager counters as JSON

```bash
cisco-perfmon collect "Cisco CallManager" --format json
```

### Use a specific cluster

```bash
cisco-perfmon collect Processor --cluster lab
cisco-perfmon collect Processor --host 10.0.0.1 --username admin --password secret --insecure
```

## Troubleshooting

- **Authentication errors:** Run `cisco-perfmon config test`
- **TLS errors:** Add `--insecure` or set `insecure: true` in cluster config
- **Rate limit errors:** The library auto-retries with backoff (80 req/min limit). Reduce `--interval` if watching.
- **Object not found:** Run `cisco-perfmon list-objects` to see valid objects
```

- [ ] **Step 2: Commit**

```bash
git add skills/cisco-perfmon-cli/SKILL.md
git commit -m "feat: add cisco-perfmon-cli skills.sh skill"
```

---

## Task 16: Update .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add docs/superpowers/ to .gitignore**

Add to `.gitignore`:

```
docs/superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore docs/superpowers/ in git"
```

---

## Task 17: Final Integration Test

- [ ] **Step 1: Run all CLI tests**

```bash
node --test test/cli/config.test.js
node --test test/cli/connection.test.js
node --test test/cli/formatters.test.js
```

- [ ] **Step 2: Smoke test the CLI (with a real CUCM if available)**

```bash
node bin/cisco-perfmon.js --help
node bin/cisco-perfmon.js --version
node bin/cisco-perfmon.js config --help
node bin/cisco-perfmon.js list-objects --help
node bin/cisco-perfmon.js session --help
```

- [ ] **Step 3: Verify package installs correctly**

```bash
npm pack --dry-run
```

Verify `bin/cisco-perfmon.js` appears in the file list.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete cisco-perfmon CLI implementation"
```
