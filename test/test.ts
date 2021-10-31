require("source-map-support").install();

import {strict as assert} from "assert";
import * as fs from "fs";
import * as path from "path";

import {Group as CanaryGroup} from "canary-test";
// @ts-ignore
import * as fsExtra from "fs-extra";

import {zbsCliMain} from "../src/cli/cli_main";
import {zbsProcessSpawnDump} from "../src/util/util_process";

export const canary = CanaryGroup("Zebes");

async function zebes(cwd: string, args: string[]) {
    console.log("Test: $ zebes", args.join(" "));
    const statusCode = await zbsCliMain(["node", "zebes", ...args], cwd);
    if(statusCode !== 0) {
        throw new Error(`Zebes failed with status code ${statusCode}.`);
    }
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

canary.test(`c/bottles - Build multi source C program (Dry run)`, async function() {
    const helloDir = cloneMaterials("c/bottles");
    await zebes(helloDir, ["init", "c", "toml"]);
    assert(fs.existsSync(path.join(helloDir, "zebes.toml")));
    await zebes(helloDir, ["build", "--dry-run"]);
    assert(!fs.existsSync(path.join(helloDir, "bin")));
    assert(!fs.existsSync(path.join(helloDir, "build")));
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

canary.test(`etc/files - File system operations (Dry run)`, async function() {
    const filesDir = cloneMaterials("etc/files");
    assert(fs.existsSync(path.join(filesDir, "zebes.json")));
    await zebes(filesDir, ["run", "test_copy_file", "--dry-run"]);
    assert(fs.existsSync(path.join(filesDir, "books/anathem.txt")));
    assert(!fs.existsSync(path.join(filesDir, "books/anathem_copy.txt")));
    await zebes(filesDir, ["run", "test_copy_file_overwrite", "--dry-run"]);
    assert(!fs.existsSync(path.join(filesDir, "people/person_copy.txt")));
    await zebes(filesDir, ["run", "test_copy_dir", "--dry-run"]);
    assert(fs.existsSync(path.join(filesDir, "books")));
    assert(!fs.existsSync(path.join(filesDir, "books_copy")));
    await zebes(filesDir, ["run", "test_copy_glob", "--dry-run"]);
    assert(fs.existsSync(path.join(filesDir, "cities")));
    assert(!fs.existsSync(path.join(filesDir, "city_images")));
    await zebes(filesDir, ["run", "test_move_file", "--dry-run"]);
    assert(fs.existsSync(path.join(filesDir, "books/dune.txt")));
    assert(!fs.existsSync(path.join(filesDir, "books/dune_moved.txt")));
    await zebes(filesDir, ["run", "test_move_file_overwrite", "--dry-run"]);
    assert(!fs.existsSync(path.join(filesDir, "books/book_moved.txt")));
    await zebes(filesDir, ["run", "test_move_dir", "--dry-run"]);
    assert(fs.existsSync(path.join(filesDir, "movies")));
    assert(!fs.existsSync(path.join(filesDir, "movies_moved")));
    await zebes(filesDir, ["run", "test_move_glob", "--dry-run"]);
    assert(fs.existsSync(path.join(filesDir, "fruits")));
    assert(!fs.existsSync(path.join(filesDir, "fruit_images")));
    await zebes(filesDir, ["run", "test_remove_file", "--dry-run"]);
    assert(fs.existsSync(path.join(filesDir, "books/fellowship.txt")));
    await zebes(filesDir, ["run", "test_remove_dir", "--dry-run"]);
    assert(fs.existsSync(path.join(filesDir, "books")));
    await zebes(filesDir, ["run", "test_remove_glob", "--dry-run"]);
    assert(fs.existsSync(path.join(filesDir, "cities/barcelona.jpg")));
});

canary.test(`etc/files - File system operations`, async function() {
    const filesDir = cloneMaterials("etc/files");
    assert(fs.existsSync(path.join(filesDir, "zebes.json")));
    // Copy one file
    assert(fs.existsSync(path.join(filesDir, "books/anathem.txt")));
    assert(!fs.existsSync(path.join(filesDir, "books/anathem_copy.txt")));
    await zebes(filesDir, ["run", "test_copy_file"]);
    assert(fs.existsSync(path.join(filesDir, "books/anathem.txt")));
    assert(fs.existsSync(path.join(filesDir, "books/anathem_copy.txt")));
    // Copy one file (test overwrite behavior)
    assert(fs.existsSync(path.join(filesDir, "people/wittgenstein.txt")));
    assert(!fs.existsSync(path.join(filesDir, "people/person_copy.txt")));
    const personOriginal = fs.readFileSync(
        path.join(filesDir, "people/wittgenstein.txt"), "utf-8"
    );
    await zebes(filesDir, ["run", "test_copy_file_overwrite"]);
    assert(fs.existsSync(path.join(filesDir, "people/wittgenstein.txt")));
    const personCopy = fs.readFileSync(
        path.join(filesDir, "people/wittgenstein.txt"), "utf-8"
    );
    assert(personOriginal === personCopy);
    // Copy a directory
    assert(fs.existsSync(path.join(filesDir, "books")));
    assert(!fs.existsSync(path.join(filesDir, "books_copy")));
    await zebes(filesDir, ["run", "test_copy_dir"]);
    assert(fs.existsSync(path.join(filesDir, "books")));
    assert(fs.existsSync(path.join(filesDir, "books_copy")));
    assert(fs.existsSync(path.join(filesDir, "books_copy/anathem.txt")));
    // Copy using globs
    assert(!fs.existsSync(path.join(filesDir, "city_images")));
    await zebes(filesDir, ["run", "test_copy_glob"]);
    assert(fs.existsSync(path.join(filesDir, "city_images")));
    assert(fs.existsSync(path.join(filesDir, "city_images/helsinki.jpg")));
    assert(!fs.existsSync(path.join(filesDir, "city_images/helsinki.txt")));
    // Move one file
    assert(fs.existsSync(path.join(filesDir, "books/dune.txt")));
    assert(!fs.existsSync(path.join(filesDir, "books/dune_moved.txt")));
    await zebes(filesDir, ["run", "test_move_file"]);
    assert(!fs.existsSync(path.join(filesDir, "books/dune.txt")));
    assert(fs.existsSync(path.join(filesDir, "books/dune_moved.txt")));
    // Move one file (test overwrite behavior)
    assert(fs.existsSync(path.join(filesDir, "books/monstrous.txt")));
    assert(fs.existsSync(path.join(filesDir, "books/xenogenesis.txt")));
    assert(fs.existsSync(path.join(filesDir, "books/parable.txt")));
    assert(!fs.existsSync(path.join(filesDir, "books/book_moved.txt")));
    const bookOriginal = fs.readFileSync(
        path.join(filesDir, "books/xenogenesis.txt"), "utf-8"
    );
    await zebes(filesDir, ["run", "test_move_file_overwrite"]);
    assert(!fs.existsSync(path.join(filesDir, "books/monstrous.txt")));
    assert(!fs.existsSync(path.join(filesDir, "books/xenogenesis.txt")));
    assert(fs.existsSync(path.join(filesDir, "books/parable.txt")));
    const bookMoved = fs.readFileSync(
        path.join(filesDir, "books/book_moved.txt"), "utf-8"
    );
    assert(bookOriginal === bookMoved);
    // Move a directory
    assert(fs.existsSync(path.join(filesDir, "movies")));
    assert(!fs.existsSync(path.join(filesDir, "movies_moved")));
    await zebes(filesDir, ["run", "test_move_dir"]);
    assert(!fs.existsSync(path.join(filesDir, "movies")));
    assert(fs.existsSync(path.join(filesDir, "movies_moved")));
    // Move using globs
    assert(fs.existsSync(path.join(filesDir, "fruits/banana.jpg")));
    assert(!fs.existsSync(path.join(filesDir, "fruit_images")));
    await zebes(filesDir, ["run", "test_move_glob"]);
    assert(!fs.existsSync(path.join(filesDir, "fruits/banana.jpg")));
    assert(fs.existsSync(path.join(filesDir, "fruit_images")));
    assert(fs.existsSync(path.join(filesDir, "fruit_images/banana.jpg")));
    // Remove one file
    assert(fs.existsSync(path.join(filesDir, "books/fellowship.txt")));
    await zebes(filesDir, ["run", "test_remove_file"]);
    assert(!fs.existsSync(path.join(filesDir, "books/fellowship.txt")));
    // Remove a directory
    assert(fs.existsSync(path.join(filesDir, "books")));
    await zebes(filesDir, ["run", "test_remove_dir"]);
    assert(!fs.existsSync(path.join(filesDir, "books")));
    // Remove using globs
    assert(fs.existsSync(path.join(filesDir, "cities/barcelona.jpg")));
    await zebes(filesDir, ["run", "test_remove_glob"]);
    assert(fs.existsSync(path.join(filesDir, "cities")));
    assert(!fs.existsSync(path.join(filesDir, "cities/barcelona.jpg")));
});

canary.doReport();
