export interface ZbsConfigHome {
    env?: {[name: string]: string};
    strictConfigFormat?: boolean;
    promptYes?: boolean;
    rebuild?: boolean;
    incremental?: boolean;
    allowActionCycles?: boolean;
    parallel?: number;
    makeCommand?: string;
}

export interface ZbsConfigProject {
    system?: string;
    env?: {[name: string]: string};
    cwd?: string;
    incremental?: boolean;
    allowActionCycles?: boolean;
    systems?: ZbsConfigSystem[];
    actions?: ZbsConfigAction[];
    targets?: ZbsConfigTarget[];
}

export interface ZbsConfigSystem {
    name: string;
    env?: {[name: string]: string};
    cwd?: string;
    incremental?: boolean;
    compiler: string;
    compileArgs?: string[];
    includePaths?: string[];
    includePathArg?: string;
    compileOutputArg?: string;
    compileOutputExt?: string;
    compileMakeRuleArg?: string;
    includeSourcePatterns?: string[];
    importSourcePatterns?: string[];
    importSourceExt?: string[];
    linker?: string;
    linkArgs?: string[];
    libraryPaths?: string[];
    libraryPathArg?: string;
    libraries?: string[];
    libraryArg?: string;
    linkOutputArg?: string;
}

export interface ZbsConfigActionCommon {
    name?: string;
    system?: string;
    nextAction?: ZbsConfigAction | string;
    nextActionFailure?: ZbsConfigAction | string;
    nextActionFinal?: ZbsConfigAction | string;
    ignoreFailure?: boolean;
    env?: {[name: string]: string};
    cwd?: string;
}

// Run a compiler
export interface ZbsConfigActionCompile extends ZbsConfigActionCommon {
    type: "compile";
    incremental?: boolean;
    compiler?: string;
    compileArgs?: string[];
    includePaths?: string[];
    sourcePaths: string[];
    rebuildAll?: boolean;
    rebuildSourcePaths?: string[];
    outputPath: string;
}

// Extract files from an archive
export interface ZbsConfigActionExtract extends ZbsConfigActionCommon {
    type: "extract";
    archivePath: string;
    outputPath: string;
    format?: string; // zip, gzip, tar, tar.gz, 7z, rar (todo!)
}

// Fetch a file
export interface ZbsConfigActionFetch extends ZbsConfigActionCommon {
    type: "fetch";
    uri: string;
    outputPath: string;
    cache?: boolean;
    overwrite?: boolean;
    httpMethod?: string;
    httpHeaders?: {[name: string]: string};
    ftpUsername?: string;
    ftpPassword?: string;
    timeoutSeconds?: number;
    retries?: number;
}

// Run a linker
export interface ZbsConfigActionLink extends ZbsConfigActionCommon {
    type: "link";
    linker?: string;
    linkArgs?: string[];
    libraryPaths?: string[];
    libraries?: string[];
    objectPaths?: string[];
    outputPath?: string;
    outputBinaryName?: string;
}

// Run make, mingw32-make, etc.
export interface ZbsConfigActionMake extends ZbsConfigActionCommon {
    type: "make";
    args?: string[];
}

// Remove files
export interface ZbsConfigActionRemove extends ZbsConfigActionCommon {
    type: "remove";
    removePaths: string[];
}

// Run shell commands
export interface ZbsConfigActionShell extends ZbsConfigActionCommon {
    type: "shell";
    name?: string;
    system?: string;
    nextAction?: ZbsConfigAction | string;
    nextActionFailure?: ZbsConfigAction | string;
    nextActionFinal?: ZbsConfigAction | string;
    ignoreFailure?: boolean;
    env?: {[name: string]: string};
    cwd?: string;
    commands: string[];
}

export type ZbsConfigAction = (
    ZbsConfigActionCompile |
    ZbsConfigActionFetch |
    ZbsConfigActionExtract |
    ZbsConfigActionLink |
    ZbsConfigActionMake |
    ZbsConfigActionRemove |
    ZbsConfigActionShell
);

export const ZbsConfigActionTypes: string[] = [
    "compile",
    "extract",
    "fetch",
    "link",
    "make",
    "remove",
    "shell",
];

export type ZbsConfigActionType = (
    "compile" |
    "extract" |
    "fetch" |
    "link" |
    "make" |
    "remove" |
    "shell"
);

export interface ZbsConfigTarget {
    name: string;
    system?: string;
    env?: {[name: string]: string};
    cwd?: string;
    incremental?: boolean;
    compiler?: string;
    compileArgs?: string[];
    includePaths?: string[];
    linker?: string;
    linkArgs?: string[];
    libraryPaths?: string[];
    libraries?: string[];
    actions: (ZbsConfigAction | string)[];
}

/** Check if an action's type string is "compile". */
export function zbsIsActionCompile(
    value: ZbsConfigAction
): value is ZbsConfigActionCompile {
    return value && typeof(value) === "object" && (
        value.type === "compile"
    );
}

/** Check if an action's type string is "extract". */
export function zbsIsActionExtract(
    value: ZbsConfigAction
): value is ZbsConfigActionExtract {
    return value && typeof(value) === "object" && (
        value.type === "extract"
    );
}

/** Check if an action's type string is "fetch". */
export function zbsIsActionFetch(
    value: ZbsConfigAction
): value is ZbsConfigActionFetch {
    return value && typeof(value) === "object" && (
        value.type === "fetch"
    );
}

/** Check if an action's type string is "link". */
export function zbsIsActionLink(
    value: ZbsConfigAction
): value is ZbsConfigActionLink {
    return value && typeof(value) === "object" && (
        value.type === "link"
    );
}

/** Check if an action's type string is "make". */
export function zbsIsActionMake(
    value: ZbsConfigAction
): value is ZbsConfigActionMake {
    return value && typeof(value) === "object" && (
        value.type === "make"
    );
}

/** Check if an action's type string is "remove". */
export function zbsIsActionRemove(
    value: ZbsConfigAction
): value is ZbsConfigActionRemove {
    return value && typeof(value) === "object" && (
        value.type === "remove"
    );
}

/** Check if an action's type string is "shell". */
export function zbsIsActionShell(
    value: ZbsConfigAction
): value is ZbsConfigActionShell {
    return value && typeof(value) === "object" && (
        value.type === "shell"
    );
}
