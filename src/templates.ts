/**
 * This module contains Zebes project configuration templates,
 * to be written using `zebes init`.
 */

export const zbsInitProjectTemplateC = {
    "systems": [
        {
            "name": "c",
            "compiler": "gcc",
            "compileArgs": ["-c"],
            "compileMakeRuleArg": "-MM",
            "includePaths": ["include"],
            "libraryPaths": ["lib"],
            "libraries": []
        }
    ],
    "targets": [
        {
            "name": "build",
            "system": "c",
            "compileArgs": ["-std=c99"],
            "actions": [
                {
                    "type": "compile",
                    "sourcePaths": ["src/**/*.c"],
                    "outputPath": "build"
                },
                {
                    "type": "link",
                    "objectPaths": ["build/**/*.o"],
                    "outputBinaryName": "bin/main"
                }
            ]
        },
        {
            "name": "clean",
            "actions": [
                {
                    "type": "remove",
                    "removePaths": ["build/*", "bin/*"],
                }
            ]
        }
    ]
}

export const zbsInitProjectTemplateCpp = {
    "systems": [
        {
            "name": "c++",
            "compiler": "g++",
            "compileArgs": ["-c"],
            "compileMakeRuleArg": "-MM",
            "includePaths": ["include"],
            "libraryPaths": ["lib"],
            "libraries": []
        }
    ],
    "targets": [
        {
            "name": "build",
            "system": "c++",
            "compileArgs": ["-std=c++20"],
            "actions": [
                {
                    "type": "compile",
                    "sourcePaths": ["src/**/*.cpp", "src/**/*.hpp"],
                    "outputPath": "build"
                },
                {
                    "type": "link",
                    "objectPaths": ["build/**/*.o"],
                    "outputBinaryName": "bin/main"
                }
            ]
        },
        {
            "name": "clean",
            "actions": [
                {
                    "type": "remove",
                    "removePaths": ["build/*", "bin/*"],
                }
            ]
        }
    ]
}

export const zbsInitProjectTemplateD = {
    "systems": [
        {
            "name": "d",
            "compiler": "dmd",
            "compileArgs": ["-c"], // -i only for single step build
            "includePaths": [],
            "libraryPaths": [],
            "libraries": [],
            "compileOutputExt": ".obj",
            "compileOutputArg": "-of",
            "linkOutputArg": "-of",
            "libraryPathArg": "-L-L",
            "libraryArg": "-L-l",
            "importSourceExt": [".d", ".di"],
            "importSourcePatterns": [
                "import\\s+([a-zA-Z0-9]+\\s*=\\s*)?(?<name>[a-zA-Z0-9_\\.]+)\\s*[:;]",
            ]
        }
    ],
    "targets": [
        {
            "name": "build",
            "system": "d",
            "actions": [
                {
                    "type": "compile",
                    "includePaths": ["src"],
                    "sourcePaths": ["src/**/*.d"],
                    "outputPath": "build"
                },
                {
                    "type": "link",
                    "objectPaths": ["build/**/*.obj"],
                    "outputBinaryName": "bin/main"
                }
            ]
        },
        {
            "name": "clean",
            "actions": [
                {
                    "type": "remove",
                    "removePaths": ["build/*", "bin/*"],
                }
            ]
        }
    ]
}

export const zbsInitProjectTemplates: {[name: string]: {[key: string]: any}} = {
    "c": zbsInitProjectTemplateC,
    "cpp": zbsInitProjectTemplateCpp,
    "d": zbsInitProjectTemplateD,
};
