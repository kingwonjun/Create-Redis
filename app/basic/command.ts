import net from "net";
import type {ParseResult, RespValue, StoreValue} from "./resp.ts";

const encodeResp = (value: RespValue | StoreValue | string): string => {

    let word: string = "";
    if (typeof value === "string") {
        word += "$";
        word += value.length.toString();
        word += "\r\n";
        word += value;
        word += "\r\n";
    } else {
        if ("type" in value && value.type === "BulkString") {
            word += "$";
            word += value.value.length.toString();
            word += "\r\n"
            word += value.value;
            word += "\r\n";
        } else if ("expiresAt" in value) {
            if (value.expiresAt === null || Date.now() < value.expiresAt) {
                word += "$";
                word += value.value.length.toString();
                word += "\r\n"
                word += value.value;
                word += "\r\n";
            } else {
                return "$-1\r\n";
            }
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

export const handleCommand = (result: ParseResult, connection: net.Socket, store: Map<string, StoreValue>, arrayList: Map<string, string[]>): void => {

    if (result.value.type === "Array" && result.value.value[0].type === "BulkString") {
        const [command, ...args] = result.value.value;
        const commandName = command.value.toLowerCase();
        switch (commandName) {
            case "ping":
                connection.write('+PONG\r\n');
                break;
            case "echo":
                connection.write(encodeResp(args[0]));
                break;
            case "set": {
                const key = getString(args[0]);
                const valueString = getString(args[1]);
                let px: string | undefined;
                if (args[2] !== undefined) {
                    px = getString(args[2])?.toLowerCase();
                }
                let expiresAt: number | null;
                if (px == "px") {
                    expiresAt = Number(args[3].value);
                } else {
                    expiresAt = null;
                }

                if (key !== null && valueString !== null) {
                    if (expiresAt === null) {
                        connection.write(Buffer.from("+OK\r\n"));
                        store.set(key, {value: valueString, expiresAt: null});
                    } else if (px === "px" && typeof expiresAt === "number") {
                        connection.write(Buffer.from("+OK\r\n"));
                        store.set(key, {value: valueString, expiresAt: Date.now() + expiresAt});
                    }
                }
                break;
            }
            case "get": {
                const key = getString(args[0]);
                if (key === null) {
                    break;
                }
                const value = store.get(key);
                if (value === undefined) {
                    connection.write(Buffer.from("$-1\r\n"));
                } else {
                    connection.write(encodeResp(value));
                }
                break;
            }
            case "rpush": {
                const key = getString(args[0]);
                const listSize = result.value.value.length;

                for (let i = 1; i < listSize - 1; i++) {
                    const value = getString(args[i]);
                    if (key !== null && value !== null) {
                        if (!arrayList.has(key)) {
                            arrayList.set(key, [value]);
                        } else {
                            const list = arrayList.get(key);
                            if (list !== undefined) {
                                list.push(value);
                            }
                        }
                    }
                }
                let listLength: string[] | undefined;
                if (key !== null) {
                    listLength = arrayList.get(key);
                    if (listLength !== undefined) {
                        connection.write(`:${listLength.length}\r\n`);
                    }
                }
                break;
            }
            case "lrange":
                const listSize = result.value.value.length;

                if (args[1].type === "Integer" && args[2].type === "Integer") {
                    console.log("여기 지나가나요?");
                    let word: string = "";
                    word += "*";
                    word += Number(args[2].value) - Number(args[1].value) + 1;
                    word += "\r\n";
                    for (let i = Number(args[1].value); i <= Number(args[2].value); i++) {
                        word += "$";
                        word += args[i].value.length.toString();
                        word += "\r\n";
                        word += args[i].value;
                        word += "\r\n";
                    }
                } else if (args[0] !== undefined ||
                    Number(args[1].value) > listSize - 1 ||
                    Number(args[listSize - 1]) > listSize - 1 ||
                    Number(args[listSize - 1]) < Number(args[1].value)) {
                    connection.write(Buffer.from("*0\r\n"));
                }
                break;
        }
    }
}