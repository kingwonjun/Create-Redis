import * as net from "net";
import {parseData} from "./parser.ts";
import {handleCommand} from "./command.ts";
import type {StoreValue} from "./resp.ts";

console.log("Logs from your program will appear here!");



const server: net.Server = net.createServer((connection: net.Socket) => {
    const store = new Map<string, StoreValue>;
    connection.on("data", (data: Buffer) => {
        const newData = (Buffer.from('*3\r\n$1\r\n1\r\n$1\r\n1\r\n$1\r\n1\r\n'));
        const result = parseData(newData, 0);
        if (result === null) {
            return;
        }
        if (result.value.type === "Array") {
            handleCommand(result, connection, store);
        }
    });
});

server.listen(6379, "127.0.0.1");
