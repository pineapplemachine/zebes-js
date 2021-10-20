// @ts-ignore
import {ArgumentParser} from "argparse";

export const ZbsVersion: string = "0.1.1";

export function zbsGetArgParser(): ArgumentParser {
    // zbs
    const argParser = new ArgumentParser({
        description: "Zebes: The least of all build systems.",
    });
    argParser.add_argument("--version", {
        action: "version",
        version: ZbsVersion,
    });
    const argSubparsers = argParser.add_subparsers({
        dest: "command",
    });
    // zbs init
    const argParserInit = argSubparsers.add_parser("init", {
        help: (
            "Helper to initialize a new Zebes project configuration " +
            "file in the current directory."
        ),
    });
    argParserInit.add_argument("template", {
        choices: ["c", "cpp", "d"],
        help: "Name the template to use for the new project file.",
    });
    argParserInit.add_argument("format", {
        choices: ["json", "toml", "yaml"],
        help: "Save the project file using the given data format.",
    });
    // zbs run
    const argParserRun = argSubparsers.add_parser("run", {
        help: "Execute the project target with a given name.",
    });
    zbsArgParserAddRunTargetArgs(argParserRun);
    argParserRun.add_argument("target", {
        help: "Name which of the project's targets should be run.",
    });
    // zbs build -> zbs run build
    const argParserBuild = argSubparsers.add_parser("build", {
        help: `Execute the project's "build" target.`,
    });
    zbsArgParserAddRunTargetArgs(argParserBuild);
    // zbs start -> zbs run start
    const argParserStart = argSubparsers.add_parser("start", {
        help: `Execute the project's "start" target.`,
    });
    zbsArgParserAddRunTargetArgs(argParserStart);
    // zbs restart -> zbs run restart
    const argParserRestart = argSubparsers.add_parser("restart", {
        help: `Execute the project's "restart" target.`,
    });
    zbsArgParserAddRunTargetArgs(argParserRestart);
    // zbs stop -> zbs run stop
    const argParserStop = argSubparsers.add_parser("stop", {
        help: `Execute the project's "stop" target.`,
    });
    zbsArgParserAddRunTargetArgs(argParserStop);
    // zbs test -> zbs run test
    const argParserTest = argSubparsers.add_parser("test", {
        help: `Execute the project's "test" target.`,
    });
    zbsArgParserAddRunTargetArgs(argParserTest);
    // zbs debug -> zbs run debug
    const argParserDebug = argSubparsers.add_parser("debug", {
        help: `Execute the project's "debug" target.`,
    });
    zbsArgParserAddRunTargetArgs(argParserDebug);
    // zbs clean -> zbs run clean
    const argParserClean = argSubparsers.add_parser("clean", {
        help: `Execute the project's "clean" target.`,
    });
    zbsArgParserAddRunTargetArgs(argParserClean);
    // All done
    return argParser;
}

function zbsArgParserAddRunTargetArgs(parser: ArgumentParser) {
    parser.add_argument("-v", "--verbose", {
        action: "store_true",
        help: "Show more information in stdout than usual.",
    });
    parser.add_argument("-vv", "--very-verbose", {
        action: "store_true",
        help: "Show much more information in stdout than usual.",
    });
    parser.add_argument("-s", "--silent", {
        action: "store_true",
        help: "Don't log anything to stdout.",
    });
    parser.add_argument("-y", "--yes", {
        action: "store_true",
        help: "Confirm yes/no questions without an interactive prompt.",
    });
    parser.add_argument("-p", "--project", {
        action: "store_true",
        help: "Specify path to a Zebes project configuration file.",
    });
    parser.add_argument("-l", "--parallel", {
        type: "int",
        help: "The greatest number of tasks that should run simultaneously",
    });
    parser.add_argument("-r", "--rebuild", {
        action: "store_true",
        help: "Force complete rebuild without incremental compilation.",
    });
    parser.add_argument("--incremental", {
        action: "store_true",
        help: "Force incremental compilation.",
    });
    parser.add_argument("--allow-action-cycles", {
        action: "store_true",
        help: "Continue running upon encountering a cyclic action.",
    });
    parser.add_argument("--dry-run", {
        action: "store_true",
        help: "Show what actions would be taken, without modifying anything.",
    });
}
