/**
 * This is a utility module for conveniently reading and
 * writing data in gzipped JSON files.
 */

import * as fs from "fs";
import * as zlib from "zlib";

/**
 * Encode the input `data` object as JSON, gzip-compress it,
 * and then write the compressed data to `dataPath`.
 *
 * @param dataPath Write gzipped JSON to this file path.
 * @param data Encode and write this data object.
 */
export async function zbsGzipJsonWrite(dataPath: string, data: any): Promise<void> {
    const jsonData = JSON.stringify(data);
    const gzipData = zlib.gzipSync(jsonData);
    fs.writeFileSync(dataPath, gzipData);
}

/**
 * Read gzip-compressed data from `dataPath`, decompress it,
 * and then return the result of parsing the decompressed data
 * as JSON.
 *
 * @param dataPath Read gzipped JSON from this file path.
 * @returns A Promise which will resolve with the decoded data.
 */
export async function zbsGzipJsonRead(dataPath: string): Promise<any> {
    const gzipData = fs.readFileSync(dataPath);
    const jsonData = zlib.gunzipSync(gzipData);
    const data: any = JSON.parse(jsonData.toString("utf-8"));
    return data;
}
