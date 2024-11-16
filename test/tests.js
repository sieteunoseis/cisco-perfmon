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

let service = new perfMonService(env.CUCM_HOSTNAME, env.CUCM_USERNAME, env.CUCM_PASSWORD, {}, false); 

var cucmServerName = env.CUCM_SERVER_NAME;

// Variables to hold our SessionID and our Session Counter
var SessionID;
var counterObject = "Cisco CallManager";
var sessionObj = {
  host: cucmServerName,
  object: "Cisco CallManager",
  instance: "",
  counter: "CallsActive",
};

(async () => {
  console.log("Let's get a description of our counter. We will also retrieve a cookie to use for the rest of the session.");
  await service
    .queryCounterDescription(sessionObj)
    .then((response) => {
      console.log("queryCounterDescription: ", response.results);
      if (response.cookie) {
        service = new perfMonService(env.CUCM_HOSTNAME, "", "", { Cookie: response.cookie });
      }
    })
    .catch((error) => {
      console.log("Error",JSON.stringify(error));
    });

  
    try {
      var result =   await service.queryCounterDescription(sessionObj)
    } catch (error) {
      console.log(JSON.stringify(error));
    }

  // console.log("Let's collect some non session counter data.");
  // await service
  //   .collectCounterData(cucmServerName, counterObject)
  //   .then((response) => {
  //     console.log("collectCounterData", response);
  //   })
  //   .catch((error) => {
  //     console.log(error.message);
  //   });

  // console.log("Let's open a session, add a counter, wait 30 seconds, collect the session data, remove the counter and finally close the session");
  // await service
  //   .openSession()
  //   .then(async (response) => {
  //     console.log("SessionID", response.results);
  //     SessionID = response.results;
  //     await service
  //       .addCounter(SessionID, sessionObj)
  //       .then(async (response) => {
  //         console.log("addCounter", response.results);
  //         const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  //         console.log("Wait 15 seconds");
  //         await delay(15000); // waiting 15 second.
  //         await service
  //           .collectSessionData(SessionID)
  //           .then(async (response) => {
  //             console.log("collectSessionData", response.results);
  //             await service
  //               .removeCounter(SessionID, response.results)
  //               .then(async (response) => {
  //                 console.log("removeCounter", response.results);
  //                 await service
  //                   .closeSession(SessionID)
  //                   .then((response) => {
  //                     console.log("closeSession", response.results);
  //                   })
  //                   .catch((error) => {
  //                     console.log(error.message);
  //                   });
  //               })
  //               .catch((error) => {
  //                 console.log(error.message);
  //               });
  //           })
  //           .catch((error) => {
  //             console.log(error.message);
  //           });
  //       })
  //       .catch((error) => {
  //         console.log(error.message);
  //       });
  //   })
  //   .catch((error) => {
  //     console.log(error.message);
  //   });

  // console.log("Let's returns the list of available PerfMon objects and counters on a particular host");
  // await service
  //   .listCounter(cucmServerName)
  //   .then((response) => {
  //     console.log("listCounter", response.results);
  //   })
  //   .catch((error) => {
  //     console.log(error.message);
  //   });

  // console.log("Let's return a list of instances of a PerfMon object on a particular host. Instances of an object can dynamically change. This operation returns the most recent list.");
  // await service
  //   .listInstance(cucmServerName, "Processor")
  //   .then((results) => {
  //     console.log("listInstance", results.results);
  //   })
  //   .catch((error) => {
  //     console.log(error.message);
  //   });
})();
