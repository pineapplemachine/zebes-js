import * as child_process from "child_process";

export function zbsProcessExec(
    command: string,
    options: any,
    callbacks?: {
        stdout?: (data: string) => any
        stderr?: (data: string) => any
    }
): Promise<number> {
    return new Promise((resolve, reject) => {
        const child: any = child_process.exec(command, options);
        if(callbacks && callbacks.stdout) {
            child.stdout.on("data", callbacks.stdout);
        }
        if(callbacks && callbacks.stderr) {
            child.stderr.on("data", callbacks.stderr);
        }
        child.on("close", resolve);
    });
}

export function zbsProcessSpawn(
    command: string,
    args: string[],
    options: any,
    callbacks?: {
        stdout?: (data: string) => any
        stderr?: (data: string) => any
    }
): Promise<number> {
    return new Promise((resolve, reject) => {
        const child: any = child_process.spawn(command, args, options);
        if(callbacks && callbacks.stdout) {
            child.stdout.on("data", callbacks.stdout);
        }
        if(callbacks && callbacks.stderr) {
            child.stderr.on("data", callbacks.stderr);
        }
        child.on("close", resolve);
    });
}
