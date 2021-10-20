require("source-map-support").install();

import {strict as assert} from "assert";
import * as fs from "fs";

import {Group as CanaryGroup} from "canary-test";

export const canary = CanaryGroup("@pinemach/csv");
export default canary;

canary.test("Write empty CSV", async function() {
    // placeholder
});
