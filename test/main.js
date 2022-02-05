/*
const CLICreator = require("../src/index");
var name = "pizza-shop";
var pkg = "./pizza_shop";
var provider = "PizzaShop";
var cli = CLICreator.createSingletonInterface(name, pkg, provider);
*/
const CLICreator = require("../src/index.js");
CLICreator.createModuleConfig("./base", "IHello", { out: "base_config.json"})
var config = CLICreator.createModuleConfig("./pizza_shop", "PizzaShop", { out: "test_config.json"});
var cli = CLICreator.createSingleModuleCLI(config);
cli.run();
/*
async function test() {
  let result = await cli.executeCommand("list-orders");
  console.log("[OUT] " + JSON.stringify(result));
}
test();
*/
