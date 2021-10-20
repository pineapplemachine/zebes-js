import {ZbsConfigProject} from "./config";
import {ZbsConfigSystem} from "./config";
import {ZbsConfigAction} from "./config";
import {ZbsConfigActionShell} from "./config";
import {ZbsConfigActionRemove} from "./config";
import {ZbsConfigActionCompile} from "./config";
import {ZbsConfigActionLink} from "./config";
import {ZbsConfigTarget} from "./config";

export interface ZbsValidateContext {
    path: string;
    errors: string[];
    warnings: string[];
}

/**
 * Produce an error if the input does not exactly equal the given string.
 */
export function zbsValidateExactString(expect: string) {
    return function (value: any, context: ZbsValidateContext): string {
        if(value !== expect) {
            context.errors.push(
                `At ${context.path}: Must be the string "${expect}".`
            );
        }
        return expect;
    };
}

/**
 * Coerce the given value to a boolean.
 */
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

/**
 * If the input value is a string, return it.
 * If it's null or undefined, return undefined.
 * Otherwise, produce an error and return undefined.
 */
export function zbsValidateString(value: any, context: ZbsValidateContext): string | undefined {
    if(value && typeof(value) !== "string") {
        context.errors.push(`At ${context.path}: Must be a string.`);
        return undefined;
    }
    else if(value === undefined || value === null) {
        return undefined;
    }
    else {
        return String(value);
    }
}

/**
 * Produce an error if the input value is not a non-empty string.
 */
export function zbsValidateRequiredString(value: any, context: ZbsValidateContext): string {
    const result = zbsValidateString(value, context);
    if(!result) {
        context.errors.push(`At ${context.path}: Must be a non-empty string`);
    }
    return result || "";
}

/**
 * Produce an error unless the input value is either an object or undefined.
 * Produce a warning if the input is an object and any of its member
 * values is something other than a string.
 */
export function zbsValidateEnv(
    value: any, context: ZbsValidateContext
): {[name: string]: string} | undefined {
    if(value && typeof(value) !== "object") {
        context.errors.push(`At ${context.path}: Must be a dictionary object.`);
        return undefined;
    }
    else if(value) {
        const env: {[name: string]: string} = {};
        for(const key in value) {
            if(typeof(value[key]) !== "string") {
                context.warnings.push(
                    `At ${context.path}[${JSON.stringify(key)}]: ` +
                    `Value should be a string. It has been coerced ` +
                    `to a string value for you.`
                );
            }
            env[key] = String(value[key]);
        }
        return env;
    }
    else {
        return undefined;
    }
}

/**
 * Behavior of this function depends on the `required` and `defined`
 * fields of the `options` object. When the `options` object is not
 * provided, both fields are treated as though they were falsey.
 *
 * If the input value is falsey, then it is coerced to undefined.
 * If the input is an array, then a validator function is applied
 * to each element.
 * If the function is truthy and not an array, then it will
 * produce an error.
 *
 * If options.required is true then, when the function returns
 * undefined, it will also produce an error.
 * If options.defined is true then undefined return values produced
 * by the array item validator will be discarded, instead of
 * being added to the array normally.
 */
export function zbsValidateList<T>(
    validateItem: ((value: any, context: ZbsValidateContext) => T),
    options?: {required?: boolean, defined?: boolean},
) {
    return function zbsValidateListItems(
        value: any, context: ZbsValidateContext
    ): T[] | undefined {
        if(!value && (!options || !options.required)) {
            return undefined;
        }
        else if(!Array.isArray(value)) {
            context.errors.push(`At ${context.path}: Must be a list.`);
            return (options && !options.required) ? [] : undefined;
        }
        const list: T[] = [];
        let index: number = 0;
        for(const item of value) {
            const itemContext = {
                path: context.path + `[${index++}]`,
                errors: [],
                warnings: [],
            };
            const validatedItem = validateItem(item, itemContext);
            if(!itemContext.errors.length && (
                validatedItem !== undefined ||
                (!options || !options.defined)
            )) {
                list.push(validatedItem);
            }
            else {
                context.errors.push(...itemContext.errors);
            }
            if(itemContext.warnings.length) {
                context.warnings.push(...itemContext.warnings);
            }
        }
        return list;
    };
}

/**
 * Invokes zbsValidateList with `required: true`.
 */
export function zbsValidateRequiredList<T>(
    validateItem: ((value: any, context: ZbsValidateContext) => T)
) {
    return function zbsValidateDefinedListItems(
        value: any, context: ZbsValidateContext
    ): T[] {
        return zbsValidateList(
            validateItem, {required: true}
        )(value, context) || [];
    };
}

