import * as net from "net"

console.log("Logs from your program will appear here!");

type RespValue = string | RespValue[];
type ParseResult = {
    value: RespValue;
    nextIdx: number;
}

const recur_array = (
    value: RespValue,
    connection: net.Socket
): void => {
    if (typeof value === "string") {
        connection.write(Buffer.from(value));
        return;
    }
    for (let i = 0; i < value.length; i++) {
        recur_array(value[i], connection);
    }
}

const server: net.Server = net.createServer((connection: net.Socket) => {
    connection.on("data", (data: Buffer) => {

        const testData: Buffer = Buffer.from("+hello\r\n");

        let idx: number = 0;
        const result = parseData(testData, idx);
        if (result === null) {
            connection.write(Buffer.from(""));
        } else if (typeof result.value === "string") {
            connection.write(Buffer.from(result.value));
        }
        // } else if (Array.isArray(result.value)) {
        //     for (let i = 0; i < result.value.length; i++) {
        //         if (typeof result.value[i] === "string") {
        //             connection.write(Buffer.from(result.value[i]));
        //         } else if (Array.isArray(result.value[i])) {
        //             connection.write(Buffer.from(result.value[i]));
        //         }
        //         connection.write(Buffer.from("\r\n"));
        //     }
        // }
    });
});

const parseData = (
    data: Buffer,
    idx: number,
): ParseResult | null => {

    const arr: RespValue[] = [];
    while (idx < data.length) {
        if (data[idx] == '*'.charCodeAt(0)) {
            idx++;
            let num: number = 0;
            if (data[idx] < '0'.charCodeAt(0) ||
                data[idx] > '9'.charCodeAt(0)) {
                return null;
            }
            while (data[idx] >= '0'.charCodeAt(0) &&
            data[idx] <= '9'.charCodeAt(0)) {
                num = num * 10 + data[idx] - '0'.charCodeAt(0);
                idx++;
            }
            if (data[idx] === 13 && data[idx + 1] === 10) {
                idx += 2;
            } else {
                return null;
            }
            if (data[idx] === '*'.charCodeAt(0)) {
                parseData(data, idx)
            }
            arr.push()
        } else if (data[idx] == '$'.charCodeAt(0)) {

            let num: number = 0;
            let word: string = "";

            while (data[idx] >= '0'.charCodeAt(0) &&
            data[idx] <= '9'.charCodeAt(0)) {
                num = num * 10 + data[idx] - '0'.charCodeAt(0);
                idx++;
            }

            if (data[idx] === 13 && data[idx + 1] === 10) {
                idx += 2;
            } else {
                return null;
            }
            if (data[idx] == '*'.charCodeAt(0) ||
                data[idx] == ':'.charCodeAt(0) ||
                data[idx] == '$'.charCodeAt(0) ||
                data[idx] == '-'.charCodeAt(0) ||
                data[idx] == '+'.charCodeAt(0)) {
                return null;
            }
            while (num > 0) {
                word += String.fromCharCode(data[idx]);
                idx++;
                num--;
            }
        } else if (data[idx] == ':'.charCodeAt(0)) {

            let word: string = "";

            if (data[idx + 1] !== '+'.charCodeAt(0) && data[idx + 1] !== '-'.charCodeAt(0)) {
                idx++;
            } else if (data[idx + 1] == '-'.charCodeAt(0)) {
                word += '-';
                idx += 2;
            } else if (data[idx + 1] == '+'.charCodeAt(0)) {
                idx += 2;
            }

            while (data[idx] !== 13) {
                if (data[idx] >= '0'.charCodeAt(0) && data[idx] <= '9'.charCodeAt(0)) {
                    word += String.fromCharCode(data[idx]);
                } else {
                    return null;
                }
                idx++;
            }

            if (data[idx] === 10) {

            }
        } else if (data[idx] == '+'.charCodeAt(0)) {
            let word: string = "";
            while (data[idx] !== '\r'.charCodeAt(0) && data[idx + 1] !== '\n'.charCodeAt(0)) {
                word += String.fromCharCode(data[idx]);
                idx++;
            }
            return {
                value: word,
                nextIdx: idx
            };
        }
        idx++;
    }
    return null;
}

server.listen(6379, "127.0.0.1");
