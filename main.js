const util = require("util");
const parseString = require("xml2js").parseString;
const stripPrefix = require("xml2js").processors.stripPrefix;

var XML_ADD_COUNTER_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
 <soapenv:Header/>
 <soapenv:Body>
    <soap:perfmonAddCounter>
       <soap:SessionHandle>%s</soap:SessionHandle>
       <soap:ArrayOfCounter>%s</soap:ArrayOfCounter>
    </soap:perfmonAddCounter>
 </soapenv:Body>
</soapenv:Envelope>`;

var XML_CLOSE_SESSION_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:perfmonCloseSession>
      <soap:SessionHandle>%s</soap:SessionHandle>
   </soap:perfmonCloseSession>
</soapenv:Body>
</soapenv:Envelope>`;

var XML_COLLECT_COUNTER_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:perfmonCollectCounterData>
      <soap:Host>%s</soap:Host>
      <soap:Object>%s</soap:Object>
   </soap:perfmonCollectCounterData>
</soapenv:Body>
</soapenv:Envelope>`;

var XML_COLLECT_SESSION_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:perfmonCollectSessionData>
      <soap:SessionHandle>%s</soap:SessionHandle>
   </soap:perfmonCollectSessionData>
</soapenv:Body>
</soapenv:Envelope>`;

var XML_LIST_COUNTER_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:perfmonListCounter>
      <soap:Host>%s</soap:Host>
   </soap:perfmonListCounter>
</soapenv:Body>
</soapenv:Envelope>`;

var XML_LIST_INSTANCE_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:perfmonListInstance>
      <soap:Host>%s</soap:Host>
      <soap:Object>%s</soap:Object>
   </soap:perfmonListInstance>
</soapenv:Body>
</soapenv:Envelope>`;

var XML_OPEN_SESSION_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:perfmonOpenSession/>
</soapenv:Body>
</soapenv:Envelope>`;

var XML_QUERY_COUNTER_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:perfmonQueryCounterDescription>%s</soap:perfmonQueryCounterDescription>
</soapenv:Body>
</soapenv:Envelope>`;

var XML_REMOVE_COUNTER_ENVELOPE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:perfmonRemoveCounter>
      <soap:SessionHandle>%s</soap:SessionHandle>
      <soap:ArrayOfCounter>%s</soap:ArrayOfCounter>
   </soap:perfmonRemoveCounter>
