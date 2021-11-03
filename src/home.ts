import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {URL} from "url";

import {ZbsLogger} from "./logger";
import {ZbsConfigHome} from "./config/config_types";
import {zbsValidateConfigHome} from "./config/config_validate";
import {zbsValueToString} from "./to_string";
import {zbsGzipJsonRead} from "./util/util_json_gzip";
import {zbsGzipJsonWrite} from "./util/util_json_gzip";

export const ZbsHomeConfigPath: string = (
    "config.json"
);

export interface ZbsHomeFileCacheData {
    [key: string]: {
        name: string,
        timestamp: number,
    };
}

export type ZbsHomeConfigMap = {
    [name: string]: {
        arg: string | undefined;
        env: string | undefined;
    }
};

const ZbsHomeConfigBooleans: ZbsHomeConfigMap = {
    strictConfigFormat: {
        arg: "strict_config_format",
        env: "ZEBES_STRICT_CONFIG_FORMAT",
    },
    promptYes: {
        arg: "yes",
        env: "ZEBES_PROMPT_YES",
    },
    rebuild: {
        arg: "rebuild",
        env: "ZEBES_REBUILD",
    },
    incremental: {
        arg: "incremental",
        env: "ZEBES_INCREMENTAL",
    },
    allowActionCycles: {
        arg: "allow_action_cycles",
        env: "ZEBES_ALLOW_ACTION_CYCLES",
    },
};

const ZbsHomeConfigNumbers: ZbsHomeConfigMap = {
    parallel: {
        arg: "parallel",
        env: "ZEBES_PARALLEL",
    },
    runMaxActions: {
        arg: "run_max_actions",
        env: "ZEBES_RUN_MAX_ACTIONS",
    },
};

const ZbsHomeConfigStrings: ZbsHomeConfigMap = {
    commandMake: {
        arg: "make_command",
        env: "ZEBES_MAKE_COMMAND",
    },
};

/**
 * This is a helper class for handling Zebes file caches.
 *
 * Zebes provides the option to cache things like remote file downloads
 * or external dependency builds so that they can be acquired quickly and
 * without an internet connection if any Zebes project needs them again.
 */
export class ZbsHomeFileCache {
    /** Path to Zebes home directory. (e.g. "~/.zebes") */
    homePath: string;
    /** Unique identifying name for this cache. (e.g. "downloads") */
    name: string;
    /** Handle to a logger instance. */
    logger: ZbsLogger;
    /** Data object containing information about cached files. */
    data: ZbsHomeFileCacheData | undefined;
    /** Track whether the cache data object has uncommitted changes. */
    modified: boolean;
    
    constructor(homePath: string, name: string, logger: ZbsLogger) {
        this.homePath = homePath;
        this.name = name;
        this.logger = logger;
        this.data = undefined;
        this.modified = false;
    }
    
    async commit() {
        if(this.modified && this.data) {
            const cacheDataPath = path.join(
                this.homePath, "cache", this.name + ".json.gz"
            );
            this.logger.debug(
                "Committing Zebes cache data to path:", cacheDataPath
            );
            await fs.mkdirSync(
                path.dirname(cacheDataPath), {recursive: true}
            );
            await zbsGzipJsonWrite(cacheDataPath, {
                version: 1,
                name: this.name,
                timestamp: new Date().getTime(),
                data: this.data,
            })
        }
        this.modified = false;
    }
    
    async getData(): Promise<ZbsHomeFileCacheData> {
        if(!this.data) {
            const cacheDataPath = path.join(
                this.homePath, "cache", this.name + ".json.gz"
            );
            if(fs.existsSync(cacheDataPath)) {
                this.logger.debug(
                    "Reading Zebes cache data:", cacheDataPath
                );
                try {
                    const data = await zbsGzipJsonRead(cacheDataPath);
                    this.data = data.data;
                }
                catch(error) {
                    this.logger.warn(error);
                }
                if(!this.data || typeof(this.data) !== "object") {
                    this.logger.warn(
                        "Malformed Zebes cache data:", cacheDataPath
                    );
                    this.data = {};
                }
            }
            else {
                this.data = {};
            }
        }
        return <ZbsHomeFileCacheData> this.data;
    }
    
    async getFile(key: string) {
        const data = await this.getData();
        if(data[key]) {
            return {
                name: data[key].name,
                timestamp: data[key].timestamp,
                path: path.join(
                    this.homePath, "cache", this.name, data[key].name
                ),
            };
        }
        else {
            return undefined;
        }
    }
    
    async addFile(key: string, fileName?: string): Promise<string> {
        const data = await this.getData();
        const now = new Date();
        const timestamp = now.toISOString().replace(/[^0-9]/g, "");
        const name = (fileName || key).slice(0, 48).replace(
            /[^a-zA-Z0-9_\-\.]/g, "_"
        );
        data[key] = {
            name: timestamp.slice(0, timestamp.length - 3) + "_" + name,
            timestamp: now.getTime(),
        };
        this.modified = true;
        return path.join(
            this.homePath, "cache", this.name, data[key].name
        );
    }
}

