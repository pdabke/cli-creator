#!/usr/bin/env node

"use strict";
var fs = require("fs");
var program = require("commander");
var CLICreator = require("../src/index");

program.command("create-config")
  .description("Create a config file that maps Typescript classes/interfaces to CLI commands.")
  .argument("[package]", "Name or root directory of a package")
  .argument("[type]", "Class or interface that specifies signatures for CLI commands.")
  .option("-n, --name <cli-name>", "Command/prompt name of the CLI")
  .option("-V, --version-string <file-name>", "Version displayed for the generated CLI")
  .option("-i, --input <mapping-file>", "JSON file that specifies Typescript types to be mapped to CLI commands")
  .option("-s, --save <file-name>", "Path where the configuration will be saved.")
  .action((pkg, type, options) => {
    let config = undefined;
    if (pkg) {
      if (!type) {
        console.log("You must specify the package as well as the type name.");
        return;
      } else {
        if (options?.input) {
          console.log("You can either specify package and type or the input spec file");
          return;
        }
      }
      config = CLICreator.createModuleConfig(pkg, type, options);
    } else {
      if (!options?.input) {
        console.log("You must specify either package/type or input specification file")
      }
      try {
        let moduleSpec = JSON.parse(fs.readFileSync(options.input));
        if (!moduleSpec.modules || moduleSpec.modules.length == 0) {
          console.log("You must define atleast one module.");
          return;
        }
        if (!options) options = {};
        if (moduleSpec.modules.length == 1) {
          // Single module CLI
          if (!options?.name) if (moduleSpec.name) options.name = moduleSpec.name;
          if (!options?.versionString) if (moduleSpec.version) options.versionString = moduleSpec.version;
          config = CLICreator.createModuleConfig(moduleSpec.modules["package"], moduleSpec.modules["type"], options);
        } else {
          config = CLICreator.createMultiModuleConfig(moduleSpec, options);
        }
      } catch (e) {
        console.log("Invalid input file path of content.");
        console.log(e);
      }
    }
    if (!options?.save) console.log(JSON.stringify(config, null, 2));
  });

program.parse();
