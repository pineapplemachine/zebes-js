# Zebes Project Configuration Specification

This file documents the fields recognized in Zebes configuration files, such as `zebes.yaml` or `zebes.toml`, and how they affect the build tool's behavior.

Zebes project configuration files are recognized in [JSON](https://www.json.org/json-en.html), [JSON5](https://json5.org/), [TOML](https://toml.io/en/), and [YAML](https://yaml.org/) formats.
There is no significant technical reason to choose any of these formats over any other. You should choose the format that you are most comfortable working with.

## Field Resolution

When Zebes needs to determine the value provided for some setting, there are six possible ways that it can do this. Each field documents the form of field resolution that it uses.

### Override Resolution

In the case of _overriding inheritance_, Zebes checks the **action** config to see if the field is set. If it is, then it uses that setting. Then it checks the config for the **target** that the action is being run as a part of, to see if the field is set there. If it is, then it uses that setting. Then it checks the **system** that the action is set to use, to see if the field is set there. If it is, then it uses that setting. Finally, it checks the overall **project** configuration to see if the field is set there. If it is, then it uses that setting. If the field is not set in any of these places, then a default value may be used or an error may be produced, depending on the field.

For example, when determining what _"compiler"_ setting to use for a "compile" action, the setting in the action itself takes the greatest precedence, when it's there. Then the target takes precedence, then the system.

### Additive List Resolution

TODO: Lists are concatenated.

### Merged Object Resolution

TODO: Objects are merged

### Relative Path Resolution

TODO: cwd. Relative cwd is relative to the next order cwd. Base cwd is where the project config file is located.

### System Resolution

TODO: Field can be defined only in the system config

### Direct Resolution

In the case of _direct resolution_, Zebes checks only the config object that the field is specifically defined for.

## Configuration Object Specifications

### Project Specification

- [system](#field-system): [System](#system-specification) name.
- [env](#field-env): Environment variables object.
- [cwd](#field-cwd): Current working directory path string.
- [incremental](#field-incremental): Incremental compilation override flag.
- [allowActionCycles](#field-allowactioncycles): Cyclic actions flag.
- systems: List of [system config objects](#system-specification).
- actions: List of [action config objects](#action-specification).
- targets: List of [target config objects](#target-specification).

The systems list defines systems which can be referenced by their name.

The actions list defines actions which can be referenced by their name.

The targets list defines targets which can be referenced by their name.

### System Specification

- [name](#field-name-system): System name string. (Required)
- [env](#field-env): Environment variables object.
- [cwd](#field-cwd): Current working directory path string.
- [incremental](#field-incremental): Incremental compilation override flag.
- [compiler](#field-compiler): Compiler command or executable. (Required)
- [compileArgs](#field-compileargs): List of compiler arguments.
- [includePaths](#field-includepaths): List of compiler include paths.
- [includePathArg](#field-includepatharg): Include path CLI argument, e.g. "-I".
- [compileOutputArg](#field-compileoutputarg): Compiler output path CLI argument, e.g. "-o".
- [compileOutputExt](#field-compileoutputext): Compiler output file extension, e.g. ".o".
- [compileMakeRuleArg](#field-compilemakerulearg): Make rule CLI flag, e.g. "-MM".
- [includeSourcePatterns](#field-includesourcepatterns): List of regex patterns to detect includes.
- [linker](#field-linker): Linker command or executable.
- [linkArgs](#field-linkargs): List of linker arguments.
- [libraryPaths](#field-librarypaths): List of linker library search paths.
- [libraryPathArg](#field-librarypatharg): Library search path CLI argument, e.g. "-L".
- [libraries](#field-libraries): List of libraries to link with.
- [libraryArg](#field-libraryarg): Linker library CLI argument, e.g. "-l".
- [linkOutputArg](#field-linkoutputarg): Linker output path CLI argument, e.g. "-o".

### Target Specification

- [name](#field-name-target): Target name string. (Required)
- [system](#field-system): [System](#system-specification) name.
- [env](#field-env): Environment variables object.
- [cwd](#field-cwd): Current working directory path string.
- [incremental](#field-incremental): Incremental compilation override flag.
- [compiler](#field-compiler): Compiler command or executable.
- [compileArgs](#field-compileargs): List of compiler arguments.
- [includePaths](#field-includepaths): List of compiler include paths.
- [linker](#field-linker): Linker command or executable.
- [linkArgs](#field-linkargs): List of linker arguments.
- [libraryPaths](#field-librarypaths): List of linker library search paths.
- [libraries](#field-libraries): List of libraries to link with.
- actions: List of [action config objects](#action-specification) or name strings.

The actions list contains the series of actions that should be run one after the other. The actions here can either be literal [action config objects](#action-specification) or they can be strings naming actions appearing in the [project config object's](#project-specification) own "actions" list.

### Action Specification

- [type](#field-type-action): Action type string. (Required)
- [name](#field-name-action): Action name string. (Required in some cases)
- [system](#field-system): [System](#system-specification) name.

The action type determines how the object's fields are treated.

The action name is required for actions in the [project config object's](#project-specification) own "actions" list. For all other places where an action object can be provded, the name is optional.

#### Action Specification (Shell)

- [type](#field-type-action): "shell"
- [name](#field-name-action): Action name string.
- [system](#field-system): [System](#system-specification) name.
- [nextAction](#field-nextaction): Action to run after this one, upon success.
- [nextActionFailure](#field-nextactionfailure): Action to run after this one, upon failure.
- [nextActionFinal](#field-nextactionfinal): Action to run after this one, unconditionally.
- [ignoreFailure](#field-ignorefailure): Flag to disregard action failure.
- [env](#field-env): Environment variables object.
- [cwd](#field-cwd): Current working directory path string.
- [commands](#field-commands-shell): List of shell commands to run.

#### Action Specification (Remove)

- [type](#field-type-action): "remove"
- [name](#field-name-action): Action name string.
- [system](#field-system): [System](#system-specification) name.
- [nextAction](#field-nextaction): Action to run after this one, upon success.
- [cwd](#field-cwd): Current working directory path string.
- [removePaths](#field-removepaths): List of globs to remove matching paths.

#### Action Specification (Compile)

- [type](#field-type-action): "compile"
- [name](#field-name-action): Action name string.
- [system](#field-system): [System](#system-specification) name.
- [nextAction](#field-nextaction): Action to run after this one, upon success.
- [nextActionFailure](#field-nextactionfailure): Action to run after this one, upon failure.
- [nextActionFinal](#field-nextactionfinal): Action to run after this one, unconditionally.
- [ignoreFailure](#field-ignorefailure): Flag to disregard action failure.
- [env](#field-env): Environment variables object.
- [cwd](#field-cwd): Current working directory path string.
- [incremental](#field-incremental): Incremental compilation override flag.
- [compiler](#field-compiler): Compiler command or executable.
- [compileArgs](#field-compileargs): List of compiler arguments.
- [includePaths](#field-includepaths): List of compiler include paths.
- [sourcePaths](#field-sourcepaths): List of globs to compile matching source file paths.
- [rebuildAll](#field-rebuildall): Incremental compilation override flag.
- [rebuildSourcePaths](#field-rebuildsourcepaths): List of globs to override incremental compilation for matching file paths.
- [outputPath](#field-outputpath): Directory path for output object files.

#### Action Specification (Link)

- [type](#field-type-action): "link"
- [name](#field-name-action): Action name string.
- [system](#field-system): [System](#system-specification) name.
- [nextAction](#field-nextaction): Action to run after this one, upon success.
- [nextActionFailure](#field-nextactionfailure): Action to run after this one, upon failure.
- [nextActionFinal](#field-nextactionfinal): Action to run after this one, unconditionally.
- [ignoreFailure](#field-ignorefailure): Flag to disregard action failure.
- [env](#field-env): Environment variables object.
- [cwd](#field-cwd): Current working directory path string.
- [linker](#field-linker): Linker command or executable.
- [linkArgs](#field-linkargs): List of linker arguments.
- [libraryPaths](#field-librarypaths): List of linker library search paths.
- [libraries](#field-libraries): List of libraries to link with.
- [objectPaths](#field-objectpaths): List of globs to link matching object files.
- [outputPath](#field-outputpath): File path for linker output.
- [outputBinaryName](#field-outputbinaryname): File name for linker output. (Add ".exe" on Windows.)

## Fields

### Field: allowActionCycles

Recognized on config objects: [Project](#project-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `boolean`  

Zebes allows for a form of control flow using config options such as [nextAction](#field-nextaction). Normally, Zebes will abort execution of a target if there is an attmpt to execute the same action more than once. This can indicate the presence of a loop, and is probably not something you should do intentionally.

However, if it is intentional, then you can force Zebes to continue execution regardless of action cycles by assigning this flag to true.

This setting can also be affected by the `--allow-action-cycles` CLI flag and the `ZEBES_PROJECT_ALLOW_ACTION_CYCLES` environment variable.

### Field: compileArgs

Recognized on config objects: [System](#system-specification), [Target](#target-specification), [Action](#action-specification).  
Resolution: [Additive List](#additive-list-resolution).  
Data type: `string[]`  

This setting affects the behavior of [compile actions](#action-specification-compile).

TODO

### Field: compileMakeRuleArg

Recognized on config objects: [System](#system-specification).  
Resolution: [System](#system-resolution).  
Data type: `string`  

This setting affects the behavior of [compile actions](#action-specification-compile).

TODO

### Field: compileOutputArg

Recognized on config objects: [System](#system-specification).  
Resolution: [System](#system-resolution).  
Data type: `string`  

This setting affects the behavior of [compile actions](#action-specification-compile).

TODO

### Field: compileOutputExt

Recognized on config objects: [System](#system-specification).  
Resolution: [System](#system-resolution).  
Data type: `string`  

This setting affects the behavior of [compile actions](#action-specification-compile).

TODO

### Field: compiler

Recognized on config objects: [System](#system-specification), [Target](#target-specification), [Action](#action-specification).  
Resolution: [Override](#override-resolution).  
Data type: `string`  

This setting affects the behavior of [compile actions](#action-specification-compile) and [link actions](#action-specification-link).

TODO

### Field: cwd

Recognized on config objects: [Project](#project-specification), [System](#system-specification), [Target](#target-specification), [Action](#action-specification).  
Resolution: [Relative Path](#relative-path-resolution).  
Data type: `string`  

TODO

### Field: env

Recognized on config objects: [Project](#project-specification), [System](#system-specification), [Target](#target-specification), [Action](#action-specification).  
Resolution: [Merged Object](#merged-object-resolution).  
Data type: `{[key: string]: string}`  

TODO

### Field: ignoreFailure

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `boolean`  

TODO

### Field: includePathArg

Recognized on config objects: [System](#system-specification).  
Resolution: [System](#system-resolution).  
Data type: `string`  

This setting affects the behavior of [compile actions](#action-specification-compile).

TODO

### Field: includePaths

Recognized on config objects: [System](#system-specification), [Target](#target-specification), [Action](#action-specification).  
Resolution: [Additive List](#additive-list-resolution).  
Data type: `string[]`  

This setting affects the behavior of [compile actions](#action-specification-compile).

TODO

### Field: includeSourcePatterns

Recognized on config objects: [System](#system-specification).  
Resolution: [System](#system-resolution).  
Data type: `string[]`  

This setting affects the behavior of [compile actions](#action-specification-compile).

TODO

### Field: incremental

Recognized on config objects: [Project](#project-specification), [System](#system-specification), [Target](#target-specification), [Action](#action-specification).  
Resolution: [Override](#override-resolution).  
Data type: `boolean`  

This setting affects the behavior of [compile actions](#action-specification-compile).

TODO

### Field: libraries

Recognized on config objects: [System](#system-specification), [Target](#target-specification), [Action](#action-specification).  
Resolution: [Additive List](#additive-list-resolution).  
Data type: `string[]`  

This setting affects the behavior of [link actions](#action-specification-link).

TODO

### Field: libraryArg

Recognized on config objects: [System](#system-specification).  
Resolution: [System](#system-resolution).  
Data type: `string`  

This setting affects the behavior of [link actions](#action-specification-link).

TODO

### Field: libraryPathArg

Recognized on config objects: [System](#system-specification).  
Resolution: [System](#system-resolution).  
Data type: `string`  

This setting affects the behavior of [link actions](#action-specification-link).

TODO

### Field: libraryPaths

Recognized on config objects: [System](#system-specification), [Target](#target-specification), [Action](#action-specification).  
Resolution: [Additive List](#additive-list-resolution).  
Data type: `string[]`  

This setting affects the behavior of [link actions](#action-specification-link).

TODO

### Field: linkArgs

Recognized on config objects: [System](#system-specification), [Target](#target-specification), [Action](#action-specification).  
Resolution: [Additive List](#additive-list-resolution).  
Data type: `string[]`  

This setting affects the behavior of [link actions](#action-specification-link).

TODO

### Field: linker

Recognized on config objects: [System](#system-specification), [Target](#target-specification), [Action](#action-specification).  
Resolution: [Override](#override-resolution).  
Data type: `string`  

This setting affects the behavior of [link actions](#action-specification-link).

TODO

### Field: linkOutputArg

Recognized on config objects: [System](#system-specification).  
Resolution: [System](#system-resolution).  
Data type: `string`  

This setting affects the behavior of [link actions](#action-specification-link).

TODO

### Field: name (Action)

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string`  

TODO

### Field: name (Target)

Recognized on config objects: [Target](#target-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string`  

TODO

### Field: name (System)

Recognized on config objects: [System](#system-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string`  

TODO

### Field: nextAction

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string | action`  

TODO

### Field: nextActionFailure

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string | action`  

TODO

### Field: nextActionFinal

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string | action`  

TODO

### Field: objectPaths

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string[]`  

This setting affects the behavior of [link actions](#action-specification-link).

TODO

### Field: outputBinaryName

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string`  

This setting affects the behavior of [link actions](#action-specification-link).

TODO

### Field: outputPath

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string`  

This setting affects the behavior of [compile actions](#action-specification-compile) and [link actions](#action-specification-link).

TODO

### Field: rebuildAll

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `boolean`  

This setting affects the behavior of [compile actions](#action-specification-compile).

TODO

### Field: rebuildSourcePaths

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string[]`  

This setting affects the behavior of [compile actions](#action-specification-compile).

TODO

### Field: removePaths

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string[]`  

This setting affects the behavior of [remove actions](#action-specification-remove).

TODO

### Field: sourcePaths

Recognized on config objects: [Action](#action-specification).  
Resolution: [Direct](#direct-resolution).  
Data type: `string[]`  

This setting affects the behavior of [compile actions](#action-specification-compile).

TODO

### Field: system

Recognized on config objects: [Project](#project-specification), [System](#system-specification), [Target](#target-specification), [Action](#action-specification).  
Resolution: [Override](#override-resolution).  
Data type: `string`  

TODO
