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

/**

TODO: add some things
zebes info # print out project config data
--dry-run

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
        fs.writeFileSync("zebes.json", JSON.stringify(
            template, undefined, 4
        ));
    }
    else if(args.format === "toml") {
        fs.writeFileSync("zebes.toml", toml.stringify(
            template
        ));
    }
    else if(args.format === "yaml") {
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

export async function zbsRun(
    logger: ZbsLogger, args: any, command?: string
): Promise<number> {
    // Find and load project config file
    const configPath: string = (args.project ?
        path.resolve(process.cwd(), args.project) :
        zbsFindProjectConfigPath()
    );
    if(!configPath) {
        logger.error("No Zebes project config file was found.");
        return 1;
    }
    logger.info("Reading project config from path:", configPath);
    const loadConfig = zbsLoadProjectConfig(configPath);
    if(loadConfig.errors.length) {
        logger.error("Failed to validate project config file.");
        for(const error of loadConfig.errors) {
            logger.error("Project config validation error:", error);
        }
        return 1;
    }
    const project = new ZbsProject(
        path.dirname(configPath),
        configPath,
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
    // Run the specified target
    const targetName = command || args.target;
    const targetConfig = project.getTarget(targetName);
    if(!targetConfig) {
        logger.error("No such target:", targetName);
        return 1;
    }
    const targetRunner = new ZbsProjectTargetRunner(
        project, targetConfig
    );
    await targetRunner.run();
    return targetRunner.failed ? 1 : 0;
}
