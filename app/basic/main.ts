import * as net from "net";
import {parseData} from "./parser.ts";
import {handleCommand} from "./command.ts";
import type {StoreValue} from "./resp.ts";

const server: net.Server = net.createServer((connection: net.Socket) => {
    const store = new Map<string, StoreValue>;
    const arrayList = new Map<string, string[]>;
    connection.on("data", (data: Buffer) => {
        const result = parseData(data, 0);
        if (result === null) {
            return;
        }
        if (result.value.type === "Array") {
            handleCommand(result, connection, store, arrayList);
        }
    });
});

server.listen(6379, "127.0.0.1");
