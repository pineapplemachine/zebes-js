/** Global system-wide Zebes presets and settings. */
export interface ZbsConfigHome {
    /** Environment variables to set when running actions. */
    env?: {[name: string]: string};
    /** Parse *.json files as strict JSON, not as permissive JSON5. */
    strictConfigFormat?: boolean;
    /** Automatically respond to [y/n] prompts with "yes". */
    promptYes?: boolean;
    /** Override incremental compilation settings. Always rebuild all files. */
    rebuild?: boolean;
    /** Use incremental builds for "compile" actions. */
    incremental?: boolean;
    /** Don't abort execution upon encountering an action cycle or loop. */
    allowActionCycles?: boolean;
    /** Maximum number of independent tasks to run simultaneously. */
    parallel?: number;
    /** Abort execution if running more than this many actions in one target. */
    runMaxActions?: number;
    /** Command or executable to use for "make" actions. */
    makeCommand?: string;
}

/** Contains all configuration for managing a Zebes project. */
export interface ZbsConfigProject {
    /** Name a system to use for "compile" and "link" actions. */
    system?: string;
    /** Environment variables to set when running actions. */
    env?: {[name: string]: string};
    /** Current working directory to set when running actions. */
    cwd?: string;
    /** Use incremental builds for "compile" actions. */
    incremental?: boolean;
    /** Don't abort execution upon encountering an action cycle or loop. */
    allowActionCycles?: boolean;
    /** List of systems to identify for "compile" and "link" actions. */
    systems?: ZbsConfigSystem[];
    /** List of actions that can be run. */
    actions?: ZbsConfigAction[];
    /** List of targets that can be run. */
    targets?: ZbsConfigTarget[];
}

/** Systems provide context for "compile" and "link" actions. */
export interface ZbsConfigSystem {
    /** Identifying name for this system. */
    name: string;
    /** Environment variables to set when running actions. */
    env?: {[name: string]: string};
    /** Current working directory to set when running actions. */
    cwd?: string;
    /** Use incremental builds for "compile" actions. */
    incremental?: boolean;
    /** Configure "compile" actions. */
    compiler?: string;
    /** Configure "compile" actions. */
    compileArgs?: string[];
    /** Configure "compile" actions. */
    includePaths?: string[];
    /** Compiler command line option for include paths, e.g. "-I". */
    includePathArg?: string;
    /** Compiler command line option for output path, e.g. "-o". */
    compileOutputArg?: string;
    /** Compiled output files should have this extension, e.g. ".o". */
    compileOutputExt?: string;
    /** Compiler command line option for make rules, e.g. "-MM". */
    compileMakeRuleArg?: string;
    /** Regex patterns to find "#include"s for incremental compilation. */
    includeSourcePatterns?: string[];
    /** Regex patterns to find "import"s for incremental compilation. */
    importSourcePatterns?: string[];
    /** Source file extensions affecting imports. (e.g. ".d", ".di"). */
    importSourceExt?: string[];
    /** Configure "link" actions. */
    linker?: string;
    /** Configure "link" actions. */
    linkArgs?: string[];
    /** Configure "link" actions. */
    libraryPaths?: string[];
    /** Linker command line option for library search paths, e.g. "-L". */
    libraryPathArg?: string;
    /** Configure "link" actions. */
    libraries?: string[];
    /** Linker command line option for libraries, e.g. "-l". */
    libraryArg?: string;
    /** Linker command line option for output path, e.g. "-o". */
    linkOutputArg?: string;
}

/** Common interface for all action types. */
export interface ZbsConfigActionCommon {
    /** Identifying name for this action. */
    name?: string;
    /** Name a system to use for "compile" and "link" actions. */
    system?: string;
    /** If the action is successful, then run this action next. */
    nextAction?: ZbsConfigAction | string;
    /** If the action fails, then run this action next. */
    nextActionFailure?: ZbsConfigAction | string;
    /** Run this action next, after "nextAction" or "nextActionFailure". */
    nextActionFinal?: ZbsConfigAction | string;
    /** Don't fail the entire target when this action fails. */
    ignoreFailure?: boolean;
    /** Environment variables. */
    env?: {[name: string]: string};
    /** Current working directory. */
    cwd?: string;
}

