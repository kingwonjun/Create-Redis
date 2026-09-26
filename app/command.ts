import net from "net";
import type {ParseResult, RespValue} from "./resp.ts";

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

export const handleCommand = (result: ParseResult, connection: net.Socket, store: Map<string, string>): void => {

    if (result.value.type === "Array" && result.value.value[0].type === "BulkString") {
        const [command, ...args] = result.value.value;
        if (command.value.toLowerCase() === "ping") {
            connection.write(encodeResp(command.value));
        } else if (command.value.toLowerCase() === "echo") {
            connection.write(encodeResp(args[0]));
        } else if (command.value.toLowerCase() === "set") {
            const key = getString(args[0]);
            const value = getString(args[1]);

            if (key !== null && value !== null) {
                store.set(key, value);
                connection.write(Buffer.from("+OK\r\n"));
            }
        } else if (command.value.toLowerCase() === "get") {
            const key = getString(args[0]);
            let value : string | undefined;
            if (key !== null) {
                value = store.get(key);
            }
            if (key !== null && value === undefined) {
                connection.write(Buffer.from("$-1\r\n"));
            }  else if (key !== null && typeof value === "string") {
                connection.write(encodeResp(value));
            }
        }
    }
}