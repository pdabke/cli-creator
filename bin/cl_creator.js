#!/usr/bin/env node

"use strict";
var fs = require("fs");
var program = require("commander");
var CLICreator = require("../src/index");

program.command("create-config")
  .description("Create a config file for a single module CLI")
  .argument("<package>", "Name or root directory of a package")
  .argument("<type>", "Class or interface that specifies signatures for CLI commands.")
  .option("-n, --name <file-name>", "Command/prompt name of the CLI. The name is used in the help messages")
  .option("-V, --version-string <file-name>", "Version displayed for the generated CLI")
  .option("-s, --save <file-name>", "Path where the configuration will be saved.")
  .action((pkg, type, options) => {
    let config = CLICreator.createModuleConfig(pkg, type, options);
    if (!options?.save) console.log(JSON.stringify(config, null, 2));
  });

program.command("create-multi-config")
  .description("Create a config file for a multiple module CLI")
  .argument("<name>", "Command/prompt name of the CLI. The name is used in the help messages")
  .argument("<input-config-file>", "Path of the file specifying source packages and types")
  .option("-V, --version-string <file-name>", "Version displayed for the generated CLI")
  .option("-s, --save <file-name>", "Path where the configuration will be saved.")
  .action((name, inputConfigFile, options) => {
    let moduleSpec = JSON.parse(fs.readFileSync(inputConfigFile));
    let config = CLICreator.createMultiModuleConfig(name, moduleSpec, options);
    if (!options?.save) console.log(JSON.stringify(config, null, 2));
  });

program.parse();
