const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  program
    .command("collect <object>")
    .description("Collect perfmon counter data (one-shot)")
    .option("--counter <names>", "comma-separated counter names to filter")
    .option("--instance <name>", "filter by instance name")
    .action(async (object, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const start = Date.now();
      try {
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-perfmon";

        const PerfMon = require("../../main.js");
        const svc = new PerfMon(connConfig.host, connConfig.username, connConfig.password);
        const result = await svc.collectCounterData(connConfig.host, object);

        let rows = Array.isArray(result.results) ? result.results : result.results ? [result.results] : [];

        // Filter by counter names if specified
        if (opts.counter) {
          const counterNames = opts.counter.split(",").map((c) => c.trim());
          rows = rows.filter((r) => counterNames.includes(r.counter));
        }

        // Filter by instance if specified
        if (opts.instance) {
          rows = rows.filter((r) => r.instance === opts.instance);
        }

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "collect", args: object, duration_ms: Date.now() - start, status: "success", rows: rows.length });
        }

        await printResult(rows, globalOpts.format);
      } catch (err) {
        if (globalOpts.audit !== false) {
          try { audit.log({ cluster: "", command: "collect", args: object, duration_ms: Date.now() - start, status: "error", message: err.message }); } catch {}
        }
        printError(err);
      }
    });
};
