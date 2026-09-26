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

const encodeResp = (value: RespValue): string => {

    let word: string = "";

    if (value.value === "ping") {
        word += "$";
        word += value.value.length.toString();
        word += "\r\n";
        word += "PONG";
        word += "\r\n";
    }
    else if (value.type === "BulkString") {
        word += "$";
        word += value.value.length.toString();
        word += "\r\n";
        word += value.value;
        word += "\r\n";
    }

    return word;
}

const handleCommand = (result: ParseResult, connection: net.Socket) : void => {

    if (result.value.type === "Array" && result.value.value[0].type === "BulkString") {
        if (result.value.value[0].value.toLowerCase() === "ping") {
            connection.write(encodeResp(result.value.value[1]));
        }
        else if (result.value.value[0].value.toLowerCase() === "echo") {
            connection.write(encodeResp(result.value.value[1]));
        }
    }
}

const server: net.Server = net.createServer((connection: net.Socket) => {
    connection.on("data", (data: Buffer) => {
        // const testData: Buffer = Buffer.from("*3\r\n:+123\r\n$5\r\n1\r234\r\n-dddd\r\n");
        let idx: number = 0;
        const result = parseData(data, idx)
        if (result === null) {
            return;
        }
        if (result.value.type === "Array") {
            console.log(result.value.value[0].value)
            handleCommand(result, connection);
        }
    });
});

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
                // num--;
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
        idx = result.nextIdx;
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
        nextIdx: result.nextIdx,
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
            break;
    }

    if (result !== null) {
        return result;
    }
    return null;
};

server.listen(6379, "127.0.0.1");
