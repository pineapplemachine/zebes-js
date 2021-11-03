import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionMake} from "../config/config_types";
import {zbsIsActionMake} from "../config/config_types";

export class ZbsProjectActionMakeRunner extends ZbsProjectActionRunner {
    static commandMake: string | undefined = undefined;
    
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionMake(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    get action(): ZbsConfigActionMake {
        if(!zbsIsActionMake(this.actionConfig)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        return this.actionConfig;
    }
    
    async getMakeCommand(): Promise<string> {
        if(this.project.home.config.commandMake) {
            return this.project.home.config.commandMake;
        }
        if(!ZbsProjectActionMakeRunner.commandMake) {
            ZbsProjectActionMakeRunner.commandMake = "make";
            if(process.platform === "win32") {
                const statusCode = await this.project.processSpawn(
                    "mingw32-make", ["--version"], {
                        ignoreDryRun: true,
                        verbose: true,
                    },
                );
                this.logger.debug(
                    "Status code for checking mingw32-make:", statusCode
                );
                if(statusCode === 0) {
                    ZbsProjectActionMakeRunner.commandMake = "mingw32-make";
                }
            }
        }
        return ZbsProjectActionMakeRunner.commandMake || "";
    }
    
    async runType(): Promise<void> {
        const cwd = this.getConfigCwd();
        const env = this.getConfigEnv();
        const commandMake = await this.getMakeCommand();
        const makeArgs: string[] = this.action.makeArgs || [];
        this.logger.debug("Current working directory for make action:", cwd);
        this.logger.debug("Using make command:",
            () => JSON.stringify(commandMake)
        );
        const statusCode = await this.project.processSpawn(commandMake, makeArgs, {
            cwd: cwd,
            env: env,
            shell: true,
        });
        if(statusCode !== 0) {
            this.fail(`Make command failed: Status code ${statusCode}`);
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionMakeRunner);
