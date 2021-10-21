import * as fs from "fs";
import * as path from "path";

import * as json5 from "json5";
import * as toml from "@iarna/toml";
import * as yaml from "yaml";

import {ZbsConfigProject} from "./config";
import {zbsValidateProject} from "./validate";

export const ZbsProjectConfigFileNames: {[name: string]: string} = {
    "zebes.json": "json",
    "zebes.json5": "json5",
    "zebes.toml": "toml",
    "zebes.yaml": "yaml",
    "zebes.yml": "yaml",
};

export function zbsFindProjectConfigPath(cwd?: string): string {
    let searchPath = cwd || process.cwd();
    while(true) {
        for(const name in ZbsProjectConfigFileNames) {
            const tryConfigPath = path.join(searchPath, name);
            if(fs.existsSync(tryConfigPath)) {
                return tryConfigPath;
            }
        }
        const nextPath = path.dirname(searchPath);
        if(!nextPath || nextPath === searchPath) {
            break;
        }
        searchPath = nextPath;
    }
    return "";
}

export function zbsLoadProjectConfig(
    configPath: string, strictFormat?: boolean
) {
    let content: any = undefined;
    const configName = path.basename(configPath);
    const format = ZbsProjectConfigFileNames[configName];
    if(format === "json" && strictFormat) {
        content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
    else if(format === "json" || format === "json5") {
        content = json5.parse(fs.readFileSync(configPath, "utf-8"));
    }
    else if(format === "toml") {
        content = toml.parse(fs.readFileSync(configPath, "utf-8"));
    }
    else if(format === "yaml") {
        content = yaml.parse(fs.readFileSync(configPath, "utf-8"));
    }
    else {
        throw new Error("Unrecognized project config file format.");
    }
    const errors: string[] = [];
    const warnings: string[] = [];
    const project = zbsValidateProject(content, {
        path: "project",
        errors: errors,
        warnings: warnings,
    });
    return {
        project: project,
        path: configPath,
        errors: errors,
        warnings: warnings,
    };
}
