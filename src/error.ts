export class ZbsError extends Error {
    isZbsError: boolean = true;
    
    constructor(message: string) {
        super(message);
    }
}
