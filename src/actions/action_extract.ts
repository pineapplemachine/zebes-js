import * as fs from "fs";
import * as path from "path";

import * as extractZip from "extract-zip";
// @ts-ignore
import * as jaguar from "jaguar";

import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionExtract} from "../config/config_types";
import {zbsIsActionExtract} from "../config/config_types";
import {ZbsLogLevel} from "../logger";
import {zbsFormatUnitBytes} from "../util/util_units";

export const ExtractArchiveFormats: string[] = [
    // "7z",
    // "gzip",
    // "rar",
    "tar",
    "tar.gz",
    "zip",
];

export class ZbsProjectActionExtractRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionExtract(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    getArchiveFormat(actionFormat: string | undefined, archivePath: string) {
        if(actionFormat) {
            return actionFormat;
        }
        const pathLower = archivePath.toLowerCase();
        if(pathLower.endsWith(".tar.gz")) {
            return "tar.gz";
        }
        // else if(pathLower.endsWith(".7z")) {
        //     return "7z";
        // }
        // else if(pathLower.endsWith(".gz") || pathLower.endsWith(".gzip")) {
        //     return "gzip";
        // }
        // else if(pathLower.endsWith(".rar")) {
        //     return "rar";
        // }
        else if(pathLower.endsWith(".tar")) {
            return "tar";
        }
        else if(pathLower.endsWith(".zip")) {
            return "zip";
        }
        else {
            return undefined;
        }
    }
    
    async extractArchiveZip(archivePath: string, outputPath: string): Promise<void> {
        this.logger.info(
            "Extracting ZIP archive", archivePath, "to", outputPath
        );
        await extractZip(archivePath, {
            dir: outputPath,
            onEntry: (entry, zipFile) => {
                this.logger.debug("Extracting:", entry.fileName);
            },
        });
        this.logger.info("Finished extracting ZIP archive.");
    }
    
    extractArchiveTar(archivePath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.logger.info(
                "Extracting tar archive", archivePath, "to", outputPath
            );
            const archiveStat = fs.statSync(archivePath);
            const logProgress = (this.logger.level < ZbsLogLevel.Info ?
                undefined :
                this.logger.progress(
                    `Extracting ${zbsFormatUnitBytes(archiveStat.size)}`,
                    100,
                )
            );
            if(logProgress) {
                logProgress.begin();
            }
            const extract = jaguar.extract(archivePath, outputPath);
            extract.on("file", (name: string) => {
                this.logger.debug("Extracting:", name);
            });
            extract.on("progress", (percent: number) => {
                if(logProgress) {
                    logProgress.update(percent);
                }
            });
            extract.on("error", (error: any) => {
                if(logProgress) {
                    logProgress.interrupt();
                }
                reject(error);
            });
            extract.on("end", () => {
                if(logProgress) {
                    logProgress.finish();
                }
                this.logger.info("Finished extracting tar archive.");
                resolve();
            });
        });
    }
    
    async runType(): Promise<void> {
        this.logger.trace("Running extract action.");
        if(!zbsIsActionExtract(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        const cwd = this.getConfigCwd();
        const archivePath = path.resolve(cwd, this.action.archivePath);
        const outputPath = path.resolve(cwd, this.action.outputPath);
        const archiveFormat = this.getArchiveFormat(
            this.action.format, this.action.archivePath
        );
        this.logger.debug(
            "Determined archive format for extraction:",
            () => JSON.stringify(archiveFormat),
        );
        if(this.project.dryRun) {
            return;
        }
        if(archiveFormat === "zip") {
            await this.extractArchiveZip(archivePath, outputPath);
        }
        else if(archiveFormat === "tar" || archiveFormat === "tar.gz") {
            await this.extractArchiveTar(archivePath, outputPath);
        }
        else {
            this.logger.error(
                "Failed to extract archive because of an unknown format. " +
                "Known formats: " +
                ExtractArchiveFormats.map(
                    (format) => JSON.stringify(format)
                ).join(", ")
            );
            this.failed = true;
            if(this.action.format) {
                this.malformed = true;
            }
            return;
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionExtractRunner);
