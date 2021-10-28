import * as util from "util";

import {ZbsProject} from "./project";

export function zbsValueToString(
    value: any,
    indent: string = "",
): string {
    if(Array.isArray(value)) {
        return zbsArrayToString(value, indent);
    }
    else if(value && typeof(value) === "object") {
        return zbsObjectToString(value, indent);
    }
    else if(value === undefined) {
        return "undefined";
    }
    else if(typeof(value) === "string" ||
        typeof(value) === "number" ||
        typeof(value) === "boolean"
    ) {
        return JSON.stringify(value);
    }
    else {
        return indent + util.inspect(value);
    }
}

export function zbsObjectToString(
    object: {[key: string]: any},
    indent: string = "",
): string {
    const lines: string[] = [];
    const valueIndent = indent + "  ";
    for(const key in object) {
        const value = object[key];
        if(value === undefined) {
            continue;
        }
        const valueString = zbsValueToString(value, valueIndent);
        if(valueString.startsWith(valueIndent)) {
            lines.push(indent + key + ":");
            lines.push(valueString);
        }
        else {
            lines.push(indent + key + ": " + valueString);
        }
    }
    if(lines.length) {
        return lines.join("\n");
    }
    else {
        return "{}";
    }
}

export function zbsArrayToString(
    array: any[],
    indent: string = "",
): string {
    if(!array.length) {
        return "[]";
    }
    const anyObject = array.some(
        (item) => (item && typeof(item) === "object")
    );
    if(array.length <= 8 && !anyObject) {
        return "[" + array.map((item) => zbsValueToString(item)).join(", ") + "]";
    }
    else {
        const lines: string[] = [];
        const itemIndent = indent + "  ";
        for(const item of array) {
            const itemString = zbsValueToString(item, itemIndent);
            lines.push(
                itemString.slice(0, itemIndent.length - 2) + "- " +
                itemString.slice(itemIndent.length)
            );
        }
        return lines.join("\n");
    }
}

export function zbsProjectToString(project: ZbsProject): string {
    return "Project:\n" + zbsObjectToString({
        path: project.path,
        configPath: project.configPath,
        dryRun: project.dryRun,
        config: project.config,
    }, "  ");
}
