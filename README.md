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
