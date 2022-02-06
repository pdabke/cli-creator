"use strict";
const fs = require("fs");
const { APIExtractor } = require("@nabh/ts-api-extractor");

function createModuleConfig(pkgNameOrPath, typeName, options) {
  var packageMap = {};
  var pkgInfo = APIExtractor.extract(pkgNameOrPath);
  packageMap[pkgInfo.package.name] = pkgInfo;
  // Get raw API informatino for all packages
  let intf = pkgInfo.metadata[typeName];
  if (!intf) {
    throw new Error("Type " + typeName + " does not exist in package " + pkgInfo.package.name);
  }

  let config = {};
  config.name = options?.name ? options.name : camelCaseToDash(typeName);
  config.packageName = pkgInfo.package.package;
  if (fs.existsSync(pkgNameOrPath)) config.packagePath = pkgNameOrPath;
  config.version = options?.versionString ? options.versionString : pkgInfo.package.version;
  config.providerType = typeName;
  let methods = [];
  config.methods = methods;
  if (intf.comment) config.comment = intf.comment;
  for (const method of intf.methods) {
    if (method.isProtected) continue;
    let m = { name: method.name };
    if (method.returns.type.startsWith("Promise")) m.isAsync = true;
    if (method.comment) m.comment = method.comment;
    let params = [];
    for (const p of method.params) {
      let pname = p.name;
      if (pname == "options") {
        addOptions(m, p, packageMap, pkgInfo.package);
      } else {
        let pInfo = { name: p.name };
        if (p.isOptional) pInfo.isOptional = true;
        if (p.comment) pInfo.comment = p.comment;
        setType(pInfo, p.type, packageMap, p.package, pkgInfo.package);
        params.push(pInfo);
      }
    }
    m.params = params;
    methods.push(m);
  }
  return config;
}

function setType(pInfo, ty, packageMap, pkg, basePkg) {

  if (ty.includes("|")) {
    let types = ty.split("|");
    types = types.map((elem) => { return elem.trim(); });
    for (const t of types) {
      if (t == "string" || t == "boolean" || t == "number" || t == "Stream" || t == "Buffer" || t == "Date") {
        pInfo.type = t;
        return;
      }

    }
    ty = types[0];
  }

  if (!pkg) {
    pInfo.type = ty;
    return;
  }

  pInfo.type = ty;
  let typeDef = lookupType(ty, packageMap, pkg, basePkg);
  if (!typeDef) {
    return;
  }
  if (typeDef.kind == "type-alias") {
    // check if this is different string options
    let nonStringType = null;
    for (const item of typeDef.types) {
      if ((item.startsWith("\"") || item.startsWith("'"))) continue;
      nonStringType = item;
    }
    if (nonStringType) {
      pInfo.type = nonStringType;
    } else {
      pInfo.type = "string";
      pInfo.choices = typeDef.types.map((val) => { return val.substring(1, val.length - 1); });
    }
  } else if (typeDef.kind == "enum") {
    let choices = typeDef.members.map((item) => { return item.value; });
    if (choices[0].startsWith("'") || choices[0].startsWith("\"")) {
      choices = choices.map((val) => { return val.substring(1, val.length - 1); });
      pInfo.type = "string";
      pInfo.choices = choices;
    } else {
      pInfo.type = "number";
      pInfo.choices = choices;
    }
  }
}

function lookupType(ty, packageMap, pkg, basePkg) {
  let pkgInfo = packageMap[pkg];
  if (!pkgInfo) {
    pkgInfo = APIExtractor.extract(pkg, basePkg);
  }
  if (!pkgInfo) throw new Error("Failed to find package " + pkg);
  packageMap[pkgInfo.package.name] = pkgInfo;
  return pkgInfo["metadata"][ty];
  /*
  let packages = Object.keys(packageMap);
  for (const p of packages) {
    if (packageMap[p]["metadata"][ty]) return packageMap[p]["metadata"][ty];
  }
  */
}

function addOptions(mInfo, optionsDef, packageMap, basePkg) {
  let typeDef = lookupType(optionsDef.type, packageMap, optionsDef.package, basePkg);
  // packageMap[optionsDef["package"]]["metadata"][optionsDef["type"]];
  let opts = [];
  mInfo.options = opts;

  for (const prop of typeDef.properties) {
    let o = { name: prop.name, comment: prop.comment };
    if (prop.isOptional) o.isOptional = true;
    setType(o, prop.type, packageMap, prop.package, basePkg);
    opts.push(o);
  }
  let ex = typeDef["extends"];
  while (ex) {
    let superType = lookupType(ex.type, packageMap, ex.package, basePkg);
    // packageMap[ex["package"]]["metadata"][ex["type"]];
    for (const prop of superType.properties) {
      let o = { name: prop.name, comment: prop.comment };
      if (prop.isOptional) o.isOptional = true;
      setType(o, prop.type, packageMap, prop.package, basePkg);
      opts.push(o);
    }
    ex = superType["extends"];
  }
}

function camelCaseToDash(str) {
  if (str != str.toLowerCase()) {
    str = str.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
  }
  if (str.startsWith("-")) str = str.substring(1);
  return str;
}
module.exports = createModuleConfig;