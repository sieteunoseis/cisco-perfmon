const perfMonService = require("../main");
const path = require("path");
const { cleanEnv, str, host } = require("envalid");

// If not production load the local env file
if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "development.env") });
} else if (process.env.NODE_ENV === "test") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "test.env") });
} else if (process.env.NODE_ENV === "staging") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "staging.env") });
}

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
  }),
  CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address to send the perfmon request to. Typically the publisher." }),
  CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
  CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." }),
  CUCM_SERVER_NAME: str({ desc: "The CUCM name or IP address of the target server from which the client wants to retrieve the counter information from. Note this could be any node in the cluster.", example: "hq-cucm-pub or hq-cucm-sub" }),
});

let service = new perfMonService(env.CUCM_HOSTNAME, env.CUCM_USERNAME, env.CUCM_PASSWORD);
let cucmServerName = env.CUCM_SERVER_NAME;
let sessionArray = [];
let objectArr = ["Processor","System"];

(async () => {
  try {
    var listCounterResults = await service.listCounter(cucmServerName);
  } catch (error) {
    console.error(error);
  }

  var output = []
  for (let counter of listCounterResults.results) {
    output.push(counter.Name);
  }
  console.log("output", output);
  
  // Filter out the one we want for now
  var filteredArr = listCounterResults.results.filter((counter) => {
    return objectArr.includes(counter.Name);
  });

  // let counter of listCounterResults.results
  for (let counter of filteredArr) {
    if (counter.ArrayOfCounter.item.length > 0) {
      if (counter.MultiInstance === "true") {
        var listInstanceResults = await service.listInstance(cucmServerName, counter.Name);
        if (listInstanceResults.results.length > 0) {
          for (const instance of listInstanceResults.results) {
            for (const item of counter.ArrayOfCounter.item) {
              let output = {
                host: "",
                object: "",
                instance: "",
                counter: "",
              };
              output.host = cucmServerName;
              output.object = counter.Name;
              output.instance = instance.Name;
              output.counter = item.Name;
              sessionArray.push(output);
            }
          }
        } else {
          let output = {
            host: "",
            object: "",
            instance: "",
            counter: "",
          };
          output.host = cucmServerName;
          output.object = counter.Name;
          sessionArray.push(output);
        }
      } else {
        for (const item of counter.ArrayOfCounter.item) {
          let output = {
            host: "",
            object: "",
            instance: "",
            counter: "",
          };
          output.host = cucmServerName;
          output.object = counter.Name;
          output.counter = item.Name;
          sessionArray.push(output);
        }
      }
    }
  }
  console.log("sessionArray", JSON.parse(JSON.stringify(sessionArray)));
})();
