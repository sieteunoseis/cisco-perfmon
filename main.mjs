import { createRequire } from "module";
const require = createRequire(import.meta.url);
const perfMonService = require("./main.js");

export default perfMonService;
