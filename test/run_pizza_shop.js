const path = require("path");
const CLICreator = require("../src/index");
async function run() {
  let config = require("./test_config.json");
  config.packagePath = path.resolve(config.packagePath);
  var cli = await CLICreator.createSingleModuleCLI(config);
  await cli.run();
}
run();
