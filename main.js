const fetch = require("fetch-retry")(global.fetch);
const util = require("util");
const parseString = require("xml2js").parseString;
const stripPrefix = require("xml2js").processors.stripPrefix;
const http = require("http");

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
  constructor(host, username, password, options = {}, retry = true) {
    this._OPTIONS = {
      retryOn: async function (attempt, error, response) {
        if (!retry) {
          return false;
        }
        if (attempt > (process.env.PERFMON_RETRIES ? parseInt(process.env.PERFMON_RETRIES) : 3)) {
          return false;
        }
        // retry on any network error, or 4xx or 5xx status codes
        if (error !== null || response.status >= 400) {
          const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          await delay(process.env.PERFMON_RETRY_DELAY ? parseInt(process.env.PERFMON_RETRY_DELAY) : 5000);
          return true;
        }
      },
      method: "POST",
      headers: {
        Authorization: username && password ? "Basic " + Buffer.from(username + ":" + password).toString("base64") : "",
        "Content-Type": "text/xml;charset=UTF-8",
        Connection: "Keep-Alive",
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
   * @returns {object} returns JSON object. JSON contains cookie and results if successful, otherwise it returns an error object.
   */
  async collectCounterData(host, object) {
    try {
      let options = this._OPTIONS;
      let server = this._HOST;
      let XML = util.format(XML_COLLECT_COUNTER_ENVELOPE, host, object);
      let soapBody = Buffer.from(XML);
      options.body = soapBody;
      options.SOAPAction = `perfmonCollectCounterData`;

      let response = await fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options);

      let promiseResults = {
        cookie: "",
        object: object,
        results: "",
      };

      promiseResults.cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";

      let output = await parseXml(await response.text());
      // Remove unnecessary keys
      removeKeys(output, "$");

      if (!response.ok) {
        // Local throw; if it weren't, I'd use Error or a subclass
        throw { status: response.status, code: http.STATUS_CODES[response.status], host: host, object: object, message: output?.Body?.Fault?.faultstring ? output.Body.Fault.faultstring : "Unknown" };
      }

      // Let's check if the response contains the key we are looking for. This is the return data.
      if (output?.Body?.perfmonCollectCounterDataResponse?.perfmonCollectCounterDataReturn) {
        var returnResults = output.Body.perfmonCollectCounterDataResponse.perfmonCollectCounterDataReturn;
        promiseResults.results = cleanResponse(returnResults);
        return promiseResults;
      } else {
        // Return JSON with no results.
        return promiseResults;
      }
    } catch (error) {
      throw error;
    }
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
  async collectSessionData(SessionHandle) {
    let options = this._OPTIONS;
    let server = this._HOST;
    let XML = util.format(XML_COLLECT_SESSION_ENVELOPE, SessionHandle);
    let soapBody = Buffer.from(XML);
    options.body = soapBody;
    options.SOAPAction = `perfmonCollectSessionData`;

    let response = await fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options);

    let promiseResults = {
      cookie: "",
      results: "",
    };

    promiseResults.cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";

    let output = await parseXml(await response.text());
    // Remove unnecessary keys
    removeKeys(output, "$");

    if (!response.ok) {
      // Local throw; if it weren't, I'd use Error or a subclass
      throw { status: response.status, code: http.STATUS_CODES[response.status], sessionId: SessionHandle, message: output?.Body?.Fault?.faultstring ? output.Body.Fault.faultstring : "Unknown" };
    }

    if (output?.Body?.perfmonCollectSessionDataResponse?.perfmonCollectSessionDataReturn) {
      var returnResults = output.Body.perfmonCollectSessionDataResponse.perfmonCollectSessionDataReturn;
      promiseResults.results = cleanResponse(returnResults);
      return promiseResults;
    } else {
      // Return JSON with no results.
      return promiseResults;
    }
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
  async listCounter(host, filtered = []) {
    let options = this._OPTIONS;
    let server = this._HOST;
    let XML = util.format(XML_LIST_COUNTER_ENVELOPE, host);
    let soapBody = Buffer.from(XML);
    options.body = soapBody;
    options.SOAPAction = `perfmonListCounter`;

    let response = await fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options);

    let promiseResults = {
      cookie: "",
      results: "",
    };

    promiseResults.cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";

    let output = await parseXml(await response.text());
    // Remove unnecessary keys
    removeKeys(output, "$");

    if (!response.ok) {
      // Local throw; if it weren't, I'd use Error or a subclass
      throw { status: response.status, code: http.STATUS_CODES[response.status], host: host, message: output?.Body?.Fault?.faultstring ? output.Body.Fault.faultstring : "Unknown" };
    }

    if (output?.Body?.perfmonListCounterResponse?.perfmonListCounterReturn) {
      var returnResults = output.Body.perfmonListCounterResponse.perfmonListCounterReturn;
      promiseResults.results = clean(returnResults);
      if (filtered.length > 0) {
        var res = promiseResults.results.filter((item) => filtered.includes(item.Name));
        promiseResults.results = res;
      }
      return promiseResults;
    } else {
      // Return JSON with no results.
      return promiseResults;
    }
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
  async listInstance(host, object) {
    let options = this._OPTIONS;
    let server = this._HOST;
    let XML = util.format(XML_LIST_INSTANCE_ENVELOPE, host, object);
    let soapBody = Buffer.from(XML);
    options.body = soapBody;
    options.SOAPAction = `perfmonListInstance`;

    let response = await fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options);

    let promiseResults = {
      cookie: "",
      object: object,
      results: "",
    };

    promiseResults.cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";

    let output = await parseXml(await response.text());
    // Remove unnecessary keys
    removeKeys(output, "$");

    if (!response.ok) {
      // Local throw; if it weren't, I'd use Error or a subclass
      throw { status: response.status, code: http.STATUS_CODES[response.status], host: host, object: object, message: output?.Body?.Fault?.faultstring ? output.Body.Fault.faultstring : "Unknown" };
    }

    if (output?.Body?.perfmonListInstanceResponse?.perfmonListInstanceReturn) {
      var returnResults = output.Body.perfmonListInstanceResponse.perfmonListInstanceReturn;
      promiseResults.results = clean(returnResults);

      // If the results are not an array, we make it an array.
      if (!Array.isArray(promiseResults.results)) {
        var temp = promiseResults.results;
        promiseResults = {
          results: [],
        };
        promiseResults.results.push(temp);
      }
      return promiseResults;
    } else {
      // Return JSON with no results.
      return promiseResults;
    }
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
  async openSession() {
    let options = this._OPTIONS;
    let server = this._HOST;
    let XML = util.format(XML_OPEN_SESSION_ENVELOPE);
    let soapBody = Buffer.from(XML);
    options.body = soapBody;
    options.SOAPAction = `perfmonOpenSession`;

    let response = await fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options);

    let promiseResults = {
      cookie: "",
      results: "",
    };

    promiseResults.cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";

    let output = await parseXml(await response.text());
    // Remove unnecessary keys
    removeKeys(output, "$");

    if (!response.ok) {
      // Local throw; if it weren't, I'd use Error or a subclass
      throw { status: response.status, code: http.STATUS_CODES[response.status], message: output?.Body?.Fault?.faultstring ? output.Body.Fault.faultstring : "Unknown" };
    }

    if (output?.Body?.perfmonOpenSessionResponse?.perfmonOpenSessionReturn) {
      var returnResults = output.Body.perfmonOpenSessionResponse.perfmonOpenSessionReturn;
      promiseResults.results = clean(returnResults);
      return promiseResults;
    } else {
      // Return JSON with no results.
      return promiseResults;
    }
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
  async closeSession(sessionHandle) {
    let options = this._OPTIONS;
    let server = this._HOST;
    let XML = util.format(XML_CLOSE_SESSION_ENVELOPE, sessionHandle);
    let soapBody = Buffer.from(XML);
    options.body = soapBody;
    options.SOAPAction = `perfmonCloseSession`;

    let response = await fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options);

    let promiseResults = {
      cookie: "",
      results: "",
    };

    promiseResults.cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";

    let output = await parseXml(await response.text());
    // Remove unnecessary keys
    removeKeys(output, "$");

    if (!response.ok) {
      // Local throw; if it weren't, I'd use Error or a subclass
      throw { status: response.status, code: http.STATUS_CODES[response.status], sessionId: sessionHandle, message: output?.Body?.Fault?.faultstring ? output.Body.Fault.faultstring : "Unknown" };
    }

    if (output?.Body?.perfmonCloseSessionResponse) {
      promiseResults.results = "success";
      return promiseResults;
    } else {
      throw { status: response.status, code: "", message: "Empty results" };
    }
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
  async addCounter(sessionHandle, counter) {
    let options = this._OPTIONS;
    let server = this._HOST;
    let counterStr;
    // Build the counter string
    if (Array.isArray(counter)) {
      counter.forEach((counter) => (counterStr += "<soap:Counter>" + "<soap:Name>" + "\\\\" + counter.host + "\\" + (counter.instance ? `${counter.object}(${counter.instance})` : counter.object) + "\\" + counter.counter + "</soap:Name>" + "</soap:Counter>"));
    } else {
      counterStr = "<soap:Counter>" + "<soap:Name>" + "\\\\" + counter.host + "\\" + (counter.instance ? `${counter.object}(${counter.instance})` : counter.object) + "\\" + counter.counter + "</soap:Name>" + "</soap:Counter>";
    }
    let XML = util.format(XML_ADD_COUNTER_ENVELOPE, sessionHandle, counterStr);
    let soapBody = Buffer.from(XML);
    options.body = soapBody;
    options.SOAPAction = `perfmonAddCounter`;

    let response = await fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options);

    let promiseResults = {
      cookie: "",
      results: "",
    };

    promiseResults.cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";

    let output = await parseXml(await response.text());
    // Remove unnecessary keys
    removeKeys(output, "$");

    if (!response.ok) {
      // Local throw; if it weren't, I'd use Error or a subclass
      throw { status: response.status, code: http.STATUS_CODES[response.status], sessionId: sessionHandle, message: output?.Body?.Fault?.faultstring ? output.Body.Fault.faultstring : "Unknown" };
    }

    if (output?.Body?.perfmonAddCounterResponse) {
      promiseResults.results = "success";
      return promiseResults;
    } else {
      throw { status: response.status, code: "", message: "Empty results" };
    }
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
  async removeCounter(sessionHandle, counter) {
    let options = this._OPTIONS;
    let server = this._HOST;

    let counterStr;
    if (Array.isArray(counter)) {
      counter.forEach((counter) => (counterStr += "<soap:Counter>" + "<soap:Name>" + "\\\\" + counter.host + "\\" + (counter.instance ? `${counter.object}(${counter.instance})` : counter.object) + "\\" + counter.counter + "</soap:Name>" + "</soap:Counter>"));
    } else {
      counterStr = "<soap:Counter>" + "<soap:Name>" + "\\\\" + counter.host + "\\" + (counter.instance ? `${counter.object}(${counter.instance})` : counter.object) + "\\" + counter.counter + "</soap:Name>" + "</soap:Counter>";
    }

    let XML = util.format(XML_REMOVE_COUNTER_ENVELOPE, sessionHandle, counterStr);
    let soapBody = Buffer.from(XML);
    options.body = soapBody;
    options.SOAPAction = `perfmonRemoveCounter`;

    let response = await fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options);

    let promiseResults = {
      cookie: "",
      results: "",
    };

    promiseResults.cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";

    let output = await parseXml(await response.text());
    // Remove unnecessary keys
    removeKeys(output, "$");

    if (!response.ok) {
      // Local throw; if it weren't, I'd use Error or a subclass
      throw { status: response.status, code: http.STATUS_CODES[response.status], sessionId: sessionHandle, message: output?.Body?.Fault?.faultstring ? output.Body.Fault.faultstring : "Unknown" };
    }

    if (output?.Body?.perfmonRemoveCounterResponse) {
      promiseResults.results = "success";
      return promiseResults;
    } else {
      throw { status: response.status, code: "", message: "Empty results" };
    }
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
   * @param {object} object - The counter to query. Example: Memory
   * @returns {object} returns JSON via a Promise. JSON contains Session Cookie (If availible) and Results.
   */
  async queryCounterDescription(object) {
    let options = this._OPTIONS;
    let server = this._HOST;
    let counterStr = "<soap:Counter>" + "\\\\" + object.host + "\\" + (object.instance ? `${object.object}(${object.instance})` : object.object) + "\\" + object.counter + "</soap:Counter>";
    let XML = util.format(XML_QUERY_COUNTER_ENVELOPE, counterStr);
    let soapBody = Buffer.from(XML);
    options.body = soapBody;
    options.SOAPAction = `perfmonQueryCounterDescription`;

    let response = await fetch(`https://${server}:8443/perfmonservice2/services/PerfmonService/`, options);

    let promiseResults = {
      cookie: "",
      object: object.object,
      results: "",
    };

    promiseResults.cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";

    let output = await parseXml(await response.text());
    // Remove unnecessary keys
    removeKeys(output, "$");

    if (!response.ok) {
      // Local throw; if it weren't, I'd use Error or a subclass
      throw { status: response.status, code: http.STATUS_CODES[response.status], object: object, message: output?.Body?.Fault?.faultstring ? output.Body.Fault.faultstring : "Unknown" };
    }

    if (output?.Body?.perfmonQueryCounterDescriptionResponse?.perfmonQueryCounterDescriptionReturn) {
      var returnResults = output.Body.perfmonQueryCounterDescriptionResponse.perfmonQueryCounterDescriptionReturn;
      promiseResults.results = clean(returnResults);
      return promiseResults;
    } else {
      // Return JSON with no results.
      return promiseResults;
    }
  }
}

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

const cleanResponse = (response) => {
  var newOutput;
  if (Array.isArray(response)) {
    newOutput = response.map((item) => {
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
    let arr = response.Name.split("\\").filter((element) => element);

    let instanceArr = arr[1].split(/[()]+/).filter(function (e) {
      return e;
    });

    newOutput = {
      host: arr[0],
      object: instanceArr[0],
      instance: instanceArr[1] ? instanceArr[1] : "",
      counter: arr[2],
      value: response.Value,
      cstatus: response.CStatus,
    };
  }
  return clean(newOutput);
};

module.exports = perfMonService;
