"use strict";
const process = require("process");
const { Command, Argument, Option, InvalidArgumentError } = require("commander");

const ARG_PARSERS = {
  "string": function (value) { return value; },

  "number": function (value, name) {
    const parsedValue = Number(value);
    if (isNaN(parsedValue)) {
      throw new InvalidArgumentError(name + " must be a number");
    }
    return parsedValue;
  },

  "Date": function (value, name) {

    const parsedValue = Date.parse(value);
    if (isNaN(parsedValue)) {
      throw new InvalidArgumentError(name + " is not a valid date.");
    }
    return new Date(parsedValue);
  },

  "boolean": function (value, name) {
    if (!value) return false;
    if (value === true || value === "true") return true;
    if (value === "false") return false;
    throw new InvalidArgumentError(name + " must be true or false");
  },

  "any": function (value, name) {
    if (!value) return undefined;
    try {
      return JSON.parse(value);
    } catch (e) {
      throw new InvalidArgumentError(name + " is not a valid JSON object.");
    }

  }

};

var COMMAND_RESPONSE = {
  status: 0,
  response: undefined,
  error: undefined
};

function setResponse(resp) {
  COMMAND_RESPONSE.status = 0;
  COMMAND_RESPONSE.response = resp;
  COMMAND_RESPONSE.error = undefined;
}

function setError(err) {
  COMMAND_RESPONSE.status = 1;
  COMMAND_RESPONSE.response = undefined;
  COMMAND_RESPONSE.error = err;
}

