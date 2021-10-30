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

export type ZbsProjectActionListRunnerStack = (
    {actions: ZbsProjectRunnerNextAction[], index: number}[]
);

export interface ZbsProjectRunnerNextAction {
    action: (ZbsConfigAction | string),
    continueActionAfter?: ZbsProjectActionRunner | undefined,
}

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
    
    getActionName(): string {
        return (this.action.name ?
            JSON.stringify(this.action.name) :
            "(Inline action)"
        );
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
    
    async run(): Promise<void> {
        if(this.failed || this.malformed) {
            this.logger.trace("Aborting action: Failed before running.");
            return;
        }
        this.logger.info("Running action:", () => this.getActionName());
        this.logger.trace(() => ("Action config:\n" +
            zbsValueToString(this.action, "  ")
        ));
        this.logger.trace(() => ("Action's system config:\n" +
            zbsValueToString(this.system, "  ")
        ));
        try {
            await this.runType();
        }
        catch(error) {
            this.logger.error("Action failed with an exception.");
            this.logger.error(error);
            this.failed = true;
        }
        this.logger.trace("Finished running action:",
            () => this.getActionName()
        );
    }
    
    /**
     * Action type subclasses override this method to define their
     * implementation.
     */
    runType(): Promise<void> {
        throw new Error(
            "Action runType method must be overridden by subclasses."
        );
    }
    
    /**
     * Action type subclasses may override this method to define
     * follow-up actions.
     */
    async getNextActions(): Promise<undefined | ZbsProjectRunnerNextAction[]> {
        const nextActions: ZbsProjectRunnerNextAction[] = [];
        if((<any> this.action).nextAction && !this.failed) {
            nextActions.push({action: (<any> this.action).nextAction});
        }
        if((<any> this.action).nextActionFailure && this.failed) {
            nextActions.push({action: (<any> this.action).nextActionFailure});
        }
        if((<any> this.action).nextActionFinal) {
            nextActions.push({action: (<any> this.action).nextActionFinal});
        }
        return nextActions;
    }
}

export class ZbsProjectActionListRunner {
    /** Provides information about the containing project. */
    project: ZbsProject;
    /** Config object representing the target to run. */
    target: ZbsConfigTarget;
    /** Config objects or names for the actions being run. */
    actions: (ZbsConfigAction | string)[];
    /** Logger instance. */
    logger: ZbsLogger;
    /** Flag is set to true upon target failure. */
    failed: boolean;
    /** Stack (FILO) of queues (FIFO) of actions to run. */
    actionsStack: ZbsProjectActionListRunnerStack;
    /** List of actions that have been run so far. */
    actionsHistory: ZbsConfigAction[];
    
    constructor(
        project: ZbsProject,
        target: ZbsConfigTarget,
        actions: (ZbsConfigAction | string)[],
        logger?: ZbsLogger,
    ) {
        this.project = project;
        this.target = target;
        this.actions = actions;
        this.logger = logger || project.logger;
        this.actionsStack = this.initActionsStack(actions);
        this.actionsHistory = [];
        this.failed = false;
    }
    
    get done() {
        return !this.actionsStack.length;
    }
    
    initActionsStack(actions: (ZbsConfigAction | string)[]) {
        const stack: ZbsProjectActionListRunnerStack = [];
        for(let i = actions.length - 1; i >= 0; i--) {
            const action = actions[i];
            const actionConfig = this.project.getAction(action);
            if(!actionConfig) {
                this.logger.error(
                    "Execution failed. No action has this name:",
                    () => JSON.stringify(action)
                );
                this.failed = true;
                return [];
            }
            stack.push({
                actions: [{action: actionConfig}],
                index: 0,
            });
        }
        return stack;
    }
    
    async run(): Promise<void> {
        while(!this.done && !this.failed) {
            await this.runNextAction();
        }
    }
    
