import * as fs from "fs";
import * as path from "path";

import * as toml from "@iarna/toml";
import * as yaml from "yaml";

import {zbsGetArgParser} from "./argparse";
import {zbsFindProjectConfigPath} from "./loadconfig";
import {zbsLoadProjectConfig} from "./loadconfig";
import {ZbsProjectConfigFileNames} from "./loadconfig";
import {ZbsLogger} from "./logger";
import {ZbsLogLevel} from "./logger";
import {ZbsProject} from "./project";
import {ZbsProjectTargetRunner} from "./project";
import {zbsInitProjectTemplates} from "./templates";
import {zbsProjectToString} from "./tostring";
import {zbsValueToString} from "./tostring";

/**

TODO: add some things
fix incremental builds
make d work
zebes info: print out project config data
--dry-run DONE
validate: warn unknown keys
config tostring functions DONE
improve action interfaces DONE
action type: branch
action type: fetch
action type: inflate
action type: rename
action type: copy
action filters (e.g. based on platform)
action messages (log, warn, error on success and/or failure)
actions run iteratively, not recursively DONE
track objects for compile actions, refer to them in link actions
local config edits ?
allow json comments, trailing commas etc (+flag to disable)
custom templates directory
fix undefined config list values always parsing as empty list

GOAL:
configure to work with raylib-cpp

*/

function zbsGetProjectBoolean(
    logger: ZbsLogger,
    name: string,
    cliValue: boolean,
    envName: string
): boolean | undefined {
    const envValue = process.env[envName];
    if(cliValue) {
        logger.debug(
            `Project ${name} behavior is being overridden ` +
            `by a command-line flag.`
        );
        return true;
    }
    else if(envName && envValue) {
        logger.debug(
            `Project ${name} behavior is being overridden ` +
            `by the environment variable "${envName}".`
        );
        return (envValue.toLowerCase() !== "false");
    }
    else {
        return undefined;
    }
}

function zbsGetProjectNumber(
    logger: ZbsLogger,
    name: string,
    cliValue: number,
    envName: string
): number | undefined {
    const envValue = +(<any> process.env[envName]);
    if(Number.isFinite(cliValue)) {
        logger.debug(
            `Project ${name} behavior is being overridden ` +
            `by a command-line flag.`
        );
        return cliValue;
    }
    else if(envName && Number.isFinite(envValue)) {
        logger.debug(
            `Project ${name} behavior is being overridden ` +
            `by the environment variable "${envName}".`
        );
        return envValue;
    }
    else {
        return undefined;
    }
}

export async function zbsMain() {
    const argParser = zbsGetArgParser();
    const args = argParser.parse_args();
    const logLevel: number = (
        args.silent ? Infinity :
        args.very_verbose ? ZbsLogLevel.Trace :
        args.verbose ? ZbsLogLevel.Debug :
        ZbsLogLevel.Info
    );
    const logger = new ZbsLogger(logLevel);
    if(args.command === "init") {
        const status = zbsInit(logger, args);
        process.exit(status);
    }
    else if(args.command === "info") {
        const status = zbsInfo(logger, args);
        process.exit(status);
    }
    else if(args.command === "run") {
        const status = await zbsRun(logger, args);
        process.exit(status);
    }
    else if(!args.command) {
        argParser.print_help();
        process.exit(0);
    }
    else {
        const status = await zbsRun(logger, args, args.command);
        process.exit(status);
    }
}

