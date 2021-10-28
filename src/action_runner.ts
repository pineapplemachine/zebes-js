import {ZbsConfigAction} from "./config/config_types";
import {ZbsConfigSystem} from "./config/config_types";
import {ZbsConfigTarget} from "./config/config_types";
import {ZbsConfigResolver} from "./config/config_resolver";
import {ZbsLogger} from "./logger";
import {ZbsProject} from "./project";
import {zbsValueToString} from "./to_string";

export interface ZbsProjectActionRunnerOptions {
    project: ZbsProject,
    target: ZbsConfigTarget | undefined,
    action: ZbsConfigAction,
    actionHistory?: ZbsConfigAction[] | undefined,
}

export type ZbsProjectActionRunnerType = (
    (new (options: ZbsProjectActionRunnerOptions) => ZbsProjectActionRunner) &
    {matchActionConfig: (action: ZbsConfigAction) => boolean}
);

export const ZbsProjectActionRunnerTypes: ZbsProjectActionRunnerType[] = [];

/**
 * Helper class to handle running a project action.
 * This is a base class which should be extended with
 * implementation specifics for each action type.
 */
export class ZbsProjectActionRunner {
    /** Provides information about the containing project. */
    project: ZbsProject;
    /** Reference to applicable system config object, if any. */
    system: ZbsConfigSystem | undefined;
    /** Config object for target that the action is running under. */
    target: ZbsConfigTarget | undefined;
    /** Config object for the action being run. */
    action: ZbsConfigAction;
    /** Flag is set to true upon action failure. */
    failed: boolean;
    /** Flag is set to true if failure was due to malformed config. */
    malformed: boolean;
    /** Logger instance. */
    logger: ZbsLogger;
    /** Helper object to determine config values for the action. */
    configResolver: ZbsConfigResolver;
    /** Track action history in order to detect cycles. */
    actionHistory: ZbsConfigAction[];
    
    static AddRunnerType(type: ZbsProjectActionRunnerType) {
        ZbsProjectActionRunnerTypes.push(type);
    }
    
    static GetRunnerType(action: ZbsConfigAction) {
        for(const runner of ZbsProjectActionRunnerTypes) {
            if(runner.matchActionConfig(action)) {
                return runner;
            }
        }
        return undefined;
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        this.project = options.project;
        this.target = options.target;
        this.action = options.action;
        this.failed = false;
        this.malformed = false;
        this.logger = options.project.logger;
        this.actionHistory = options.actionHistory || [];
        this.configResolver = new ZbsConfigResolver(
            this.project.home.config,
            this.project.config,
            undefined,
            this.target,
            this.action,
        );
        const system = this.configResolver.get<string>("system") || "";
        this.system = this.project.getSystem(system);
        this.logger.trace("Action identifies system with name:", system);
        if(system && !this.system) {
            this.fail(`Unknown system "${system}".`, true);
        }
        else if(!this.system && this.action.type === "compile") {
            this.fail("Compile action must have an associated system.", true);
        }
        else if(!this.system && this.action.type === "link") {
            this.fail("Link action must have an associated system.", true);
        }
        this.configResolver.system = this.system;
    }
    
    getConfig<T>(key: string, fallback?: T): T | undefined {
        return this.configResolver.get<T>(key, fallback);
    }
    
    getConfigPath(key: string, basePath: string): string {
        return this.configResolver.getPath(key, basePath);
    }
    
    getConfigCwd(): string {
        return this.getConfigPath("cwd", this.project.path);
    }
    
    getConfigListAdditive<T>(key: string): T[] {
        return this.configResolver.getListAdditive<T>(key);
    }
    
    getConfigObjectAdditive<T>(key: string): {[key: string]: T} {
        return this.configResolver.getObjectAdditive<T>(key);
    }
    
    getIncludePathArg(): string {
        return (this.system && this.system.includePathArg) || "-I";
    }
    
    getLibraryPathArg(): string {
        return (this.system && this.system.libraryPathArg) || "-L";
    }
    
    getLibraryArg(): string {
        return (this.system && this.system.libraryArg) || "-l";
    }
    
    getCompileOutputArg(): string {
        return (this.system && this.system.compileOutputArg) || "-o";
    }
    
