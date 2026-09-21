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

const start_star = {}

const start_plus = (
    data: Buffer,
    idx: number,
): ParseResult | null => {
    let word: string = "";
    while (!(data[idx] === '\r'.charCodeAt(0) && data[idx + 1] === '\n'.charCodeAt(0))) {
        if (data.length == idx) {
            return null;
        }
        word += String.fromCharCode(data[idx]);
        idx++;
    }
    return {
        value: word,
        nextIdx: idx + 2,
    };
}

const server: net.Server = net.createServer((connection: net.Socket) => {
    connection.on("data", (data: Buffer) => {

        const testData: Buffer = Buffer.from("+abc\r\n");

        let idx: number = 0;
        const result = parseData(testData, idx);
        if (result === null) {
            connection.write(Buffer.from(""));
        } else if (typeof result.value === "string") {
            recur_array(result.value, connection);
        } else if (Array.isArray(result.value)) {
            recur_array(result.value, connection);
        }

        // *2로 센다음 다시 *표시가 나올때 각각의 배열이 2개이상 나올수 있다.
        // 세는 도중에는 $가 나왔을경우 \r\n이 지나고 $값만큼 세고 \r\n 이걸 하나로 봐야된다.
    });
});

const parseData = (
    data: Buffer,
    idx: number,
): ParseResult | null => {

    let result : ParseResult | null = null;
    switch (data[idx]) {
        case "*".charCodeAt(0):
            idx++;
            break;
        case "$".charCodeAt(0):
            idx++;
            break;
        case "+".charCodeAt(0):
            idx++;
            result = start_plus(data, idx)
            break;
        case "-".charCodeAt(0):
            idx++;
            break;
        case ":".charCodeAt(0):
            idx++;
            break;
        default:
            break;
    }
    if (result !== null) {
        return result;
    }
    return null;
}

server.listen(6379, "127.0.0.1");