/**
 * Invokes zbsValidateList with `defined: true`.
 */
export function zbsValidateDefinedList<T>(
    validateItem: ((value: any, context: ZbsValidateContext) => T | undefined)
) {
    return function zbsValidateDefinedListItems(
        value: any, context: ZbsValidateContext
    ): T[] | undefined {
        return <T[] | undefined> zbsValidateList(
            validateItem, {defined: true}
        )(value, context);
    };
}

/**
 * Invokes zbsValidateList with `required: true` and `defined: true`.
 */
export function zbsValidateRequiredDefinedList<T>(
    validateItem: ((value: any, context: ZbsValidateContext) => T | undefined)
) {
    return function zbsValidateRequiredDefinedListItems(
        value: any, context: ZbsValidateContext
    ): T[] {
        return <T[]> zbsValidateList(
            validateItem, {required: true, defined: true}
        )(value, context) || [];
    };
}

/**
 * If the input value is falsey, returns undefined.
 * If the input value is an array, validates that every member
 * of the array is a string.
 * Otherwise, the function produces an error.
 */
export function zbsValidateStringList(
    value: any, context: ZbsValidateContext
): string[] | undefined {
    return zbsValidateList<string>(zbsValidateRequiredString)(
        value, context
    );
}

/**
 * If the input value is an array, validates that every member
 * of the array is a string.
 * Otherwise, the function produces an error.
 */
export function zbsValidateRequiredStringList(
    value: any, context: ZbsValidateContext
): string[] {
    return zbsValidateRequiredList<string>(zbsValidateRequiredString)(
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
            context.errors.push(`At ${context.path}: Must be an object.`);
            return {};
        }
        const result: {[key: string]: any} = {};
        for(const key in validateKeys) {
            const itemContext = {
                path: `${context.path}.${key}`,
                errors: [],
                warnings: [],
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
            if(itemContext.warnings.length) {
                context.warnings.push(...itemContext.warnings);
            }
        }
        for(const key in value) {
            if(!(key in validateKeys)) {
                context.warnings.push(
                    `At ${context.path}: Unknown key ${JSON.stringify(key)} ` +
                    `in object. This key and its value will be ignored.`
                );
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
            warnings: context.warnings,
        });
    }
    return action;
}

export function zbsValidateActionStringOrInline(
    value: any, context: ZbsValidateContext
): ZbsConfigAction | string | undefined {
    if(value === undefined || (value && typeof(value) === "string")) {
        return value;
    }
    else {
        return zbsValidateActionInline(value, context) || "";
    }
}

export function zbsValidateRequiredActionStringOrInline(
    value: any, context: ZbsValidateContext
): ZbsConfigAction | string {
    const action = zbsValidateActionStringOrInline(value, context);
    if(!action) {
        context.errors.push(
            `At ${context.path}: Must be either an action name string ` +
            `or an action object.`
        );
    }
    return action || "";
}
    
export function zbsValidateActionInline(
    value: any, context: ZbsValidateContext
): ZbsConfigAction | undefined {
    if(!value || typeof(value) !== "object") {
        context.errors.push(`At ${context.path}: Must be an object.`);
        return undefined;
    }
    if(value.type === "shell") {
        return <ZbsConfigActionShell> zbsValidateObject({
            type: zbsValidateExactString("shell"),
            nextAction: zbsValidateActionStringOrInline,
            nextActionFailure: zbsValidateActionStringOrInline,
            nextActionFinal: zbsValidateActionStringOrInline,
            ignoreFailure: zbsValidateBoolean,
            system: zbsValidateString,
            env: zbsValidateEnv,
            cwd: zbsValidateString,
            commands: zbsValidateRequiredStringList,
        })(value, context);
    }
    else if(value.type === "remove") {
        return <ZbsConfigActionRemove> zbsValidateObject({
            type: zbsValidateExactString("remove"),
            nextAction: zbsValidateActionStringOrInline,
            cwd: zbsValidateString,
            removePaths: zbsValidateRequiredStringList,
        })(value, context);
    }
    else if(value.type === "compile") {
        return <ZbsConfigActionCompile> zbsValidateObject({
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
        return <ZbsConfigActionLink> zbsValidateObject({
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
            `At ${context.path}.type: Must be either ` +
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
        // TODO: Also accept action names
        actions: zbsValidateRequiredDefinedList<ZbsConfigAction | string>(
            zbsValidateRequiredActionStringOrInline
        ),
    })(value, context);
}
