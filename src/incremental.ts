/**
 * This module contains utilities for incremental compilation,
 * especially for mapping dependencies between source files in
 * the same project.
 */

import * as fs from "fs";
import * as path from "path";

import {ZbsConfigSystem} from "./config/config_types";
import {ZbsLogger} from "./logger";
import {zbsProcessSpawn} from "./util/util_process";
import {zbsGzipJsonRead} from "./util/util_json_gzip";
import {zbsGzipJsonWrite} from "./util/util_json_gzip";

export interface ZbsDependencyMapUpdateOptions {
    sourcePath: string;
    dryRun: boolean;
    env: {[name: string]: string};
    compiler: string;
    compileArgs: string[];
    includePaths: string[];
    compileMakeRuleArg?: string;
    includeSourcePatterns?: string[];
    importSourcePatterns?: string[];
    importSourceExt?: string[];
}

export interface ZbsDependency {
    timestamp: number;
    dependencies: string[];
}

/**
 * This is a utility class used to check and cache the last
 * modified time for files.
 * TODO: Offer an option to check hashes also or instead
 */
export class ZbsFilesModified {
    cwd: string;
    sources: {[name: string]: bigint};
    logger: ZbsLogger;
    
    constructor(cwd: string, logger: ZbsLogger) {
        this.cwd = cwd;
        this.sources = {};
        this.logger = logger;
    }
    
    getModifiedTime(name: string): bigint {
        const nameNormal = path.normalize(name);
        if(!(nameNormal in this.sources)) {
            const namePath = path.resolve(this. cwd, nameNormal);
            if(!fs.existsSync(namePath)) {
                this.sources[nameNormal] = BigInt(0);
            }
            else {
                const stat = fs.statSync(namePath, {
                    bigint: true,
                    throwIfNoEntry: false,
                });
                this.sources[nameNormal] = stat ? stat.mtimeMs : BigInt(0);
            }
        }
        return this.sources[nameNormal];
    }
}

export class ZbsDependencyMap {
    cwd: string;
    env: {[name: string]: string};
    sources: {[name: string]: ZbsDependency};
    logger: ZbsLogger;
    anyUpdate: boolean;
    
    constructor(
        cwd: string,
        env: {[name: string]: string},
        logger: ZbsLogger,
    ) {
        this.cwd = cwd;
        this.env = env;
        this.sources = {};
        this.logger = logger;
        this.anyUpdate = false;
    }
    
    async write(dataPath: string): Promise<void> {
        await zbsGzipJsonWrite(dataPath, {
            version: 1,
            timestamp: new Date().getTime(),
            cwd: this.cwd,
            sources: this.sources,
        });
    }
    
    async load(dataPath: string): Promise<void> {
        const data = await zbsGzipJsonRead(dataPath);
        this.sources = data.sources || {};
        this.anyUpdate = false;
    }
    
    getReverseMap(): {[name: string]: string[]} {
        const map: {[name: string]: string[]} = {};
        for(const source in this.sources) {
            for(const dependency in this.sources[source].dependencies) {
                if(!Array.isArray(map[dependency])) {
                    map[dependency] = [];
                }
                map[dependency].push(source);
            }
        }
        return map;
    }
    
    getDependencies(sourcePath: string): string[] {
        // TODO: Not good enough! Need to return dependencies' dependencies too
        const dependency = this.sources[path.normalize(sourcePath)];
        return dependency ? dependency.dependencies : [];
    }
    
    getDependants(sourcePaths: string[]): Set<string> {
        const dependants = new Set<string>();
        const reverseMap = this.getReverseMap();
        for(const sourcePath of sourcePaths) {
            const sourcePathNormal = path.normalize(sourcePath);
            if(Array.isArray(reverseMap[sourcePathNormal])) {
                for(const dependantPath of reverseMap[sourcePathNormal]) {
                    dependants.add(dependantPath);
                }
            }
        }
        return dependants;
    }
    
