import * as fs from "fs";
import * as path from "path";

import * as glob from "fast-glob";
// @ts-ignore
import * as fsExtra from "fs-extra";

import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionCopy} from "../config/config_types";
import {zbsIsActionCopy} from "../config/config_types";

export class ZbsProjectActionCopyRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionCopy(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    get action(): ZbsConfigActionCopy {
        if(!zbsIsActionCopy(this.actionConfig)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        return this.actionConfig;
    }
    
    async copyPath(srcPath: string, destPath: string) {
        if(fs.existsSync(destPath) && !this.action.overwrite) {
            this.logger.info(
                `Destination path already exists and copy action's ` +
                `\"overwrite\" flag is not set. Skipping: ` + destPath
            );
        }
        else {
            await this.project.fsCopy(
                srcPath, destPath, !!this.action.overwrite
            );
        }
    }
    
    async runType(): Promise<void> {
        const cwd = this.getConfigCwd();
        const outputPath = path.resolve(cwd, this.action.outputPath);
        if(this.action.copyPath) {
            const copyPath = path.resolve(cwd, this.action.copyPath);
            this.copyPath(copyPath, outputPath);
        }
        else if(this.action.copyPaths && this.action.copyPaths.length) {
            const copyPathsBase = path.resolve(
                cwd, this.action.copyPathsBase || ""
            );
            const copyPaths = await glob(this.action.copyPaths, {
                cwd: copyPathsBase,
                suppressErrors: true,
                onlyFiles: false,
            });
            for(const copyPath of copyPaths) {
                this.copyPath(
                    path.resolve(copyPathsBase, copyPath),
                    path.resolve(outputPath, copyPath),
                );
            }
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionCopyRunner);
