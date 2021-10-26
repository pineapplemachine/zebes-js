import * as fs from "fs";
import * as path from "path";

import * as glob from "fast-glob";
// @ts-ignore
import * as fsExtra from "fs-extra";

import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionRemove} from "../config/config_types";
import {zbsIsActionRemove} from "../config/config_types";

export class ZbsProjectActionRemoveRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionRemove(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    async runType(): Promise<void> {
        this.logger.trace("Running remove action.");
        if(!zbsIsActionRemove(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        const cwd = this.getConfigCwd();
        const removePaths = await glob(this.action.removePaths, {
            cwd: cwd,
            suppressErrors: true,
            onlyFiles: false,
        });
        for(const removePath of removePaths) {
            if(!removePath) {
                continue;
            }
            const resolvedRemovePath = path.resolve(cwd, removePath);
            const stat = fs.statSync(resolvedRemovePath, {
                throwIfNoEntry: false,
            });
            if(!stat) {
                this.logger.debug(
                    "Not removing path (doesn't exist):",
                    resolvedRemovePath
                );
                continue;
            }
            const removeName = stat.isDirectory() ? "directory" : "file";
            if(this.project.dryRun) {
                this.logger.info(
                    `Dry-run: Removing ${removeName}:`,
                    resolvedRemovePath
                );
                continue;
            }
            const removeOk = await this.project.promptConfirm(
                `Remove ${removeName} ${resolvedRemovePath} ?`, false
            );
            if(removeOk) {
                this.logger.info(`Removing ${removeName}:`, resolvedRemovePath);
                fsExtra.removeSync(resolvedRemovePath);
            }
            else {
                this.logger.info(`Not removing ${removeName}:`, resolvedRemovePath);
            }
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionRemoveRunner);
