const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  program
    .command("list-objects")
    .description("List available perfmon objects")
    .option("--search <keyword>", "filter objects by keyword (case-insensitive)")
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const start = Date.now();
      try {
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-perfmon";

        const PerfMon = require("../../main.js");
        const svc = new PerfMon(connConfig.host, connConfig.username, connConfig.password);
        const result = await svc.listCounter(connConfig.host);

        let objects = Array.isArray(result.results) ? result.results : [];

        // Extract unique object names from counter list
        const objectNames = [...new Set(objects.map((item) => item.Name || item.name).filter(Boolean))];
        let rows = objectNames.map((name) => ({ name }));

        if (opts.search) {
          const keyword = opts.search.toLowerCase();
          rows = rows.filter((r) => r.name.toLowerCase().includes(keyword));
        }

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "list-objects", args: opts.search || "", duration_ms: Date.now() - start, status: "success", rows: rows.length });
        }

        await printResult(rows, globalOpts.format);
      } catch (err) {
        if (globalOpts.audit !== false) {
          try { audit.log({ cluster: "", command: "list-objects", duration_ms: Date.now() - start, status: "error", message: err.message }); } catch {}
        }
        printError(err);
      }
    });
};
