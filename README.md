# cli-creator
Typescript libraries often provide a command line interface (CLI) to enable interactive use of their API. For example, AWS offers an SDK as well aws-cli, a command line tool to interact with cloud resources. Keeping the CLI in sync with the underlying APIs is time consuming and highly error prone process. `cli-creator` automates this process by generating CLI commands from Typescript interface or class type definition. This allows developers to keep their CLI in sync with the API changes by simply rebuilding the CLI code without any coding changes.
## Usage
Install globally or locally
```
npm i [-g] @nabh/cli-creator
```
### Command Line Usage
If you install `cli-extractor` globally, you can use `cli-extractor` CLI to create configuration files needed to convert your Typescript classes/interfaces into a CLI
```shell
> cli-creator --help
Usage: cli_creator [options] [command]

Options:
  -h, --help                                display help for command

Commands:
  create-config [options] [package] [type]  Create a config file that maps Typescript classes/interfaces to CLI commands.
  help [command]                            display help for command
```
```
> cli-creator create-config --help
Usage: cli_creator create-config [options] [package] [type]

Create a config file that maps Typescript classes/interfaces to CLI commands.

Arguments:
  package                           Name or root directory of a package
  type                              Class or interface that specifies signatures for CLI commands.

Options:
  -n, --name <cli-name>             Command/prompt name of the CLI
  -V, --version-string <file-name>  Version displayed for the generated CLI
  -i, --input <mapping-file>        JSON file that specifies Typescript types to be mapped to CLI commands
  -s, --save <file-name>            Path where the configuration will be saved.
  -h, --help                        display help for command

```
## Steps to create a single module CLI
### Identify target package and type
We will assume that you want to generate CLI that exposes methods defined on class `PizzaShop` in package `test`. Abridged source code for the class is shown below.
```typescript
export class PizzaShop {
  /**
   * Place a new order
   * @param customerName - Customer name
   * @param pizzaType Type of pizza
   * @param quantity - Number of pizzas. Default is 1
   * @param options - Order options
   * @returns Order object
   */
  placeOrder(customerName: string, pizzaType: pizzatype, quantity: number = 1, options?: OrderOptions): Order {
    /* Implementation code here */
  }

  /**
   * 
   * @param id - Order ID
   * @param name - Customer name associated with the order
   * @returns true if the order was successfully canceled
   * @throws Error if the id and customer name does not match
   */
  cancelOrder(id: number, name: string): boolean {
    /* Implementation code here */
  }

  /**
   * List current orders
   * @returns Array listing all orders
   */
  listOrders(): Order[] {
    /* Implementation code here */
  }
}
```

### Install `cli-creator` locally
Install `cli-creator` in your CLI package
```sh
> npm install @nabh/cli-creator
```

### Create CLI module configuration files
Add the following line in the `script` section of the `package.json` file
```json
{
  "scripts": {
    "create-cli-config": "cli-creator create-config -s cli-config.json test pizza-shop"
  }
}
```
Run the config creation script
```shell
> npm run create-cli-config
```
### Create main file to run CLI
Create a file named `cli.js` as shown below.
```javascript
const fs = require("fs");
const CLICreator = require("@nabh/cli-creator");
async function run() {
  let config = JSON.parse(fs.readFileSync("./cli-config.json"));
  var cli = await CLICreator.createSingleModuleCLI(config);
  await cli.run();
}
run();
```

