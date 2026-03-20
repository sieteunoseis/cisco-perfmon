const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  program
    .command("describe <object>")
    .description("Describe a perfmon counter")
    .option("--counter <name>", "counter name to describe")
    .option("--instance <name>", "instance name")
    .action(async (object, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const start = Date.now();
      try {
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-perfmon";

        const PerfMon = require("../../main.js");
        const svc = new PerfMon(connConfig.host, connConfig.username, connConfig.password);

        const counterObj = {
          host: connConfig.host,
          object: object,
        };
        if (opts.counter) counterObj.counter = opts.counter;
        if (opts.instance) counterObj.instance = opts.instance;

        const result = await svc.queryCounterDescription(counterObj);

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "describe", args: `${object} ${opts.counter || ""}`.trim(), duration_ms: Date.now() - start, status: "success" });
        }

        await printResult(result.results || result, globalOpts.format);
      } catch (err) {
        if (globalOpts.audit !== false) {
          try { audit.log({ cluster: "", command: "describe", args: object, duration_ms: Date.now() - start, status: "error", message: err.message }); } catch {}
        }
        printError(err);
      }
    });
};
