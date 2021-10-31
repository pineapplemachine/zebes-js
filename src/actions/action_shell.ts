import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionShell} from "../config/config_types";
import {zbsIsActionShell} from "../config/config_types";

export class ZbsProjectActionShellRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionShell(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    get action(): ZbsConfigActionShell {
        if(!zbsIsActionShell(this.actionConfig)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        return this.actionConfig;
    }
    
    async runType(): Promise<void> {
        const cwd = this.getConfigCwd();
        const env = this.getConfigObjectAdditive<string>("env");
        this.logger.debug("Current working directory for shell action:", cwd);
        for(const command of this.action.commands) {
            if(!command) {
                continue;
            }
            const statusCode = await this.project.processExec(command, {
                cwd: cwd,
                env: Object.assign({}, this.project.env, env),
            });
            if(statusCode !== 0) {
                this.fail(`Command failed: Status code ${statusCode}`);
            }
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionShellRunner);