export function zbsInit(logger: ZbsLogger, args: any): number {
    const template = zbsInitProjectTemplates[args.template];
    if(!template) {
        logger.error(`Failed to load project template: "${args.template}"`);
        return 1;
    }
    for(const key in ZbsProjectConfigFileNames) {
        if(fs.existsSync(key)) {
            logger.error(
                "A Zebes project file already exists in this directory:",
                key
            );
            return 1;
        }
    }
    if(args.format === "json") {
        logger.info("Writing JSON project config file: zebes.json");
        fs.writeFileSync("zebes.json", JSON.stringify(
            template, undefined, 4
        ));
    }
    else if(args.format === "toml") {
        logger.info("Writing TOML project config file: zebes.toml");
        fs.writeFileSync("zebes.toml", toml.stringify(
            template
        ));
    }
    else if(args.format === "yaml") {
        logger.info("Writing YAML project config file: zebes.yaml");
        fs.writeFileSync("zebes.yaml", yaml.stringify(
            template
        ));
    }
    else {
        logger.error(`Unknown project file format "${args.format}".`);
        return 1;
    }
    return 0;
}

function zbsGetProjectConfig(
    logger: ZbsLogger, argsProject?: string | undefined
) {
    // Find the project file
    logger.trace("Searching for a project config file.");
    const configPath: string = (argsProject ?
        path.resolve(process.cwd(), argsProject) :
        zbsFindProjectConfigPath()
    );
    // Handle the case where none was found
    if(!configPath) {
        logger.info("No Zebes project config file was found.");
        return undefined;
    }
    // Read the project file
    logger.info("Reading project config from path:", configPath);
    const loadConfig = zbsLoadProjectConfig(configPath);
    // Report errors in the project file
    // TODO: Warn about unknown object keys
    if(loadConfig.errors.length) {
        logger.error("Failed to validate project config file.");
        for(const error of loadConfig.errors) {
            logger.error("Project config validation error:", error);
        }
    }
    // All done
    return loadConfig;
}

export function zbsInfo(logger: ZbsLogger, args: any): number {
    const loadConfig = zbsGetProjectConfig(logger, args.project);
    if(loadConfig && loadConfig.project) {
        logger.info("Project config:");
        logger.info(zbsValueToString(loadConfig.project, "  "));
    }
    return (loadConfig && loadConfig.errors.length) ? 1 : 0;
}

export async function zbsRun(
    logger: ZbsLogger, args: any, command?: string
): Promise<number> {
    // Get project configuration
    const loadConfig = zbsGetProjectConfig(logger, args.project);
    if(!loadConfig || !loadConfig.project) {
        return 1;
    }
    const project = new ZbsProject(
        path.dirname(loadConfig.path),
        loadConfig.path,
        loadConfig.project,
        logger,
    );
    // Check CLI flags and env vars for project behavior changes
    project.promptYes = !!zbsGetProjectBoolean(
        logger, "prompt acceptance", args.yes,
        "ZEBES_PROJECT_YES",
    );
    project.rebuild = !!zbsGetProjectBoolean(
        logger, "rebuild", args.rebuild,
        "ZEBES_PROJECT_REBUILD",
    );
    if(!project.config.incremental) {
        project.config.incremental = !!zbsGetProjectBoolean(
            logger, "incremental", args.incremental,
            "ZEBES_PROJECT_INCREMENTAL",
        );
    }
    if(!project.config.allowActionCycles) {
        project.config.allowActionCycles = !!zbsGetProjectBoolean(
            logger, "action cycles", args.allow_action_cycles,
            "ZEBES_PROJECT_ALLOW_ACTION_CYCLES",
        );
    }
    project.parallel = zbsGetProjectNumber(
        logger, "parallel", args.parallel,
        "ZEBES_PROJECT_PARALLEL",
    ) || 0;
    project.dryRun = args.dry_run;
    if(project.dryRun) {
        logger.info("Running target in dry-run mode.");
    }
    logger.trace(() => zbsProjectToString(project));
    // Run the specified target
    const targetName = command || args.target;
    logger.trace(`Preparing to run target "${targetName}".`);
    const targetConfig = project.getTarget(targetName);
    if(!targetConfig) {
        logger.error("No such target:", targetName);
        return 1;
    }
    const targetRunner = new ZbsProjectTargetRunner(
        project, targetConfig
    );
    await targetRunner.run();
    logger.trace(`Finished running target "${targetName}".`);
    return targetRunner.failed ? 1 : 0;
}
