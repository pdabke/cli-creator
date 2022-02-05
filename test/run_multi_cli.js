const path = require("path");
const CLICreator = require("../src/index");
const { TestFactory } = require("./pizza_shop");

var MULTI_MODULE_CONFIG = require("./test_modules.json");
for (const mod of MULTI_MODULE_CONFIG.modules) mod.packagePath = path.resolve(mod.packagePath);

async function run() {
  var cli = await CLICreator.createMultiModuleCLI(MULTI_MODULE_CONFIG, TestFactory, {scope: "world"}, 
    [["-s, --scope <scope>", "Scope, either world or universe"]]);
  await cli.run();
}
run();
