const path = require("path");
const CLICreator = require("../src/index");
async function run() {
  let config = require("./base_config.json");
  config.packagePath = path.resolve(config.packagePath);
  var cli = await CLICreator.createSingleModuleCLI(config, require("./base")["HelloFactory"], null, [["-s, --scope <scope>", "Scope, either world or universe"]]);
  await cli.run();
}
run();
