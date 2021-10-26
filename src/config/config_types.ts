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

export interface ZbsConfigActionInflate extends ZbsConfigActionCommon {
    type: "inflate";
    archivePath: string;
    outputPath: string;
    format?: string; // zip, gzip, tar, tar.gz, 7z, rar (todo!)
}

export interface ZbsConfigActionRemove extends ZbsConfigActionCommon {
    type: "remove";
    removePaths: string[];
}

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
    ZbsConfigActionLink |
    ZbsConfigActionRemove |
    ZbsConfigActionShell
);

export type ZbsConfigActionType = (
    "compile" |
    "fetch" |
    "link" |
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

export function zbsIsActionShell(
    value: ZbsConfigAction
): value is ZbsConfigActionShell {
    return value && typeof(value) === "object" && (
        value.type === "shell"
    );
}

export function zbsIsActionFetch(
    value: ZbsConfigAction
): value is ZbsConfigActionFetch {
    return value && typeof(value) === "object" && (
        value.type === "fetch"
    );
}

export function zbsIsActionRemove(
    value: ZbsConfigAction
): value is ZbsConfigActionRemove {
    return value && typeof(value) === "object" && (
        value.type === "remove"
    );
}

export function zbsIsActionCompile(
    value: ZbsConfigAction
): value is ZbsConfigActionCompile {
    return value && typeof(value) === "object" && (
        value.type === "compile"
    );
}

export function zbsIsActionLink(
    value: ZbsConfigAction
): value is ZbsConfigActionLink {
    return value && typeof(value) === "object" && (
        value.type === "link"
    );
}
