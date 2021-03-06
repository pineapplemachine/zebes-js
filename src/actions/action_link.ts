import * as fs from "fs";
import * as path from "path";

import * as glob from "fast-glob";

import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionLink} from "../config/config_types";
import {zbsIsActionLink} from "../config/config_types";

export class ZbsProjectActionLinkRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionLink(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    get action(): ZbsConfigActionLink {
        if(!zbsIsActionLink(this.actionConfig)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        return this.actionConfig;
    }
    
    getLinkOutputPath(): string {
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
        // Get and validate configuration values
        const cwd = this.getConfigCwd();
        const env = this.getConfigEnv();
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
        // Build list of object file paths
        const objectPaths: Set<string> = new Set();
        if(this.action.objectPaths) {
            const globObjectPaths = await glob(this.action.objectPaths, {
                cwd: cwd,
                suppressErrors: true,
            });
            for(const objectPath of globObjectPaths) {
                objectPaths.add(objectPath);
            }
        }
        if(this.action.objectLists) {
            for(const listName of this.action.objectLists) {
                for(const objectPath of this.project.objectLists[listName]) {
                    objectPaths.add(objectPath);
                }
            }
        }
        if(this.action.objectsAuto) {
            for(const objectPath of this.project.takeObjectsAuto()) {
                objectPaths.add(objectPath);
            }
        }
        if(!objectPaths.size) {
            if(this.project.dryRun) {
                this.logger.info("Dry-run: No object files were found.");
            }
            else {
                this.fail("Link action failed: No object files were found.");
            }
            return;
        }
        this.logger.debug(
            "Found", objectPaths.size, "object files to link."
        );
        // Build args list and run the linker command
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
        await this.project.fsMkdir(
            path.dirname(path.resolve(cwd, outputPath))
        );
        this.logger.info("Linking:", outputPath);
        const statusCode = await this.project.processSpawn(linker, args, {
            cwd: cwd,
            env: env,
            shell: true,
        });
        if(statusCode !== 0) {
            this.fail(`Linking failed with status code ${statusCode}`);
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionLinkRunner);
