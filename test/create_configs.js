const CLICreator = require("../src/index.js");
CLICreator.createModuleConfig("./base", "IHello", { out: "base_config.json"})
CLICreator.createModuleConfig("./pizza_shop", "PizzaShop", { out: "test_config.json"});
CLICreator.createMultiModuleConfig("cli-creator", 
  [
    {package: "./base", type: "IHello"},
    {package: "./pizza_shop", type: "PizzaShop"}
  ], "test_modules.json");
