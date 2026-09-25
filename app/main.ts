import * as net from "net";

console.log("Logs from your program will appear here!");

type RespSimpleString = {
    type: "SimpleString";
    value: string;
};

type RespInteger = {
    type: "Integer";
    value: number;
};

type RespError = {
    type: "Error";
    value: string;
};

type RespBulkString = {
    type: "BulkString";
    value: string;
};

type RespArray = {
    type: "Array";
    value: RespValue[];
};

type RespValue =
    | RespSimpleString
    | RespInteger
    | RespError
    | RespBulkString
    | RespArray;
type ParseResult = {
    value: RespValue;
    nextIdx: number;
};

const recur_array = (value: RespValue, connection: net.Socket): void => {
    if (
        value.type === "SimpleString" ||
        value.type === "Error" ||
        value.type === "BulkString"
    ) {
        connection.write(Buffer.from(value.value));
        return;
    } else if (value.type === "Integer") {
        connection.write(Buffer.from(value.value.toString()));
        return;
    }
    for (let i = 0; i < value.value.length; i++) {
        recur_array(value.value[i], connection);
    }
};

const start_integer = (data: Buffer, idx: number): ParseResult | null => {
    let word: string = "";
    if (data[idx] === "-".charCodeAt(0)) {
        word += "-";
        idx++;
    } else if (data[idx] === "+".charCodeAt(0)) {
        idx++;
    } else if (data[idx] >= "0".charCodeAt(0) && data[idx] <= "9".charCodeAt(0)) {
        word += String.fromCharCode(data[idx]);
        idx++;
    }

    while (!(data[idx] === "\r".charCodeAt(0) && data[idx + 1] === "\n".charCodeAt(0))) {
        if (data.length === idx) {
            return null;
        }
        word += String.fromCharCode(data[idx]);
        idx++;
    }

    return {
        value: {
            type: "Integer",
            value: Number(word),
        },
        nextIdx: idx + 2,
    };
};

const start_plus = (data: Buffer, idx: number): ParseResult | null => {
    let word: string = "";
    while (
        !(data[idx] === "\r".charCodeAt(0) && data[idx + 1] === "\n".charCodeAt(0))) {
        if (data.length == idx) {
            break;
        }
        word += String.fromCharCode(data[idx]);
        idx++;
    }
    return {
        value: {
            type: "SimpleString",
            value: word,
        },
        nextIdx: idx + 2,
    };
};

const start_error = (data: Buffer, idx: number): ParseResult | null => {
    let word: string = "";
    while (!(data[idx] === "\r".charCodeAt(0) && data[idx + 1] === "\n".charCodeAt(0))) {
        if (data.length == idx) {
            return null;
        }
        word += String.fromCharCode(data[idx]);
        idx++;
    }
    return {
        value: {
            type: "Error",
            value: word,
        },
        nextIdx: idx + 2,
    };
};

const start_star = (data: Buffer, idx: number): ParseResult | null => {
    let word: string = "";
    let arr: RespValue[] = [];
    while (!(data[idx] === "\r".charCodeAt(0) && data[idx + 1] === "\n".charCodeAt(0))) {
        if (data.length == idx) {
            return null;
        }
        word += String.fromCharCode(data[idx]);
        idx++;
    }

    idx += 2;
    let num = Number(word);
    let result: ParseResult | null = null;
    while (num > 0) {
        switch (String.fromCharCode(data[idx])) {
            case "*":
                idx++;
                num--;
                result = start_star(data, idx);
                break;
            case "-":
                idx++;
                result = start_error(data, idx);
                break;
            case "+":
                idx++;
                result = start_plus(data, idx);
                break;
            case ":":
                idx++;
                console.log("여기작동되긴하나요?");
                result = start_integer(data, idx);
                break;
            case "$":
                result = start_dollar(data, idx);
                break;
        }
        if (result === null) {
            return null;
        } else {
            arr.push(result.value);
        }
        console.log(`전에 idx = ${idx}`);
        idx = result.nextIdx;
        console.log(`후에 idx = ${idx}`);
        // console.log(JSON.stringify(result?.value, null, 2));
        num--;
    }
    if (result === null) {
        return null;
    }

    return {
        value: {
            type: "Array",
            value: arr,
        },
        nextIdx: result.nextIdx + 2,
    };
};

const start_dollar = (data: Buffer, idx: number): ParseResult | null => {
    let word: string = "";
    idx++;
    while (!(data[idx] === "\r".charCodeAt(0) && data[idx + 1] === "\n".charCodeAt(0))) {
        if (data.length === idx) {
            return null;
        }
        word += String.fromCharCode(data[idx]);
        idx++;
    }
    idx += 2;
    let num = Number(word);
    word = "";
    while (num > 0) {
        if (data.length == idx) {
            return null;
        }
        word += String.fromCharCode(data[idx]);
        idx++;
        num--;
    }
    if (
        data[idx] === "\r".charCodeAt(0) &&
        data[idx + 1] === "\n".charCodeAt(0)
    ) {
        return {
            value: {
                type: "BulkString",
                value: word,
            },
            nextIdx: idx + 2,
        };
    }
    return null;
};

const server: net.Server = net.createServer((connection: net.Socket) => {
    connection.on("data", (data: Buffer) => {
        const testData: Buffer = Buffer.from("*2\r\n*2\r\n+123\r\n+123\r\n:-123\r\n");
        let idx: number = 0;
        const result = parseData(testData, idx);

        if (result === null) {
            connection.write(Buffer.from(""));
        } else if (typeof result.value === "string") {
            recur_array(result.value, connection);
        } else if (Array.isArray(result.value)) {
            recur_array(result.value, connection);
        }
    });
});

const parseData = (data: Buffer, idx: number): ParseResult | null => {
    let result: ParseResult | null = null;
    switch (data[idx]) {
        case "*".charCodeAt(0):
            idx++;
            result = start_star(data, idx);
            break;
        case "$".charCodeAt(0):
            result = start_dollar(data, idx);
            break;
        case "+".charCodeAt(0):
            idx++;
            result = start_plus(data, idx);
            break;
        case "-".charCodeAt(0):
            idx++;
            result = start_error(data, idx);
            break;
        case ":".charCodeAt(0):
            idx++;
            result = start_integer(data, idx);
            break;
        default:
            break;``
    }
    console.log(JSON.stringify(result?.value, null, 2));

    if (result !== null) {
        return result;
    }
    return null;
};

server.listen(6379, "127.0.0.1");
