import {ZbsConfigProject} from "./config";
import {ZbsConfigSystem} from "./config";
import {ZbsConfigActionInline} from "./config";
import {ZbsConfigActionInlineShell} from "./config";
import {ZbsConfigActionInlineRemove} from "./config";
import {ZbsConfigActionInlineCompile} from "./config";
import {ZbsConfigActionInlineLink} from "./config";
import {ZbsConfigActionType} from "./config";
import {ZbsConfigAction} from "./config";
import {ZbsConfigTarget} from "./config";

export interface ZbsValidateContext {
    path: string;
    errors: string[];
}

export function zbsValidateExactString(expect: string) {
    return function (value: any, context: ZbsValidateContext): string {
        if(value !== expect) {
            context.errors.push(context.path + `: Must be the string "${expect}".`);
        }
        return expect;
    };
}

export function zbsValidateBoolean(value: any, context: ZbsValidateContext): boolean | undefined {
    if(value === null || value === undefined) {
        return undefined;
    }
    else if(!value || value === "false") {
        return false;
    }
    else {
        return true;
    }
}

export function zbsValidateString(value: any, context: ZbsValidateContext): string | undefined {
    if(value && typeof(value) !== "string") {
        context.errors.push(context.path + ": Must be a string.");
        return "";
    }
    else if(value === undefined || value === null) {
        return undefined;
    }
    else {
        return String(value);
    }
}

export function zbsValidateRequiredString(value: any, context: ZbsValidateContext): string {
    const result = zbsValidateString(value, context);
    if(!result) {
        context.errors.push(context.path + ": Must be a non-empty string");
    }
    return result || "";
}

export function zbsValidateEnv(
    value: any, context: ZbsValidateContext
): {[name: string]: string} | undefined {
    if(value && typeof(value) !== "object") {
        context.errors.push(context.path + ": Must be a dictionary object.");
        return undefined;
    }
    else {
        const env: {[name: string]: string} = {};
        for(const key in value) {
            env[key] = String(key);
        }
        return env;
    }
}

export function zbsValidateList<T>(
    validateItem: ((value: any, context: ZbsValidateContext) => T)
) {
    return function zbsValidateListItems(
        value: any, context: ZbsValidateContext
    ): T[] {
        if(!value) {
            return [];
        }
        else if(!Array.isArray(value)) {
            context.errors.push(context.path + ": Must be a list.");
            return [];
        }
        const list: T[] = [];
        let index: number = 0;
        for(const item of value) {
            const itemContext = {
                path: context.path + `[${index++}]`,
                errors: [],
            };
            const validatedItem = validateItem(item, itemContext);
            if(!itemContext.errors.length) {
                list.push(validatedItem);
            }
            else {
                context.errors.push(...itemContext.errors);
            }
        }
        return list;
    };
}

export function zbsValidateDefinedList<T>(
    validateItem: ((value: any, context: ZbsValidateContext) => T | undefined)
) {
    return function zbsValidateListItems(
        value: any, context: ZbsValidateContext
    ): T[] {
        if(!value) {
            return [];
        }
        else if(!Array.isArray(value)) {
            context.errors.push(context.path + ": Must be a list.");
            return [];
        }
        const list: T[] = [];
        let index: number = 0;
        for(const item of value) {
            const itemContext = {
                path: context.path + `[${index++}]`,
                errors: [],
            };
            const validatedItem = validateItem(item, itemContext);
            if(!itemContext.errors.length && validatedItem !== undefined) {
                list.push(validatedItem);
            }
            else {
                context.errors.push(...itemContext.errors);
            }
        }
        return list;
    };
}

export function zbsValidateStringList(
    value: any, context: ZbsValidateContext
): string[] {
    return zbsValidateList<string>(zbsValidateRequiredString)(
        value, context
    );
}

export function zbsValidateObject(
    validateKeys: {[key: string]: ((value: any, context: ZbsValidateContext) => any)}
) {
    return function zbsValidateObjectKeys(
        value: any, context: ZbsValidateContext
    ): {[key: string]: any} {
        if(!value || typeof(value) !== "object") {
            context.errors.push(context.path + ": Must be an object.");
            return {};
        }
        const result: {[key: string]: any} = {};
        for(const key in validateKeys) {
            const itemContext = {
                path: `${context.path}.${key}`,
                errors: [],
            };
            const validatedItem = validateKeys[key](
                value[key], itemContext
            );
            if(!itemContext.errors.length) {
                result[key] = validatedItem;
            }
            else {
                context.errors.push(...itemContext.errors);
            }
        }
        return result;
    };
}

export function zbsValidateProject(
    value: any, context: ZbsValidateContext
): ZbsConfigProject {
    return <ZbsConfigProject> zbsValidateObject({
        env: zbsValidateEnv,
        cwd: zbsValidateString,
        incremental: zbsValidateBoolean,
        system: zbsValidateString,
        allowActionCycles: zbsValidateBoolean,
        systems: zbsValidateDefinedList<ZbsConfigSystem>(zbsValidateSystem),
        actions: zbsValidateDefinedList<ZbsConfigAction>(zbsValidateAction),
        targets: zbsValidateDefinedList<ZbsConfigTarget>(zbsValidateTarget),
    })(value, context);
}