    getCompileOutputExt(): string {
        return (this.system && this.system.compileOutputExt) || ".o";
    }
    
    getLinkOutputArg(): string {
        return (this.system && this.system.linkOutputArg) || "-o";
    }
    
    fail(message: string, malformed?: boolean): void {
        this.logger.error(message);
        this.failed = true;
        if(malformed) {
            this.malformed = true;
        }
    }
    
    async run() {
        // Run this action
        const thisNextActions = await this.runThisAction();
        if(this.malformed ||
            !Array.isArray(thisNextActions) ||
            !thisNextActions.length
        ) {
            return;
        }
        // Run next actions (queue of stacks)
        // TODO: make this configurable
        const actionsCountMax: number = 100000;
        let actionsCount: number = 0;
        const actionsQueue: (ZbsConfigAction | string)[][] = [
            thisNextActions,
        ];
        let actionsQueueIndex: number = 0;
        while(actionsQueueIndex < actionsQueue.length) {
            const actionsStack = actionsQueue[actionsQueueIndex];
            const action = actionsStack.pop();
            if(!action || !actionsStack.length) {
                actionsQueueIndex++;
            }
            if(action) {
                const nextActions = this.runNextAction(action);
                if(Array.isArray(nextActions) && nextActions.length) {
                    actionsQueue.push(nextActions);
                }
            }
            if(actionsCount++ > actionsCountMax) {
                this.logger.error(
                    `Exceeded maximum actions count (${actionsCountMax}). ` +
                    `Are you sure this was intentional?`
                    // TODO: Explain how to bypass the error
                );
            }
        }
    }
    
    /**
     * @returns A stack containing actions that must be run
     * successively after this one.
     * NOTE: Actions are executed from last to first.
     */
    async runThisAction(): Promise<(ZbsConfigAction | string)[]> {
        if(this.failed || this.malformed) {
            this.logger.trace("Aborting action: Failed before running.");
            return [];
        }
        this.logger.info("Running action:",
            this.action.name || "(Inline action)"
        );
        this.logger.trace("Action config:\n",
            () => zbsValueToString(this.action, "  ")
        );
        this.logger.trace("Action's system config:\n",
            () => zbsValueToString(this.system, "  ")
        );
        // Check for cycles/loops
        if(this.actionHistory.indexOf(this.action) >= 0) {
            if(this.project.config.allowActionCycles) {
                this.logger.warn("Encountered cyclic action. (Ignoring.)");
            }
            else {
                this.fail("Encountered cyclic action.");
                this.logger.info(
                    "Cyclic actions are probably an indicator of a " +
                    "mistake in the project config! However, if you're " +
                    "sure that this is what you want, then you can " +
                    "disable this error using the allowActionCycles " +
                    "setting. This setting can be enabled by, for example, " +
                    "passing the --allow-action-cycles flag to Zebes on " +
                    "the command line."
                );
                return [];
            }
        }
        this.actionHistory.push(this.action);
        // Run this action
        try {
            await this.runType();
        }
        catch(error) {
            this.logger.error("Action failed with an exception.");
            this.logger.error(error);
            this.failed = true;
        }
        // Determine next actions
        const nextActions: (ZbsConfigAction | string)[] = [];
        if((<any> this.action).nextActionFinal) {
            nextActions.push((<any> this.action).nextActionFinal);
        }
        if((<any> this.action).nextAction && !this.failed) {
            nextActions.push((<any> this.action).nextAction);
        }
        if((<any> this.action).nextActionFailure && this.failed) {
            nextActions.push((<any> this.action).nextActionFailure);
        }
        return nextActions;
    }
    
    async runNextAction(
        action: ZbsConfigAction | string
    ): Promise<(ZbsConfigAction | string)[]> {
        const actionConfig = this.project.getAction(action);
        if(!actionConfig) {
            this.logger.error(
                "Action failed. Expected to find an action " +
                "with this name, but none was found:",
                () => JSON.stringify(action)
            );
            this.failed = true;
            this.malformed = true;
            return [];
        }
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
            actionHistory: this.actionHistory.slice(),
        });
        return await actionRunner.runThisAction();
    }
    
    runType(): Promise<void> {
        throw new Error(
            "Action runType method must be overridden by subclasses."
        );
    }
}