class CLIModule {
  constructor(config, provider, optionSpecs, programName) {
    this.notSilent = true;
    if (provider) this.provider = provider;
    else {
      let pkg = undefined;
      try {
        if (config.packageName) {
          pkg = require(config.packageName);
        }
      } catch (e) {
        // ignore
      }
      if (!pkg) {
        try {
          if (config.packagePath) {
            try {
              pkg = require(config.packagePath);
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          // ignore
        }
      }
      if (pkg) {
        try {
          this.provider = new pkg[config.providerType];
        } catch (e) {
          // Ignore error since the provider may be set later and the
          // target type may not have an empty constructor
        }
      }
    }
    if (!this.provider) throw new Error("Could not set the module provider.");
    this.name = config.name;
    this.program = new Command();
    this.program.version(config.version, "-v, --version");
    this.program.exitOverride();
    if (programName) programName = programName + " ";
    else programName = "";
    this.program.name(programName + config.name);
    if (config.comment) this.program.description(config.comment);
    this.setupCommands(this.program, this.provider, config.methods);
    if (optionSpecs) {
      for (const opt of optionSpecs) this.program.option(...opt);
    }
  }

  /* options = { from: 'user' } for interactive processing */
  async execCommand(args) {
    try {
      await this.program.parseAsync(args, { from: "user" });
      return COMMAND_RESPONSE;
    } catch (e) {
      // This error is a commander error, not an error thrown by the 
      // implementation
      // Ignore CommanderError with exit code 0 since that corresponds
      // to a help command and the error is thrown by exitOverride()

      if (e.exitCode == 0) setResponse(undefined);
      else setError(e);

      return COMMAND_RESPONSE;
    }
  }

  setupCommands(program, provider, commandConfigs) {
    for (const cInfo of commandConfigs) {
      let cmdStr = camelCaseToDash(cInfo.name); // constructCommandString(cInfo.method, cInfo.params);
      let cmd = program.command(cmdStr);
      if (cInfo.comment) cmd.description(cInfo.comment);
      let argFuncs = addArgs(cmd, cInfo.params);
      let argNames = cInfo.params.map((p) => { return p.name; });
      let optFuncs = {};
      if (cInfo.options) {
        let optStrs = constructOptionFlags(cInfo.options);
        optFuncs = addOptions(cmd, cInfo.options, optStrs);
      }

      // Need to use an intermediate function to ensure correct "this"
      // value when we call the actual method on the provider object
      cmd.action(async (...args) => {

        // Commander was designed to execute one command and exit. Here we
        // support an interactive mode and unfortunately some state has to
        // be reset in the Command object when it is reused.
        args[args.length - 1]._optionValueSources = {};
        args[args.length - 1]._optionValues = {};

        let response = undefined;
        let typedCmdArgs = [];
        try {
          for (let i = 0; i < argFuncs.length; i++) {
            if (args[i] === undefined) {
              typedCmdArgs.push(undefined);
              continue;
            }
            if (Array.isArray(args[i])) {
              let typedArray = [];
              for (const c of args[i]) typedArray.push(argFuncs[i](c, argNames[i]));
              typedCmdArgs.push(typedArray);
            } else {
              typedCmdArgs.push(argFuncs[i](args[i], argNames[i]));
            }
          }
          // Push options
          let opts = args[args.length - 2];
          Object.keys(opts).forEach((key) => {
            opts[key] = optFuncs[key]["func"](opts[key], optFuncs[key]["name"]);
          });
          typedCmdArgs.push(args[args.length - 2]);
          if (cInfo.isAsync) response = await provider[cInfo.name](...typedCmdArgs);
          else response = provider[cInfo.name](...typedCmdArgs);
          this.printResult(JSON.stringify(response, null, 2));
          setResponse(response);
        } catch (e) {
          // Retry if the command involves a remote call and fails due to 
          // connectivity issues. For example this happens with AWS sdk v3
          if (e.code == "ECONNABORTED") {
            try {
              if (cInfo.isAsync) response = await provider[cInfo.name](...typedCmdArgs);
              else response = provider[cInfo.name](...typedCmdArgs);
              this.printResult(JSON.stringify(response, null, 2));
              setResponse(response);
            } catch (e1) {
              if (e1.message) this.printResult(e1.message);
              else this.printResult(e1);
              setError(e1);
            }
          } else {
            if (e.message) this.printResult(e.message);
            else this.printResult(e);
            setError(e);
          }
        }
      });
    }
  }

  setSilent(flag) {
    this.notSilent = !flag;
    if (flag) {
      // When silent mode is true, override console output functions
      // with no-op functions
      this.program.configureOutput({
        writeOut: () => { },
        writeErr: () => { },
        outputError: () => { }
      });
    } else {
      this.program.configureOutput({
        writeOut: (str) => process.stdout.write(str),
        writeErr: (str) => process.stderr.write(str),
        outputError: (str, write) => write(str)
      });
    }
  }

  printResult(message) {
    if (this.notSilent) console.log(message);
  }
}
function addArgs(cmd, params) {
  let argFuncs = [];
  for (const param of params) {
    let variadic = param.isList ? "..." : "";
    let name = camelCaseToDash(param.name);
    let argName = param.isOptional ? "[" + name + variadic + "]" : "<" + name + variadic + ">";
    let comment = param.comment;
    let arg = new Argument(argName, comment);
    if (param.choices) arg.choices(param.choices);
    if (param.default) arg.default(param.default);
    arg.required = param.isOptional ? false : true;
    let argFunc = ARG_PARSERS[param.type];
    if (!argFunc) argFunc = ARG_PARSERS["any"];
    // We are not overriding the argParser because then it loses
    // built in check for choices and processing of variadic options
    // Instead we do the type conversion at the execution time
    // arg.argParser(argFunc);

    argFuncs.push(argFunc);
    cmd.addArgument(arg);
  }
  return argFuncs;
}

function addOptions(cmd, opts, optFlags) {
  let argFuncs = {};
  for (let i = 0; i < opts.length; i++) {
    let opt = opts[i];
    let optStr = null;
    if (opt.type == "boolean") {
      optStr = optFlags[i];
    } else {
      let variadic = opt.isList ? "..." : "";
      let name = camelCaseToDash(opt.name);
      let argName = "<" + name + variadic + ">";
      optStr = optFlags[i] + " " + argName;
    }
    let comment = opt.comment;
    let arg = new Option(optStr, comment);
    if (opt.choices) arg.choices(opt.choices);
    if (opt.default) arg.default(opt.default);
    let argFunc = ARG_PARSERS[opt.type];
    if (!argFunc) argFunc = ARG_PARSERS["any"];
    // We are not overriding the argParser because then it loses
    // built in check for choices and processing of variadic options
    // Instead we do the type conversion at the execution time
    // arg.argParser(argFunc);

    cmd.addOption(arg);
    argFuncs[arg.attributeName()] = { name: optFlags[i], func: argFunc };
  }
  return argFuncs;
}


function constructOptionFlags(oInfos) {
  let usedFlags = { "h": true, "v": true };
  let optStrs = [];
  for (const oInfo of oInfos) {
    let oname = oInfo.name;
    let flg = null;
    let opt = null;
    for (let i = 0; i < oname.length; i++) {
      let f = oname[i].toLowerCase();
      if (!usedFlags[f]) {
        flg = f;
        usedFlags[flg] = true;
        break;
      } else if (!usedFlags[f.toUpperCase()]) {
        flg = f.toUpperCase();
        usedFlags[flg] = true;
        break;
      }
    }
    if (!flg) throw new Error("Could not find a flag");
    opt = "-" + flg + ", --" + camelCaseToDash(oInfo.name);
    optStrs.push(opt);
  }
  return optStrs;
}

function camelCaseToDash(ccStr) {
  if (ccStr != ccStr.toLowerCase()) {
    ccStr = ccStr.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
  }
  return ccStr;
}



module.exports = CLIModule;