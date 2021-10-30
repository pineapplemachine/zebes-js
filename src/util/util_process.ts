import * as child_process from "child_process";

export function zbsProcessExec(
    command: string,
    options: child_process.ExecOptions,
    callbacks?: {
        stdout?: (data: Buffer) => any,
        stderr?: (data: Buffer) => any,
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
    options: child_process.SpawnOptions,
    callbacks?: {
        stdout?: (data: Buffer) => any,
        stderr?: (data: Buffer) => any,
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

export async function zbsProcessSpawnDump(
    command: string, args: string[], options: any
): Promise<{statusCode: number, stdout: string, stderr: string}> {
    const stdoutData: string[] = [];
    const stderrData: string[] = [];
    const statusCode = await zbsProcessSpawn(command, args, options, {
        stdout: (data) => stdoutData.push(data.toString()),
        stderr: (data) => stderrData.push(data.toString()),
    });
    return {
        statusCode: statusCode,
        stdout: stdoutData.join(""),
        stderr: stderrData.join(""),
    };
}