    /**
     * Given an included file name, try to find the resulting file path.
     * First search the directory of the source file with the inclusion,
     * then search includePaths from left to right.
     */
    findDependencyPath(
        name: string,
        sourcePath: string,
        includePaths: string[],
    ): string {
        if(path.isAbsolute(name)) {
            return name;
        }
        // Search source file directory
        const inSourceDir = path.join(
            path.dirname(path.resolve(this.cwd, sourcePath)), name
        );
        if(fs.existsSync(inSourceDir)) {
            return inSourceDir;
        }
        // Search include paths, left-to-right
        for(const includePath of includePaths) {
            const inIncludeDir = path.join(
                path.resolve(this.cwd, includePath), name
            );
            if(fs.existsSync(inIncludeDir)) {
                return inIncludeDir;
            }
        }
        // Couldn't find it
        return "";
    }
    
    findImportDependencyPath(
        name: string,
        sourcePath: string,
        includePaths: string[],
        importSourceExt: string[] | undefined,
    ): string {
        const nameParts = name.split(".");
        const namePartVariants = nameParts.map((part, i) => {
            const replacedPart = part.replace(/_/g, "-");
            const parts: string[] = [
                part,
                part.toLowerCase(),
                replacedPart,
                replacedPart.toLowerCase(),
            ];
            if(i === nameParts.length - 1 && importSourceExt) {
                for(const ext of importSourceExt) {
                    parts.push(...parts.slice(0, 4).map((p) => (p + ext)));
                }
            }
            return parts;
        });
        function checkPath(searchPath: string): string {
            let currentPath: string = searchPath;
            let foundPath: string[] = [];
            for(const namePartVariantList of namePartVariants) {
                let foundAny: boolean = false;
                for(const namePart of namePartVariantList) {
                    const nextPath = path.join(currentPath, namePart);
                    if(fs.existsSync(nextPath)) {
                        currentPath = nextPath;
                        foundPath.push(namePart);
                        foundAny = true;
                    }
                }
                if(!foundAny) {
                    return "";
                }
            }
            return path.join(searchPath, ...foundPath);
        }
        // TODO: make it an option NOT to search relative to the
        // source path. This means better DMD compatibility.
        const inSourceDir = checkPath(
            path.dirname(path.resolve(this.cwd, sourcePath))
        );
        if(inSourceDir) {
            return inSourceDir;
        }
        // Search include paths, left-to-right
        for(const includePath of includePaths) {
            const inIncludeDir = checkPath(
                path.resolve(this.cwd, includePath)
            );
            if(inIncludeDir) {
                return inIncludeDir;
            }
        }
        // Couldn't find it
        return "";
    }
    
    /**
     * Given a dependency path:
     * If the path is within the cwd, then return a path that is
     * relative to the cwd.
     * Otherwise, return an absolute path.
     * Note, this assumes that `this.cwd` is an absolute path.
     */
    resolveDependencyPath(depPath: string): string {
        const resolve = path.resolve(this.cwd, depPath);
        const cwdRelative = path.relative(this.cwd, resolve);
        if(cwdRelative.startsWith("..")) {
            return path.normalize(resolve);
        }
        else {
            return path.normalize(cwdRelative);
        }
    }
    
    async update(options: ZbsDependencyMapUpdateOptions) {
        this.logger.debug(
            "Updating dependency information for source file:",
            options.sourcePath
        );
        this.anyUpdate = true;
        const timestamp = new Date().getTime();
        const dependencies: string[] = [];
        if(options.compileMakeRuleArg) {
            dependencies.push(...(
                await this.getMakeRuleDependencies(options)
            ));
        }
        if(!options.dryRun) {
            const hasIncludePatterns = (
                Array.isArray(options.includeSourcePatterns) &&
                options.includeSourcePatterns.length
            );
            const hasImportPatterns = (
                Array.isArray(options.importSourcePatterns) &&
                options.importSourcePatterns.length
            );
            if(hasIncludePatterns || hasImportPatterns) {
                // TODO: allow configuration of text encoding
                const sourceContent = fs.readFileSync(
                    path.resolve(this.cwd, options.sourcePath), "utf-8"
                );
                if(hasIncludePatterns) {
                    dependencies.push(...(
                        await this.getIncludePatternDependencies(
                            sourceContent, options
                        )
                    ));
                }
                if(hasImportPatterns) {
                    dependencies.push(...(
                        await this.getImportPatternDependencies(
                            sourceContent, options
                        )
                    ));
                }
            }
        }
        if(dependencies.length) {
            this.logger.debug("Found dependencies:", () => (
                dependencies.map((dep) => JSON.stringify(dep)).join(", ")
            ));
        }
        else {
            this.logger.debug("Found no dependencies.");
        }
        this.sources[path.normalize(options.sourcePath)] = {
            timestamp: timestamp,
            dependencies: dependencies,
        };
    }
    