/** Action: Compile source files. */
export interface ZbsConfigActionCompile extends ZbsConfigActionCommon {
    type: "compile";
    /** Use incremental compilation. */
    incremental?: boolean;
    /** Compiler command or executable. */
    compiler?: string;
    /** Additional command line arguments for compilation. */
    compileArgs?: string[];
    /** Include paths. Normally passed via "-I" options. */
    includePaths?: string[];
    /** Compile source files matching glob patterns. */
    sourcePaths: string[];
    /** Override "incremental" setting and always rebuild all files. */
    rebuildAll?: boolean;
    /** Override "incremental" setting for files matching glob patterns. */
    rebuildSourcePaths?: string[];
    /** Output compiled object files into this directory. */
    outputPath: string;
    /** Identifiable name for the list of created object files. */
    objectList?: string;
}

/** Action: Copy files. */
export interface ZbsConfigActionCopy extends ZbsConfigActionCommon {
    type: "copy";
    /** Copy an exact path. */
    copyPath?: string;
    /** Copy paths matching each glob pattern. */
    copyPaths?: string[];
    /** Paths in copyPaths are relative to this directory. */
    copyPathsBase?: string;
    /** Destination for copied files. */
    outputPath: string;
    /** Overwrite files at the destination? */
    overwrite?: boolean;
}

export interface ZbsConfigActionExternRequirement {
    /** Identifying name for this external dependency, e.g. "dep@1.0.0". */
    externName: string;
    /** File path where the dependency is expected. */
    externPath: string,
    /** After running "acquireActions", the dependency will be here. */
    acquirePath: string,
    /** Cache acquired dependencies to prevent repeated fetches or builds. */
    cache?: boolean;
}

/** Action: Acquire external dependencies. */
export interface ZbsConfigActionExtern extends ZbsConfigActionCommon {
    type: "extern";
    /** Run these actions in series to acquire the dependency. */
    acquireActions: (ZbsConfigAction | string)[];
    /** Run this action after successfully acquiring the dependency. */
    nextActionAcquired?: (ZbsConfigAction | string);
    /** List of files or directories required for the dependency. */
    externRequirements: ZbsConfigActionExternRequirement[];
    /** Cache acquired dependencies to prevent repeated fetches or builds. */
    cache?: boolean;
}

/** Action: Extract files from an archive. */
export interface ZbsConfigActionExtract extends ZbsConfigActionCommon {
    type: "extract";
    /** Extract files from this archive. */
    archivePath: string;
    /** Output the extracted files to this directory path. */
    outputPath: string;
    /** Specify archive format, instead of detection by file extension. */
    format?: string;
}

/** Action: Fetch files, normally from a remote host. */
export interface ZbsConfigActionFetch extends ZbsConfigActionCommon {
    type: "fetch";
    /** Fetch file from this URI. */
    uri: string;
    /** Write the fetched file to this destination path. */
    outputPath: string;
    /** Cache fetched files to prevent repeated downloads. */
    cache?: boolean;
    /** If the destination file exists already, overwrite it. */
    overwrite?: boolean;
    /** Method to use for fetching http and https resources. */
    httpMethod?: string;
    /** Headers to use when fetching http and https resources. */
    httpHeaders?: {[name: string]: string};
    /** TODO: FTP not yet implemented */
    ftpUsername?: string;
    /** TODO: FTP not yet implemented */
    ftpPassword?: string;
    /** If a download takes longer than this, fail it. */
    timeoutSeconds?: number;
    /** If a download fails, retry it up to this many times. */
    retries?: number;
}

/** Action: Link compiled source files. */
export interface ZbsConfigActionLink extends ZbsConfigActionCommon {
    type: "link";
    /** Linker command. Falls back to the configured compiler command. */
    linker?: string;
    /** Additional command line arguments to provide to the linker. */
    linkArgs?: string[];
    /** Library search paths. Normally passed via "-L" options. */
    libraryPaths?: string[];
    /** Link with libraries. Normally passed via "-l" options. */
    libraries?: string[];
    /** Include files matching these glob patterns when linking. */
    objectPaths?: string[];
    /** Compile objects stored in lists by prior "compile" actions. */
    objectLists?: string[];
    /** Link objects produced by preceding "compile" actions. */
    objectsAuto?: boolean;
    /** Path to linker output. Normally passed via the "-o" option. */
    outputPath?: string;
    /** Output `[name].exe` on Windows and `[name]` elsewhere. */
    outputBinaryName?: string;
}

