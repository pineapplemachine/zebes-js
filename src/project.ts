import * as fs from "fs";
import * as path from "path";

import * as glob from "fast-glob";
// @ts-ignore
import * as micromatch from "micromatch";

import {ZbsConfigProject} from "./config";
import {ZbsConfigSystem} from "./config";
import {ZbsConfigAction} from "./config";
import {ZbsConfigActionShell} from "./config";
import {ZbsConfigActionRemove} from "./config";
import {ZbsConfigActionCompile} from "./config";
import {ZbsConfigActionLink} from "./config";
import {ZbsConfigTarget} from "./config";
import {ZbsDependencyMap} from "./dependencies";
import {ZbsError} from "./error";
import {ZbsLogger} from "./logger";
import {zbsProcessExec} from "./process";
import {zbsProcessSpawn} from "./process";
import {zbsPromiseAllLimitSettle} from "./promise";
import {ZbsPrompt} from "./prompt";
import {zbsValueToString} from "./tostring";

function zbsIsActionShell(
    value: ZbsConfigAction
): value is ZbsConfigActionShell {
    return value && typeof(value) === "object" && (
        value.type === "shell"
    );
}

function zbsIsActionRemove(
    value: ZbsConfigAction
): value is ZbsConfigActionRemove {
    return value && typeof(value) === "object" && (
        value.type === "remove"
    );
}

function zbsIsActionCompile(
    value: ZbsConfigAction
): value is ZbsConfigActionCompile {
    return value && typeof(value) === "object" && (
        value.type === "compile"
    );
}

function zbsIsActionLink(
    value: ZbsConfigAction
): value is ZbsConfigActionLink {
    return value && typeof(value) === "object" && (
        value.type === "link"
    );
}

export class ZbsConfigHelper {
    project: ZbsConfigProject | undefined;
    system: ZbsConfigSystem | undefined;
    target: ZbsConfigTarget | undefined;
    action: ZbsConfigAction | undefined;
    
    constructor(
        project?: ZbsConfigProject | undefined,
        system?: ZbsConfigSystem | undefined,
        target?: ZbsConfigTarget | undefined,
        action?: ZbsConfigAction | undefined,
    ) {
        this.project = project;
        this.system = system;
        this.target = target;
        this.action = action;
    }

    get<T>(key: string, fallback?: T): T | undefined {
        const project = <any> this.project;
        const system = <any> this.system;
        const target = <any> this.target;
        const action = <any> this.action;
        if(action && action[key] !== undefined) {
            return action[key];
        }
        else if(system && system[key] !== undefined) {
            return system[key];
        }
        else if(target && target[key] !== undefined) {
            return target[key];
        }
        else if(project && project[key] !== undefined) {
            return project[key];
        }
        else {
            return fallback;
        }
    }

    getListAdditive<T>(key: string): T[] {
        const list: T[] = [];
        const project = <any> this.project;
        const system = <any> this.system;
        const target = <any> this.target;
        const action = <any> this.action;
        if(project && key in project && Array.isArray(project[key])) {
            list.push(...project[key]);
        }
        if(system && key in system && Array.isArray(system[key])) {
            list.push(...system[key]);
        }
        if(target && key in target && Array.isArray(target[key])) {
            list.push(...target[key]);
        }
        if(action && key in action && Array.isArray(action[key])) {
            list.push(...action[key]);
        }
        return list;
    }

    getObjectAdditive<T>(key: string): {[key: string]: T} {
        const object: {[key: string]: T} = {};
        const project = <any> this.project;
        const system = <any> this.system;
        const target = <any> this.target;
        const action = <any> this.action;
        if(project && project[key] && typeof(project[key]) === "object") {
            Object.assign(object, project[key]);
        }
        if(system && system[key] && typeof(system[key]) === "object") {
            Object.assign(object, system[key]);
        }
        if(target && target[key] && typeof(target[key]) === "object") {
            Object.assign(object, target[key]);
        }
        if(action && action[key] && typeof(action[key]) === "object") {
            Object.assign(object, action[key]);
        }
        return object;
    }
}

