import * as fs from "fs";
import * as path from "path";

import * as glob from "fast-glob";
// @ts-ignore
import * as micromatch from "micromatch";

import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionCompile} from "../config/config_types";
import {zbsIsActionCompile} from "../config/config_types";
import {ZbsDependencyMap} from "../incremental";
import {ZbsFilesModified} from "../incremental";
import {zbsProcessSpawn} from "../util/util_process";
import {zbsPromiseAllLimitSettle} from "../util/util_promise";

export class ZbsProjectActionCompileRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionCompile(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    checkRebuildNeeded(
        dependencies: ZbsDependencyMap,
        filesModified: ZbsFilesModified,
        sourcePath: string,
        objectPath: string,
    ): boolean {
        // Compare source modified time against object modified time
        const sourceModified = filesModified.getModifiedTime(sourcePath);
        const objectModified = filesModified.getModifiedTime(objectPath);
        if(!sourceModified || !objectModified ||
            sourceModified >= objectModified
        ) {
            this.logger.debug(
                "Incremental: Compilation needed because " +
                "the source file has been updated:", sourcePath
            );
            return true;
        }
        // Compare object modified time against dependency updated times
        const dependencyPaths = dependencies.getDependencies(sourcePath);
        for(const dependencyPath of dependencyPaths) {
            const depModified = (
                filesModified.getModifiedTime(dependencyPath)
            );
            if(depModified > objectModified) {
                this.logger.trace(
                    "Incremental: Dependency was recently updated:",
                    dependencyPath
                );
                this.logger.debug(
                    "Incremental: Compilation needed because " +
                    "a dependency has been updated:", sourcePath
                );
                return true;
            }
        }
        // Nothing has changed, no rebuild needed
        this.logger.debug(
            "Incremental: No compilation needed for source file:",
            sourcePath
        );
        return false;
    }
    
    async runType(): Promise<void> {
        this.logger.trace("Running compile action.");
        if(!zbsIsActionCompile(this.action)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        const cwd = this.getConfigCwd();
        const env = this.getConfigObjectAdditive<string>("env");
        const incremental = !!this.getConfig<boolean>("incremental");
        const compiler = this.getConfig<string>("compiler") || "";
        const compileArgs = this.getConfigListAdditive<string>("compileArgs");
        const includePaths = this.getConfigListAdditive<string>("includePaths");
        if(!compiler) {
            return this.fail(
                "Compile action failed: No compiler has been specified."
            );
        }
        else {
            this.logger.trace("Using linker:", compiler);
        }
        const sourcePaths = await glob(this.action.sourcePaths, {
            cwd: cwd,
            suppressErrors: true,
        });
        const buildPaths: string[] = incremental ? [] : sourcePaths;
        const depsPath = path.join(
            this.action.outputPath, "zebes.deps.json.gzip"
        );
        const dependencies = new ZbsDependencyMap(cwd, this.logger);
        const filesModified = new ZbsFilesModified(cwd, this.logger);
        if(incremental) {
            // Attempt to load dependencies information from a prior run
            if(fs.existsSync(depsPath)) {
                await dependencies.load(depsPath);
            }
            // Get the list of paths that should be rebuilt
            // For example, because they have changed since the last compile
            // This step does not yet consider dependencies
            const rebuildPaths = this.action.rebuildSourcePaths && new Set(micromatch(
                sourcePaths,
                this.action.rebuildSourcePaths,
            ));
            for(const sourcePath of sourcePaths) {
                const objectPath = path.join(
                    this.action.outputPath,
                    sourcePath + this.getCompileOutputExt(),
                );
                const needsBuild: boolean = (
                    this.project.rebuild ||
                    (rebuildPaths && rebuildPaths.has(sourcePath)) ||
                    this.checkRebuildNeeded(
                        dependencies,
                        filesModified,
                        sourcePath,
                        objectPath,
                    )
                );
                if(needsBuild) {
                    buildPaths.push(path.normalize(sourcePath));
                }
                else {
                    this.logger.debug(
                        "Source file was found to have not changed:", sourcePath
                    );
                }
            }
        }
        const build = async (buildPath: string) => {
            if(!zbsIsActionCompile(this.action)) {
                throw new Error("Internal error: Action type inconsistency.");
            }
            const objectPath = path.join(
                this.action.outputPath,
                buildPath + this.getCompileOutputExt(),
            );
            const baseArgs: string[] = [buildPath];
            baseArgs.push(...includePaths.map(
                (path) => (this.getIncludePathArg() + path)
            ));
            baseArgs.push(...compileArgs);
            const args = [
                ...baseArgs,
                this.getCompileOutputArg() + objectPath,
            ];
            this.logger.info("Compiling source:", buildPath);
            if(this.project.dryRun) {
                this.logger.info("Dry-run: $", compiler, ...args);
            }
            else {
                this.logger.info("$", compiler, ...args);
                fs.mkdirSync(path.dirname(path.resolve(cwd, objectPath)), {
                    recursive: true,
                });
                const statusCode = await zbsProcessSpawn(compiler, args, {
                    cwd: cwd,
                    env: Object.assign({}, process.env, env),
                    shell: true,
                }, {
                    stdout: (data) => this.logger.info(data.toString()),
                    stderr: (data) => this.logger.info(data.toString()),
                });
                if(statusCode !== 0) {
                    this.fail(
                        `Compilation failed with status code ${statusCode}: ` +
                        buildPath
                    );
                }
            }
            if(incremental) {
                await dependencies.update({
                    sourcePath: buildPath,
                    dryRun: this.project.dryRun,
                    env: env,
                    compiler: compiler,
                    compileArgs: baseArgs,
                    includePaths: includePaths,
                    compileMakeRuleArg: (
                        this.system && this.system.compileMakeRuleArg
                    ),
                    includeSourcePatterns: (
                        this.system && this.system.includeSourcePatterns
                    ),
                    importSourcePatterns: (
                        this.system && this.system.importSourcePatterns
                    ),
                    importSourceExt: (
                        this.system && this.system.importSourceExt
                    ),
                });
            }
        }
        this.logger.info(`Building ${buildPaths.length} source files.`);
        await zbsPromiseAllLimitSettle(
            Math.max(this.project.parallel, 1),
            buildPaths.map((buildPath) => (() => build(buildPath))),
        );
        if(incremental && !this.project.dryRun && dependencies.anyUpdate) {
            this.logger.debug("Writing dependencies data:", depsPath);
            await dependencies.write(depsPath);
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionCompileRunner);
