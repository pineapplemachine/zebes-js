/**
 * Evaluate all the promises, but only allow up to `limit` promises to
 * be actively running at once.
 * 
 * @param limit Allow no more than this many promise tasks to be running
 * at once.
 * @param promises The list of promises to resolve, provided as a list
 * of functions that produce promises.
 * @param resultCallback Invoke this function once for every successful result.
 * @param errorCallback Invoke this function once for every promise rejection.
 * @param settle When true, every promise will be evaluated. When false,
 * evaluation will stop after the first rejection.
 */
export function zbsPromiseAllLimit<T>(
    limit: number,
    promises: (() => Promise<T>)[],
    resultCallback?: null | ((result: T, index: number) => any),
    errorCallback?: null | ((error: any, index: number) => any),
    settle: boolean = false,
): Promise<void> {
    let promisesIndex: number = 0;
    let countFinished: number = 0;
    let rejected: boolean = false;
    let anyError: boolean = false;
    let firstError: any = undefined;
    return new Promise<void>((resolve, reject) => {
        function startNext() {
            if(promisesIndex < promises.length && (settle || !anyError)) {
                startIndex(promisesIndex++);
            }
            else if(countFinished >= promises.length) {
                if(!anyError) {
                    resolve();
                }
                else if(!rejected) {
                    reject(firstError);
                    rejected = true;
                }
            }
        }
        function startIndex(index: number) {
            const promise = promises[index]();
            promise.then((result: T) => {
                countFinished++;
                if(resultCallback) {
                    resultCallback(result, index);
                }
                startNext();
            }).catch((error: any) => {
                if(errorCallback) {
                    errorCallback(error, index);
                }
                if(!anyError) {
                    if(!settle) {
                        reject(error);
                    }
                    anyError = true;
                    firstError = error;
                }
            });
        }
        for(let i = 0; i < limit; i++) {
            startNext();
        }
    });
}

export function zbsPromiseAllLimitSettle<T>(
    limit: number,
    promises: (() => Promise<T>)[],
    resultCallback?: null | ((result: T, index: number) => any),
    errorCallback?: null | ((error: any, index: number) => any),
) {
    return zbsPromiseAllLimit(limit, promises, resultCallback, errorCallback, true);
}
