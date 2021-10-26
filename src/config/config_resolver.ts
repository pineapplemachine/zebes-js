import * as path from "path";

import {ZbsConfigProject} from "./config_types";
import {ZbsConfigSystem} from "./config_types";
import {ZbsConfigTarget} from "./config_types";
import {ZbsConfigAction} from "./config_types";

export class ZbsConfigResolver {
    project: ZbsConfigProject | undefined;
    system: ZbsConfigSystem | undefined;
    target: ZbsConfigTarget | undefined;
    action: ZbsConfigAction | undefined;
    
    constructor(
        project?: ZbsConfigProject | undefined,
        system?: ZbsConfigSystem | undefined,
        target?: ZbsConfigTarget | undefined,
        action?: ZbsConfigAction | undefined,
    ) {
        this.project = project;
        this.system = system;
        this.target = target;
        this.action = action;
    }

    get<T>(key: string, fallback?: T): T | undefined {
        const project = <any> this.project;
        const system = <any> this.system;
        const target = <any> this.target;
        const action = <any> this.action;
        if(action && action[key] !== undefined) {
            return action[key];
        }
        else if(system && system[key] !== undefined) {
            return system[key];
        }
        else if(target && target[key] !== undefined) {
            return target[key];
        }
        else if(project && project[key] !== undefined) {
            return project[key];
        }
        else {
            return fallback;
        }
    }
    
    getPath(key: string, basePath: string): string {
        const project = <any> this.project;
        const system = <any> this.system;
        const target = <any> this.target;
        const action = <any> this.action;
        let result: string = basePath;
        if(project && project[key]) {
            basePath = path.resolve(result, String(project[key]));
        }
        if(target && target[key]) {
            basePath = path.resolve(result, String(target[key]));
        }
        if(system && system[key]) {
            basePath = path.resolve(result, String(system[key]));
        }
        if(action && action[key]) {
            basePath = path.resolve(result, String(action[key]));
        }
        return result;
    }

    getListAdditive<T>(key: string): T[] {
        const list: T[] = [];
        const project = <any> this.project;
        const system = <any> this.system;
        const target = <any> this.target;
        const action = <any> this.action;
        if(project && key in project && Array.isArray(project[key])) {
            list.push(...project[key]);
        }
        if(system && key in system && Array.isArray(system[key])) {
            list.push(...system[key]);
        }
        if(target && key in target && Array.isArray(target[key])) {
            list.push(...target[key]);
        }
        if(action && key in action && Array.isArray(action[key])) {
            list.push(...action[key]);
        }
        return list;
    }

    getObjectAdditive<T>(key: string): {[key: string]: T} {
        const object: {[key: string]: T} = {};
        const project = <any> this.project;
        const system = <any> this.system;
        const target = <any> this.target;
        const action = <any> this.action;
        if(project && project[key] && typeof(project[key]) === "object") {
            Object.assign(object, project[key]);
        }
        if(system && system[key] && typeof(system[key]) === "object") {
            Object.assign(object, system[key]);
        }
        if(target && target[key] && typeof(target[key]) === "object") {
            Object.assign(object, target[key]);
        }
        if(action && action[key] && typeof(action[key]) === "object") {
            Object.assign(object, action[key]);
        }
        return object;
    }
}
