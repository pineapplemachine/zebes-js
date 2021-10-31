import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";

// @ts-ignore
import * as fsExtra from "fs-extra";

import {ZbsConfigAction} from "./config/config_types";
import {ZbsConfigProject} from "./config/config_types";
import {ZbsConfigSystem} from "./config/config_types";
import {ZbsConfigTarget} from "./config/config_types";
import {ZbsHome} from "./home";
import {ZbsLogger} from "./logger";
import {ZbsLogLevel} from "./logger";
import {zbsProcessExec} from "./util/util_process";
import {zbsProcessSpawn} from "./util/util_process";
import {ZbsPrompt} from "./util/util_prompt";

export interface ZbsProjectExecOptions extends child_process.ExecOptions {
    ignoreDryRun?: boolean;
    verbose?: boolean;
    silent?: boolean;
    dataLogLevel?: number;
}

export interface ZbsProjectSpawnOptions extends child_process.SpawnOptions {
    ignoreDryRun?: boolean;
    verbose?: boolean;
    silent?: boolean;
    dataLogLevel?: number;
}

export class ZbsProject {
    /** Path to root project directory. */
    path: string;
    /** Path to project configuration file. */
    configPath: string;
    /** Dry-run flag: Announce actions, don't take them. */
    dryRun: boolean;
    /** Project config object loaded from project file. */
    config: ZbsConfigProject;
    /** Logger instance. */
    logger: ZbsLogger;
    /** Helper class for interactive CLI prompts. */
    prompt: ZbsPrompt;
    /** Helper class for dealing with Zebes' home directory. */
    home: ZbsHome;
    /** Run using these environment variables. */
    env: {[name: string]: string};
    /** Full list of object files produced by "compile" actions. */
    objectsAuto: Set<string>;
    /** Named lists of object files used by "compile" and "link" actions. */
    objectLists: {[name: string]: Set<string>};
    /** Map system config objects by name. */
    systemsMap: {[name: string]: ZbsConfigSystem};
    /** Map action config objects by name. */
    actionsMap: {[name: string]: ZbsConfigAction};
    /** Map target config objects by name. */
    targetsMap: {[name: string]: ZbsConfigTarget};
    
    constructor(
        projectPath: string,
        configPath: string,
        config: ZbsConfigProject,
        logger: ZbsLogger,
        home: ZbsHome,
        env?: {[name: string]: string},
    ) {
        this.path = projectPath;
        this.configPath = configPath;
        this.config = config;
        this.logger = logger;
        this.home = home;
        this.env = env || <any> process.env;
        this.dryRun = false;
        this.prompt = new ZbsPrompt();
        this.objectsAuto = new Set();
        this.objectLists = {};
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
    
    addCompiledObject(listName: string | undefined, objectPath: string) {
        if(listName) {
            if(!this.objectLists[listName]) {
                this.objectLists[listName] = new Set();
            }
            this.objectLists[listName].add(objectPath);
        }
        this.objectsAuto.add(objectPath);
    }
    
    takeObjectsAuto() {
        const objectsAuto = this.objectsAuto;
        this.objectsAuto = new Set();
        return objectsAuto;
    }
    
    async fsMkdir(dirPath: string) {
        const prefix = this.dryRun ? "Dry-run: " : "";
        this.logger.debug(prefix + "Ensuring directory existence:", dirPath);
        if(!this.dryRun) {
            fs.mkdirSync(dirPath, {recursive: true});
        }
    }
    
    async fsMove(srcPath: string, destPath: string, overwrite?: boolean) {
        const prefix = this.dryRun ? "Dry-run: " : "";
        this.logger.info(
            prefix + "Moving from", srcPath, "to", destPath
        );
        if(!this.dryRun) {
            fsExtra.moveSync(srcPath, destPath, {
                overwrite: !!overwrite,
            });
        }
    }
    
    async fsRemove(removePath: string) {
        const prefix = this.dryRun ? "Dry-run: " : "";
        this.logger.info(
            prefix + "Removing path:", removePath
        );
        if(!this.dryRun) {
            fsExtra.removeSync(removePath);
        }
    }
    
    async fsCopy(srcPath: string, destPath: string, overwrite?: boolean) {
        const prefix = this.dryRun ? "Dry-run: " : "";
        this.logger.info(
            prefix + "Copying from", srcPath, "to", destPath
        );
        if(!this.dryRun) {
            fsExtra.copySync(srcPath, destPath, {
                overwrite: !!overwrite,
            });
        }
    }
    
    async fsCopyFile(srcPath: string, destPath: string) {
        const prefix = this.dryRun ? "Dry-run: " : "";
        this.logger.info(
            prefix + "Copying file from", srcPath, "to", destPath
        );
        if(!this.dryRun) {
            fs.mkdirSync(path.dirname(destPath), {recursive: true});
            fs.copyFileSync(srcPath, destPath);
        }
    }
    
    async promptConfirm(
        message: string, defaultResult?: boolean
    ): Promise<boolean> {
        return this.home.config.promptYes || (
            await this.prompt.confirm(message, defaultResult)
        );
    }
    
    async processCommon(
        exec: boolean,
        command: string,
        args: string[] | undefined,
        options: any,
        callbacks?: {
            stdout?: (data: Buffer) => any,
            stderr?: (data: Buffer) => any,
        }
    ): Promise<number> {
        if(exec && args) {
            throw new Error("Process execution inconsistency error.");
        }
        const dryRun = this.dryRun && !options.ignoreDryRun;
        const prefix = (dryRun ? "Dry-run: $" : "$");
        const logLevel = (options.verbose ?
            ZbsLogLevel.Debug : ZbsLogLevel.Info
        );
        if(!options.silent) {
            this.logger.log(logLevel, prefix, command, ...(args || []));
        }
        if(dryRun) {
            return 0;
        }
        const dataLogLevel = ("dataLogLevel" in options ?
            options.dataLogLevel : logLevel
        );
        const useCallbacks = callbacks || {
            stdout: (data) => this.logger.log(
                dataLogLevel, data.toString()
            ),
            stderr: (data) => this.logger.log(
                dataLogLevel, data.toString()
            ),
        };
        let statusCode: number = 0;
        if(exec) {
            statusCode = await zbsProcessExec(
                command, options, useCallbacks
            );
        }
        else {
            statusCode = await zbsProcessSpawn(
                command, args || [], options, useCallbacks
            );
        }
        this.logger.trace("Process status code:", statusCode);
        return statusCode;
    }
    
    processExec(
        command: string,
        options: ZbsProjectExecOptions,
        callbacks?: {
            stdout?: (data: Buffer) => any,
            stderr?: (data: Buffer) => any,
        }
    ): Promise<number> {
        return this.processCommon(
            true, command, undefined, options, callbacks
        );
    }
    
    processSpawn(
        command: string,
        args: string[],
        options: ZbsProjectSpawnOptions,
        callbacks?: {
            stdout?: (data: Buffer) => any,
            stderr?: (data: Buffer) => any,
        }
    ): Promise<number> {
        return this.processCommon(
            false, command, args, options, callbacks
        );
    }
}
