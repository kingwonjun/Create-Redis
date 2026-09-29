import * as net from "net";
import {parseData} from "./basic/parser.ts";
import {handleCommand} from "./basic/command.ts";
import type {BlockedClient, StoreValue} from "./basic/resp.ts";

// key별로 해당 리스트의 데이터를 기다리고 있는 클라이언트들을 저장한다.
const BlockedClientArray: BlockedClient[] = [];
const blockedClients = new Map<string, BlockedClient[]>;
// SET/GET 명령에서 사용하는 문자열 데이터를 저장한다.
const store = new Map<string, StoreValue>;
// RPUSH/LPUSH/LRANGE 등 리스트 명령에서 사용하는 리스트 데이터를 저장한다.
const arrayList = new Map<string, string[]>;
const server: net.Server = net.createServer((connection: net.Socket) => {
    connection.on("data", (data: Buffer) => {
        const result = parseData(data, 0);
        if (result === null) {
            return;
        }
        if (result.value.type === "Array") {
            handleCommand(result, connection, store, arrayList, blockedClients, BlockedClientArray);
        }
    });
});

server.listen(6379, "127.0.0.1");
