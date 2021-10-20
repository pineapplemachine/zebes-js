import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

import {ZbsConfigSystem} from "./config";
import {ZbsLogger} from "./logger";
import {zbsProcessSpawn} from "./process";

// TODO:
// https://stackoverflow.com/questions/15976080/list-of-all-header-files-included-by-a-c-file

/**

λ gcc rcore.c -MM
rcore.o: rcore.c raylib.h config.h utils.h rlgl.h external/glad.h \
 raymath.h rgestures.h rcamera.h external/msf_gif.h external/sinfl.h \
 external/sdefl.h

λ g++ raylib-cpp.hpp -I ../../raylib/src -MM
raylib-cpp.o: raylib-cpp.hpp AudioDevice.hpp raylib.hpp \
 ../../raylib/src/raylib.h raylib-cpp-utils.hpp AudioStream.hpp \
 BoundingBox.hpp Camera2D.hpp Vector2.hpp raylib.hpp raymath.hpp \
 ../../raylib/src/raymath.h raylib-cpp-utils.hpp Camera3D.hpp Vector3.hpp \
 Color.hpp Vector4.hpp Font.hpp Functions.hpp Gamepad.hpp Image.hpp \

 Material.hpp Matrix.hpp raymath.hpp Mesh.hpp BoundingBox.hpp Model.hpp \
 Mesh.hpp Model.hpp ModelAnimation.hpp Mesh.hpp Mouse.hpp Music.hpp \

 Ray.hpp RayCollision.hpp RayCollision.hpp Rectangle.hpp \
 RenderTexture.hpp Shader.hpp Texture.hpp Material.hpp Sound.hpp Text.hpp \
 Texture.hpp Vector2.hpp Vector3.hpp Vector4.hpp VrStereoConfig.hpp \

 Wave.hpp Window.hpp
*/

export interface ZbsDependencyMapUpdateOptions {
    sourcePath: string;
    dryRun: boolean;
    env: {[name: string]: string};
    compiler: string;
    compileArgs: string[];
    includePaths: string[];
    compileMakeRuleArg?: string;
    includeSourcePatterns?: string[];
}

export interface ZbsDependency {
    timestamp: number;
    dependencies: string[];
}

export class ZbsDependencyMap {
    cwd: string;
    sources: {[name: string]: ZbsDependency};
    logger: ZbsLogger;
    
    constructor(cwd: string, logger: ZbsLogger) {
        this.cwd = cwd;
        this.sources = {};
        this.logger = logger;
    }
    
    async load(dataPath: string): Promise<void> {
        const jsonData = JSON.stringify({
            version: 1,
            timestamp: new Date().getTime(),
            cwd: this.cwd,
            sources: this.sources,
        });
        const gzipData = zlib.gzipSync(jsonData);
        fs.writeFileSync(dataPath, gzipData);
    }
    
    async write(dataPath: string): Promise<void> {
        const gzipData = fs.readFileSync(dataPath);
        const jsonData = zlib.gunzipSync(gzipData);
        const data = JSON.parse(jsonData.toString("utf-8"));
        this.sources = data.sources;
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
    
    getDependants(sourcePaths: string[]): Set<string> {
        const dependants = new Set<string>();
        const reverseMap = this.getReverseMap();
        for(const sourcePath of sourcePaths) {
            if(Array.isArray(reverseMap[sourcePath])) {
                for(const dependantPath of reverseMap[sourcePath]) {
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
        const timestamp = new Date().getTime();
        const dependencies: string[] = [];
        if(options.compileMakeRuleArg) {
            dependencies.push(...(
                await this.getMakeRuleDependencies(options)
            ));
        }
        if(Array.isArray(options.includeSourcePatterns) &&
            options.includeSourcePatterns.length &&
            !options.dryRun
        ) {
            dependencies.push(...(
                await this.getSourcePatternDependencies(options)
            ));
        }
        this.sources[options.sourcePath] = {
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
            env: Object.assign({}, process.env, options.env),
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
        const namePattern = /(\w|\\\s)+/g;
        const lineMatches = [
            stdoutData[0].slice(1 + colonIndex).matchAll(namePattern),
            ...stdoutData.slice(1).map((line) => line.matchAll(namePattern)),
        ];
        const dependencies: string[] = [];
        for(const matches of lineMatches) {
            for(const match of matches) {
                const name = match[0].replace(/\\/g, "");
                dependencies.push(this.resolveDependencyPath(name));
            }
        }
        // All done
        return dependencies;
    }
    
    async getSourcePatternDependencies(
        options: ZbsDependencyMapUpdateOptions
    ): Promise<string[]> {
        if(!options.includeSourcePatterns) {
            throw new Error("Dependency map consistency error.");
        }
        // TODO: allow configuration of text encoding
        const sourceContent = fs.readFileSync(
            path.resolve(this.cwd, options.sourcePath), "utf-8"
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
}