    async getMakeRuleDependencies(
        options: ZbsDependencyMapUpdateOptions
    ): Promise<string[]> {
        if(!options.compileMakeRuleArg) {
            throw new Error("Dependency map consistency error.");
        }
        this.logger.trace(() => (
            `Getting dependency information using a make rule flag ` +
            `(${JSON.stringify(options.compileMakeRuleArg)}).`
        ));
        // Run the compiler with a make rule flag, e.g. -MM
        // This produces a list of dependencies in the format of a make rule
        const args = [...options.compileArgs, options.compileMakeRuleArg];
        let stdoutData: string[] = [];
        if(options.dryRun) {
            this.logger.info("Dry-run: $", options.compiler, ...args);
            return [];
        }
        this.logger.debug("$", options.compiler, ...args);
        const statusCode = await zbsProcessSpawn(options.compiler, args, {
            cwd: this.cwd,
            env: Object.assign({}, this.env, options.env),
            shell: true,
        }, {
            stdout: (data) => {
                const dataString = data.toString();
                this.logger.trace(dataString);
                stdoutData.push(dataString);
            },
            stderr: (data) => this.logger.trace(data.toString()),
        });
        if(statusCode !== 0) {
            this.logger.error(
                `Getting dependencies make rule failed with ` +
                `status code ${statusCode}:`, options.sourcePath
            );
        }
        // Parse the list of dependencies
        const colonIndex = (stdoutData[0] || "").indexOf(":");
        if(colonIndex < 0) {
            this.logger.warn(
                "Failed to get dependencies via make rule for source path:",
                options.sourcePath
            );
            return [];
        }
        const namePattern = /(\S|\\\s)+/g;
        const lineMatches = [
            stdoutData[0].slice(1 + colonIndex).matchAll(namePattern),
            ...stdoutData.slice(1).map((line) => line.matchAll(namePattern)),
        ];
        const dependencies: string[] = [];
        for(const matches of lineMatches) {
            for(const match of matches) {
                const name = match[0].replace(/\\ /g, " ");
                if(!name || name.trim() === "\\") {
                    continue;
                }
                const dependency = this.resolveDependencyPath(name);
                if(dependency !== "." && dependency !== options.sourcePath) {
                    dependencies.push(dependency);
                }
            }
        }
        // All done
        return dependencies;
    }
    
    async getIncludePatternDependencies(
        sourceContent: string,
        options: ZbsDependencyMapUpdateOptions,
    ): Promise<string[]> {
        if(!options.includeSourcePatterns) {
            throw new Error("Dependency map consistency error.");
        }
        this.logger.trace(
            "Getting dependency information using include path regex patterns."
        );
        const dependencies: string[] = [];
        for(const sourcePattern of options.includeSourcePatterns) {
            const pattern = new RegExp(sourcePattern, "g");
            const matches = sourceContent.matchAll(pattern);
            for(const match of matches) {
                const name = match.groups && match.groups.name;
                if(name) {
                    const depPath = this.findDependencyPath(
                        name, options.sourcePath, options.includePaths
                    );
                    dependencies.push(this.resolveDependencyPath(depPath));
                }
            }
        }
        return dependencies;
    }
    
    async getImportPatternDependencies(
        sourceContent: string,
        options: ZbsDependencyMapUpdateOptions,
    ): Promise<string[]> {
        if(!options.importSourcePatterns) {
            throw new Error("Dependency map consistency error.");
        }
        this.logger.trace(
            "Getting dependency information using import path regex patterns."
        );
        const dependencies: string[] = [];
        for(const sourcePattern of options.importSourcePatterns) {
            const pattern = new RegExp(sourcePattern, "g");
            const matches = sourceContent.matchAll(pattern);
            for(const match of matches) {
                const name = match.groups && match.groups.name;
                if(name) {
                    const depPath = this.findImportDependencyPath(
                        name,
                        options.sourcePath,
                        options.includePaths,
                        options.importSourceExt,
                    );
                    if(depPath) {
                        const depResolved = this.resolveDependencyPath(depPath);
                        dependencies.push(depResolved);
                    }
                }
            }
        }
        return dependencies;
    }
}
