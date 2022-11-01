const perfMonService = require("../main");

// Set up new PerfMon service
let service = new perfMonService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt"
);

// Variables to hold our SessionID and our Session Counter
var SessionID;
var counterObj = {
  host: "cucm01-pub",
  object: "Cisco CallManager",
  counter: "CallsActive",
};

console.log("Let's get a description of our counter.");
service
  .queryCounterDescription(counterObj)
  .then((results) => {
    console.log("queryCounterDescription", results);
  })
  .catch((error) => {
    console.log(error);
  });

console.log(
  "Let's open a session, add a counter, wait 30 seconds, collect the session data, remove the counter and finally close the session"
);
service
  .openSession()
  .then((results) => {
    console.log("SessionID", results);
    SessionID = results;
    service
      .addCounter(SessionID, counterObj)
      .then(async (results) => {
        console.log("addCounter", results);
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        console.log("Wait 30 seconds");
        await delay(30000); /// waiting 30 second.
        service
          .collectSessionData(SessionID)
          .then((results) => {
            console.log("collectSessionData", results);
            service
              .removeCounter(SessionID, counterObj)
              .then((results) => {
                console.log("removeCounter", results);
                service
                  .closeSession(SessionID)
                  .then((results) => {
                    console.log("closeSession", results);
                  })
                  .catch((error) => {
                    console.log(error);
                  });
              })
              .catch((error) => {
                console.log(error);
              });
          })
          .catch((error) => {
            console.log(error);
          });
      })
      .catch((error) => {
        console.log(error);
      });
  })
  .catch((error) => {
    console.log(error);
  });

console.log("Let's collect some non session counter data.");
service
  .collectCounterData("cucm01-pub", "Cisco CallManager")
  .then((results) => {
    console.log("collectCounterData", results);
  })
  .catch((error) => {
    console.log(error);
  });

console.log(
  "Let's returns the list of available PerfMon objects and counters on a particular host"
);
service
  .listCounter("cucm01-pub")
  .then((results) => {
    console.log("listCounter", results);
  })
  .catch((error) => {
    console.log(error);
  });

console.log(
  "Let's return a list of instances of a PerfMon object on a particular host. Instances of an object can dynamically change. This operation returns the most recent list."
);
service
  .listInstance("cucm01-pub","Partition")
  .then((results) => {
    console.log("listInstance", results);
  })
  .catch((error) => {
    console.log(error);
  });
