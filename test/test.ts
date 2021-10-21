require("source-map-support").install();

import {strict as assert} from "assert";
import * as fs from "fs";
import * as path from "path";

import {Group as CanaryGroup} from "canary-test";
// @ts-ignore
import * as fsExtra from "fs-extra";

import {zbsCliMain} from "../src/cli";
import {zbsProcessSpawnDump} from "../src/process";

export const canary = CanaryGroup("Zebes");

function zebes(cwd: string, args: string[]) {
    console.log("Test: $ zebes", args.join(" "));
    return zbsCliMain(["node", "zebes", ...args], cwd);
}

function cloneMaterials(materialsPath: string): string {
    const cwd = process.cwd();
    const materialsDir = path.join(
        cwd, "test/materials", materialsPath
    );
    const runDir = path.join(
        cwd, "test/run", materialsPath
    );
    fsExtra.removeSync(runDir);
    fs.mkdirSync(runDir, {recursive: true});
    fsExtra.copySync(materialsDir, runDir);
    return runDir;
}

function spawn(command: string, args: string[], options: any) {
    console.log("Test: $", command, args.join(" "));
    return zbsProcessSpawnDump(command, args, options);
}

function getPlatformBinaryName(name: string): string {
    return process.platform === "win32" ? name + ".exe" : name;
}

canary.test(`c/hello - Build trivial C program`, async function() {
    const helloDir = cloneMaterials("c/hello");
    await zebes(helloDir, ["init", "c", "toml"]);
    assert(fs.existsSync(path.join(helloDir, "zebes.toml")));
    await zebes(helloDir, ["build"]);
    const binaryName = getPlatformBinaryName("main");
    assert(fs.existsSync(path.join(helloDir, "bin", binaryName)));
    const result = await spawn(binaryName, [], {
        cwd: path.join(helloDir, "bin"),
    });
    console.log(result);
    assert(result.statusCode === 0);
    assert(result.stdout.startsWith("Hello, world!"));
});

canary.test(`c/bottles - Build multi source C program`, async function() {
    const helloDir = cloneMaterials("c/bottles");
    await zebes(helloDir, ["init", "c", "toml"]);
    assert(fs.existsSync(path.join(helloDir, "zebes.toml")));
    await zebes(helloDir, ["build"]);
    const binaryName = getPlatformBinaryName("main");
    assert(fs.existsSync(path.join(helloDir, "bin", binaryName)));
    const result = await spawn(binaryName, [], {
        cwd: path.join(helloDir, "bin"),
    });
    assert(result.statusCode === 0);
    assert(result.stdout.startsWith("99 bottles of beer on the wall"));
    assert(result.stdout.indexOf("no more bottles of beer on the wall") > 0);
});

canary.test(`cpp/hello - Build trivial C++ program`, async function() {
    const helloDir = cloneMaterials("cpp/hello");
    await zebes(helloDir, ["init", "cpp", "yaml"]);
    assert(fs.existsSync(path.join(helloDir, "zebes.yaml")));
    await zebes(helloDir, ["build"]);
    const binaryName = getPlatformBinaryName("main");
    assert(fs.existsSync(path.join(helloDir, "bin", binaryName)));
    const result = await spawn(binaryName, [], {
        cwd: path.join(helloDir, "bin"),
    });
    console.log(result);
    assert(result.statusCode === 0);
    assert(result.stdout.startsWith("Hello, world!"));
});

canary.test(`d/hello - Build trivial D program`, async function() {
    const helloDir = cloneMaterials("d/hello");
    await zebes(helloDir, ["init", "d", "toml"]);
    assert(fs.existsSync(path.join(helloDir, "zebes.toml")));
    await zebes(helloDir, ["build"]);
    const binaryName = getPlatformBinaryName("main");
    assert(fs.existsSync(path.join(helloDir, "bin", binaryName)));
    const result = await spawn(binaryName, [], {
        cwd: path.join(helloDir, "bin"),
    });
    console.log(result);
    assert(result.statusCode === 0);
    assert(result.stdout.startsWith("Hello, world!"));
});

canary.doReport();
