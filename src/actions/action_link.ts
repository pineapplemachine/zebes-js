import * as fs from "fs";
import * as path from "path";

import * as glob from "fast-glob";

import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionLink} from "../config/config_types";
import {zbsIsActionLink} from "../config/config_types";
import {zbsProcessSpawn} from "../util/util_process";

export class ZbsProjectActionLinkRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionLink(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    getLinkOutputPath(): string {
        if(!zbsIsActionLink(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        if(this.action.outputPath) {
            return this.action.outputPath;
        }
        else if(!this.action.outputBinaryName) {
            return "";
        }
        const binaryName = this.action.outputBinaryName;
        if(process.platform === "win32") {
            return (binaryName.endsWith(".exe") ?
                binaryName : binaryName + ".exe"
            );
        }
        else {
            return (binaryName.endsWith(".exe") ?
                binaryName.slice(0, binaryName.length - 4) : binaryName
            );
        }
    }
    
    async runType(): Promise<void> {
        this.logger.trace("Running link action.");
        if(!zbsIsActionLink(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        const cwd = this.getConfigCwd();
        const env = this.getConfigObjectAdditive<string>("env");
        const compiler = this.getConfig<string>("compiler") || "";
        const linker = this.getConfig<string>("linker") || compiler;
        const linkArgs = this.getConfigListAdditive<string>("linkArgs");
        const libraryPaths = this.getConfigListAdditive<string>("libraryPaths");
        const libraries = this.getConfigListAdditive<string>("libraries");
        const outputPath = this.getLinkOutputPath();
        if(!linker) {
            return this.fail(
                "Link action failed: No linker has been specified."
            );
        }
        else {
            this.logger.trace("Using linker:", linker);
        }
        if(!outputPath) {
            return this.fail(
                "Link action failed: No output path has been specified."
            );
        }
        const objectPaths = await glob(this.action.objectPaths || [], {
            cwd: cwd,
            suppressErrors: true,
        });
        if(!objectPaths.length) {
            return this.fail(
                "Link action failed: No object files were found."
            );
        }
        const args: string[] = [];
        args.push(...objectPaths);
        args.push(...libraryPaths.map(
            (path) => (this.getLibraryPathArg() + path)
        ));
        args.push(...libraries.map(
            (path) => (this.getLibraryArg() + path)
        ));
        args.push(...linkArgs);
        args.push(this.getLinkOutputArg() + outputPath);
        fs.mkdirSync(path.dirname(path.resolve(cwd, outputPath)), {
            recursive: true,
        });
        this.logger.info("Linking:", outputPath);
        if(this.project.dryRun) {
            this.logger.info("Dry-run: $", linker, ...args);
            return;
        }
        this.logger.info("$", linker, ...args);
        const statusCode = await zbsProcessSpawn(linker, args, {
            cwd: cwd,
            env: Object.assign({}, process.env, env),
            shell: true,
        }, {
            stdout: (data) => this.logger.info(data.toString()),
            stderr: (data) => this.logger.info(data.toString()),
        });
        if(statusCode !== 0) {
            this.fail(`Linking failed with status code ${statusCode}`);
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionLinkRunner);
