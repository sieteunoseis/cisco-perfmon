const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  program
    .command("list-instances <object>")
    .description("List instances of a perfmon object")
    .action(async (object, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const start = Date.now();
      try {
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-perfmon";

        const PerfMon = require("../../main.js");
        const svc = new PerfMon(connConfig.host, connConfig.username, connConfig.password);
        const result = await svc.listInstance(connConfig.host, object);

        let instances = Array.isArray(result.results) ? result.results : [];
        const rows = instances.map((item) => {
          if (typeof item === "string") return { instance: item };
          return { instance: item.Name || item.name || JSON.stringify(item) };
        });

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "list-instances", args: object, duration_ms: Date.now() - start, status: "success", rows: rows.length });
        }

        await printResult(rows, globalOpts.format);
      } catch (err) {
        if (globalOpts.audit !== false) {
          try { audit.log({ cluster: "", command: "list-instances", args: object, duration_ms: Date.now() - start, status: "error", message: err.message }); } catch {}
        }
        printError(err);
      }
    });
};
