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

export interface ZbsConfigActionShell {
    type: "shell";
    name?: string;
    nextAction?: ZbsConfigAction | string;
    nextActionFailure?: ZbsConfigAction | string;
    nextActionFinal?: ZbsConfigAction | string;
    ignoreFailure?: boolean;
    system?: string;
    env?: {[name: string]: string};
    cwd?: string;
    commands: string[];
}

export interface ZbsConfigActionRemove {
    type: "remove";
    name?: string;
    nextAction?: ZbsConfigAction | string;
    cwd?: string;
    removePaths: string[];
}

export interface ZbsConfigActionCompile {
    type: "compile";
    name?: string;
    nextAction?: ZbsConfigAction | string;
    nextActionFailure?: ZbsConfigAction | string;
    nextActionFinal?: ZbsConfigAction | string;
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

export interface ZbsConfigActionLink {
    type: "link";
    name?: string;
    nextAction?: ZbsConfigAction | string;
    nextActionFailure?: ZbsConfigAction | string;
    nextActionFinal?: ZbsConfigAction | string;
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

export type ZbsConfigAction = (
    ZbsConfigActionShell |
    ZbsConfigActionRemove |
    ZbsConfigActionCompile |
    ZbsConfigActionLink
);

export type ZbsConfigActionType = (
    "shell" |
    "remove" |
    "compile" |
    "link"
);

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
    actions: (ZbsConfigAction | string)[];
}