import * as net from "net";
import {parseData} from "./parser.ts";
import {handleCommand} from "./command.ts";

console.log("Logs from your program will appear here!");

const server: net.Server = net.createServer((connection: net.Socket) => {
    const store = new Map<string, string>;
    connection.on("data", (data: Buffer) => {
        const result = parseData(data, 0)
        if (result === null) {
            return;
        }
        if (result.value.type === "Array") {
            handleCommand(result, connection, store);
        }
    });
});





server.listen(6379, "127.0.0.1");
