"use strict";
const fs = require("fs");
const process = require("process");
const { Command, Option } = require("commander");
const CLIModule = require("./cli_module");
const createModuleConfig = require("../src/create_module_config");

const CLICreator = {
  createModuleConfig(pkgNameOrPath, providerType, options) {
    let config = createModuleConfig(pkgNameOrPath, providerType, options);
    if (options?.save) fs.writeFileSync(options.save, JSON.stringify(config, null, 2));
    return config;
  },

  createMultiModuleConfig(name, moduleSpecs, options) {
    let mmConfig = {name: name};
    if (options?.versionString) mmConfig.version = options.versionString;
    let configs = [];
    mmConfig.modules = configs;
    for (const modSpec of moduleSpecs) {
      configs.push(createModuleConfig(modSpec.package, modSpec.type, modSpec.options));
    }
    if (options?.save) {
      fs.writeFileSync(options.save, JSON.stringify(mmConfig, null, 2));
    }
    return mmConfig;
  },

  async createSingleModuleCLI(config, providerFactory, factoryOptions, optionsSpec, apiMode) {
    let cli = new SingleModuleCLI(config, providerFactory, factoryOptions, optionsSpec);
    if (apiMode) {
      await cli.init();
      cli.setSilent(true);    
    }
    return cli;
  },

  async createMultiModuleCLI(multiConfig, providerFactory, factoryOptions, optionsSpec, apiMode) {
    let cli = new MultiModuleCLI(multiConfig, providerFactory, factoryOptions, optionsSpec);
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