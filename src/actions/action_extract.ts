import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

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

/**
 * Map identifying archive format names to file extensions
 * which should be recognized as belonging to that format.
 */
export const ExtractArchiveFormats: {[name: string]: string[]} = {
    "7z": [".7z", ".7zip"],
    "gz": [".gz", ".gzip"],
    "rar": [".rar", ".r00"],
    "tar": [".tar"],
    // "tarlz": [".tar.lz"],
    // "tarlzo": [".tar.lzo"],
    // "tb2": [".tb2", ".tbz", ".tbz2", ".tz2", ".tar.bz2"],
    "tgz": [".tgz", ".taz", ".tar.gz"],
    // "tlz": [".tar.lzma", ".tlz"],
    // "txz": [".txz", ".tar.xz"],
    // "tzst": [".tar.zst", ".tzst"],
    // "xz": [".xz", ".xzip"],
    "zip": [".zip", ".zipx"],
};

export class ZbsProjectActionExtractRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionExtract(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    get action(): ZbsConfigActionExtract {
        if(!zbsIsActionExtract(this.actionConfig)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        return this.actionConfig;
    }
    
    getArchiveFormat(actionFormat: string | undefined, extractPath: string) {
        if(actionFormat) {
            return actionFormat;
        }
        const pathLower = extractPath.toLowerCase();
        let longestMatch: string = "";
        for(const formatName in ExtractArchiveFormats) {
            for(const formatExt of ExtractArchiveFormats[formatName]) {
                if(formatExt.length > longestMatch.length &&
                    pathLower.endsWith(formatExt)
                ) {
                    longestMatch = formatName;
                }
            }
        }
        return longestMatch || undefined;
    }
    
    async extractArchive7z(extractPath: string, outputPath: string): Promise<void> {
        this.logger.info(
            "Extracting 7z archive", extractPath, "to", outputPath
        );
        const command = this.project.home.config.command7z || "7z";
        const args = ["x", extractPath, "-y", "-o" + outputPath];
        const result = await this.project.tryProcessSpawn(command, args, {
            cwd: this.getConfigCwd(),
            env: this.getConfigEnv(),
            shell: false,
            dataLogLevel: ZbsLogLevel.Debug,
        });
        if(result.error || result.status !== 0) {
            this.fail("Failure extracing 7z archive.");
            if(result.error) {
                this.fail(result.error);
            }
            if(result.error && result.error.code === "ENOENT") {
                this.logger.info(
                    "In order to extract 7z archives, the 7z command " +
                    "line utility must be available on your system."
                );
                this.logger.info("https://www.7-zip.org/download.html");
            }
            return;
        }
        this.logger.info("Finished extracting 7z archive.");
    }
    
    extractArchiveGzip(extractPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.logger.info(
                "Extracting gzip archive", extractPath, "to", outputPath
            );
            const extractStream = fs.createReadStream(extractPath);
            const outputStream = fs.createWriteStream(outputPath);
            const gunzip = zlib.createGunzip();
            extractStream.pipe(gunzip);
            gunzip.pipe(outputStream);
            extractStream.on("error", reject);
            outputStream.on("error", reject);
            gunzip.on("error", reject);
            outputStream.on("close", () => {
                this.logger.info("Finished extracting gzip archive.");
                resolve();
            });
        });
    }
    
    async extractArchiveRar(extractPath: string, outputPath: string): Promise<void> {
        this.logger.info(
            "Extracting rar archive", extractPath, "to", outputPath
        );
        const command = this.project.home.config.commandUnrar || "unrar";
        // Output directory path must have a trailing slash on some platforms.
        // https://serverfault.com/questions/117531/extract-rar-files-to-folder
        const args = ["x", extractPath, outputPath + "/", "-o+", "-y"];
        const result = await this.project.tryProcessSpawn(command, args, {
            cwd: this.getConfigCwd(),
            env: this.getConfigEnv(),
            shell: false,
            dataLogLevel: ZbsLogLevel.Debug,
        });
        if(result.error || result.status !== 0) {
            this.fail("Failure extracing rar archive.");
            if(result.error) {
                this.fail(result.error);
            }
            if(result.error && result.error.code === "ENOENT") {
                this.logger.info(
                    "In order to extract rar archives, the unrar command " +
                    "line utility must be available on your system."
                );
                this.logger.info("https://www.rarlab.com/rar_add.htm");
            }
            return;
        }
        this.logger.info("Finished extracting rar archive.");
    }
    
    extractArchiveTar(extractPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.logger.info(
                "Extracting tar archive", extractPath, "to", outputPath
            );
            const archiveStat = fs.statSync(extractPath);
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
            const extract = jaguar.extract(extractPath, outputPath);
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
    
    async extractArchiveZip(extractPath: string, outputPath: string): Promise<void> {
        this.logger.info(
            "Extracting ZIP archive", extractPath, "to", outputPath
        );
        await extractZip(extractPath, {
            dir: outputPath,
            onEntry: (entry, zipFile) => {
                this.logger.debug("Extracting:", entry.fileName);
            },
        });
        this.logger.info("Finished extracting ZIP archive.");
    }
    
    async runType(): Promise<void> {
        const cwd = this.getConfigCwd();
        const extractPath = path.resolve(cwd, this.action.extractPath);
        const outputPath = path.resolve(cwd, this.action.outputPath);
        const archiveFormat = this.getArchiveFormat(
            this.action.format, this.action.extractPath
        );
        this.logger.debug(
            "Determined archive format for extraction:",
            () => JSON.stringify(archiveFormat),
        );
        if(this.project.dryRun) {
            return;
        }
        if(archiveFormat === "7z") {
            await this.extractArchive7z(extractPath, outputPath);
        }
        else if(archiveFormat === "gz") {
            await this.extractArchiveGzip(extractPath, outputPath);
        }
        else if(archiveFormat === "rar") {
            await this.extractArchiveRar(extractPath, outputPath);
        }
        else if(archiveFormat === "tar" || archiveFormat === "tgz") {
            await this.extractArchiveTar(extractPath, outputPath);
        }
        else if(archiveFormat === "zip") {
            await this.extractArchiveZip(extractPath, outputPath);
        }
        else {
            this.logger.error(
                "Failed to extract archive because of an unknown format. " +
                "Known formats: " +
                Object.keys(ExtractArchiveFormats).map(
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