export class ZbsProject {
    path: string;
    configPath: string;
    rebuild: boolean;
    parallel: number;
    promptYes: boolean;
    dryRun: boolean;
    config: ZbsConfigProject;
    logger: ZbsLogger;
    prompt: ZbsPrompt;
    systemsMap: {[name: string]: ZbsConfigSystem};
    actionsMap: {[name: string]: ZbsConfigAction};
    targetsMap: {[name: string]: ZbsConfigTarget};
    
    constructor(
        projectPath: string,
        configPath: string,
        config: ZbsConfigProject,
        logger: ZbsLogger,
    ) {
        this.path = projectPath;
        this.configPath = configPath;
        this.config = config;
        this.logger = logger;
        this.rebuild = false;
        this.promptYes = false;
        this.dryRun = false;
        this.parallel = 0;
        this.prompt = new ZbsPrompt();
        function buildMap<T extends {name?: string | undefined}>(
            list: T[] | null | undefined
        ): {[name: string]: T} {
            const map: {[name: string]: T} = {};
            if(Array.isArray(list)) {
                for(const item of list) {
                    if(typeof(item) === "object" &&
                        item && item.name && !(item.name in map)
                    ) {
                        map[item.name] = item;
                    }
                }
            }
            return map;
        }
        this.systemsMap = buildMap<ZbsConfigSystem>(config.systems);
        this.actionsMap = buildMap<ZbsConfigAction>(config.actions);
        this.targetsMap = buildMap<ZbsConfigTarget>(config.targets);
    }
    
    getSystem(
        system: ZbsConfigSystem | string | undefined
    ): ZbsConfigSystem | undefined {
        if(typeof(system) === "string") {
            return this.systemsMap[system];
        }
        else {
            return system;
        }
    }
    
    getTarget(
        target: ZbsConfigTarget | string | undefined
    ): ZbsConfigTarget | undefined {
        if(typeof(target) === "string") {
            return this.targetsMap[target];
        }
        else {
            return target;
        }
    }
    
    getAction(
        action: ZbsConfigAction | string | undefined
    ): ZbsConfigAction | undefined {
        if(typeof(action) === "string") {
            return this.actionsMap[action];
        }
        else {
            return action;
        }
    }
}

export class ZbsProjectTargetRunner {
    project: ZbsProject;
    target: ZbsConfigTarget;
    logger: ZbsLogger;
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
    
