"use strict"
const fs = require("fs");
const path = require("path");
const { execSync } = require('child_process')
const CLICreator = require("../src/index.js");

const BASE_CONFIG = JSON.parse(fs.readFileSync(path.resolve(__dirname, "base_config.json")));
const TEST_CONFIG = JSON.parse(fs.readFileSync(path.resolve(__dirname, "test_config.json")));
const MULTI_MODULE_CONFIG = JSON.parse(fs.readFileSync(path.resolve(__dirname, "test_modules.json")));

beforeAll(() => {
  fs.rmSync(path.resolve(__dirname, "base", "dist"), { recursive: true, force: true });
  fs.rmSync(path.resolve(__dirname, "pizza_shop", "dist"), { recursive: true, force: true });
  execSync("npm run build", { cwd: path.resolve(__dirname, "base") });
  execSync("npm run build", { cwd: path.resolve(__dirname, "pizza_shop") });
  process.chdir("./test");
});

afterAll(() => {
  fs.rmSync(path.resolve(__dirname, "pizza_shop", "dist"), { recursive: true, force: true });
  fs.rmSync(path.resolve(__dirname, "base", "dist"), { recursive: true, force: true });
});

test("Module config creation", () => {
  var config = CLICreator.createModuleConfig("./pizza_shop", "PizzaShop");
  expect(config).toEqual(TEST_CONFIG);
  // Replace relative package paths in the config files to absolute paths so that
  // CLI Module class (which is not in the test directory) can correctly require it
  TEST_CONFIG.packagePath = path.resolve(TEST_CONFIG.packagePath);
  BASE_CONFIG.packagePath = path.resolve(BASE_CONFIG.packagePath);
  for (const mod of MULTI_MODULE_CONFIG.modules) mod.packagePath = path.resolve(mod.packagePath);
});

test("Single module CLI: Happy path with provider factory", async () => {
  var cli = await CLICreator.createSingleModuleCLI(BASE_CONFIG, require("./base")["HelloFactory"], {scope: "universe"}, null, true);
  let resp = await cli.executeCommand("say-hello")
  expect(resp.response).toEqual("Hello Universe");

  cli = await CLICreator.createSingleModuleCLI(BASE_CONFIG, require("./base")["HelloFactory"], {scope: "world"}, null, true);
  resp = await cli.executeCommand("say-hello")
  expect(resp.response).toEqual("Hello World");
});

test("Single module CLI: Happy path without provider factory", async () => {
  var cli = await CLICreator.createSingleModuleCLI(TEST_CONFIG, null, null, null, true);
  let resp = await cli.executeCommand("list-orders")
  expect(resp.response).toEqual([]);
  resp = await cli.executeCommand("place-order -o dine-in -t -e bob@example.com -n bob -p 12345 bob cheese 1");
  expect(resp).toEqual({ "status": 0, "response": { "status": "placed", "id": 0, "customerName": "bob" } });
});


test("Single module CLI: Invalid commands", async () => {
  var cli = await CLICreator.createSingleModuleCLI(TEST_CONFIG, null, null, null, true);
  let resp = await cli.executeCommand("wrong-command");
  expect(resp.status).toEqual(1);
  resp = await cli.executeCommand("place-order");
  expect(resp.status).toEqual(1);
});

test("Multi module CLI: Happy path with provider factory", async () => {
  var cli = await CLICreator.createMultiModuleCLI(MULTI_MODULE_CONFIG, require("./pizza_shop")["TestFactory"], {scope: "world"}, null, true);
  let resp = await cli.executeCommand("i-hello say-hello")
  expect(resp.response).toEqual("Hello World");
  resp = await cli.executeCommand("pizza-shop place-order -o dine-in -t -e bob@example.com -n bob -p 12345 bob cheese 1");
  expect(resp).toEqual({ "status": 0, "response": { "status": "placed", "id": 0, "customerName": "bob" } });
});


test("Multi module CLI: Happy path without provider factory", async () => {
  var cli = await CLICreator.createMultiModuleCLI(MULTI_MODULE_CONFIG, null, null, null, true);
  let resp = await cli.executeCommand("pizza-shop list-orders")
  expect(resp.response).toEqual([]);
  resp = await cli.executeCommand("pizza-shop place-order -o dine-in -t -e bob@example.com -n bob -p 12345 bob cheese 1");
  expect(resp).toEqual({ "status": 0, "response": { "status": "placed", "id": 0, "customerName": "bob" } });
});


test("Multi module CLI: Invalid commands", async () => {
  var cli = await CLICreator.createMultiModuleCLI(MULTI_MODULE_CONFIG, null, null, null, true);
  let resp = await cli.executeCommand("wrong-command");
  expect(resp.status).toEqual(1);
  resp = await cli.executeCommand("place-order");
  expect(resp.status).toEqual(1);
});

test("Single module CLI: Shell invocation", () => {
  let resp = execSync("node run_cli say-hello");
  resp = resp.toString().trim();
  expect(resp).toEqual("\"Hello Universe\"");
});

test("Single module CLI: Shell invocation with option", () => {
  let resp = execSync("node run_cli --scope world say-hello");
  resp = resp.toString().trim();
  expect(resp).toEqual("\"Hello World\"");
});

test("Multi module CLI: Shell invocation", () => {
  let resp = execSync("node run_multi_cli i-hello say-hello");
  resp = resp.toString().trim();
  expect(resp).toEqual("\"Hello World\"");
});

test("Multi module CLI: Shell invocation with option", () => {
  let resp = execSync("node run_multi_cli --scope universe i-hello say-hello");
  resp = resp.toString().trim();
  expect(resp).toEqual("\"Hello Universe\"");
});

test("CLI-Creator global script: Multi module", () => {
  let resp = execSync("node " + path.resolve("..", "bin", "cli_creator.js") +
    " create-multi-config -V 2.0.0 baboon cli_test_input.json");
  resp = JSON.parse(resp.toString().trim());
  let expected = JSON.parse(fs.readFileSync("cli_test_multi.json"));
  expect(expected).toEqual(resp);
});

test("CLI-Creator global script: Single module", () => {
  let resp = execSync("node " + path.resolve("..", "bin", "cli_creator.js") +
    " create-config -V 2.0.0 --name hello ./base IHello");
  resp = JSON.parse(resp.toString().trim());
  let expected = JSON.parse(fs.readFileSync("cli_test_base.json"));
  expect(expected).toEqual(resp);
});

