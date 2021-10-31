import * as fs from "fs";
import * as path from "path";

import * as glob from "fast-glob";
// @ts-ignore
import * as fsExtra from "fs-extra";

import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionMove} from "../config/config_types";
import {zbsIsActionMove} from "../config/config_types";

export class ZbsProjectActionMoveRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionMove(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    get action(): ZbsConfigActionMove {
        if(!zbsIsActionMove(this.actionConfig)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        return this.actionConfig;
    }
    
    async movePath(srcPath: string, destPath: string) {
        if(fs.existsSync(destPath) && !this.action.overwrite) {
            this.fail(
                "Move action failure. Destination path already exists: " +
                destPath
            );
            this.logger.info(
                `Set the action's "overwrite" flag to true ` +
                `to bypass this error and overwrite existing files ` +
                `at the destination path.`
            );
        }
        else {
            await this.project.fsMove(
                srcPath, destPath, !!this.action.overwrite
            );
        }
    }
    
    async runType(): Promise<void> {
        const cwd = this.getConfigCwd();
        const outputPath = path.resolve(cwd, this.action.outputPath);
        if(this.action.movePath) {
            const movePath = path.resolve(cwd, this.action.movePath);
            await this.movePath(movePath, outputPath);
        }
        else if(this.action.movePaths && this.action.movePaths.length) {
            const movePathsBase = path.resolve(
                cwd, this.action.movePathsBase || ""
            );
            const movePaths = await glob(this.action.movePaths, {
                cwd: movePathsBase,
                suppressErrors: true,
                onlyFiles: false,
            });
            for(const movePath of movePaths) {
                await this.movePath(
                    path.resolve(movePathsBase, movePath),
                    path.resolve(outputPath, movePath),
                );
            }
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionMoveRunner);
