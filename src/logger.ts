export const ZbsLoggerProgressLength: number = 24;

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
    currentProgress: ZbsLoggerProgress | undefined;
    
    constructor(level: number = 0) {
        this.level = level;
        this.currentProgress = undefined;
    }
    
    log(level: number, message: any, ...rest: any[]) {
        if(level >= this.level) {
            if(this.currentProgress) {
                this.currentProgress.interrupt();
            }
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
    
    progress(message: string, total: number): ZbsLoggerProgress {
        return new ZbsLoggerProgress(this, message, total);
    }
}

export class ZbsLoggerProgress {
    logger: ZbsLogger;
    message: string;
    total: number;
    progress: number;
    interrupted: boolean;
    
    constructor(
        logger: ZbsLogger,
        message: string,
        total: number,
        progress?: number,
    ) {
        this.logger = logger;
        this.message = message;
        this.total = total;
        this.progress = progress || 0;
        this.interrupted = false;
    }
    
    get done(): boolean {
        return this.progress >= this.total;
    }
    
    begin(message?: string) {
        if(this.progress && !this.done && !this.interrupted) {
            this.interrupt("Restarted");
        }
        if(this.logger.currentProgress && this.logger.currentProgress !== this) {
            this.logger.currentProgress.interrupt();
            this.logger.currentProgress = this;
        }
        this.logger.writeInfo(this.message || message || "Progress", ">| ");
        this.progress = 0;
        this.interrupted = false;
    }
    
    update(progress: number) {
        if(this.done || progress <= this.progress) {
            return;
        }
        else if(this.interrupted) {
            this.resume();
        }
        else if(progress >= this.total) {
            this.finish(progress);
        }
        else {
            const lastLength = Math.floor(
                this.progress / this.total * ZbsLoggerProgressLength
            );
            const newLength = Math.floor(
                progress / this.total * ZbsLoggerProgressLength
            );
            for(let i = lastLength; i < newLength; i++) {
                this.logger.writeInfo("#");
            }
            this.progress = progress;
        }
    }
    
    increment(addProgress: number) {
        return this.update(this.progress + addProgress);
    }
    
    finish(progress?: number | undefined) {
        if(this.progress >= this.total) {
            return;
        }
        const lastLength = Math.floor(
            this.progress / this.total * ZbsLoggerProgressLength
        );
        for(let i = lastLength; i < ZbsLoggerProgressLength; i++) {
            this.logger.writeInfo("#");
        }
        this.logger.writeInfo(" | 100%\n");
        this.progress = progress !== undefined ? progress : this.total;
        if(this.logger.currentProgress === this) {
            this.logger.currentProgress = undefined;
        }
    }
    
    interrupt(message?: string) {
        if(this.done || this.interrupted) {
            return;
        }
        this.logger.writeInfo("|", message || "Interrupted");
        this.logger.writeInfo("\n");
        this.interrupted = true;
    }
    
    resume(message?: string) {
        if(!this.interrupted) {
            return;
        }
        this.logger.writeInfo(this.message || message || "Progress", ">| ");
        this.interrupted = false;
        if(this.progress >= this.total) {
            this.finish(this.progress);
        }
        else {
            const length = Math.floor(
                this.progress / this.total * ZbsLoggerProgressLength
            );
            for(let i = 0; i < length; i++) {
                this.logger.writeInfo("#");
            }
        }
    }
}
