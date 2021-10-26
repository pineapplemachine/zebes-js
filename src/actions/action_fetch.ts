import * as fs from "fs";
import * as http from "http";
import * as https from "https";
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
    
    fetchHttp(destPath: string, urlObject: URL): Promise<void> {
        return new Promise(async (resolve, reject) => {
            if(!zbsIsActionFetch(this.action)) {
                throw new Error("Internal error: Action type inconsistency.");
            }
            // Issue the HTTP or HTTPS request
            const response = await axios.request({
                url: urlObject.toString(),
                method: <any> (this.action.httpMethod || "get"),
                headers: this.action.httpHeaders || {},
                timeout: 1000 * (this.action.timeoutSeconds || 0),
                responseType: "stream",
            });
            // Set up the destination file stream
            fs.mkdirSync(path.dirname(destPath), {
                recursive: true,
            });
            const partialDestPath: string = destPath + ".part";
            const outputStream = fs.createWriteStream(partialDestPath);
            outputStream.on("finish", () => {
                fs.renameSync(partialDestPath, destPath);
                resolve();
            });
            (<any> response.data).pipe(outputStream);
            // Handle progress bar
            let progressBar: boolean = false;
            const contentLength = +response.headers["content-length"];
            if(Number.isFinite(contentLength)) {
                let currentLength: number = 0;
                let currentBlocks: number = 0;
                this.logger.writeInfo(
                    "Downloading", zbsFormatUnitBytes(contentLength), "| "
                );
                (<any> response.data).on("data", (data: any) => {
                    progressBar = true;
                    currentLength += data.length;
                    const blocks = currentLength / contentLength * 24;
                    while(currentBlocks < blocks) {
                        this.logger.writeInfo("#");
                        currentBlocks++;
                    }
                    if(currentBlocks === blocks) {
                        this.logger.writeInfo(" | 100%\n");
                    }
                });
            }
            (<any> response.data).on("error", (error: any) => {
                if(progressBar) {
                    this.logger.writeInfo(" | Interrupted\n");
                }
                fs.unlinkSync(partialDestPath);
                reject(error);
            });
        });
    }
    
    async runType(): Promise<void> {
        this.logger.trace("Running fetch action.");
        if(!zbsIsActionFetch(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
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
                await this.project.home.getCachedDownload(this.action.uri)
            );
            if(cachedDownload && fs.existsSync(cachedDownload.path)) {
                const cachedTime = new Date(cachedDownload.timestamp);
                this.logger.info(
                    "Copying fetched file from Zebes downloads cache. " +
                    `(Fetched ${cachedTime.toISOString()}.)`
                );
                this.logger.trace(
                    "Copying from cached file path:", cachedDownload.path
                );
                fs.copyFileSync(cachedDownload.path, outputPath);
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
            const cachePath = (
                await this.project.home.addCachedDownload(this.action.uri)
            );
            this.logger.trace("Copying to cached file path:", cachePath);
            fs.mkdirSync(path.dirname(cachePath), {
                recursive: true,
            });
            fs.copyFileSync(outputPath, cachePath);
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionFetchRunner);
