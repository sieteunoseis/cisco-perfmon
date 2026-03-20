const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

const SPARK_CHARS = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";

function sparkline(values) {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => SPARK_CHARS[Math.min(Math.floor(((v - min) / range) * 7), 7)]).join("");
}

function avg(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function watchCommand(program) {
  program
    .command("watch <object>")
    .description("Continuously poll perfmon counters with live sparklines")
    .option("--counter <names>", "comma-separated counter names to watch")
    .option("--instance <name>", "filter by instance name")
    .option("--interval <seconds>", "polling interval in seconds", "10")
    .option("--duration <seconds>", "stop after N seconds (default: indefinite)")
    .action(async (object, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const interval = parseInt(opts.interval, 10) * 1000;
      const duration = opts.duration ? parseInt(opts.duration, 10) * 1000 : 0;
      const counterFilter = opts.counter ? opts.counter.split(",").map((c) => c.trim()) : null;
      const start = Date.now();
      let iterations = 0;

      try {
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-perfmon";

        const PerfMon = require("../../main.js");
        const svc = new PerfMon(connConfig.host, connConfig.username, connConfig.password);

        // Rolling history: key = "object|instance|counter", value = number[]
        const history = {};
        const MAX_SAMPLES = 12;
        let running = true;

        const cleanup = () => {
          running = false;
          // Print final summary
          console.log("\n");
          console.log("Watch stopped. Final summary:");
          console.log(`  Iterations: ${iterations}`);
          console.log(`  Duration: ${((Date.now() - start) / 1000).toFixed(1)}s`);

          if (globalOpts.audit !== false) {
            try { audit.log({ cluster: connConfig.host, command: "watch", args: object, duration_ms: Date.now() - start, status: "success", iterations }); } catch {}
          }

          process.exit(0);
        };

        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);

        const poll = async () => {
          try {
            const result = await svc.collectCounterData(connConfig.host, object);
            let rows = Array.isArray(result.results) ? result.results : result.results ? [result.results] : [];

            if (counterFilter) {
              rows = rows.filter((r) => counterFilter.includes(r.counter));
            }
            if (opts.instance) {
              rows = rows.filter((r) => r.instance === opts.instance);
            }

            // Update history
            for (const row of rows) {
              const key = `${row.object}|${row.instance || ""}|${row.counter}`;
              if (!history[key]) history[key] = [];
              const numVal = parseFloat(row.value);
              if (!isNaN(numVal)) {
                history[key].push(numVal);
                if (history[key].length > MAX_SAMPLES) history[key].shift();
              }
            }

            iterations++;

            if (globalOpts.format !== "table") {
              // Non-table formats: print timestamped blocks
              console.log(`\n--- ${new Date().toISOString()} (sample ${iterations}) ---`);
              await printResult(rows, globalOpts.format);
            } else {
              // Table format: clear and redraw with sparklines
              process.stdout.write("\x1b[2J\x1b[0f");
              console.log(`cisco-perfmon watch: ${object} | interval: ${opts.interval}s | sample: ${iterations} | ${new Date().toISOString()}\n`);

              const Table = require("cli-table3");
              const table = new Table({ head: ["counter", "instance", "value", "sparkline", "min", "max", "avg"] });

              for (const row of rows) {
                const key = `${row.object}|${row.instance || ""}|${row.counter}`;
                const values = history[key] || [];
                const numVal = parseFloat(row.value);
                const numValues = values.filter((v) => !isNaN(v));

                table.push([
                  row.counter,
                  row.instance || "",
                  row.value,
                  sparkline(numValues),
                  numValues.length > 0 ? Math.min(...numValues).toFixed(1) : "-",
                  numValues.length > 0 ? Math.max(...numValues).toFixed(1) : "-",
                  numValues.length > 0 ? avg(numValues).toFixed(1) : "-",
                ]);
              }

              console.log(table.toString());
              console.log(`\n${rows.length} counter${rows.length !== 1 ? "s" : ""} | Press Ctrl+C to stop`);
            }
          } catch (err) {
            process.stderr.write(`\nPoll error: ${err.message || err}\n`);
          }
        };

        // Initial poll
        await poll();

        // Set up interval
        const pollTimer = setInterval(async () => {
          if (!running) return;
          if (duration > 0 && Date.now() - start >= duration) {
            clearInterval(pollTimer);
            cleanup();
            return;
          }
          await poll();
        }, interval);

        // If duration is set, schedule exit
        if (duration > 0) {
          setTimeout(() => {
            clearInterval(pollTimer);
            cleanup();
          }, duration);
        }

        // Keep process alive
        await new Promise(() => {});
      } catch (err) {
        if (globalOpts.audit !== false) {
          try { audit.log({ cluster: "", command: "watch", args: object, duration_ms: Date.now() - start, status: "error", message: err.message }); } catch {}
        }
        printError(err);
      }
    });
}

module.exports = watchCommand;
module.exports.sparkline = sparkline;
