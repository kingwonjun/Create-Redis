import * as net from "net";

console.log("Logs from your program will appear here!");

type RespSimpleString = {
    type: "SimpleString";
    value: string;
};

type RespInteger = {
    type: "Integer";
    value: string;
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

const encodeResp = (value: RespValue | string): string => {

    let word: string = "";

    if (typeof value === "string") {
        word += "$";
        word += value.length.toString();
        word += "\r\n";
        word += value;
        word += "\r\n";
    } else {
        if (value.value === "PING") {
            word += "+";
            word += "PONG";
            word += "\r\n";
        } else if (value.type === "BulkString") {
            word += "$";
            word += value.value.length.toString();
            word += "\r\n";
            word += value.value;
            word += "\r\n";
        }
    }

    return word;
}

const getString = (value: RespValue): string | null => {
    if (typeof value.value === "string") {
        return value.value;
    }
    return null;
}

const handleCommand = (result: ParseResult, connection: net.Socket, store: Map<string, string>): void => {

    if (result.value.type === "Array" && result.value.value[0].type === "BulkString") {
        if (result.value.value[0].value.toLowerCase() === "ping") {
            console.log("1");
            connection.write(encodeResp(result.value.value[0]));
        } else if (result.value.value[0].value.toLowerCase() === "echo") {
            connection.write(encodeResp(result.value.value[1]));
        } else if (result.value.value[0].value.toLowerCase() === "set") {
            const key = getString(result.value.value[1]);
            const value = getString(result.value.value[2]);
            if (key !== null && value !== null) {
                store.set(key, value);
                connection.write(Buffer.from("+OK\r\n"));
            }
        } else if (result.value.value[0].value.toLowerCase() === "get") {
            const key = getString(result.value.value[1]);
            let value : string | undefined;
            if (key !== null) {
                 value = store.get(key);
            }
            if (key !== null && value === undefined) {
                console.log("여기가 왜되는거야?")
                connection.write(Buffer.from("$-1\r\n"));
            }  else if (key !== null && typeof value === "string") {
                connection.write(encodeResp(value));
            }
        }
    }
}

const server: net.Server = net.createServer((connection: net.Socket) => {
    connection.on("data", (data: Buffer) => {

        const store = new Map<string, string>;
        const result = parseData(data, 0)
        if (result === null) {
            return;
        }
        if (result.value.type === "Array") {
            handleCommand(result, connection, store);
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
            value: word,
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
