export enum ZbsLogLevel {
    Trace = 0,
    Debug = 10,
    Info = 20,
    Warn = 30,
    Error = 40,
    Critical = 50,
}

export class ZbsLogger {
    level: number;
    
    constructor(level: number = 0) {
        this.level = level;
    }
    
    log(level: number, message: any, ...rest: any[]) {
        if(level >= this.level) {
            console.log(message, ...rest);
        }
    }
    
    trace(message: any, ...rest: any[]) {
        return this.log(ZbsLogLevel.Trace, "Trace:", message, ...rest);
    }
    
    debug(message: any, ...rest: any[]) {
        return this.log(ZbsLogLevel.Debug, "Debug:", message, ...rest);
    }
    
    info(message: any, ...rest: any[]) {
        return this.log(ZbsLogLevel.Info, message, ...rest);
    }
    
    warn(message: any, ...rest: any[]) {
        return this.log(ZbsLogLevel.Warn, "Warning:", message, ...rest);
    }
    
    error(message: any, ...rest: any[]) {
        return this.log(ZbsLogLevel.Error, "Error:", message, ...rest);
    }
    
    critical(message: any, ...rest: any[]) {
        return this.log(ZbsLogLevel.Critical, "Critical:", message, ...rest);
    }
}