    async run() {
        this.logger.info("Running target:", this.target.name);
        this.logger.trace("Target config:");
        this.logger.trace(() => zbsValueToString(this.target, "  "));
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
        for(const action of this.target.actions) {
            const actionConfig = this.project.getAction(action);
            if(!actionConfig) {
                throw new ZbsError(`No such action: ${action}`);
            }
            const actionRunner = new ZbsProjectActionRunner(
                this.project,
                this.target,
                actionConfig,
            );
            await actionRunner.run();
            if(actionRunner.failed) {
                if((<any> actionConfig).ignoreFailure) {
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
    }
}

export class ZbsProjectActionRunner {
    project: ZbsProject;
    system: ZbsConfigSystem | undefined;
    target: ZbsConfigTarget | undefined;
    action: ZbsConfigAction;
    failed: boolean;
    malformed: boolean;
    logger: ZbsLogger;
    configHelper: ZbsConfigHelper;
    actionHistory: ZbsConfigAction[];
    
    constructor(
        project: ZbsProject,
        target: ZbsConfigTarget | undefined,
        action: ZbsConfigAction,
        actionHistory?: ZbsConfigAction[],
    ) {
        this.project = project;
        this.target = target;
        this.action = action;
        this.failed = false;
        this.malformed = false;
        this.logger = project.logger;
        this.actionHistory = actionHistory || [];
        this.configHelper = new ZbsConfigHelper(
            project.config, undefined, target, action
        );
        const system = this.configHelper.get<string>("system") || "";
        this.system = project.getSystem(system);
        this.logger.trace("Action identifies system with name:", system);
        if(system && !this.system) {
            this.logger.error(`Unknown system "${system}".`);
            this.failed = true;
            this.malformed = true;
        }
        else if(!this.system && this.action.type === "compile") {
            this.logger.error("Compile action must have an associated system.");
            this.failed = true;
            this.malformed = true;
        }
        else if(!this.system && this.action.type === "link") {
            this.logger.error("Link action must have an associated system.");
            this.failed = true;
            this.malformed = true;
        }
        this.configHelper.system = this.system;
    }
    
    getConfig<T>(key: string, fallback?: T): T | undefined {
        return this.configHelper.get<T>(key, fallback);
    }
    
    getCwd<T>(): string {
        const cwd: string = this.getConfig("cwd") || "";
        return (cwd ?
            path.resolve(this.project.path, cwd) :
            this.project.path
        );
    }
    
    getConfigListAdditive<T>(key: string): T[] {
        return this.configHelper.getListAdditive<T>(key);
    }
    
    getConfigObjectAdditive<T>(key: string): {[key: string]: T} {
        return this.configHelper.getObjectAdditive<T>(key);
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
    
    getCompileMakeRuleArg(): string {
        return (this.system && this.system.compileMakeRuleArg) || "-MM";
    }
    
    getLinkOutputArg(): string {
        return (this.system && this.system.linkOutputArg) || "-o";
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
        this.logger.trace("Action config:");
        this.logger.trace(() => zbsValueToString(this.action, "  "));
        this.logger.trace("Action's system config:");
        this.logger.trace(() => zbsValueToString(this.system, "  "));
        // Check for cycles/loops
        if(this.actionHistory.indexOf(this.action) >= 0) {
            if(this.project.config.allowActionCycles) {
                this.logger.warn("Encountered cyclic action. (Ignoring.)");
            }
            else {
                this.logger.error("Encountered cyclic action.");
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
                return [];
            }
        }
        this.actionHistory.push(this.action);
        // Run this action
        await this.runDispatchType();
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
    
    runNextAction(
        action: ZbsConfigAction | string
    ): Promise<(ZbsConfigAction | string)[]> {
        const actionConfig = this.project.getAction(action);
        if(!actionConfig) {
            throw new ZbsError(`No such action: ${action}`);
        }
        const actionRunner = new ZbsProjectActionRunner(
            this.project,
            this.target,
            actionConfig,
            this.actionHistory.slice(),
        );
        return actionRunner.runThisAction();
    }
    
    runDispatchType() {
        if(this.action.type === "shell") {
            return this.runShell();
        }
        else if(this.action.type === "remove") {
            return this.runRemove();
        }
        else if(this.action.type === "compile") {
            return this.runCompile();
        }
        else if(this.action.type === "link") {
            return this.runLink();
        }
        else if((<any> this.action).type) {
            throw new ZbsError(
                `Invalid action: Unknown action type ` +
                `"${(<any> this.action).type}".`
            );
        }
        else {
            throw new ZbsError(`Invalid action: Action must have a type.`);
        }
    }
    
    async runShell() {
        this.logger.trace("Running shell action.");
        if(!zbsIsActionShell(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        const cwd = this.getCwd();
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
                this.logger.info(`Command failed: Status code ${statusCode}`);
                this.failed = true;
                break;
            }
        }
    }
    
    async runRemove() {
        this.logger.trace("Running remove action.");
        if(!zbsIsActionRemove(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        const cwd = this.getCwd();
        const removePaths = await glob(this.action.removePaths, {
            cwd: cwd,
            suppressErrors: true,
            onlyFiles: false,
        });
        for(const removePath of removePaths) {
            if(!removePath) {
                continue;
            }
            const stat = fs.statSync(removePath, {
                throwIfNoEntry: false,
            });
            if(!stat) {
                this.logger.debug(
                    "Not removing path (doesn't exist):", removePath
                );
                continue;
            }
            const removeName = stat.isDirectory() ? "directory" : "file";
            if(this.project.dryRun) {
                this.logger.info(`Dry-run: Removing ${removeName}:`, removePath);
                continue;
            }
            const removeOk = this.project.promptYes || (
                await this.project.prompt.confirm(
                    `Remove ${removeName} ${removePath} ?`, false
                )
            );
            if(removeOk) {
                this.logger.info(`Removing ${removeName}:`, removePath);
                if(stat.isDirectory()) {
                    fs.rmdirSync(removePath, {
                        recursive: true,
                    });
                }
                else {
                    fs.unlinkSync(removePath);
                }
            }
            else {
                this.logger.info(`Not removing ${removeName}:`, removePath);
            }
        }
    }
    
    async runCompile() {
        this.logger.trace("Running compile action.");
        if(!zbsIsActionCompile(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        const cwd = this.getCwd();
        const env = this.getConfigObjectAdditive<string>("env");
        const incremental = !!this.getConfig<boolean>("incremental");
        const compiler = this.getConfig<string>("compiler") || "";
        const compileArgs = this.getConfigListAdditive<string>("compileArgs");
        const includePaths = this.getConfigListAdditive<string>("includePaths");
        if(!compiler) {
            this.logger.error("No compiler has been specified.");
            this.failed = true;
            return;
        }
        else {
            this.logger.trace("Using linker:", compiler);
        }
        const sourcePaths = await glob(this.action.sourcePaths, {
            cwd: cwd,
            suppressErrors: true,
        });
        const buildPaths: string[] = incremental ? [] : sourcePaths;
        const depsPath = path.join(
            this.action.outputPath, "zebes.deps.json.gzip"
        );
        const dependencies = new ZbsDependencyMap(
            this.getCwd(), this.logger
        );
        if(incremental) {
            // Attempt to load dependencies information from a prior run
            if(fs.existsSync(depsPath)) {
                await dependencies.load(depsPath);
            }
            // Get the list of paths that should be rebuilt
            // For example, because they have changed since the last compile
            // This step does not yet consider dependencies
            const rebuildPaths = this.action.rebuildSourcePaths && new Set(micromatch(
                sourcePaths,
                this.action.rebuildSourcePaths,
            ));
            for(const sourcePath of sourcePaths) {
                const objectPath = path.join(
                    this.action.outputPath, sourcePath
                );
                let needsBuild: boolean = true;
                if(!this.project.rebuild && (
                    !rebuildPaths || !rebuildPaths.has(sourcePath)
                )) {
                    const sourceTime = fs.statSync(sourcePath, {
                        bigint: true,
                        throwIfNoEntry: false,
                    });
                    const objectTime = fs.statSync(objectPath, {
                        bigint: true,
                        throwIfNoEntry: false,
                    });
                    needsBuild = (
                        !sourceTime || !objectTime ||
                        sourceTime >= objectTime
                    );
                }
                if(needsBuild) {
                    buildPaths.push(sourcePath);
                }
                else {
                    this.logger.debug(
                        "Source file was found to have not changed:", sourcePath
                    );
                }
            }
            // Add dependencies to the build paths list
            const dependants = dependencies.getDependants(buildPaths);
            const buildPathsSet = new Set(buildPaths);
            for(const buildPath of buildPaths) {
                dependants.delete(buildPath);
            }
            for(const sourcePath of sourcePaths) {
                if(dependants.has(sourcePath) && !buildPathsSet.has(sourcePath)) {
                    buildPaths.push(sourcePath);
                    this.logger.debug(
                        "Source file will be rebuilt due to rebuilt dependencies:",
                        sourcePath
                    );
                }
            }
        }
        const build = async (buildPath: string) => {
            if(!zbsIsActionCompile(this.action)) {
                throw new Error("Internal error: Action type inconsistency.");
            }
            const objectPath = path.join(
                this.action.outputPath,
                buildPath + this.getCompileOutputExt(),
            );
            const baseArgs: string[] = [buildPath];
            baseArgs.push(...includePaths.map(
                (path) => (this.getIncludePathArg() + path)
            ));
            baseArgs.push(...compileArgs);
            const args = [
                ...baseArgs,
                this.getCompileOutputArg(),
                objectPath,
            ];
            this.logger.info("Building:", buildPath);
            if(this.project.dryRun) {
                this.logger.info("Dry-run: $", compiler, ...args);
            }
            else {
                this.logger.info("$", compiler, ...args);
                fs.mkdirSync(path.dirname(path.resolve(cwd, objectPath)), {
                    recursive: true,
                });
                const statusCode = await zbsProcessSpawn(compiler, args, {
                    cwd: cwd,
                    env: Object.assign({}, process.env, env),
                    shell: true,
                }, {
                    stdout: (data) => this.logger.info(data.toString()),
                    stderr: (data) => this.logger.info(data.toString()),
                });
                if(statusCode !== 0) {
                    this.logger.error(
                        `Compilation failed with status code ${statusCode}:`,
                        buildPath
                    );
                    this.failed = true;
                }
            }
            if(incremental) {
                await dependencies.update({
                    sourcePath: buildPath,
                    dryRun: this.project.dryRun,
                    env: env,
                    compiler: compiler,
                    compileArgs: baseArgs,
                    includePaths: includePaths,
                    compileMakeRuleArg: this.getCompileMakeRuleArg(),
                    includeSourcePatterns: (
                        this.system && this.system.includeSourcePatterns
                    ),
                });
            }
        }
        this.logger.info(`Building ${buildPaths.length} source files.`);
        await zbsPromiseAllLimitSettle(
            Math.max(this.project.parallel, 1),
            buildPaths.map((buildPath) => (() => build(buildPath))),
        );
        if(incremental && !this.project.dryRun) {
            this.logger.debug("Writing dependencies data:", depsPath);
            await dependencies.write(depsPath);
        }
    }
    
    async runLink() {
        this.logger.trace("Running link action.");
        if(!zbsIsActionLink(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        const cwd = this.getCwd();
        const env = this.getConfigObjectAdditive<string>("env");
        const compiler = this.getConfig<string>("compiler") || "";
        const linker = this.getConfig<string>("linker") || compiler;
        const linkArgs = this.getConfigListAdditive<string>("linkArgs");
        const libraryPaths = this.getConfigListAdditive<string>("libraryPaths");
        const libraries = this.getConfigListAdditive<string>("libraries");
        if(!linker) {
            this.logger.error("No linker has been specified.");
            this.failed = true;
            return;
        }
        else {
            this.logger.trace("Using linker:", linker);
        }
        const objectPaths = await glob(this.action.objectPaths || [], {
            cwd: cwd,
            suppressErrors: true,
        });
        if(!objectPaths.length) {
            this.logger.error("No object files were found.");
            return 1;
        }
        const args: string[] = [];
        args.push(...objectPaths);
        args.push(...libraryPaths.map(
            (path) => (this.getLibraryPathArg() + path)
        ));
        args.push(...libraries.map(
            (path) => (this.getLibraryArg() + path)
        ));
        args.push(...linkArgs);
        args.push(this.getLinkOutputArg(), this.action.outputPath);
        fs.mkdirSync(path.dirname(path.resolve(cwd, this.action.outputPath)), {
            recursive: true,
        });
        this.logger.info("Linking:", this.action.outputPath);
        if(this.project.dryRun) {
            this.logger.info("Dry-run: $", linker, ...args);
            return;
        }
        this.logger.info("$", linker, ...args);
        const statusCode = await zbsProcessSpawn(linker, args, {
            cwd: cwd,
            env: Object.assign({}, process.env, env),
            shell: true,
        }, {
            stdout: (data) => this.logger.info(data.toString()),
            stderr: (data) => this.logger.info(data.toString()),
        });
        if(statusCode !== 0) {
            this.logger.error("Linking failed with status code", statusCode);
            this.failed = true;
        }
    }
}
