import net from "net";
import type {ParseResult, RespValue, StoreValue} from "./resp.ts";

const encodeResp = (value: RespValue | StoreValue | string ): string => {

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
        } else if ("type" in value && value.type === "BulkString") {
            word += "$";
            word += value.value.length.toString();
            word += "\r\n"
            word += value.value;
            word += "\r\n";
        } else if ("expiresAt" in value) {
            if (value.expiresAt === null || Date.now() >= value.expiresAt) {
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

const getString = (value: RespValue ): string | null => {
        if (typeof value.value === "string") {
        return value.value;
    }
    return null;
}

export const handleCommand = (result: ParseResult, connection: net.Socket, store: Map<string, StoreValue>): void => {

    if (result.value.type === "Array" && result.value.value[0].type === "BulkString") {
        const [command, ...args] = result.value.value;
        const commandName = command.value.toLowerCase();
        switch (commandName) {
            case "ping":
                connection.write(encodeResp(command.value));
                break;
            case "echo":
                connection.write(encodeResp(args[0]));
                break;
            case "set": {
                const key = getString(args[0]);
                const valueString = getString(args[1]);
                const Px = getString(args[2])?.toLowerCase()
                const expiresAt = args[3];

                if (key !== null && valueString !== null) {
                    if (expiresAt === null) {

                        store.set (key, {value: valueString, expiresAt : null});
                    }
                    else if (Px === "px" && typeof expiresAt === "number") {
                        console.log(`set작동`);
                        connection.write(Buffer.from("+OK\r\n"));
                        store.set(key, {value : valueString, expiresAt : Date.now() + expiresAt });
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
                } else  {
                    connection.write(encodeResp(value));
                }
                break;
            }
        }
    }
}