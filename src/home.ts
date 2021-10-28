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
export const ZbsHomeDownloadsCacheFilesPath: string = (
    "downloads_cache"
);
export const ZbsHomeDownloadsCacheDataPath: string = (
    "downloads_cache.json.gz"
);

export interface ZbsHomeDownloadsCache {
    [uri: string]: {
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
};

const ZbsHomeConfigStrings: ZbsHomeConfigMap = {
    makeCommand: {
        arg: "make_command",
        env: "ZEBES_MAKE_COMMAND",
    },
};

export class ZbsHome {
    path: string;
    logger: ZbsLogger;
    config: ZbsConfigHome;
    downloadsCache?: ZbsHomeDownloadsCache | undefined;
    downloadsCacheModified: boolean = false;
    
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
            this.logger.trace("Zebes home config file:\n",
                () => zbsValueToString(this.config)
            );
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
        this.logger.trace("Zebes final home config:\n",
            () => zbsValueToString(this.config)
        );
    }
    
    async commit() {
        if(this.downloadsCacheModified) {
            const cacheDataPath = path.join(
                this.path, ZbsHomeDownloadsCacheDataPath
            );
            this.logger.trace(
                "Committing downloads cache data to path:", cacheDataPath
            );
            await zbsGzipJsonWrite(cacheDataPath, {
                version: 1,
                timestamp: new Date().getTime(),
                cache: this.downloadsCache,
            })
        }
    }
    
    async getDownloadsCache(): Promise<ZbsHomeDownloadsCache> {
        if(!this.downloadsCache) {
            const cacheDataPath = path.join(
                this.path, ZbsHomeDownloadsCacheDataPath
            );
            if(fs.existsSync(cacheDataPath)) {
                const data = await zbsGzipJsonRead(cacheDataPath);
                this.downloadsCache = data.cache;
            }
            else {
                this.downloadsCache = {};
            }
        }
        return <ZbsHomeDownloadsCache> this.downloadsCache;
    }
    
    async getCachedDownload(uri: string) {
        const cache = await this.getDownloadsCache();
        if(cache[uri]) {
            return {
                name: cache[uri].name,
                timestamp: cache[uri].timestamp,
                path: path.join(
                    this.path,
                    ZbsHomeDownloadsCacheFilesPath,
                    cache[uri].name,
                ),
            };
        }
        else {
            return undefined;
        }
    }
    
    async addCachedDownload(uri: string): Promise<string> {
        const cache = await this.getDownloadsCache();
        const now = new Date();
        const url = new URL(uri);
        const timestamp = now.toISOString().replace(/[^0-9]/g, "");
        const basename = path.basename(url.pathname).slice(0, 64).replace(
            /[^a-zA-Z0-9_\-\.]/g, "_"
        );
        cache[uri] = {
            name: timestamp.slice(0, timestamp.length - 3) + "_" + basename,
            timestamp: now.getTime(),
        };
        this.downloadsCacheModified = true;
        return path.join(
            this.path,
            ZbsHomeDownloadsCacheFilesPath,
            cache[uri].name,
        );
    }
}