/** Action: Run commands such as make or mingw32-make. */
export interface ZbsConfigActionMake extends ZbsConfigActionCommon {
    type: "make";
    /** Command line arguments to pass to make. */
    makeArgs?: string[];
}

/** Action: Move or rename files. */
export interface ZbsConfigActionMove extends ZbsConfigActionCommon {
    type: "move";
    /** Move an exact path. */
    movePath?: string;
    /** Move paths matching each glob pattern. */
    movePaths?: string[];
    /** Paths in movePaths are relative to this directory. */
    movePathsBase?: string;
    /** Destination for moved files. */
    outputPath: string;
    /** Overwrite files at the destination? */
    overwrite?: boolean;
}

/** Action: Remove files. */
export interface ZbsConfigActionRemove extends ZbsConfigActionCommon {
    type: "remove";
    /** Remove exact path. */
    removePath?: string;
    /** Remove paths matching each glob pattern. */
    removePaths?: string[];
    /** Use interactive CLI prompt to confirm removals. */
    prompt?: boolean;
}

/** Action: Execute arbitrary shell commands. */
export interface ZbsConfigActionShell extends ZbsConfigActionCommon {
    type: "shell";
    /** Run these shell commands in order. */
    commands: string[];
}

/** Union type for all actions. */
export type ZbsConfigAction = (
    ZbsConfigActionCompile |
    ZbsConfigActionCopy |
    ZbsConfigActionExtern |
    ZbsConfigActionExtract |
    ZbsConfigActionFetch |
    ZbsConfigActionLink |
    ZbsConfigActionMake |
    ZbsConfigActionMove |
    ZbsConfigActionRemove |
    ZbsConfigActionShell
);

/** List of action type strings, as an array. */
export const ZbsConfigActionTypes: string[] = [
    "compile",
    "copy",
    "extern",
    "extract",
    "fetch",
    "link",
    "make",
    "move",
    "remove",
    "shell",
];

/** List of action type strings, as a union type. */
export type ZbsConfigActionType = (
    "compile" |
    "copy" |
    "extern" |
    "extract" |
    "fetch" |
    "link" |
    "make" |
    "move" |
    "remove" |
    "shell"
);

/** The primary usage of Zebes is to execute targets. */
export interface ZbsConfigTarget {
    /** A name identifying the target. */
    name: string;
    /** Name a system to use for "compile" and "link" actions. */
    system?: string;
    /** Environment variables to set when running actions. */
    env?: {[name: string]: string};
    /** Current working directory to set when running actions. */
    cwd?: string;
    /** Use incremental builds for "compile" actions. */
    incremental?: boolean;
    /** Configure "compile" actions. */
    compiler?: string;
    /** Configure "compile" actions. */
    compileArgs?: string[];
    /** Configure "compile" actions. */
    includePaths?: string[];
    /** Configure "link" actions. */
    linker?: string;
    /** Configure "link" actions. */
    linkArgs?: string[];
    /** Configure "link" actions. */
    libraryPaths?: string[];
    /** Configure "link" actions. */
    libraries?: string[];
    /** Target execution entails running each action in series. */
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

/** Check if an action's type string is "copy". */
export function zbsIsActionCopy(
    value: ZbsConfigAction
): value is ZbsConfigActionCopy {
    return value && typeof(value) === "object" && (
        value.type === "copy"
    );
}

/** Check if an action's type string is "extern". */
export function zbsIsActionExtern(
    value: ZbsConfigAction
): value is ZbsConfigActionExtern {
    return value && typeof(value) === "object" && (
        value.type === "extern"
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

/** Check if an action's type string is "move". */
export function zbsIsActionMove(
    value: ZbsConfigAction
): value is ZbsConfigActionMove {
    return value && typeof(value) === "object" && (
        value.type === "move"
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
