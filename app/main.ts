import * as net from "net"

console.log("Logs from your program will appear here!");


type RespSimpleString = {
    type: "SimpleString",
    value: string,
}

type RespInteger = {
    type: "Integer",
    value: number,
}

type RespError = {
    type: "Error",
    value: string,
}

type RespBulkString = {
    type: "BulkString",
    value: string,
}

type RespArray = {
    type: "Array",
    value: RespValue[],
}

type RespValue = RespSimpleString | RespInteger | RespError | RespBulkString | RespArray;
type ParseResult = {
    value: RespValue;
    nextIdx: number;
}

const recur_array = (
    value: RespValue,
    connection: net.Socket
): void => {
    if (value.type === "SimpleString" ||
        value.type === "Error" ||
        value.type === "BulkString") {
        connection.write(Buffer.from(value.value));
        return;
    } else if (value.type === "Integer") {
        connection.write(Buffer.from(value.value.toString()));
        return;
    }
    for (let i = 0; i < value.value.length; i++) {
        recur_array(value.value[i], connection);
    }
}

const start_integer = (
    data: Buffer,
    idx: number,
): ParseResult | null => {
    let word: string = "";
    if (data[idx] === '-'.charCodeAt(0)) {
        word += "-";
        idx++;
    } else if (data[idx] === '+'.charCodeAt(0)) {
        idx++;
    } else if (data[idx] >= '0'.charCodeAt(0) && data[idx] <= '9'.charCodeAt(0)) {
        word += String.fromCharCode(data[idx]);
        idx++;
    }

    while (!(data[idx] === '\r'.charCodeAt(0) && data[idx + 1] === '\n'.charCodeAt(0))) {
        if (data.length == idx) {
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
}

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
        value: {
            type: "SimpleString",
            value: word,
        },
        nextIdx: idx + 2,
    };
}

const start_error = (
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
        value: {
            type: "Error",
            value: word,
        },
        nextIdx: idx + 2,
    };
}

const start_star = (
    data: Buffer,
    idx: number,
): ParseResult | null => {
    let word: string = "";
    let arr: RespValue[] = [];
    while (!(data[idx] === '\r'.charCodeAt(0) && data[idx + 1] === '\n'.charCodeAt(0))) {
        if (data.length == idx) {
            return null;
        }
        word += String.fromCharCode(data[idx]);
        idx++;
    }
    let num = Number(word);
    while (!(data[idx] === '\r'.charCodeAt(0) && data[idx + 1] === '\n'.charCodeAt(0))) {
        if (data.length == idx) {
            return null;
        }
        word += String.fromCharCode(data[idx]);
        idx++;
        num--;
    }
    return {
        value: {
            type: "Array",
            value: arr,
        },
        nextIdx: idx + 2,
    };
}

const start_dollar = (
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

    let num = Number(word);
    while (num > 0 && !(data[idx] === '\r'.charCodeAt(0) && data[idx + 1] === '\n'.charCodeAt(0))) {
        if (data.length == idx) {
            return null;
        }
        word += String.fromCharCode(data[idx]);
        idx++;
        num--;
    }

    // 문자열을 숫자로 바꾼다. Number 함수 사용
    return {
        value: {
            type: "BulkString",
            value: word,
        },
        nextIdx: idx + 2,
    };
}

const server: net.Server = net.createServer((connection: net.Socket) => {
    connection.on("data", (data: Buffer) => {
        const testData: Buffer = Buffer.from("-DDD\r\n");
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

const parseData = (
    data: Buffer,
    idx: number,
): ParseResult | null => {

    let result: ParseResult | null = null;
    switch (data[idx]) {
        case "*".charCodeAt(0):
            idx++;

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
    console.log(JSON.stringify(result));

    if (result !== null && result.nextIdx !== idx) {
        return parseData(data, result.nextIdx);
    }
    if (result !== null) {
        return result;
    }
    return null;
}

server.listen(6379, "127.0.0.1");
