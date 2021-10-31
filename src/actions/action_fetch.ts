import * as fs from "fs";
import * as path from "path";
import {URL} from "url";

import axios from "axios";

import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionFetch} from "../config/config_types";
import {zbsIsActionFetch} from "../config/config_types";
import {zbsFormatUnitBytes} from "../util/util_units";

export class ZbsProjectActionFetchRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionFetch(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    get action(): ZbsConfigActionFetch {
        if(!zbsIsActionFetch(this.actionConfig)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        return this.actionConfig;
    }
    
    fetchHttp(destPath: string, urlObject: URL): Promise<void> {
        this.logger.trace("Fetching HTTP/HTTPS.");
        return new Promise(async (resolve, reject) => {
            // Issue the HTTP or HTTPS request
            const response = await axios.request({
                url: urlObject.toString(),
                method: <any> (this.action.httpMethod || "get"),
                headers: this.action.httpHeaders || {},
                timeout: 1000 * (this.action.timeoutSeconds || 0),
                responseType: "stream",
            });
            // Handle progress bar
            const contentLength = +response.headers["content-length"];
            const logProgress = (!contentLength ? undefined :
                this.logger.progress(
                    `Downloading ${zbsFormatUnitBytes(contentLength)}`,
                    contentLength,
                )
            );
            if(logProgress) {
                logProgress.begin();
            }
            if(Number.isFinite(contentLength)) {
                (<any> response.data).on("data", (data: any) => {
                    if(logProgress) {
                        logProgress.increment(data.length);
                    }
                });
            }
            (<any> response.data).on("error", (error: any) => {
                if(logProgress) {
                    logProgress.interrupt();
                }
                fs.unlinkSync(partialDestPath);
                reject(error);
            });
            // Pipe request to output file stream
            await this.project.fsMkdir(path.dirname(destPath));
            const partialDestPath: string = destPath + ".part";
            const outputStream = fs.createWriteStream(partialDestPath);
            outputStream.on("finish", () => {
                if(logProgress) {
                    logProgress.finish();
                }
                fs.renameSync(partialDestPath, destPath);
                resolve();
            });
            (<any> response.data).pipe(outputStream);
        });
    }
    
    getCache() {
        return this.project.home.cache("fetch");
    }
    
    async runType(): Promise<void> {
        const cwd = this.getConfigCwd();
        const outputPath = path.resolve(cwd, this.action.outputPath);
        if(fs.existsSync(outputPath)) {
            if(!this.action.overwrite) {
                this.logger.info(
                    "Fetched file already exists. " +
                    "Keeping without fetching:",
                    outputPath
                );
                return;
            }
            else {
                this.logger.info(
                    "Fetching will overwrite file:", outputPath
                );
            }
        }
        if(this.action.cache) {
            const cachedDownload = (
                await this.getCache().getFile(this.action.uri)
            );
            if(cachedDownload && fs.existsSync(cachedDownload.path)) {
                const cachedTime = new Date(cachedDownload.timestamp);
                this.logger.info(
                    "Copying fetched file from Zebes downloads cache. " +
                    `(Fetched ${cachedTime.toISOString()})`
                );
                await this.project.fsCopyFile(
                    cachedDownload.path, outputPath
                );
                return;
            }
            else if(cachedDownload) {
                this.logger.debug(
                    "Cache record exists but the file is missing:",
                    cachedDownload.path
                );
            }
        }
        const urlObject = new URL(this.action.uri);
        const urlProtocol = urlObject.protocol;
        // TODO: More protocols. file:// ftp:// sftp://
        this.logger.info("Fetching URI:", this.action.uri);
        if(this.project.dryRun) {
            return;
        }
        let tries: number = 0;
        const retries: number = (this.action.retries || 0);
        while(tries <= retries) {
            if(tries++) {
                this.logger.info(
                    `Fetch attempt failed. Retrying. ` +
                    `(${tries}/${retries} retry attemps.)`
                );
            }
            if(urlProtocol === "http:" || urlProtocol === "https:") {
                await this.fetchHttp(outputPath, urlObject);
            }
            else {
                this.logger.error(
                    "Fetch action failed. Unknown URI protocol:",
                    () => JSON.stringify(urlProtocol)
                );
                this.failed = true;
                return;
            }
        }
        if(this.action.cache) {
            this.logger.info("Copying fetched file to Zebes downloads cache.");
            const cachePath = await this.getCache().addFile(
                this.action.uri,
                path.basename(new URL(this.action.uri).pathname),
            );
            this.logger.debug("Copying to cache path:", cachePath);
            await this.project.fsMkdir(path.dirname(cachePath));
            await this.project.fsCopyFile(outputPath, cachePath);
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionFetchRunner);
