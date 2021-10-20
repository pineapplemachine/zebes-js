import * as readline from "readline";
import * as stream from "stream";

export class ZbsPrompt {
    interface: readline.Interface;
    
    constructor(
        input: stream.Readable = process.stdin,
        output: stream.Writable = process.stdout,
    ) {
        this.interface = readline.createInterface({
            input: input,
            output: output,
        });
    }
    
    text(prompt: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.interface.question(prompt, resolve);
        });
    }
    
    async confirm(prompt: string, defaultResult?: boolean): Promise<boolean> {
        const yn = (
            defaultResult === undefined ? "[y/n]" :
            (defaultResult ? "[Y/n]" : "[y/N]")
        );
        while(true) {
            const result = await this.text(prompt + " " + yn + " ");
            const resultLower = result.toLowerCase();
            if(resultLower === "y" || resultLower === "yes") {
                return true;
            }
            else if(resultLower === "n" || resultLower === "no") {
                return false;
            }
            else if(!resultLower && defaultResult !== undefined) {
                return defaultResult;
            }
        }
    }
}
