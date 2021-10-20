#!/usr/bin/env node

// @ts-ignore
import * as sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import {zbsMain} from "./cli";

zbsMain().then(() => {
    process.exit(0);
}).catch((error: any) => {
    if(error) {
        console.log(error);
    }
    process.exit(1);
});
