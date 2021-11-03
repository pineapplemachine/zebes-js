import * as fs from "fs";
import * as path from "path";

import {ZbsProjectActionRunner} from "../action_runner";
import {ZbsProjectActionRunnerOptions} from "../action_runner";
import {ZbsConfigAction} from "../config/config_types";
import {ZbsConfigActionAssert} from "../config/config_types";
import {zbsIsActionAssert} from "../config/config_types";

async function assertPathsExist(cwd: string, args: string[]) {
    const errors: string[] = [];
    for(const arg of args) {
        const argPath = path.resolve(cwd, arg);
        if(!fs.existsSync(argPath)) {
            errors.push("Path does not exist: " + argPath);
        }
    }
    return errors;
}

async function assertFilesExist(cwd: string, args: string[]) {
    const errors: string[] = [];
    for(const arg of args) {
        const argPath = path.resolve(cwd, arg);
        if(!fs.existsSync(argPath)) {
            errors.push("Path does not exist: " + argPath);
        }
        else {
            const stat = fs.statSync(argPath);
            if(stat.isDirectory()) {
                errors.push("Path is not a file: " + argPath);
            }
        }
    }
    return errors;
}

async function assertFilesEqual(cwd: string, args: string[]) {
    if(args.length <= 1) {
        return undefined;
    }
    const existErrors = await assertFilesExist(cwd, args);
    if(existErrors) {
        return existErrors;
    }
    const firstArgPath = path.resolve(cwd, args[0]);
    const firstArgContent = fs.readFileSync(firstArgPath);
    const errors: string[] = [];
    for(let i = 1; i < args.length; i++) {
        const argPath = path.resolve(cwd, args[i]);
        const argContent = fs.readFileSync(argPath);
        if(!firstArgContent.equals(argContent)) {
            errors.push(
                `File contents are not equal: ` +
                `${firstArgPath} and ${argPath}`
            );
        }
    }
    return errors;
}

export type AssertionMapType = {
    [name: string]: (
        (cwd: string, args: string[]) => Promise<string[] | undefined>
    ),
};

export const AssertionMap: AssertionMapType = {
    "paths_exist": assertPathsExist,
    "files_exist": assertFilesExist,
    "files_equal": assertFilesEqual,
};

export class ZbsProjectActionAssertRunner extends ZbsProjectActionRunner {
    static matchActionConfig(action: ZbsConfigAction): boolean {
        return zbsIsActionAssert(action);
    }
    
    constructor(options: ZbsProjectActionRunnerOptions) {
        super(options);
    }
    
    get action(): ZbsConfigActionAssert {
        if(!zbsIsActionAssert(this.actionConfig)) {
            throw new Error("Internal error: Action type inconsistency.");
        }
        return this.actionConfig;
    }
    
    assertFailure(index: number, message: any) {
        const preface = () => `Assert failure at assertion index ${index}:`;
        if(this.project.dryRun) {
            this.logger.info("Dry-run:", preface, message);
        }
        else {
            this.logger.error(preface, message);
            this.failed = true;
        }
    }
    
    async runType(): Promise<void> {
        const cwd = this.getConfigCwd();
        for(let i = 0; i < this.action.assertions.length; i++) {
            const assertion = this.action.assertions[i];
            const assertFunction = AssertionMap[assertion[0]];
            if(!assertFunction) {
                this.logger.error(() => (
                    `Assert failure at assertion index ${i}. ` +
                    `Unknown assertion name: ` +
                    JSON.stringify(assertion[0])
                ));
                this.failed = true;
                continue;
            }
            let assertErrors: string[] | undefined = undefined;
            try {
                assertErrors = await assertFunction(cwd, assertion.slice(1));
            }
            catch(error) {
                this.assertFailure(i, error);
            }
            if(Array.isArray(assertErrors) && assertErrors.length) {
                for(const error of assertErrors) {
                    this.assertFailure(i, error);
                }
            }
        }
    }
}

ZbsProjectActionRunner.AddRunnerType(ZbsProjectActionAssertRunner);