    getAllowActionCycles(): boolean {
        if(this.project.config.allowActionCycles !== undefined) {
            return !!this.project.config.allowActionCycles;
        }
        else {
            return !!this.project.home.config.allowActionCycles
        }
    }
    
    getNextAction(): ZbsProjectRunnerNextAction | undefined {
        while(this.actionsStack.length) {
            const stackTop = this.actionsStack[this.actionsStack.length - 1];
            const nextAction = stackTop && stackTop.actions[stackTop.index++];
            if(stackTop && (stackTop.index >= stackTop.actions.length)) {
                this.actionsStack.pop();
            }
            if(nextAction) {
                return nextAction;
            }
        }
        return undefined;
    }
    
    async runNextAction(): Promise<void> {
        const nextAction = this.getNextAction();
        if(nextAction) {
            const actionConfig = this.project.getAction(nextAction.action);
            if(actionConfig) {
                await this.runAction(actionConfig);
                if(nextAction.continueActionAfter) {
                    await this.handleActionRunner(nextAction.continueActionAfter);
                }
            }
            else {
                this.logger.error(
                    "Execution failure. Unknown action name:",
                    () => JSON.stringify(nextAction.action)
                );
                this.failed = true;
            }
        }
    }
    
    checkAction(action: ZbsConfigAction) {
        // Check for action cycles
        if(!this.getAllowActionCycles() &&
            this.actionsHistory.indexOf(action) >= 0
        ) {
            this.logger.error(
                "Aborting action execution: Encountered cyclic action."
            );
            this.logger.info(
                "Cyclic actions are probably an indicator of a " +
                "mistake in the project config! However, if you're " +
                "sure that this is what you want, then you can " +
                "disable this error using the allowActionCycles " +
                "setting. This setting can be enabled by, for example, " +
                "passing the --allow-action-cycles flag to Zebes on " +
                "the command line."
            );
            this.failed = true;
        }
        this.actionsHistory.push(action);
        // Check max actions count
        if(this.project.home.config.runMaxActions &&
            this.actionsHistory.length > this.project.home.config.runMaxActions
        ) {
            this.logger.error(
                "Aborting action execution: Maximum action count exceeded."
            );
            this.logger.info(
                "Exceeding the maximum action count is probably an " +
                "indicator of a mistake in the project config! " +
                "However, if you're sure that this is what you " +
                "want, then you can change the maximum number of " +
                "actions allowed to run at once using the runMaxActions " +
                "setting. This setting can be changed by, for example, " +
                "passing a --run-max-actions argument to Zebes on the " +
                "command line. " +
                "Setting the value to zero removes all limitation."
            );
            this.failed = true;
        }
    }
    
    async handleActionRunner(
        actionRunner: ZbsProjectActionRunner
    ): Promise<void> {
        // Run it
        await actionRunner.run();
        // Handle failure
        if(actionRunner.failed) {
            if(actionRunner.malformed) {
                this.logger.error(
                    "Aborting action execution: " +
                    "Action configuration was malformed."
                );
                this.failed = true;
            }
            else if(actionRunner.action.ignoreFailure) {
                this.logger.info("Action failed. (Ignoring.)");
            }
            else {
                this.logger.error(
                    "Aborting target execution: Action failed."
                );
                this.failed = true;
            }
        }
        // Add subsequent actions to the stack
        if(!actionRunner.malformed) {
            const nextActions = await actionRunner.getNextActions();
            if(nextActions && nextActions.length) {
                this.actionsStack.push({actions: nextActions, index: 0});
            }
        }
    }
    
    async runAction(action: ZbsConfigAction): Promise<void> {
        this.checkAction(action);
        if(this.failed) {
            return;
        }
        // Run the action
        const actionRunnerType = (
            ZbsProjectActionRunner.GetRunnerType(action)
        );
        if(!actionRunnerType) {
            throw new Error("Internal action type dispatch error.");
        }
        const actionRunner = new actionRunnerType({
            project: this.project,
            target: this.target,
            action: action,
        });
        await this.handleActionRunner(actionRunner);
    }
}
