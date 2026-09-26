import type {ParseResult, RespValue} from "./resp.ts";

export const parseData = (data: Buffer, idx: number): ParseResult | null => {
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
