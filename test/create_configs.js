const CLICreator = require("../src/index.js");
CLICreator.createModuleConfig("./base", "IHello", { save: "base_config.json" })
CLICreator.createModuleConfig("./pizza_shop", "PizzaShop", { save: "test_config.json" });
CLICreator.createMultiModuleConfig(
  {
    "name": "cli-creator",
    "modules":
      [
        { package: "./base", type: "IHello" },
        { package: "./pizza_shop", type: "PizzaShop" }
      ]
    },{ save: "test_modules.json" });
