export const zbsInitProjectTemplateC = {
    "systems": [
        {
            "name": "c",
            "compiler": "gcc",
            "compileArgs": ["-c"],
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
                    "outputPath": "bin/main.exe"
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
                    "outputPath": "bin/main.exe"
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
            "compileArgs": ["-c"],
            "includePaths": ["include"],
            "libraryPaths": ["lib"],
            "libraries": []
        }
    ],
    "targets": [
        {
            "name": "build",
            "system": "d",
            "actions": [
                {
                    "type": "compile",
                    "sourcePaths": ["src/**/*.d"],
                    "outputPath": "build"
                },
                {
                    "type": "link",
                    "objectPaths": ["build/**/*.o"],
                    "outputPath": "bin/main.exe"
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