export class ZbsHome {
    path: string;
    logger: ZbsLogger;
    config: ZbsConfigHome;
    caches: {[name: string]: ZbsHomeFileCache};
    
    constructor(
        logger: ZbsLogger,
        homePath?: string | undefined,
        env?: {[name: string]: string},
    ) {
        this.logger = logger;
        this.path = (
            homePath || (env || process.env)["ZEBES_HOME"] || 
            path.join(os.homedir(), ".zebes")
        );
        this.logger.trace(
            "Initializing with Zebes home directory:", this.path
        );
        this.config = {};
        this.caches = {};
    }
    
    async loadConfig(
        cliArgs?: any, useEnv?: {[name: string]: string}
    ): Promise<void> {
        const env: {[name: string]: string} = useEnv || <any> process.env;
        const configPath = path.join(this.path, ZbsHomeConfigPath);
        if(fs.existsSync(configPath)) {
            this.logger.debug("Reading Zebes config from path", configPath);
            const configJson = fs.readFileSync(configPath, "utf-8");
            this.config = JSON.parse(configJson);
            this.logger.trace(() => ("Zebes home config file contents:\n" +
                zbsValueToString(this.config, "  ")
            ));
        }
        else {
            this.config = {};
        }
        for(const key in ZbsHomeConfigBooleans) {
            const keyInfo = (<any> ZbsHomeConfigBooleans)[key];
            if(cliArgs[keyInfo.arg]) {
                (<any> this.config)[key] = true;
                this.logger.debug(() => (
                    `Zebes project setting ${key} is being overridden by the ` +
                    `command line argument "--${keyInfo.arg.replace(/_/g, "-")}".`
                ));
            }
            else if(env[keyInfo.env]) {
                const envValue = (
                    env[keyInfo.env].trim().toLowerCase()
                );
                (<any> this.config)[key] = (envValue !== "0" && envValue !== "false");
                this.logger.debug(() => (
                    `Zebes project setting ${key} is being overridden by the ` +
                    `environment variable "--${keyInfo.env}".`
                ));
            }
            else if(key in this.config) {
                this.logger.debug(() => (
                    `Zebes project setting ${key} is being overridden by the ` +
                    `global config file at ${configPath}`
                ));
            }
        }
        for(const key in ZbsHomeConfigNumbers) {
            const keyInfo = (<any> ZbsHomeConfigNumbers)[key];
            if(Number.isFinite(cliArgs[keyInfo.arg])) {
                (<any> this.config)[key] = +cliArgs[keyInfo.arg] || 0;
                this.logger.debug(() => (
                    `Zebes project setting ${key} is being overridden by the ` +
                    `command line argument "--${keyInfo.arg.replace(/_/g, "-")}".`
                ));
            }
            else if(Number.isFinite(+env[keyInfo.env])) {
                const envValue = env[keyInfo.env].trim();
                (<any> this.config)[key] = +envValue || 0;
                this.logger.debug(() => (
                    `Zebes project setting ${key} is being overridden by the ` +
                    `environment variable "--${keyInfo.env}".`
                ));
            }
            else if(key in this.config) {
                this.logger.debug(() => (
                    `Zebes project setting ${key} is being overridden by the ` +
                    `global config file at ${configPath}`
                ));
            }
        }
        for(const key in ZbsHomeConfigStrings) {
            const keyInfo = (<any> ZbsHomeConfigStrings)[key];
            if(cliArgs[keyInfo.arg]) {
                (<any> this.config)[key] = String(cliArgs[keyInfo.arg]);
                this.logger.debug(() => (
                    `Zebes project setting ${key} is being overridden by the ` +
                    `command line argument "--${keyInfo.arg.replace(/_/g, "-")}".`
                ));
            }
            else if(env[keyInfo.env]) {
                (<any> this.config)[key] = String(env[keyInfo.env]);
                this.logger.debug(() => (
                    `Zebes project setting ${key} is being overridden by the ` +
                    `environment variable "--${keyInfo.env}".`
                ));
            }
            else if(key in this.config) {
                this.logger.debug(() => (
                    `Zebes project setting ${key} is being overridden by the ` +
                    `global config file at ${configPath}`
                ));
            }
        }
        // runMaxActions, if not defined anywhere, should default to a
        // moderately large number.
        if(this.config.runMaxActions === undefined) {
            this.config.runMaxActions = 1000;
        }
        // All done
        this.logger.trace(() => ("Zebes final home config:\n" +
            zbsValueToString(this.config, "  ")
        ));
    }
    
    cache(name: string): ZbsHomeFileCache {
        if(!this.caches[name]) {
            this.caches[name] = new ZbsHomeFileCache(
                this.path, name, this.logger
            );
        }
        return <ZbsHomeFileCache> this.caches[name];
    }
    
    async commitCaches() {
        this.logger.trace("Comitting changes to Zebes file caches.");
        for(const name in this.caches) {
            await this.caches[name].commit();
        }
    }
}
