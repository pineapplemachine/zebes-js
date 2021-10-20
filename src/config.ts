export interface ZbsConfigProject {
    env?: {[name: string]: string};
    cwd?: string;
    incremental?: boolean;
    system?: string;
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
    linker?: string;
    linkArgs?: string[];
    libraryPaths?: string[];
    libraryPathArg?: string;
    libraries?: string[];
    libraryArg?: string;
    linkOutputArg?: string;
}

export interface ZbsConfigActionInlineShell {
    type: "shell";
    nextAction?: ZbsConfigActionInline | string;
    nextActionFailure?: ZbsConfigActionInline | string;
    nextActionFinal?: ZbsConfigActionInline | string;
    ignoreFailure?: boolean;
    system?: string;
    env?: {[name: string]: string};
    cwd?: string;
    commands: string[];
}

export interface ZbsConfigActionInlineRemove {
    type: "remove";
    nextAction?: ZbsConfigActionInline | string;
    cwd?: string;
    removePaths: string[];
}

export interface ZbsConfigActionInlineCompile {
    type: "compile";
    nextAction?: ZbsConfigActionInline | string;
    nextActionFailure?: ZbsConfigActionInline | string;
    nextActionFinal?: ZbsConfigActionInline | string;
    ignoreFailure?: boolean;
    system?: string;
    env?: {[name: string]: string};
    cwd?: string;
    incremental?: boolean;
    compiler?: string;
    compileArgs?: string[];
    includePaths?: string[];
    sourcePaths: string[];
    rebuildAll?: boolean;
    rebuildSourcePaths?: string[];
    outputPath: string;
}

export interface ZbsConfigActionInlineLink {
    type: "link";
    nextAction?: ZbsConfigActionInline | string;
    nextActionFailure?: ZbsConfigActionInline | string;
    nextActionFinal?: ZbsConfigActionInline | string;
    ignoreFailure?: boolean;
    system?: string;
    env?: {[name: string]: string};
    cwd?: string;
    linker?: string;
    linkArgs?: string[];
    libraryPaths?: string[];
    libraries?: string[];
    objectPaths?: string[];
    outputPath: string;
}

export type ZbsConfigActionInline = (
    ZbsConfigActionInlineShell |
    ZbsConfigActionInlineRemove |
    ZbsConfigActionInlineCompile |
    ZbsConfigActionInlineLink
);

export interface ZbsConfigActionShell
    extends ZbsConfigActionInlineShell {
    name: string;
}

export interface ZbsConfigActionRemove
    extends ZbsConfigActionInlineRemove {
    name: string;
}

export interface ZbsConfigActionCompile
    extends ZbsConfigActionInlineCompile {
    name: string;
}

export interface ZbsConfigActionLink
    extends ZbsConfigActionInlineLink {
    name: string;
}

export type ZbsConfigAction = (
    ZbsConfigActionShell |
    ZbsConfigActionRemove |
    ZbsConfigActionCompile |
    ZbsConfigActionLink
);

export type ZbsConfigActionType = ("shell" | "compile" | "link");

export interface ZbsConfigTarget {
    name: string;
    env?: {[name: string]: string};
    cwd?: string;
    incremental?: boolean;
    system?: string;
    compiler?: string;
    compileArgs?: string[];
    includePaths?: string[];
    linker?: string;
    linkArgs?: string[];
    libraryPaths?: string[];
    libraries?: string[];
    actions: (ZbsConfigActionInline | string)[];
}
