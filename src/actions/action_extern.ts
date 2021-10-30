import * as fs from "fs";
import * as path from "path";

import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsProjectRunnerNextAction} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionExtern} from "../config/config_types";
import {zbsIsActionExtern} from "../config/config_types";

export class ZbsProjectActionExternRunner extends ZbsProjectActionRunner {
    /** Flag is set on first run if the dependency is not already satisfied. */
    needsAcquire: boolean;
    /** Flag is set upon the dependency being satisfied. */
    acquired: boolean;
    
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionExtern(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
        this.needsAcquire = false;
        this.acquired = false;
    }
    
    getCache() {
        return this.project.home.cache("extern");
    }
    
    /**
     * This is a two-part action.
     *
     * The first time that the runner executes this action, the
     * "runPreExtern" method is evaluated. This method determines
     * whether the external dependency has been satisfied or not.
     * If it has been, then this is the end of the extern action.
     * If not, then the "getNextActions" method will return the
     * list of acquireActions associated with this extern action.
     * After the final action in the list, the runner will return
     * to this action and execute it again.
     *
     * The second time that the runner executes this action, the
     * "runPostExtern" method is evaluated. This method verifies
     * that the external dependency has in fact been acquired.
     * If it has been, then it is copied to the location where
     * is is needed. It may be cached, as well.
     * If it has not been, then this extern action reports a
     * failure.
     */
    async runType(): Promise<void> {
        this.logger.trace("Running extern action.");
        if(!zbsIsActionExtern(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        if(this.failed || this.acquired) {
            return;
        }
        else if(this.needsAcquire) {
            await this.runPostExtern();
        }
        else {
            await this.runPreExtern();
        }
    }
    
    async runPreExtern(): Promise<void> {
        this.logger.trace(`Running extern action "pre" step.`);
        if(!zbsIsActionExtern(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        if(!this.action.externRequirements.length) {
            this.logger.warn("Extern action has no requirements.");
            this.acquired = true;
            return;
        }
        // Check each extern requirement
        const cwd = this.getConfigCwd();
        let requirementsSatisfied: number = 0;
        for(const requirement of this.action.externRequirements) {
            const externName = requirement.externName;
            const externPath = path.resolve(cwd, requirement.externPath);
            const cache = !!(requirement.cache !== undefined ?
                requirement.cache : this.action.cache
            );
            // Check if the dependency path already exists
            if(fs.existsSync(externPath)) {
                this.logger.info(() => (
                    `Extern dependency ${JSON.stringify(externName)} ` +
                    `is already satisfied: ` + externPath
                ));
                requirementsSatisfied++;
                continue;
            }
            // Check if the dependency is in the Zebes cache
            if(cache) {
                const cachedExtern = await this.getCache().getFile(
                    requirement.externName
                );
                if(cachedExtern && fs.existsSync(cachedExtern.path)) {
                    const cachedTime = new Date(cachedExtern.timestamp);
                    this.logger.info(() => (
                        `Copying extern dependency ${JSON.stringify(externName)} ` +
                        `from Zebes external dependencies cache. ` +
                        `(Acquired ${cachedTime.toISOString()})`
                    ));
                    await this.project.fsCopy(cachedExtern.path, externPath);
                    requirementsSatisfied++;
                    continue;
                }
                else if(cachedExtern) {
                    this.logger.debug(
                        "Cache record exists but the file is missing:",
                        cachedExtern.path
                    );
                }
            }
        }
        // Handle extern action state
        // Indicate that the dependency must yet be acquired, if needed
        if(requirementsSatisfied === this.action.externRequirements.length) {
            this.acquired = true;
        }
        else {
            this.logger.debug(
                "Extern dependency is not satisfied. " +
                "Extern acquireActions will be run to attempt " +
                "to acquire files."
            );
            this.needsAcquire = true;
        }
    }
    
    async runPostExtern() {
        this.logger.trace(`Running extern action "post" step.`);
        if(!zbsIsActionExtern(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        const cwd = this.getConfigCwd();
        if(this.project.dryRun) {
            this.logger.info(
                "Dry-run: Assuming external dependency was " +
                "successfully acquired."
            );
            this.acquired = true;
            return;
        }
        // Check that the dependency has actually been acquired
        let requirementsSatisfied: number = 0;
        for(const requirement of this.action.externRequirements) {
            const externName = requirement.externName;
            const externPath = path.resolve(cwd, requirement.externPath);
            const acquirePath = path.resolve(cwd, requirement.acquirePath);
            const cache = !!(requirement.cache !== undefined ?
                requirement.cache : this.action.cache
            );
            if(!fs.existsSync(acquirePath)) {
                this.logger.error(() => (
                    `Extern action failure: Extern dependency acquisition ` +
                    `for ${JSON.stringify(externName)} failed to produce ` +
                    `the expected output at ` + acquirePath
                ));
                this.failed = true;
                continue;
            }
            else {
                this.logger.info(() => (
                    `Extern dependency ${JSON.stringify(externName)} ` +
                    `was successfully acquired at ` + acquirePath
                ));
                requirementsSatisfied++;
            }
            // Add it to the cache, when applicable
            if(cache) {
                const cachePath = await this.getCache().addFile(
                    requirement.externName
                );
                this.logger.debug("Copying to cache path:", cachePath);
                await this.project.fsMkdir(path.dirname(cachePath));
                await this.project.fsCopy(acquirePath, cachePath);
            }
            // Copy it to the expected extern path
            await this.project.fsCopy(acquirePath, externPath);
        }
        if(requirementsSatisfied === this.action.externRequirements.length) {
            this.acquired = true;
        }
        else {
            this.logger.error(
                "Extern action failure: Not all dependencies were " +
                "succesfully acquired."
            );
            this.failed = true;
        }
    }
    
    async getNextActions(): Promise<ZbsProjectRunnerNextAction[] | undefined> {
        // Run acquireActions to acquire the dependency
        if(this.needsAcquire && !this.acquired && !this.failed) {
            const acquireActions = (
                (<ZbsConfigActionExtern> this.action).acquireActions
            );
            const nextActions = acquireActions.map((action, i) => ({
                action: action,
                continueActionAfter: (
                    i === acquireActions.length - 1 ? this : undefined
                ),
            }));
            return nextActions;
        }
        // Run nextActionAcquired and then normal nextAction, etc.
        else if(this.needsAcquire && this.acquired && !this.failed) {
            const nextActions = (await super.getNextActions()) || [];
            const nextActionAcquired = (
                (<ZbsConfigActionExtern> this.action).nextActionAcquired
            );
            if(nextActionAcquired) {
                nextActions.unshift({action: nextActionAcquired});
            }
            return nextActions;
        }
        // Run normal nextAction, etc.
        else {
            return await super.getNextActions();
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionExternRunner);