### Execute a command using CLI
```shell
> node cli --help
Usage: pizza-shop [options] [command]

Pizza order management

Options:
  -v, --version                                                  output the version number
  -h, --help                                                     display help for command

Commands:
  cancel-order <id> <name>
  list-orders                                                    List current orders
  place-order [options] <customer-name> <pizza-type> [quantity]  Place a new order
  help [command]                                                 display help for command

> node cli place-order bob cheese
{
  "status": "placed",
  "id": 0,
  "customerName": "bob"
}
```
### Run commands in interactive mode
If you run `cli.js` file without a command, it will run in the interactive mode.
```shell
> node cli
pizza-shop> list-orders
[]
pizza-shop> place-order bob pepperoni
{
  "status": "placed",
  "id": 0,
  "customerName": "bob"
}
pizza-shop> list-orders
[
  {
    "status": "placed",
    "id": 0,
    "customerName": "bob"
  }
]
pizza-shop>
```
## Creating CLI for multiple Typescript Objects
The previous example walked through the creation of a CLI that enables invoking methods on an instance of a single Typescript class or an interface. It is also possible to create a CLI that has multiple modules corresponding to different Typescript classes/interfaces. For example, let's say that you want to create a CLI corresponding to two Typescript types: `IHello` interface in package `hello`, and `PizzaShop` class in package `pizza-shop`. The first step in creating a `multi-module` CLI is to create an input file that specify target Typescript types. For the current example, the input file will look like the one shown below.
```json
{
  "name": "cli-creator-test",
  "version": "2.0.0",
  "modules": [
    {
      "package": "hello",
      "type": "IHello"
    },
    {
      "package": "pizza-shop",
      "type": "PizzaShop"
    }
  ]
}
```
The next step is to create the config file for the target CLI by using `cli-creator` command.
```shell
> cli-creator create-config -i cli-input.json -s cli-config.json
```
The last step is to create the main file for the CLI as shown below.
```javascript
const path = require("path");
const CLICreator = require("@nabh/cli-creator");
const { TestFactory } = require("pizza-shop");

var MULTI_MODULE_CONFIG = require("./cli-config.json");

async function run() {
  var cli = await CLICreator.createMultiModuleCLI(MULTI_MODULE_CONFIG, TestFactory, {scope: "world"}, 
    [["-s, --scope <scope>", "Scope, either world or universe"]]);
  await cli.run();
}
run();
```
You can test the CLI by running the main file.
```shell
> node main.js
cli-creator-test> help
Usage: cli-creator-test [options] <module-command>

Arguments:
  module-command       Module command. If omitted, the program will run in interactive mode.

Options:
  -s, --scope <scope>  Scope, either world or universe
  -h, --help           display help for command

Available Modules:
  i-hello
  pizza-shop
Type <module-name> --help for module-specific help.

cli-creator-test> i-hello say-hello
"Hello World"
cli-creator-test> pizza-shop place-order bob cheese
{
  "status": "placed",  
  "id": 0,
  "customerName": "bob"
}
```
## Using an object factor to create provider instances
`cli-creator` needs to create an instance of Typescript class that executes CLI commands. By default, `cli-creator` tries to create an instance of the targeted class by using its no-args constructor. However, this is not possible if the target type is an interface. It is also possible that the class does not have a no-args constructor. In such cases, `cli-creator` allows you to pass in a `factory` class that can create the required instances. The factory class object and default configuration parameters can be passed to `createSingleModuleCLI` and `createMultiModuleCLI` methods on the `CLICreator` object. The factory class is expected to have a static `create` method that accepts an options object as its first argument. You can optionally process a second argument that provides the name of the module for which the instance to be created. In the example in the previous section, we passed in a `TestFactory` class and specified the default option variable `scope` to have value `world`. A sample implementation of `TestFactory` class is given below.
```typescript
export class TestFactory {
  static create(opts, moduleName) {
    if (moduleName == "i-hello") {
      if (opts?.scope == "world") return new HelloWorld();
      else return new HelloUniverse();
    } else {
      return new PizzaShop();
    }
  }
}
```
## CLI initialization options
Notice that the `TestFactor` creates instance of a different class depending on the value of an option named `scope`. In our example, we passed that as an argument to the `createMultiModuleCLI` call. It is also possible to let the CLI invoker to control such options on the command line, just include an array of option specifications as the fourth argument. `cli-creator` uses the `commander` package for the CLI implementation and the option specification array is passed through to the `option` method call on the `command` object.

<a name="CLICreator"></a>

## API Reference
Utility to transform Typescript classes and interfaces into CLI commands

**Kind**: global constant  

