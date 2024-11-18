const perfMonService = require("../main");
const path = require("path");
const { cleanEnv, str, host } = require("envalid");
const pLimit = require("p-limit");
const objectLimit = pLimit(10);

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

const cucmServerName = env.CUCM_HOSTNAME;
let perfmon_service = new perfMonService(cucmServerName, env.CUCM_USERNAME, env.CUCM_PASSWORD, {}, false);
let counterArr = [
  "Cisco CAR DB",
  "Cisco CallManager",
  "Cisco Phones",
  "Cisco Lines",
  "Cisco H323",
  "Cisco MGCP Gateways",
  "Cisco MOH Device",
  "Cisco Analog Access",
  "Cisco MGCP FXS Device",
  "Cisco MGCP FXO Device",
  "Cisco MGCP T1CAS Device",
  "Cisco MGCP PRI Device",
  "Cisco MGCP BRI Device",
  "Cisco MTP Device",
  "Cisco Transcode Device",
  "Cisco SW Conference Bridge Device",
  "Cisco HW Conference Bridge Device",
  "Cisco Locations RSVP",
  "Cisco Gatekeeper",
  "Cisco CallManager System Performance",
  "Cisco Video Conference Bridge Device",
  "Cisco Hunt Lists",
  "Cisco SIP",
  "Cisco Annunciator Device",
  "Cisco QSIG Features",
  "Cisco SIP Stack",
  "Cisco Presence Features",
  "Cisco WSMConnector",
  "Cisco Dual-Mode Mobility",
  "Cisco SIP Station",
  "Cisco Mobility Manager",
  "Cisco Signaling",
  "Cisco Call Restriction",
  "External Call Control",
  "Cisco SAF Client",
  "IME Client",
  "IME Client Instance",
  "Cisco SIP Normalization",
  "Cisco Telepresence MCU Conference Bridge Device",
  "Cisco SIP Line Normalization",
  "Cisco Hunt Pilots",
  "Cisco Video On Hold Device",
  "Cisco Recording",
  "Cisco IVR Device",
  "Cisco AXL Tomcat Connector",
  "Cisco AXL Tomcat Web Application",
  "Cisco AXL Tomcat JVM",
  "Cisco LDAP Directory",
  "Cisco Media Streaming App",
  "Cisco SSOSP Tomcat Connector",
  "Cisco SSOSP Tomcat Web Application",
  "Cisco SSOSP Tomcat JVM",
  "Cisco TFTP",
  "Cisco Tomcat Connector",
  "Cisco Tomcat Web Application",
  "Cisco Tomcat JVM",
  "Cisco UDS Tomcat Connector",
  "Cisco UDS Tomcat Web Application",
  "Cisco UDS Tomcat JVM",
  "Cisco AXL Web Service",
  "Cisco Device Activation",
  "Cisco Extension Mobility",
  "Cisco IP Manager Assistant",
  "Cisco WebDialer",
  "Cisco CTI Manager",
  "Cisco CTI Proxy",
  "DB Local_DSN",
  "DB Change Notification Server",
  "DB Change Notification Client",
  "DB Change Notification Subscriptions",
  "Enterprise Replication Perfmon Counters",
  "Enterprise Replication DBSpace Monitors",
  "Number of Replicates Created and State of Replication",
  "DB User Host Information Counters",
  "Cisco Locations LBM",
  "Cisco LBM Service",
  "Process",
  "Partition",
  "Memory",
  "Processor",
  "Thread",
  "IP",
  "TCP",
  "Network Interface",
  "System",
  "IP6",
  "Ramfs",
  "Cisco HAProxy",
  "Docker Container",
  "SAML SSO",
];

const retry = (fn, retriesLeft = 1, retryInteveral = 1000, promiseDelay = 0) => {
  return new Promise(async (resolve, reject) => {
    await new Promise((resolve) => setTimeout(resolve, promiseDelay));
    fn()
      .then(resolve)
      .catch((error) => {
        if (retriesLeft > 0) {
          setTimeout(() => {
            retry(fn, retriesLeft - 1, retryInteveral).then(resolve, reject);
          }, retryInteveral);
        } else {
          reject(error);
        }
      });
  });
};

(async () => {
  try {
    // Let's run the perfmon loop for each counter
    console.log("Running rate limit test. This will take a while...");

    const promises = await counterArr.map((counter) => {
      return objectLimit(() => retry(() => perfmon_service.collectCounterData(cucmServerName, counter), 0, 0, 0));
    });

    let output = await Promise.allSettled(promises);
    output = output.map((el) => {
      if (el.status === "fulfilled") {
        return el.value;
      } else {
        return el.reason;
      }
    });

    output = output.flat(1);

    let errors = {};
    let success = {};

    output.forEach((el) => {
      if(el?.status > 400) {
        errors[el.object] = (errors[el.object] || 0) + 1;
      }else if(el?.results){
        el.results.forEach((result) => {
          success[result.object] = (success[result.object] || 0) + 1;
        })
      }
    });

    const nonPercentageObjects = output.reduce((acc, obj) => {
      const matchingItems = obj.results.filter(item => !item?.counter.includes("%") && !item.counter?.includes("Percentage"));
    
      if (matchingItems.length > 0) {
        acc.push(matchingItems);
      }  
      return acc.flat(1);
    }, []);
    
    console.log(`Total number of objects: ${output.length}, matching non percentage objects: ${nonPercentageObjects.length}`);

    var results = {
      success: success,
      errors: errors
    }

    console.log(results);
    console.log("Rate limit test completed.");
  } catch (err) {
    console.error("Error:", err);
  }
})();
