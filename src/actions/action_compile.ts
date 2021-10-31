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
import {zbsPromiseAllLimitSettle} from "../util/util_promise";

export class ZbsProjectActionCompileRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionCompile(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    get action(): ZbsConfigActionCompile {
        if(!zbsIsActionCompile(this.actionConfig)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        return this.actionConfig;
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
            this.action.outputPath, ".zebes/deps.json.gz"
        );
        const dependencies = new ZbsDependencyMap(
            cwd, this.project.env, this.project
        );
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
                    this.project.home.config.rebuild ||
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
            await this.project.fsMkdir(
                path.dirname(path.resolve(cwd, objectPath))
            );
            const statusCode = await this.project.processSpawn(compiler, args, {
                cwd: cwd,
                env: Object.assign({}, this.project.env, env),
                shell: true,
            });
            if(statusCode !== 0) {
                this.fail(
                    `Compilation failed with status code ${statusCode}: ` +
                    buildPath
                );
            }
            if(incremental && !this.project.dryRun) {
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
            Math.max(this.project.home.config.parallel || 0, 1),
            buildPaths.map((buildPath) => (() => build(buildPath))),
        );
        if(incremental && !this.project.dryRun && dependencies.anyUpdate) {
            this.logger.debug("Writing dependencies data:", depsPath);
            await this.project.fsMkdir(path.dirname(depsPath));
            await dependencies.write(depsPath);
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionCompileRunner);
