import * as path from "path";

import {ZbsConfigAction} from "./config_types";
import {ZbsConfigHome} from "./config_types";
import {ZbsConfigProject} from "./config_types";
import {ZbsConfigSystem} from "./config_types";
import {ZbsConfigTarget} from "./config_types";

export class ZbsConfigResolver {
    home: ZbsConfigHome | undefined;
    project: ZbsConfigProject | undefined;
    system: ZbsConfigSystem | undefined;
    target: ZbsConfigTarget | undefined;
    action: ZbsConfigAction | undefined;
    
    constructor(
        home?: ZbsConfigHome | undefined,
        project?: ZbsConfigProject | undefined,
        system?: ZbsConfigSystem | undefined,
        target?: ZbsConfigTarget | undefined,
        action?: ZbsConfigAction | undefined,
    ) {
        this.home = home
        this.project = project;
        this.system = system;
        this.target = target;
        this.action = action;
    }

    get<T>(key: string, fallback?: T): T | undefined {
        if(this.action && (<any> this.action)[key] !== undefined) {
            return (<any> this.action)[key];
        }
        else if(this.system && (<any> this.system)[key] !== undefined) {
            return (<any> this.system)[key];
        }
        else if(this.target && (<any> this.target)[key] !== undefined) {
            return (<any> this.target)[key];
        }
        else if(this.project && (<any> this.project)[key] !== undefined) {
            return (<any> this.project)[key];
        }
        else if(this.home && (<any> this.home)[key] !== undefined) {
            return (<any> this.home)[key];
        }
        else {
            return fallback;
        }
    }
    
    getPath(key: string, basePath: string): string {
        let result: string = basePath;
        if(this.home && (<any> this.home)[key]) {
            result = path.resolve(result, String((<any> this.home)[key]));
        }
        if(this.project && (<any> this.project)[key]) {
            result = path.resolve(result, String((<any> this.project)[key]));
        }
        if(this.target && (<any> this.target)[key]) {
            result = path.resolve(result, String((<any> this.target)[key]));
        }
        if(this.system && (<any> this.system)[key]) {
            result = path.resolve(result, String((<any> this.system)[key]));
        }
        if(this.action && (<any> this.action)[key]) {
            result = path.resolve(result, String((<any> this.action)[key]));
        }
        return result;
    }

    getListAdditive<T>(key: string): T[] {
        const list: T[] = [];
        const home = <any> this.home;
        const project = <any> this.project;
        const system = <any> this.system;
        const target = <any> this.target;
        const action = <any> this.action;
        if(home && key in home && Array.isArray(home[key])) {
            list.push(...home[key]);
        }
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
        const home = <any> this.home;
        const project = <any> this.project;
        const system = <any> this.system;
        const target = <any> this.target;
        const action = <any> this.action;
        if(home && home[key] && typeof(home[key]) === "object") {
            Object.assign(object, home[key]);
        }
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
