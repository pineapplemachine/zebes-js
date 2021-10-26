import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionShell} from "../config/config_types";
import {zbsIsActionShell} from "../config/config_types";
import {zbsProcessExec} from "../util/util_process";

export class ZbsProjectActionShellRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionShell(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    async runType(): Promise<void> {
        this.logger.trace("Running shell action.");
        if(!zbsIsActionShell(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        const cwd = this.getConfigCwd();
        const env = this.getConfigObjectAdditive<string>("env");
        for(const command of this.action.commands) {
            if(!command) {
                continue;
            }
            if(this.project.dryRun) {
                this.logger.info("Dry-run: $", command);
                continue;
            }
            this.logger.info("$", command);
            const statusCode = await zbsProcessExec(command, {
                cwd: cwd,
                env: Object.assign({}, process.env, env),
                shell: true,
            }, {
                stdout: (data) => this.logger.info(data.toString()),
                stderr: (data) => this.logger.info(data.toString()),
            });
            if(statusCode !== 0) {
                this.fail(`Command failed: Status code ${statusCode}`);
            }
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionShellRunner);
