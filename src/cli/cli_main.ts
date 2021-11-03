import * as fs from "fs";
import * as path from "path";

import * as toml from "@iarna/toml";
import * as yaml from "yaml";

import {zbsGetArgParser} from "./cli_args";

import {zbsFindProjectConfigPath} from "../config/config_load";
import {zbsLoadProjectConfig} from "../config/config_load";
import {ZbsProjectConfigFileNames} from "../config/config_load";
import {ZbsHome} from "../home";
import {ZbsLogger} from "../logger";
import {ZbsLogLevel} from "../logger";
import {ZbsProject} from "../project";
import {ZbsProjectTargetRunner} from "../target_runner";
import {zbsInitProjectTemplates} from "../templates";
import {zbsProjectToString} from "../to_string";
import {zbsValueToString} from "../to_string";

/**

TODO: add some things
document all the things
Fix incremental getDependencies method
action type: branch
action type: assertions
fetch FTP and SFTP support
extract 7z support (use shell 7z command)
extract gz support
extract rar support (use shell rar command)
extract xz, tar.xz/txz support
fix logger spacing
option to use symlinks to cache instead of copying
--no-cache CLI arg to fetch and ignore cache
zebes refresh to clear download cache etc
DMD -makedeps
DMD -J and ImportExpressions
action type: parallel
action filters (e.g. based on platform)
action messages (log, warn, error on success and/or failure)
local config edits ?
custom templates directory

zebes info: print out project config data DONE
--dry-run DONE
action type: copy DONE
action type: move DONE
action type: fetch DONE
action type: extract DONE
validate: warn unknown keys DONE
external dependency cache DONE
Copy files with glob pattern DONE
config tostring functions DONE
improve action interfaces DONE
actions run iteratively, not recursively DONE
allow json comments, trailing commas etc (+flag to disable) DONE
fix undefined config list values always parsing as empty list DONE
action type: make - e.g. dispatch to mingw32-make on windows DONE
track objects for compile actions, refer to them in link actions TODO
make d work DONE

GOAL:
configure to work with raylib-cpp

*/

async function zbsGetHome(
    logger: ZbsLogger, args?: any, env?: {[name: string]: string}
) {
    const home = new ZbsHome(logger, undefined, env);
    await home.loadConfig(args, env);
    return home;
}

function zbsGetProjectConfig(
    logger: ZbsLogger,
    cwd: string,
    argsProject: string | undefined,
    strictFormat: boolean,
) {
    // Find the project file
    logger.trace("Searching for a project config file.");
    const configPath: string = (argsProject ?
        path.resolve(cwd, argsProject) :
        zbsFindProjectConfigPath(cwd)
    );
    // Handle the case where none was found
    if(!configPath) {
        logger.info("No Zebes project config file was found.");
        return undefined;
    }
    // Read the project file
    logger.info("Reading project config from path:", configPath);
    // TODO: Give more helpful error messages when parsing fails
    const loadConfig = zbsLoadProjectConfig(
        configPath, strictFormat
    );
    // Report errors in the project file
    if(loadConfig.errors.length) {
        logger.error("Failed to validate project config file.");
    }
    if(loadConfig.warnings.length) {
        logger.warn(
            `Found ${loadConfig.warnings.length} project config ` +
            `validation warnings.`
        );
        for(const warn of loadConfig.warnings) {
            logger.warn(warn);
        }
    }
    if(loadConfig.errors.length) {
        logger.error(
            `Found ${loadConfig.errors.length} project config ` +
            `validation failures.`
        );
        for(const error of loadConfig.errors) {
            logger.error(error);
        }
    }
    // All done
    return loadConfig;
}

export async function zbsCliMain(
    argv?: string[], cwd?: string,
    env?: {[name: string]: string},
): Promise<number> {
    const argParser = zbsGetArgParser();
    const args = argParser.parse_args(
        (argv || process.argv).slice(2)
    );
    const mainCwd = cwd || process.cwd();
    const mainEnv = env || <any> process.env;
    const logLevel: number = (
        args.silent ? Infinity :
        args.very_verbose ? ZbsLogLevel.Trace :
        args.verbose ? ZbsLogLevel.Debug :
        ZbsLogLevel.Info
    );
    const logger = new ZbsLogger(logLevel);
    if(args.command === "init") {
        const status = zbsCliInit(logger, args, mainCwd, mainEnv);
        return status;
    }
    else if(args.command === "info") {
        const status = await zbsCliInfo(logger, args, mainCwd, mainEnv);
        return status;
    }
    else if(args.command === "run") {
        const status = await zbsCliRun(logger, args, mainCwd, mainEnv);
        return status;
    }
    else if(!args.command) {
        argParser.print_help();
        return 0;
    }
    else {
        const status = await zbsCliRun(
            logger, args, mainCwd, mainEnv, args.command
        );
        return status;
    }
}

export function zbsCliInit(
    logger: ZbsLogger, args: any, cwd: string,
    env?: {[name: string]: string},
): number {
    const template = zbsInitProjectTemplates[args.template];
    if(!template) {
        logger.error(`Failed to load project template: "${args.template}"`);
        return 1;
    }
    for(const key in ZbsProjectConfigFileNames) {
        if(fs.existsSync(path.join(cwd, key))) {
            logger.error(
                "A Zebes project file already exists in this directory:",
                key
            );
            return 1;
        }
    }
    if(args.format === "json") {
        logger.info("Writing JSON project config file: zebes.json");
        fs.writeFileSync(path.join(cwd, "zebes.json"),
            JSON.stringify(template, undefined, 4)
        );
    }
    else if(args.format === "toml") {
        logger.info("Writing TOML project config file: zebes.toml");
        fs.writeFileSync(path.join(cwd, "zebes.toml"),
            toml.stringify(template)
        );
    }
    else if(args.format === "yaml") {
        logger.info("Writing YAML project config file: zebes.yaml");
        fs.writeFileSync(path.join(cwd, "zebes.yaml"),
            yaml.stringify(template)
        );
    }
    else {
        logger.error(`Unknown project file format "${args.format}".`);
        return 1;
    }
    return 0;
}

export async function zbsCliInfo(
    logger: ZbsLogger, args: any, cwd: string,
    env?: {[name: string]: string},
): Promise<number> {
    const home = await zbsGetHome(logger, args, env);
    const loadConfig = zbsGetProjectConfig(
        logger, cwd, args.project, !!home.config.strictConfigFormat
    );
    if(loadConfig && loadConfig.project) {
        logger.info("Project config:");
        logger.info(zbsValueToString(loadConfig.project, "  "));
    }
    return (loadConfig && loadConfig.errors.length) ? 1 : 0;
}

export async function zbsCliRun(
    logger: ZbsLogger, args: any, cwd: string,
    env?: {[name: string]: string},
    command?: string,
): Promise<number> {
    const home = await zbsGetHome(logger, args, env);
    // Get project configuration
    const loadConfig = zbsGetProjectConfig(
        logger, cwd, args.project, !!home.config.strictConfigFormat
    );
    if(!loadConfig || !loadConfig.project) {
        return 1;
    }
    const project = new ZbsProject(
        path.dirname(loadConfig.path),
        loadConfig.path,
        loadConfig.project,
        logger,
        home,
    );
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
