/**
 * Lets node verify scripts import components that include a CSS side effect.
 */
const Module = require("node:module");
Module._extensions[".css"] = function loadCss(module) {
  module.exports = {};
};
