import {ZbsProjectActionRunner} from "./action_runner";
import {ZbsConfigTarget} from "./config/config_types";
import {ZbsLogger} from "./logger";;
import {ZbsProject} from "./project";
import {zbsValueToString} from "./to_string";

// These imports register action runner implementations as a side-effect
import "./actions/action_compile";
import "./actions/action_extract";
import "./actions/action_fetch";
import "./actions/action_link";
import "./actions/action_remove";
import "./actions/action_shell";

/**
 * Helper class to handle running a project target.
 */
export class ZbsProjectTargetRunner {
    /** Provides information about the containing project. */
    project: ZbsProject;
    /** Config object representing the target to run. */
    target: ZbsConfigTarget;
    /** Logger instance. */
    logger: ZbsLogger;
    /** Flag is set to true upon target failure. */
    failed: boolean;
    
    constructor(
        project: ZbsProject,
        target: ZbsConfigTarget,
    ) {
        this.project = project;
        this.target = target;
        this.failed = false;
        this.logger = project.logger;
    }
    
    /**
     * Attempt to run this action.
     */
    async run(): Promise<void> {
        // Log info and check preconditions
        this.logger.info("Running target:", this.target.name);
        this.logger.trace("Target config:\n",
            () => zbsValueToString(this.target, "  ")
        );
        if(!this.target.actions || !this.target.actions.length) {
            this.logger.warn(
                `Target "${this.target.name}" has no actions to run.`
            );
            return;
        }
        this.logger.trace(
            `Target "${this.target.name}" has ` +
            `${this.target.actions.length} actions to run.`
        );
        // Run each action in series
        for(const action of this.target.actions) {
            // Get the action config object
            const actionConfig = this.project.getAction(action);
            if(!actionConfig) {
                this.logger.error(
                    "Target failed. No such action:",
                    () => JSON.stringify(action)
                );
                this.failed = true;
                break;
            }
            // Run the action
            const actionRunnerType = (
                ZbsProjectActionRunner.GetRunnerType(actionConfig)
            );
            if(!actionRunnerType) {
                throw new Error("Internal action type dispatch error.");
            }
            const actionRunner = new actionRunnerType({
                project: this.project,
                target: this.target,
                action: actionConfig,
            });
            await actionRunner.run();
            // Handle failed actions
            if(actionRunner.failed) {
                if(actionRunner.malformed) {
                    this.logger.error(
                        "Aborting target execution: " +
                        "Action configuration was malformed."
                    );
                    this.failed = true;
                    break;
                }
                else if((<any> actionConfig).ignoreFailure) {
                    this.logger.info("Action failed. (Ignoring.)");
                }
                else {
                    this.logger.error(
                        "Aborting target execution: Action failed."
                    );
                    this.failed = true;
                    break;
                }
            }
        }
        // Wrap it up
        this.project.home.commit();
    }
}