</soapenv:Body>
</soapenv:Envelope>`;

/**
 * Cisco Perfmon Service
 * This is a service class that uses fetch and promises to pull Perfmon data from Cisco CUCM
 *
 *
 * @class perfMonService
 * @param {string} host - The host to collect data from. This is usually the IP address/FQDN of the CUCM publisher.
 * @param {string} username - The username to authenticate with. This is usually an AXL user. Can leave this blank if using JESSIONSSO cookie.
 * @param {string} password - The password to authenticate with. This is usually an AXL user. Can leave this blank if using JESSIONSSO cookie.
 * @param {object} options - Additional headers to add to the request. Useful for adding cookies for SSO sessions.
 * @returns {object} returns constructor object.
 */
class perfMonService {
  constructor(host, username, password, options) {
    this._OPTIONS = {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(username + ":" + password).toString("base64"),
        "Content-Type": "text/xml;charset=UTF-8",
        Connection: "keep-alive",
      },
    };

    // Adds additional headers if they are provided. Useful for adding cookies for SSO sessions
    if (options) {
      this._OPTIONS.headers = Object.assign(this._OPTIONS.headers, options);
    }

    this._HOST = host;
  }
  /**
   * Post Fetch using Cisco PerfMon API
   *
   * @collectCounterData
   * @example
   * var service = new perfMonService();
   * service.collectCounterData().then((results => {
   *    console.log(results.Results);
   *   }))
   * @memberof perfMonService
   * @param {string} host - The host to collect data from
   * @param {string} object - The object to collect data about. Example: Cisco CallManager
   * @returns {object} returns JSON via a Promise. JSON contains Session Cookie (If availible) and Results.
   */
  collectCounterData(host, object) {
    var XML;
    var options = this._OPTIONS;
    options.SOAPAction = `perfmonCollectCounterData`;
    var server = this._HOST;

    XML = util.format(XML_COLLECT_COUNTER_ENVELOPE, host, object);

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // Set up our promise results
      var promiseResults = {
        Cookie: "",
        Results: "",
      };
      // We fetch the API endpoint
      fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options)
        .then(async (response) => {
          try {
            var data = []; // create an array to save chunked data from server
            promiseResults.Cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";
            // response.body is a ReadableStream
            const reader = response.body.getReader();
            for await (const chunk of readChunks(reader)) {
              data.push(Buffer.from(chunk));
            }
            var buffer = Buffer.concat(data); // create buffer of data
            let xmlOutput = buffer.toString("binary").trim();
            let output = await parseXml(xmlOutput);
            // Remove unnecessary keys
            removeKeys(output, "$");

            if (keyExists(output, "perfmonCollectCounterDataReturn")) {
              var returnResults = output.Body.perfmonCollectCounterDataResponse.perfmonCollectCounterDataReturn;
              if (returnResults) {
                var newOutput;
                if (Array.isArray(returnResults)) {
                  newOutput = returnResults.map((item) => {
                    let arr = item.Name.split("\\").filter((element) => element);

                    let instanceArr = arr[1].split(/[()]+/).filter(function (e) {
                      return e;
                    });

                    return {
                      host: arr[0],
                      object: instanceArr[0],
                      instance: instanceArr[1] ? instanceArr[1] : "",
                      counter: arr[2],
                      value: item.Value,
                      cstatus: item.CStatus,
                    };
                  });
                } else {
                  let arr = returnResults.Name.split("\\").filter((element) => element);

                  let instanceArr = arr[1].split(/[()]+/).filter(function (e) {
                    return e;
                  });

                  newOutput = {
                    host: arr[0],
                    object: instanceArr[0],
                    instance: instanceArr[1] ? instanceArr[1] : "",
                    counter: arr[2],
                    value: returnResults.Value,
                    cstatus: returnResults.CStatus,
                  };
                }
                promiseResults.Results = clean(newOutput);
                resolve(promiseResults);
              } else {
                promiseResults.Results = output.Body.Fault;
                reject(promiseResults);
              }
            } else {
              // Error checking. If the response contains a fault, we return the fault.
              if (keyExists(output, "Fault")) {
                if (output.Body.Fault.faultcode.includes("RateControl")) {
                  promiseResults.Results = { faultcode: "RateControl", faultstring: output.Body.Fault.faultstring };
                } else if (output.Body.Fault.faultcode.includes("generalException")) {
                  promiseResults.Results = { faultcode: "generalException", faultstring: output.Body.Fault.faultstring };
                } else {
                  promiseResults.Results = { faultcode: output.Body.Fault.faultcode, faultstring: output.Body.Fault.faultstring };
                }
                resolve(promiseResults);
              } else {
                // Error unknown. Return the response status instead.
                reject(response.status);
              }
            }
          } catch (e) {
            promiseResults.Results = e;
            reject(promiseResults);
          }
        })
        .catch((error) => {
          promiseResults.Results = error;
          reject(promiseResults);
        }); // catches the error and logs it
    });
  }
  /**
   * Post Fetch using Cisco PerfMon API
   *
   * @collectSessionData
   * @example
   * var service = new perfMonService();
   * service.collectSessionData().then((results => {
   *    console.log(results.Results);
   * }))
   * @memberof perfMonService
   * @param {string} SessionHandle - A unique session ID from the client, of type SessionHandleType. The session handle that the perfmonOpenSession request previously opened.
   * @returns {object} returns JSON via a Promise. JSON contains Session Cookie (If availible) and Results.
   */
  collectSessionData(SessionHandle) {
    var XML;
    var options = this._OPTIONS;
    options.SOAPAction = `perfmonCollectSessionData`;
    var server = this._HOST;

    XML = util.format(XML_COLLECT_SESSION_ENVELOPE, SessionHandle);

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // Set up our promise results
      var promiseResults = {
        Cookie: "",
        Results: "",
      };
      // We fetch the API endpoint
      fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options)
        .then(async (response) => {
          try {
            var data = []; // create an array to save chunked data from server
            promiseResults.Cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";
            // response.body is a ReadableStream
            const reader = response.body.getReader();
            for await (const chunk of readChunks(reader)) {
              data.push(Buffer.from(chunk));
            }
            var buffer = Buffer.concat(data); // create buffer of data
            let xmlOutput = buffer.toString("binary").trim();
            let output = await parseXml(xmlOutput);
            // Remove unnecessary keys
            removeKeys(output, "$");

            if (keyExists(output, "perfmonCollectSessionDataReturn")) {
              var returnResults = output.Body.perfmonCollectSessionDataResponse.perfmonCollectSessionDataReturn;

              if (returnResults) {
                var newOutput;
                if (Array.isArray(returnResults)) {
                  newOutput = returnResults.map((item) => {
                    let arr = item.Name.split("\\").filter((element) => element);

                    let instanceArr = arr[1].split(/[()]+/).filter(function (e) {
                      return e;
                    });

                    return {
                      host: arr[0],
                      object: instanceArr[0],
                      instance: instanceArr[1] ? instanceArr[1] : "",
                      counter: arr[2],
                      value: item.Value,
                      cstatus: item.CStatus,
                    };
                  });
                } else {
                  let arr = returnResults.Name.split("\\").filter((element) => element);

                  let instanceArr = arr[1].split(/[()]+/).filter(function (e) {
                    return e;
                  });

                  newOutput = {
                    host: arr[0],
                    object: instanceArr[0],
                    instance: instanceArr[1] ? instanceArr[1] : "",
                    counter: arr[2],
                    value: returnResults.Value,
                    cstatus: returnResults.CStatus,
                  };
                }
                promiseResults.Results = clean(newOutput);
                resolve(promiseResults);
              } else {
                promiseResults.Results = output.Body.Fault;
                reject(promiseResults);
              }
            } else {
              promiseResults.Results = { response: "empty" };
              resolve(promiseResults);
            }
          } catch (e) {
            promiseResults.Results = e;
            reject(promiseResults);
          }
        })
        .catch((error) => {
          promiseResults.Results = error;
          reject(promiseResults);
        }); // catches the error and logs it
    });
  }
  /**
   * Post Fetch using Cisco PerfMon API
   *
   * @listCounter
   * @example
   * var service = new perfMonService();
   * service.listCounter().then((results => {
   *    console.log(results.Results);
   * }))
   * @memberof perfMonService
   * @param {string} host - The host to collect data from.
   * @returns {object} returns JSON via a Promise. JSON contains Session Cookie (If availible) and Results.
   */
  listCounter(host) {
    var XML;
    var options = this._OPTIONS;
    options.SOAPAction = `perfmonListCounter`;
    var server = this._HOST;

    XML = util.format(XML_LIST_COUNTER_ENVELOPE, host);

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // Set up our promise results
      var promiseResults = {
        Cookie: "",
        Results: "",
      };
      // We fetch the API endpoint
      fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options)
        .then(async (response) => {
          try {
            var data = []; // create an array to save chunked data from server
            promiseResults.Cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";
            // response.body is a ReadableStream
            const reader = response.body.getReader();
            for await (const chunk of readChunks(reader)) {
              data.push(Buffer.from(chunk));
            }
            var buffer = Buffer.concat(data); // create buffer of data
            let xmlOutput = buffer.toString("binary").trim();
            let output = await parseXml(xmlOutput);
            // Remove unnecessary keys
            removeKeys(output, "$");

            if (keyExists(output, "perfmonListCounterReturn")) {
              var returnResults = output.Body.perfmonListCounterResponse.perfmonListCounterReturn;

              if (returnResults) {
                promiseResults.Results = clean(returnResults);
                resolve(promiseResults);
              } else {
                promiseResults.Results = output.Body.Fault;
                reject(promiseResults);
              }
            } else {
              promiseResults.Results = { response: "empty" };
              resolve(promiseResults);
            }
          } catch (e) {
            promiseResults.Results = e;
            reject(promiseResults);
          }
        })
        .catch((error) => {
          promiseResults.Results = error;
          reject(promiseResults);
        }); // catches the error and logs it
    });
  }
  /**
   * Post Fetch using Cisco PerfMon API
   *
   * @listInstance
   * @example
   * var service = new perfMonService();
   * service.listInstance().then((results => {
   *    console.log(results.Results);
   * }))
   * @memberof perfMonService
   * @param {string} host - The host to collect data from.
   * @param {string} object - The object to collect data about. Example: Cisco CallManager
   * @returns {object} returns JSON via a Promise. JSON contains Session Cookie (If availible) and Results.
   */
  listInstance(host, object) {
    var XML;
    var options = this._OPTIONS;
    options.SOAPAction = `perfmonListInstance`;
    var server = this._HOST;

    XML = util.format(XML_LIST_INSTANCE_ENVELOPE, host, object);

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // Set up our promise results
      var promiseResults = {
        Cookie: "",
        Results: "",
      };
      // We fetch the API endpoint
      fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options)
        .then(async (response) => {
          try {
            var data = []; // create an array to save chunked data from server
            promiseResults.Cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";
            // response.body is a ReadableStream
            const reader = response.body.getReader();
            for await (const chunk of readChunks(reader)) {
              data.push(Buffer.from(chunk));
            }
            var buffer = Buffer.concat(data); // create buffer of data
            let xmlOutput = buffer.toString("binary").trim();
            let output = await parseXml(xmlOutput);
            // Remove unnecessary keys
            removeKeys(output, "$");

            if (keyExists(output, "perfmonListInstanceReturn")) {
              var returnResults = output.Body.perfmonListInstanceResponse.perfmonListInstanceReturn;

              if (returnResults) {
                promiseResults.Results = clean(returnResults);
                resolve(promiseResults);
              } else {
                promiseResults.Results = output.Body.Fault;
                reject(promiseResults);
              }
            } else {
              promiseResults.Results = { response: "empty" };
              resolve(promiseResults);
            }
          } catch (e) {
            promiseResults.Results = e;
            reject(promiseResults);
          }
        })
        .catch((error) => {
          promiseResults.Results = error;
          reject(promiseResults);
        }); // catches the error and logs it
    });
  }
  /**
   * Post Fetch using Cisco PerfMon API
   *
   * @openSession
   * @example
   * var service = new perfMonService();
   * service.openSession().then((results => {
   *    console.log(results.Results);
   * }))
   * @memberof perfMonService
   * @returns {object} returns JSON via a Promise. JSON contains Session Cookie (If availible) and Results.
   */
  openSession() {
    var XML;
    var options = this._OPTIONS;
    options.SOAPAction = `perfmonOpenSession`;
    var server = this._HOST;
    XML = util.format(XML_OPEN_SESSION_ENVELOPE);

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // Set up our promise results
      var promiseResults = {
        Cookie: "",
        Results: "",
      };
      // We fetch the API endpoint
      fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options)
        .then(async (response) => {
          try {
            var data = []; // create an array to save chunked data from server
            promiseResults.Cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";
            // response.body is a ReadableStream
            const reader = response.body.getReader();
            for await (const chunk of readChunks(reader)) {
              data.push(Buffer.from(chunk));
            }
            var buffer = Buffer.concat(data); // create buffer of data
            let xmlOutput = buffer.toString("binary").trim();
            let output = await parseXml(xmlOutput);
            // Remove unnecessary keys
            removeKeys(output, "$");

            if (keyExists(output, "perfmonOpenSessionReturn")) {
              var returnResults = output.Body.perfmonOpenSessionResponse.perfmonOpenSessionReturn;

              if (returnResults) {
                promiseResults.Results = clean(returnResults);
                resolve(promiseResults);
              } else {
                promiseResults.Results = output.Body.Fault;
                reject(promiseResults);
              }
            } else {
              promiseResults.Results = { response: "empty" };
              resolve(promiseResults);
            }
          } catch (e) {
            promiseResults.Results = e;
            reject(promiseResults);
          }
        })
        .catch((error) => {
          promiseResults.Results = error;
          reject(promiseResults);
        }); // catches the error and logs it
    });
  }
  /**
   * Post Fetch using Cisco PerfMon API
   *
   * @closeSession
   * @example
   * var service = new perfMonService();
   * service.closeSession().then((results => {
   *    console.log(results.Results);
   * }))
   * @memberof perfMonService
   * @param {string} sessionHandle - A unique session ID from the client, of type SessionHandleType. The session handle that the perfmonOpenSession request previously opened.
   * @returns {object} returns JSON via a Promise. JSON contains Session Cookie (If availible) and Results.
   */
  closeSession(sessionHandle) {
    var XML;
    var options = this._OPTIONS;
    options.SOAPAction = `perfmonCloseSession`;
    var server = this._HOST;
    XML = util.format(XML_CLOSE_SESSION_ENVELOPE, sessionHandle);

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // Set up our promise results
      var promiseResults = {
        Cookie: "",
        Results: "",
      };
      // We fetch the API endpoint
      fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options)
        .then(async (response) => {
          try {
            var data = []; // create an array to save chunked data from server
            promiseResults.Cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";
            // response.body is a ReadableStream
            const reader = response.body.getReader();
            for await (const chunk of readChunks(reader)) {
              data.push(Buffer.from(chunk));
            }
            var buffer = Buffer.concat(data); // create buffer of data
            let xmlOutput = buffer.toString("binary").trim();
            let output = await parseXml(xmlOutput);
            // Remove unnecessary keys
            removeKeys(output, "$");

            if (keyExists(output, "perfmonCloseSessionResponse")) {
              var returnResults = output.Body.perfmonCloseSessionResponse;
              if (returnResults) {
                promiseResults.Results = { response: "success" };
                resolve(promiseResults);
              } else {
                promiseResults.Results = output.Body.Fault;
                reject(promiseResults);
              }
            } else {
              promiseResults.Results = { response: "empty" };
              resolve(promiseResults);
            }
          } catch (e) {
            promiseResults.Results = e;
            reject(promiseResults);
          }
        })
        .catch((error) => {
          promiseResults.Results = error;
          reject(promiseResults);
        }); // catches the error and logs it
    });
  }
  /**
   * Post Fetch using Cisco PerfMon API
   *
   * @addCounter
   * @example
   * var service = new perfMonService();
   * service.addCounter().then((results => {
   *    console.log(results.Results);
   * }))
   * @memberof perfMonService
   * @param {string} sessionHandle - A unique session ID from the client, of type SessionHandleType. The session handle that the perfmonOpenSession request previously opened.
   * @param {object} counter - The counter to add. Example: Memory
   * @returns {object} returns JSON via a Promise. JSON contains Session Cookie (If availible) and Results.
   */
  addCounter(sessionHandle, counter) {
    var XML;
    var counterStr = "";
    var options = this._OPTIONS;
    options.SOAPAction = `perfmonAddCounter`;
    var server = this._HOST;

    if (Array.isArray(counter)) {
      counter.forEach((item) => (counterStr += "<soap:Counter>" + "<soap:Name>" + "\\\\" + item.host + "\\" + item.object + "\\" + item.counter + "</soap:Name>" + "</soap:Counter>"));
    } else {
      counterStr = "<soap:Counter>" + "<soap:Name>" + "\\\\" + counter.host + "\\" + counter.object + "\\" + counter.counter + "</soap:Name>" + "</soap:Counter>";
    }

    XML = util.format(XML_ADD_COUNTER_ENVELOPE, sessionHandle, counterStr);

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // Set up our promise results
      var promiseResults = {
        Cookie: "",
        Results: "",
      };
      // We fetch the API endpoint
      fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options)
        .then(async (response) => {
          try {
            var data = []; // create an array to save chunked data from server
            // response.body is a ReadableStream
            const reader = response.body.getReader();
            for await (const chunk of readChunks(reader)) {
              data.push(Buffer.from(chunk));
            }
            var buffer = Buffer.concat(data); // create buffer of data
            let xmlOutput = buffer.toString("binary").trim();
            let output = await parseXml(xmlOutput);
            // Remove unnecessary keys
            removeKeys(output, "$");

            if (keyExists(output, "perfmonAddCounterResponse")) {
              var returnResults = output.Body.perfmonAddCounterResponse;
              if (returnResults) {
                promiseResults.Results = { response: "success" };
                resolve(promiseResults);
              } else {
                promiseResults.Results = output.Body.Fault;
                reject(promiseResults);
              }
            } else {
              promiseResults.Results = { response: "empty" };
              resolve(promiseResults);
            }
          } catch (e) {
            promiseResults.Results = e;
            reject(promiseResults);
          }
        })
        .catch((error) => {
          promiseResults.Results = error;
          reject(promiseResults);
        }); // catches the error and logs it
    });
  }
  /**
   * Post Fetch using Cisco PerfMon API
   *
   * @removeCounter
   * @example
   * var service = new perfMonService();
   * service.removeCounter().then((results => {
   *    console.log(results.Results);
   * }))
   * @memberof perfMonService
   * @param {string} sessionHandle - A unique session ID from the client, of type SessionHandleType. The session handle that the perfmonOpenSession request previously opened.
   * @param {object} counter - The counter to remove. Example: Memory
   * @returns {object} returns JSON via a Promise. JSON contains Session Cookie (If availible) and Results.
   */
  removeCounter(sessionHandle, counter) {
    var XML;
    var counterStr = "";
    var options = this._OPTIONS;
    options.SOAPAction = `perfmonRemoveCounter`;
    var server = this._HOST;

    if (Array.isArray(counter)) {
      counter.forEach((item) => (counterStr += "<soap:Counter>" + "<soap:Name>" + "\\\\" + item.host + "\\" + item.object + "\\" + item.counter + "</soap:Name>" + "</soap:Counter>"));
    } else {
      counterStr = "<soap:Counter>" + "<soap:Name>" + "\\\\" + counter.host + "\\" + counter.object + "\\" + counter.counter + "</soap:Name>" + "</soap:Counter>";
    }

    XML = util.format(XML_REMOVE_COUNTER_ENVELOPE, sessionHandle, counterStr);

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // Set up our promise results
      var promiseResults = {
        Cookie: "",
        Results: "",
      };
      // We fetch the API endpoint
      fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options)
        .then(async (response) => {
          try {
            var data = []; // create an array to save chunked data from server
            // response.body is a ReadableStream
            const reader = response.body.getReader();
            for await (const chunk of readChunks(reader)) {
              data.push(Buffer.from(chunk));
            }
            var buffer = Buffer.concat(data); // create buffer of data
            let xmlOutput = buffer.toString("binary").trim();
            let output = await parseXml(xmlOutput);
            // Remove unnecessary keys
            removeKeys(output, "$");

            if (keyExists(output, "perfmonRemoveCounterResponse")) {
              var returnResults = output.Body.perfmonRemoveCounterResponse;
              if (returnResults) {
                promiseResults.Results = { response: "success" };
                resolve(promiseResults);
              } else {
                promiseResults.Results = output.Body.Fault;
                reject(promiseResults);
              }
            } else {
              promiseResults.Results = { response: "empty" };
              resolve(promiseResults);
            }
          } catch (e) {
            promiseResults.Results = e;
            reject(promiseResults);
          }
        })
        .catch((error) => {
          promiseResults.Results = error;
          reject(promiseResults);
        }); // catches the error and logs it
    });
  }
  /**
   * Post Fetch using Cisco PerfMon API
   *
   * @queryCounterDescription
   * @example
   * var service = new perfMonService();
   * service.queryCounterDescription().then((results => {
   *    console.log(results.Results);
   * }))
   * @memberof perfMonService
   * @param {object} counter - The counter to query. Example: Memory
   * @returns {object} returns JSON via a Promise. JSON contains Session Cookie (If availible) and Results.
   */
  queryCounterDescription(counter) {
    var XML;
    var options = this._OPTIONS;
    options.SOAPAction = `perfmonQueryCounterDescription`;
    var server = this._HOST;

    var counterStr = "<soap:Counter>" + "\\\\" + counter.host + "\\" + counter.object + "\\" + counter.counter + "</soap:Counter>";

    XML = util.format(XML_QUERY_COUNTER_ENVELOPE, counterStr);

    var soapBody = Buffer.from(XML);
    options.body = soapBody;

    return new Promise((resolve, reject) => {
      // Set up our promise results
      var promiseResults = {
        Cookie: "",
        Results: "",
      };
      // We fetch the API endpoint
      fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options)
        .then(async (response) => {
          try {
            var data = []; // create an array to save chunked data from server
            promiseResults.Cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";
            // response.body is a ReadableStream
            const reader = response.body.getReader();
            for await (const chunk of readChunks(reader)) {
              data.push(Buffer.from(chunk));
            }
            var buffer = Buffer.concat(data); // create buffer of data
            let xmlOutput = buffer.toString("binary").trim();
            let output = await parseXml(xmlOutput);

            // Remove unnecessary keys
            removeKeys(output, "$");

            if (keyExists(output, "perfmonQueryCounterDescriptionReturn")) {
              var returnResults = output.Body.perfmonQueryCounterDescriptionResponse.perfmonQueryCounterDescriptionReturn;
              if (returnResults) {
                promiseResults.Results = clean(returnResults);
                resolve(promiseResults);
              } else {
                promiseResults.Results = output.Body.Fault;
                reject(promiseResults);
              }
            } else {
              promiseResults.Results = { response: "empty" };
              resolve(promiseResults);
            }
          } catch (e) {
            promiseResults.Results = e;
            reject(promiseResults);
          }
        })
        .catch((error) => {
          promiseResults.Results = error;
          reject(promiseResults);
        }); // catches the error and logs it
    });
  }
}

// readChunks() reads from the provided reader and yields the results into an async iterable
const readChunks = (reader) => {
  return {
    async *[Symbol.asyncIterator]() {
      let readResult = await reader.read();
      while (!readResult.done) {
        yield readResult.value;
        readResult = await reader.read();
      }
    },
  };
};

const keyExists = (obj, key) => {
  if (!obj || (typeof obj !== "object" && !Array.isArray(obj))) {
    return false;
  } else if (obj.hasOwnProperty(key)) {
    return true;
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = keyExists(obj[i], key);
      if (result) {
        return result;
      }
    }
  } else {
    for (const k in obj) {
      const result = keyExists(obj[k], key);
      if (result) {
        return result;
      }
    }
  }

  return false;
};

/**
 * Remove all specified keys from an object, no matter how deep they are.
 * The removal is done in place, so run it on a copy if you don't want to modify the original object.
 * This function has no limit so circular objects will probably crash the browser
 *
 * @param obj The object from where you want to remove the keys
 * @param keys An array of property names (strings) to remove
 */
const removeKeys = (obj, keys) => {
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      switch (typeof obj[prop]) {
        case "object":
          if (keys.indexOf(prop) > -1) {
            delete obj[prop];
          } else {
            removeKeys(obj[prop], keys);
          }
          break;
        default:
          if (keys.indexOf(prop) > -1) {
            delete obj[prop];
          }
          break;
      }
    }
  }
};

const clean = (object) => {
  Object.entries(object).forEach(([k, v]) => {
    if (v && typeof v === "object") {
      clean(v);
    }
    if ((v && typeof v === "object" && !Object.keys(v).length) || v === null || v === undefined) {
      if (Array.isArray(object)) {
        object.splice(k, 1);
      } else {
        delete object[k];
      }
    }
  });
  return object;
};

const parseXml = (xmlPart) => {
  return new Promise((resolve, reject) => {
    parseString(
      xmlPart,
      {
        explicitArray: false,
        explicitRoot: false,
        tagNameProcessors: [stripPrefix],
      },
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
};

module.exports = perfMonService;
