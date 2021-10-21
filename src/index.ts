#!/usr/bin/env node

// @ts-ignore
import * as sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import {zbsCliMain} from "./cli";

zbsCliMain().then((statusCode) => {
    process.exit(statusCode);
}).catch((error: any) => {
    if(error) {
        console.log(error);
    }
    process.exit(1);
});
