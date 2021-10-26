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
            console.log(message, ...rest.map(
                (value) => (typeof(value) === "function" ? value() : value)
            ));
        }
    }
    
    write(level: number, message: any, ...rest: any[]) {
        if(level >= this.level) {
            process.stdout.write(message);
            for(const value of rest) {
                process.stdout.write(" ");
                process.stdout.write(
                    typeof(value) === "function" ? value() : value
                );
            }
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
    
    writeInfo(message: any, ...rest: any[]) {
        return this.write(ZbsLogLevel.Info, message, ...rest);
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
    
    progress(current: number, total: number) {
    }
}