* [CLICreator](#CLICreator)
    * [.createModuleConfig(pkgNameOrPath, providerType, options)](#CLICreator.createModuleConfig) ⇒
    * [.createMultiModuleConfig(moduleSpecs, options)](#CLICreator.createMultiModuleConfig) ⇒
    * [.createSingleModuleCLI(config, providerFactory, factoryOptions, optionsSpec, apiMode)](#CLICreator.createSingleModuleCLI) ⇒
    * [.createMultiModuleCLI(config, providerFactory, factoryOptions, optionsSpec, apiMode)](#CLICreator.createMultiModuleCLI) ⇒

<a name="CLICreator.createModuleConfig"></a>

### CLICreator.createModuleConfig(pkgNameOrPath, providerType, options) ⇒
Create configuration file needed by cli-creator to map Typescript types to CLI commands

**Kind**: static method of [<code>CLICreator</code>](#CLICreator)  
**Returns**: Configuration object used to generate CLI  

| Param | Type | Description |
| --- | --- | --- |
| pkgNameOrPath | <code>string</code> | Name of the Typescript package or path to the root package directoy |
| providerType | <code>string</code> | Class or interface name that implements CLI commands |
| options | <code>object</code> | Available options specified as properties of the options object: |
| [options.name] | <code>string</code> | Name of the prompt/script for the CLI |
| [options.versionString] | <code>string</code> | Version string to be printed when client uses -v or --version option on CLI |
| [options.save] | <code>string</code> | Path to the file where the generated file is to be saved. If omitted, the method will print  the generated file to the console |

<a name="CLICreator.createMultiModuleConfig"></a>

### CLICreator.createMultiModuleConfig(moduleSpecs, options) ⇒
Create mapping configuration for CLI that can invoke commands on multiple modules corresponding to different Typescript objects

**Kind**: static method of [<code>CLICreator</code>](#CLICreator)  
**Returns**: Configuration object to be used by a multi-module CLI  

| Param | Type | Description |
| --- | --- | --- |
| moduleSpecs | <code>object</code> | {name: <name>, version: <version-string>, modules: [{package: <pkg>, type: <class-or-interface-name>}]} |
| [moduleSpec.name] | <code>string</code> | Name/prompt for the CLI |
| [moduleSpec.version] | <code>string</code> | Version string to be displayed when CLI is invoked with -v or --version option |
| [moduleSpec.modules] | <code>array</code> | Array of objects that specify package name and class/interface for that module |
| options | <code>object</code> | Available options specified as properties of the options object: |
| [options.name] | <code>string</code> | Name of the prompt/script for the CLI |
| [options.versionString] | <code>string</code> | Version string to be printed when client uses -v or --version option on CLI |
| [options.save] | <code>string</code> | Path to the file where the generated file is to be saved. If omitted, the method will print |

<a name="CLICreator.createSingleModuleCLI"></a>

### CLICreator.createSingleModuleCLI(config, providerFactory, factoryOptions, optionsSpec, apiMode) ⇒
**Kind**: static method of [<code>CLICreator</code>](#CLICreator)  
**Returns**: CLI object. Use "run" method for traditional CLI usage. Use "executeCommand" method for single command execution  

| Param | Type | Description |
| --- | --- | --- |
| config | <code>object</code> | Typescript types to commands mapping configuration |
| providerFactory | <code>object</code> | Factory class that can create instances of Objects that implement CLI commands |
| factoryOptions | <code>object</code> | Default option values supplied to the object factory. For example: {scope: "world"} |
| optionsSpec | <code>array</code> | CLI global command line options spec. Passed through unchanged to commander.  For example: [["-s, --scope <scope>", "Scope, either world or universe"]] |
| apiMode | <code>boolean</code> | true if you will be programmatically executing CLI commands. False by default. |

<a name="CLICreator.createMultiModuleCLI"></a>

### CLICreator.createMultiModuleCLI(config, providerFactory, factoryOptions, optionsSpec, apiMode) ⇒
**Kind**: static method of [<code>CLICreator</code>](#CLICreator)  
**Returns**: CLI object. Use "run" method for traditional CLI usage. Use "executeCommand" method for single command execution  

| Param | Type | Description |
| --- | --- | --- |
| config | <code>object</code> |  |
| providerFactory | <code>object</code> | Factory class that can create instances of Objects that implement CLI commands |
| factoryOptions | <code>object</code> | Default option values supplied to the object factory. For example: {scope: "world"} |
| optionsSpec | <code>array</code> | CLI global command line options spec. Passed through unchanged to commander.  For example: [["-s, --scope <scope>", "Scope, either world or universe"]] |
| apiMode | <code>boolean</code> | true if you will be programmatically executing CLI commands. False by default. |