export function zbsValidateSystem(
    value: any, context: ZbsValidateContext
): ZbsConfigSystem {
    return <ZbsConfigSystem> zbsValidateObject({
        name: zbsValidateRequiredString,
        env: zbsValidateEnv,
        cwd: zbsValidateString,
        incremental: zbsValidateBoolean,
        compiler: zbsValidateRequiredString,
        compileArgs: zbsValidateStringList,
        includePaths: zbsValidateStringList,
        includePathArg: zbsValidateString,
        compileOutputArg: zbsValidateString,
        compileOutputExt: zbsValidateString,
        includeSourcePatterns: zbsValidateStringList,
        linker: zbsValidateString,
        linkArgs: zbsValidateStringList,
        libraryPaths: zbsValidateStringList,
        libraryPathArg: zbsValidateString,
        libraries: zbsValidateStringList,
        libraryArg: zbsValidateString,
        linkOutputArg: zbsValidateString,
    })(value, context);
}

export function zbsValidateAction(
    value: any, context: ZbsValidateContext
): ZbsConfigAction | undefined {
    const action = <ZbsConfigAction | undefined> (
        zbsValidateActionInline(value, context)
    );
    if(action) {
        action.name = zbsValidateRequiredString(value.name, {
            path: context.path + ".name",
            errors: context.errors,
        });
    }
    return action;
}

export function zbsValidateActionStringOrInline(
    value: any, context: ZbsValidateContext
): ZbsConfigActionInline | string | undefined {
    if(value === undefined || (value && typeof(value) === "string")) {
        return value;
    }
    else {
        return zbsValidateActionInline(value, context) || "";
    }
}
    
export function zbsValidateActionInline(
    value: any, context: ZbsValidateContext
): ZbsConfigActionInline | undefined {
    if(!value || typeof(value) !== "object") {
        context.errors.push(context.path + ": Must be an object.");
        return undefined;
    }
    if(value.type === "shell") {
        return <ZbsConfigActionInlineShell> zbsValidateObject({
            type: zbsValidateExactString("shell"),
            nextAction: zbsValidateActionStringOrInline,
            nextActionFailure: zbsValidateActionStringOrInline,
            nextActionFinal: zbsValidateActionStringOrInline,
            ignoreFailure: zbsValidateBoolean,
            system: zbsValidateString,
            env: zbsValidateEnv,
            cwd: zbsValidateString,
            commands: zbsValidateStringList,
        })(value, context);
    }
    else if(value.type === "remove") {
        return <ZbsConfigActionInlineRemove> zbsValidateObject({
            type: zbsValidateExactString("remove"),
            nextAction: zbsValidateActionStringOrInline,
            cwd: zbsValidateString,
            removePaths: zbsValidateStringList,
        })(value, context);
    }
    else if(value.type === "compile") {
        return <ZbsConfigActionInlineCompile> zbsValidateObject({
            type: zbsValidateExactString("compile"),
            nextAction: zbsValidateActionStringOrInline,
            nextActionFailure: zbsValidateActionStringOrInline,
            nextActionFinal: zbsValidateActionStringOrInline,
            ignoreFailure: zbsValidateBoolean,
            system: zbsValidateString,
            env: zbsValidateEnv,
            cwd: zbsValidateString,
            incremental: zbsValidateBoolean,
            compiler: zbsValidateString,
            compileArgs: zbsValidateStringList,
            includePaths: zbsValidateStringList,
            sourcePaths: zbsValidateStringList,
            rebuildAll: zbsValidateBoolean,
            rebuildSourcePaths: zbsValidateStringList,
            outputPath: zbsValidateRequiredString,
        })(value, context);
    }
    else if(value.type === "link") {
        return <ZbsConfigActionInlineLink> zbsValidateObject({
            type: zbsValidateExactString("link"),
            nextAction: zbsValidateActionStringOrInline,
            nextActionFailure: zbsValidateActionStringOrInline,
            nextActionFinal: zbsValidateActionStringOrInline,
            ignoreFailure: zbsValidateBoolean,
            system: zbsValidateString,
            env: zbsValidateEnv,
            cwd: zbsValidateString,
            linker: zbsValidateString,
            linkArgs: zbsValidateStringList,
            libraryPaths: zbsValidateStringList,
            libraries: zbsValidateStringList,
            objectPaths: zbsValidateStringList,
            outputPath: zbsValidateRequiredString,
        })(value, context);
    }
    else {
        context.errors.push(
            context.path + `.type: Must be either ` +
            `"shell", "remove", "compile", or "link".`
        );
        return undefined;
    }
}

export function zbsValidateTarget(
    value: any, context: ZbsValidateContext
): ZbsConfigTarget {
    return <ZbsConfigTarget> zbsValidateObject({
        name: zbsValidateRequiredString,
        env: zbsValidateEnv,
        cwd: zbsValidateString,
        incremental: zbsValidateBoolean,
        system: zbsValidateString,
        compiler: zbsValidateString,
        compileArgs: zbsValidateStringList,
        includePaths: zbsValidateStringList,
        linker: zbsValidateString,
        linkArgs: zbsValidateStringList,
        libraryPaths: zbsValidateStringList,
        libraries: zbsValidateStringList,
        actions: zbsValidateDefinedList<ZbsConfigActionInline>(
            zbsValidateActionInline
        ),
    })(value, context);
}
