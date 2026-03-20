const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  const session = program.command("session").description("Manage perfmon sessions");

  session
    .command("open")
    .description("Open a new perfmon session")
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const start = Date.now();
      try {
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-perfmon";

        const PerfMon = require("../../main.js");
        const svc = new PerfMon(connConfig.host, connConfig.username, connConfig.password);
        const result = await svc.openSession();

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "session open", duration_ms: Date.now() - start, status: "success" });
        }

        const handle = result.results;
        if (globalOpts.format === "json") {
          await printResult({ sessionHandle: handle }, globalOpts.format);
        } else {
          console.log(`Session handle: ${handle}`);
        }
      } catch (err) {
        if (globalOpts.audit !== false) {
          try { audit.log({ cluster: "", command: "session open", duration_ms: Date.now() - start, status: "error", message: err.message }); } catch {}
        }
        printError(err);
      }
    });

  session
    .command("add <handle>")
    .description("Add counters to a session")
    .option("--counters <json>", "JSON array of counter objects [{host,object,counter,instance?}]")
    .action(async (handle, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const start = Date.now();
      try {
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-perfmon";

        if (!opts.counters) throw new Error("Missing required option: --counters (JSON array of counter objects)");
        const counters = JSON.parse(opts.counters);

        const PerfMon = require("../../main.js");
        const svc = new PerfMon(connConfig.host, connConfig.username, connConfig.password);
        const result = await svc.addCounter(handle, counters);

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "session add", args: handle, duration_ms: Date.now() - start, status: "success" });
        }

        console.log(`Counters added to session ${handle}: ${result.results}`);
      } catch (err) {
        if (globalOpts.audit !== false) {
          try { audit.log({ cluster: "", command: "session add", args: handle, duration_ms: Date.now() - start, status: "error", message: err.message }); } catch {}
        }
        printError(err);
      }
    });

  session
    .command("collect <handle>")
    .description("Collect data from a session")
    .action(async (handle, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const start = Date.now();
      try {
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-perfmon";

        const PerfMon = require("../../main.js");
        const svc = new PerfMon(connConfig.host, connConfig.username, connConfig.password);
        const result = await svc.collectSessionData(handle);

        let rows = Array.isArray(result.results) ? result.results : result.results ? [result.results] : [];

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "session collect", args: handle, duration_ms: Date.now() - start, status: "success", rows: rows.length });
        }

        await printResult(rows, globalOpts.format);
      } catch (err) {
        if (globalOpts.audit !== false) {
          try { audit.log({ cluster: "", command: "session collect", args: handle, duration_ms: Date.now() - start, status: "error", message: err.message }); } catch {}
        }
        printError(err);
      }
    });

  session
    .command("remove <handle>")
    .description("Remove counters from a session")
    .option("--counters <json>", "JSON array of counter objects [{host,object,counter,instance?}]")
    .action(async (handle, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const start = Date.now();
      try {
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-perfmon";

        if (!opts.counters) throw new Error("Missing required option: --counters (JSON array of counter objects)");
        const counters = JSON.parse(opts.counters);

        const PerfMon = require("../../main.js");
        const svc = new PerfMon(connConfig.host, connConfig.username, connConfig.password);
        const result = await svc.removeCounter(handle, counters);

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "session remove", args: handle, duration_ms: Date.now() - start, status: "success" });
        }

        console.log(`Counters removed from session ${handle}: ${result.results}`);
      } catch (err) {
        if (globalOpts.audit !== false) {
          try { audit.log({ cluster: "", command: "session remove", args: handle, duration_ms: Date.now() - start, status: "error", message: err.message }); } catch {}
        }
        printError(err);
      }
    });

  session
    .command("close <handle>")
    .description("Close a perfmon session")
    .action(async (handle, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const start = Date.now();
      try {
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-perfmon";

        const PerfMon = require("../../main.js");
        const svc = new PerfMon(connConfig.host, connConfig.username, connConfig.password);
        const result = await svc.closeSession(handle);

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "session close", args: handle, duration_ms: Date.now() - start, status: "success" });
        }

        console.log(`Session ${handle} closed: ${result.results}`);
      } catch (err) {
        if (globalOpts.audit !== false) {
          try { audit.log({ cluster: "", command: "session close", args: handle, duration_ms: Date.now() - start, status: "error", message: err.message }); } catch {}
        }
        printError(err);
      }
    });
};
