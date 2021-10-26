import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {URL} from "url";

import {ZbsLogger} from "./logger";
import {zbsGzipJsonRead} from "./util/util_json_gzip";
import {zbsGzipJsonWrite} from "./util/util_json_gzip";

export const ZbsHomeDownloadsCacheFilesPath: string = (
    "downloads_cache"
);
export const ZbsHomeDownloadsCacheDataPath: string = (
    "downloads_cache.json.gzip"
);

export interface ZbsHomeDownloadsCache {
    [uri: string]: {
        name: string,
        timestamp: number,
    };
}

export class ZbsHome {
    path: string;
    logger: ZbsLogger;
    downloadsCache?: ZbsHomeDownloadsCache | undefined;
    downloadsCacheModified: boolean = false;
    
    constructor(logger: ZbsLogger, homePath?: string | undefined) {
        this.logger = logger;
        this.path = (
            homePath || process.env["ZEBES_HOME"] || 
            path.join(os.homedir(), ".zebes")
        );
        this.logger.trace(
            "Initializing with Zebes home directory:", this.path
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
