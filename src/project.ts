import {ZbsConfigAction} from "./config/config_types";
import {ZbsConfigProject} from "./config/config_types";
import {ZbsConfigSystem} from "./config/config_types";
import {ZbsConfigTarget} from "./config/config_types";
import {ZbsHome} from "./home";
import {ZbsLogger} from "./logger";
import {ZbsPrompt} from "./util/util_prompt";

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
    
    async promptConfirm(
        message: string, defaultResult?: boolean
    ): Promise<boolean> {
        return this.home.config.promptYes || (
            await this.prompt.confirm(message, defaultResult)
        );
    }
}
