"use strict";
const fs = require("fs");
const process = require("process");
const { Command, Option } = require("commander");
const CLIModule = require("./cli_module");
const createModuleConfig = require("../src/create_module_config");

/**
 * Utility to transform Typescript classes and interfaces into CLI commands
 */
const CLICreator = {
  /**
   * Create configuration file needed by cli-creator to map Typescript types to CLI commands
   * 
   * @param {string} pkgNameOrPath Name of the Typescript package or path to the root package directoy
   * @param {string} providerType Class or interface name that implements CLI commands
   * @param {object} options Available options specified as properties of the options object:
   * @param [options.name] {string} Name of the prompt/script for the CLI
   * @param [options.versionString] {string} - Version string to be printed when client uses -v or --version option on CLI
   * @param [options.save] {string} Path to the file where the generated file is to be saved. If omitted, the method will print 
   * the generated file to the console
   * @returns Configuration object used to generate CLI
   */
  createModuleConfig(pkgNameOrPath, providerType, options) {
    let config = createModuleConfig(pkgNameOrPath, providerType, options);
    if (options?.save) fs.writeFileSync(options.save, JSON.stringify(config, null, 2));
    return config;
  },

  /**
   * Create mapping configuration for CLI that can invoke commands on multiple modules corresponding to different Typescript objects
   * @param {object} moduleSpecs {name: <name>, version: <version-string>, modules: [{package: <pkg>, type: <class-or-interface-name>}]}
   * @param [moduleSpec.name] {string} Name/prompt for the CLI
   * @param [moduleSpec.version] {string} Version string to be displayed when CLI is invoked with -v or --version option
   * @param [moduleSpec.modules] {array} Array of objects that specify package name and class/interface for that module
   * @param {object} options Available options specified as properties of the options object:
   * @param [options.name] {string} Name of the prompt/script for the CLI
   * @param [options.versionString] {string} - Version string to be printed when client uses -v or --version option on CLI
   * @param [options.save] {string} Path to the file where the generated file is to be saved. If omitted, the method will print 
   * @returns Configuration object to be used by a multi-module CLI
   */
  createMultiModuleConfig(moduleSpecs, options) {
    let mmConfig = {name: moduleSpecs.name, version: moduleSpecs.version};
    if (options?.name) mmConfig.name = options.name;
    if (options?.versionString) mmConfig.version = options.versionString;
    let configs = [];
    mmConfig.modules = configs;
    for (const modSpec of moduleSpecs.modules) {
      configs.push(createModuleConfig(modSpec.package, modSpec.type, modSpec.options));
    }
    if (options?.save) {
      fs.writeFileSync(options.save, JSON.stringify(mmConfig, null, 2));
    }
    return mmConfig;
  },

  /**
   * 
   * @param {object} config Typescript types to commands mapping configuration
   * @param {object} providerFactory Factory class that can create instances of Objects that implement CLI commands
   * @param {object} factoryOptions Default option values supplied to the object factory. For example:
   * {scope: "world"}
   * @param {array} optionsSpec CLI global command line options spec. Passed through unchanged to commander. 
   * For example: [["-s, --scope <scope>", "Scope, either world or universe"]]
   * @param {boolean} apiMode true if you will be programmatically executing CLI commands. False by default.
   * @returns CLI object. Use "run" method for traditional CLI usage. Use "executeCommand" method for single command execution
   */
  async createSingleModuleCLI(config, providerFactory, factoryOptions, optionsSpec, apiMode) {
    let cli = new SingleModuleCLI(config, providerFactory, factoryOptions, optionsSpec);
    if (apiMode) {
      await cli.init();
      cli.setSilent(true);    
    }
    return cli;
  },

  /**
   * 
   * @param {object} config 
   * @param {object} providerFactory Factory class that can create instances of Objects that implement CLI commands
   * @param {object} factoryOptions Default option values supplied to the object factory. For example:
   * {scope: "world"}
   * @param {array} optionsSpec CLI global command line options spec. Passed through unchanged to commander. 
   * For example: [["-s, --scope <scope>", "Scope, either world or universe"]]
   * @param {boolean} apiMode true if you will be programmatically executing CLI commands. False by default.
   * @returns CLI object. Use "run" method for traditional CLI usage. Use "executeCommand" method for single command execution
   */
  async createMultiModuleCLI(config, providerFactory, factoryOptions, optionsSpec, apiMode) {
    let cli = new MultiModuleCLI(config, providerFactory, factoryOptions, optionsSpec);
    if (apiMode) {
      cli.setSilent(true);    
    }
    return cli;
  }

};

class SingleModuleCLI {
  constructor(config, providerFactory, factoryOptions, optionSpecs) {
    this.config = config;
    this.providerFactory = providerFactory;
    this.factoryOptions = factoryOptions ? factoryOptions : {};
    this.interactive = true;
    this.optionSpecs = optionSpecs;

    this.optionFlags = {};
    this.options = [];
    if (optionSpecs) {
      this.optionFlags = {};
      for (const opt of optionSpecs) {
        let optObj = new Option(...opt);
        this.options.push(optObj);
        if (optObj.short) this.optionFlags[optObj.short] = optObj;
        if (optObj.long) this.optionFlags[optObj.long] = optObj;
      }
    }
  }

  async init() {
    this.cliModule = await this.createCLIModule(this.config);
    this.name = this.cliModule.name;
  }

  async createCLIModule(config, moduleName, programName) {
    let provider = undefined;
    if (this.providerFactory) {
      let opts = this.factoryOptions ? this.factoryOptions : {};
      provider = await this.providerFactory.create(opts, moduleName);
    }
    return new CLIModule(config, provider, this.optionSpecs, programName);
  }

