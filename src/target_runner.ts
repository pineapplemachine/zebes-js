import {ZbsProjectActionListRunner} from "./action_runner";
import {ZbsConfigTarget} from "./config/config_types";
import {ZbsLogger} from "./logger";;
import {ZbsProject} from "./project";
import {zbsValueToString} from "./to_string";

// These imports register action runner implementations as a side-effect
import "./actions/action_compile";
import "./actions/action_copy";
import "./actions/action_extern";
import "./actions/action_extract";
import "./actions/action_fetch";
import "./actions/action_link";
import "./actions/action_make";
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
        this.logger.trace(() => ("Target config:\n" +
            zbsValueToString(this.target, "  ")
        ));
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
        const actionsRunner = new ZbsProjectActionListRunner(
            this.project,
            this.target,
            this.target.actions,
        );
        await actionsRunner.run();
        if(actionsRunner.failed) {
            this.logger.error("Target execution failed.");
            this.failed = true;
        }
        // Wrap it up
        await this.project.home.commitCaches();
    }
}
