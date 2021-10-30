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
    
    async runType(): Promise<void> {
        this.logger.trace("Running copy action.");
        if(!zbsIsActionCopy(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        const cwd = this.getConfigCwd();
        const outputPath = path.resolve(cwd, this.action.outputPath);
        if(this.action.copyPath) {
            const copyPath = path.resolve(cwd, this.action.copyPath);
            await this.project.fsCopy(copyPath, outputPath);
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
                const copyOutputPath = path.resolve(outputPath, copyPath);
                await this.project.fsCopy(
                    path.resolve(copyPathsBase, copyPath),
                    copyOutputPath,
                );
            }
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionCopyRunner);
