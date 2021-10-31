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
    
    get action(): ZbsConfigActionRemove {
        if(!zbsIsActionRemove(this.actionConfig)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        return this.actionConfig;
    }
    
    async removePath(removePath: string) {
        if(!fs.existsSync(removePath)) {
            this.logger.info(
                "Path doesn't exist. Skipping removal:", removePath
            );
            return;
        }
        if(this.action.prompt && !this.project.dryRun) {
            const removePrompt = await this.project.promptConfirm(
                `Remove path? ${removePath}`, false
            );
            if(!removePrompt) {
                this.logger.info("Not removing path:", removePath);
                return;
            }
        }
        await this.project.fsRemove(removePath);
    }
    
    async runType(): Promise<void> {
        const cwd = this.getConfigCwd();
        const removePaths = (this.action.removePath ?
            [this.action.removePath || ""] :
            await glob(this.action.removePaths || [], {
                cwd: cwd,
                suppressErrors: true,
                onlyFiles: false,
            })
        );
        for(const removePath of removePaths) {
            await this.removePath(path.resolve(cwd, removePath));
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionRemoveRunner);