  setSilent(flag) {
    this.cliModule.setSilent(flag);
  }

  async executeCommand(cmd) {
    return await this.exec(parseArgString(cmd));
  }

  async exec(argv) {
    return await this.cliModule.execCommand(argv);
  }

  getOption(flag) {
    return this.optionFlags[flag];
  }

  async run() {
    try {
      let optPlus = extractOptions(process.argv, this);
      if (optPlus.options) Object.assign(this.factoryOptions, optPlus.options);
      await this.init();
      if (optPlus.execAndExit) {
        this.interactive = false;
        await this.exec(process.argv.slice(optPlus.startIndex));
      } else {
        await this.interact();
      }
    } catch (e) {
      console.log(e.message);
    }
  }

  async interact() {
    this.interactive = true;
    const rl = require("readline-sync");
    var answer = undefined;
    while (answer != "exit") {
      answer = rl.question(this.name + "> ");
      if (answer != "exit") {
        await this.exec(parseArgString(answer));
      }
    }
  }
}

class MultiModuleCLI extends SingleModuleCLI {
  constructor(mmConfig, providerFactory, factoryOptions, optionsSpec) {
    super(null, providerFactory, factoryOptions, optionsSpec);
    this.program = new Command(mmConfig.name);
    this.name = mmConfig.name;
    this.program.version = mmConfig.version ? mmConfig.version : "1.0.0";
    for (const opt of this.options) this.program.addOption(opt);
    this.program.argument("<module-command>", "Module command. If omitted, the program will run in interactive mode.");
    this.program.exitOverride();
    this.modules = {};
    this.silent = false;
    this.moduleList = [];
    this.moduleMap = {};
    for (const modSpec of mmConfig.modules) {
      this.moduleList.push(modSpec.name);
      this.moduleMap[modSpec.name] = modSpec;
    }
  }

  async init() {
    // We do lazy initialization of modules so nothing to be done here
  }

  setSilent(flag) {
    this.silent = flag;
    Object.keys(this.modules).forEach((key) => this.modules[key].setSilent(flag));
  }

  async exec(argv) {
    if (argv.length == 1 && (argv[0] == "help" || argv[0] == "-h" || argv[0] == "--help")) {
      this.showHelp();
      return;
    }
    if (argv.length == 1 && (argv[0] == "version" || argv[0] == "-v" || argv[0] == "--version")) {
      this.showVersion();
      return;
    }
    let cliModule = this.modules[argv[0]];
    if (!cliModule) {
      try {
        let modConfig = this.moduleMap[argv[0]];
        if (!modConfig) return { status: 1, 
          error: { code: "module.not_configured", message: "Module " + argv[0] + 
          " has not been configured."}};
        cliModule = await this.createCLIModule(modConfig, modConfig.name, this.name);
        cliModule.setSilent(this.silent);
        this.modules[argv[0]] = cliModule;
      } catch (e) {
        return { status: 1, error: e };
      }
    }
    return await cliModule.execCommand(argv.slice(1));
  }

  showHelp() {
    try {
      this.program.parse(["node", "programname", "--help"]);
    } catch (e) {
      // Ignore error caused by exit override
    }
    console.log("");
    console.log("Available Modules:");
    for (const mod of this.moduleList) {
      console.log("  " + mod);
    }
    let moreHelp = this.interactive ? "Type <module-name> --help for module-specific help." :
      "Type " + this.name + " <module-name> --help for module-specific help.";
    console.log(moreHelp);
  }

  showVersion() {
    console.log(this.program.version);
  }
}

function extractOptions(argv, module) {
  let metaOptions = {help: true, "--help": true, "-h": true, "--version": true, "-v": true};
  let optPlus = { startIndex: 2 };
  let opts = {};
  optPlus.options = opts;
  let i = 2;
  while (i < argv.length) {
    let option = module.getOption(argv[i]);
    if (!option) {
      if (argv[i].startsWith("-") && !metaOptions[argv[i]]) throw new Error("Invalid option: " + argv[i]);
      optPlus.execAndExit = true;
      optPlus.startIndex = i;
      return optPlus;
    }
    if (option.required) {
      if (i+1 == argv.length) throw new Error("You must specify value for option " + argv[i]);
      opts[option.attributeName()] = argv[i+1];
      i++;
    } else {
      opts[option.attributeName()] = true;
    }
    i++;
  }
  if (argv.length == 3 && (argv[2] == "-h" || argv[2] == "--help" || argv[2] == "-v" || argv[2] == "--version")) {
    optPlus.execAndExit = true;
  }
  return optPlus;
}

function parseArgString(argString) {

  argString = argString.trim();

  var i = 0;
  var prev = null;
  var curr = null;
  var withinQuotes = null;
  var argv = [];

  for (let j = 0; j < argString.length; j++) {
    prev = curr;
    curr = argString.charAt(j);

    // Move to next position if we current character is a space
    // unless we are within quotes
    if (curr === " " && !withinQuotes) {
      // If previous character was a quotes, just skip this space
      if (!(prev === " ")) {
        i++;
      }
      continue;
    }

    if (curr === withinQuotes) {
      withinQuotes = null;
      continue;
    } else if ((curr === "'" || curr === "\"") && !withinQuotes) {
      withinQuotes = curr;
      continue;
    }

    if (!argv[i]) argv[i] = "";
    argv[i] += curr;
  }

  return argv;
}

module.exports = CLICreator;