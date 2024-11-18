# Cisco RisPort Library

Simple library to pull Perfmon stats from a Cisco CUCM via SOAP.

Perfmon information can be found at
[PerfMon API Reference](https://developer.cisco.com/docs/sxml/#!perfmon-api-reference).

## Installation

Using npm:

```javascript
npm i -g npm
npm i --save cisco-perfmon
```

## Requirements

This package uses the built in Fetch API of Node. This feature was first introduced in Node v16.15.0. You may need to enable expermential vm module. Also you can disable warnings with an optional enviromental variable.

Also if you are using self signed certificates on Cisco VOS products you may need to disable TLS verification. This makes TLS, and HTTPS by extension, insecure. The use of this environment variable is strongly discouraged. Please only do this in a lab enviroment.

Suggested enviromental variables:

```env
NODE_OPTIONS=--experimental-vm-modules
NODE_NO_WARNINGS=1
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Usage

Note: Rather than use string with backslashes i.e. "\\cucm3\Cisco CallManager\CallsActive", opted to pass these via JSON to the functions. See below:

```javascript
const perfMonService = require("../main");

// Set up new PerfMon service
let service = new perfMonService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt"
);

var counterObj = {
  host: cucmServerName,
  object: "Cisco CallManager",
  instance: "",
  counter: "CallsActive",
};

console.log("Let's get a description of our counter.");
service
  .queryCounterDescription(counterObj)
  .then((response) => {
    console.log("queryCounterDescription", response.results);
  })
  .catch((error) => {
    console.log(error.message);
  });
```

## Examples

```javascript
npm run test
```

## Output Examples

```
  Success Example
  {
    host: 'cucm01-pub',
    object: 'Cisco CallManager',
    instance: '',
    counter: 'PRIChannelsActive',
    value: '0',
    cstatus: '1'
  }

  Error Example
  {
    status: 500,
    code: 'Internal Server Error',
    host: 'cucm01-pub',
    counter: 'SAML SSO',
    message: 'Exceeded allowed rate for Perfmon information. Current allowed rate for perfmon information is 80 requests per minute.PerfmonService'
  }
```

Note: Test are using Cisco's DevNet sandbox information. Find more information here: [Cisco DevNet](https://devnetsandbox.cisco.com/)