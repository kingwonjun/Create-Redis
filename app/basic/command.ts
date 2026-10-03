import net from "net";
import type {BlockedClient, ParseResult, RespValue, StoreValue, StreamEntry, StreamKeyValue} from "./resp.ts";

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

export const handleCommand = (result: ParseResult, connection: net.Socket, store: Map<string, StoreValue>, arrayList: Map<string, string[]>, blockedClients: Map<string, BlockedClient[]>, BlockedClientArray: BlockedClient[], streamList: Map<string, StreamEntry[]>, streamArray: StreamKeyValue[]): void => {

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
                        // PX는 현재 시각에 만료 시간을 더해 절대 시각으로 저장한다.
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
            case "rpush":
            case "lpush": {
                const key = getString(args[0]);
                const listSize = result.value.value.length;

                if (key === null) {
                    break;
                }
                for (let i = 1; i < listSize - 1; i++) {
                    const value = getString(args[i]);
                    if (value !== null) {
                        if (!arrayList.has(key)) {
                            arrayList.set(key, [value]);
                        } else {
                            const list = arrayList.get(key);
                            if (list !== undefined && commandName === "rpush") {
                                list.push(value);
                            } else if (list !== undefined && commandName == "lpush") {
                                list.unshift(value);
                            }
                        }
                    }
                }
                let listLength: string[] | undefined;
                listLength = arrayList.get(key);
                if (listLength !== undefined) {
                    connection.write(`:${listLength.length}\r\n`);
                }

                // blpop으로 lpush와 rpush가 된 상태에서 로직을 추가
                const list = arrayList.get(key);
                if (list === undefined) {
                    break;
                }
                console.log("c");
                if (list.length > 0) {
                    const otherConnection = BlockedClientArray.shift();
                    if (otherConnection !== undefined) {
                        otherConnection.connection.write(Buffer.from(`*2\r\n$${key.length}\r\n${key}\r\n$${list[0].length}\r\n${list.shift()}\r\n`));
                    }
                }
                break;
            }
            case "lrange": {
                let list: string[] | undefined;
                if (typeof args[0].value === "string" && arrayList.get(args[0].value) !== undefined) {
                    list = arrayList.get(args[0].value);
                }
                if (list === undefined) {
                    connection.write(Buffer.from("*0\r\n"));
                    return;
                }
                if (args[0] === undefined) {
                    connection.write(Buffer.from("*0\r\n"));
                    return;
                }
                // LRANGE의 start와 stop은 모두 결과에 포함되는 인덱스다.
                let start = Number(args[1].value);
                let stop = Number(args[2].value);
                // 음수 인덱스는 리스트의 끝을 기준으로 계산한다.
                if (start < 0) {
                    start = list.length + start;
                }
                if (start < 0) {
                    start = 0;
                }
                if (stop < 0) {
                    stop = list.length + stop;
                }
                if (stop < 0) {
                    stop = 0;
                }
                if (start > stop) {
                    connection.write(Buffer.from("*0\r\n"));
                    return;
                }
                if (start > list.length) {
                    connection.write(Buffer.from("*0\r\n"));
                    return;
                }
                let word: string = "";
                word += "*";
                console.log(`word ${word}`);
                if (list.length < stop) {
                    word += list.length;
                    stop = list.length - 1;
                } else {
                    word += (stop - start + 1);
                }
                word += "\r\n";
                for (let i = start; i <= stop; i++) {
                    word += "$";
                    word += list[i].length;
                    word += "\r\n";
                    word += list[i];
                    word += "\r\n";
                }
                connection.write(Buffer.from(word));
                console.log("확인");
                break;
            }
            case "llen": {
                if (typeof args[0].value !== "string") {
                    break;
                }
                const list = arrayList.get(args[0].value);
                if (list == undefined) {
                    connection.write(Buffer.from(":0\r\n"));
                    break;
                }
                connection.write(Buffer.from(`:${list.length}\r\n`));
                break;
            }
            case "lpop" : {
                if (args[0].value === undefined || args[0].type !== "BulkString") {
                    break;
                }
                const list = arrayList.get(args[0].value);
                if (list == undefined) {
                    connection.write(Buffer.from("$-1\r\n"));
                    break;
                }
                if (args[1] === undefined) {
                    connection.write(Buffer.from(`$${list[0].length}\r\n${list.shift()}\r\n`));
                } else if (args[1].type === "BulkString") {
                    let count: number = Number(args[1].value);
                    connection.write(Buffer.from(`*${args[1].value}\r\n`));
                    while (count > 0) {
                        connection.write(Buffer.from(`$${list[0].length}\r\n${list.shift()}\r\n`));
                        count--;
                    }
                }
                break;
            }
            case "blpop" : {
                const key = args[0].value;
                if (typeof key !== "string" || args[0].type !== "BulkString") {
                    break;
                }
                if (args[1].value === undefined || args[1].type !== "BulkString") {
                    break;
                }
                if (args[1].value === "0") {
                    BlockedClientArray.push({connection, timer: undefined});
                } else {
                    const timer = setTimeout(() => {
                        const clientList = blockedClients.get(key);
                        if (clientList !== undefined) {
                            const index = clientList.findIndex((conn) => conn.connection === connection);
                            clientList.splice(index, 1);
                        }
                        connection.write(Buffer.from("*-1\r\n"));
                    }, Number(args[1].value) * 1000);
                    BlockedClientArray.push({connection, timer});
                }
                blockedClients.set(key, BlockedClientArray);
                const list = arrayList.get(key);
                if (list === undefined) {
                    break;
                }
                if (list.length > 0) {
                    BlockedClientArray.shift();
                    connection.write(Buffer.from(`*2\r\n$${key.length}\r\n${key}\r\n$${list[0].length}\r\n${list.shift()}\r\n`));
                }
                break;
            }
            case "type": {
                const key = args[0].value;
                if (typeof key === "object") {
                    break;
                }
                const value = store.get(key);
                if (streamList.has(key)) {
                    connection.write(Buffer.from("+stream\r\n"));
                } else if (typeof value === "object" && typeof value.value === "string") {
                    connection.write(Buffer.from("+string\r\n"));
                } else {
                    connection.write(Buffer.from("+none\r\n"));
                }
                break;
            }
            case "xadd": {
                const key = args[0].value;
                if (typeof key !== "string" || args[0].type !== "BulkString") {
                    break;
                }
                let id = args[1].value;
                if (typeof id !== "string") {
                    break;
                }
                const streamIdChecker = streamList.get(key);

                let finalValue: string | undefined;
                if (streamIdChecker !== undefined && id === "*") {
                    const nearId = streamIdChecker[0].id;
                    const autoValueStartIdToCompare = Number(nearId.slice(0, id.indexOf('-')));
                    const autoValueEndIdToCompare = nearId.slice(id.indexOf('-') + 1);

                    const autoValueStartId = Date.now();
                    let autoValueEndId = 0;
                    if (autoValueStartId === autoValueStartIdToCompare) {
                        autoValueEndId = Number(autoValueEndIdToCompare) + 1;
                    }
                    finalValue = String(autoValueStartId).concat("-").concat(String(autoValueEndId));
                    id = finalValue;
                } else if (id === "*"){
                    finalValue = String(Date.now()).concat("-").concat("0");
                    id = finalValue;
                }
                // finalvalue -> id로 옮겨담고 후에 나올 로직을 위해 if(finalValue === uyndefined)이 나을까 finalValue ==  null 이 나을까 고민이 된다.;
                if (finalValue === undefined) {
                    if (Number(id[id.length - 1]) <= 0) {
                        connection.write('-ERR The ID specified in XADD must be greater than 0-0\r\n');
                        break;
                    }

                    const startId = Number(id.slice(0, id.indexOf('-')));
                    const endId = id.slice(id.indexOf('-') + 1);
                    // 자동 시퀸스 번호 코드
                    console.log(`startId = ${startId}`);
                    console.log(`endId = ${endId}`);
                    if (streamIdChecker === undefined && startId === 0 && endId === "*") {
                        id = String(startId).concat("-").concat("1");
                    } else if (streamIdChecker === undefined && endId === "*") {
                        id = String(startId).concat("-").concat("0");
                    }
                    if (streamIdChecker !== undefined) {
                        const startIdToCompare = Number(streamIdChecker[0].id.slice(0, id.indexOf('-')));
                        const endIdToCompare = Number(streamIdChecker[0].id.slice(id.indexOf('-') + 1));

                        if (endId !== "*" && (startId < startIdToCompare || Number(endId) <= endIdToCompare)) {
                            connection.write('-ERR The ID specified in XADD is equal or smaller than the target stream top item\r\n');
                            break;
                        }
                        if (startId !== startIdToCompare && endId === "*") {
                            id = String(startId).concat("-").concat("0");
                        }
                        if (startId === startIdToCompare && endId === "*") {
                            id = String(startId).concat("-").concat(String(endIdToCompare + 1));
                        }
                    }
                }

                console.log(`[command, ...args].length = ${[command, ...args].length}`);
                for (let i = 2; i < [command, ...args].length - 1; i += 2) {
                    // i가 2부터 시작하니까 인덱스 0으로 맞추기위해 -2함
                    const keyValue1 = args[i].value;
                    const keyValue2 = args[i + 1].value;
                    if (typeof keyValue1 !== "string" || typeof keyValue2 !== "string") {
                        break;
                    }
                    //console.log(`keyValue1 = ${keyValue1}`);
                    //console.log(`keyValue2 = ${keyValue2}`);
                    streamArray.push({streamKey: keyValue1, streamValue: keyValue2});
                }
                console.log(streamArray);
                let keyIdList = streamList.get(key);
                if (keyIdList !== undefined) {
                    keyIdList.push({id, fields: [...streamArray]});
                    streamList.set(key, keyIdList);
                }
                else {
                    streamList.set(key, [{id, fields: [...streamArray]}]);
                }

                // 이거는 방금전에 내가 바꿨다. 조심해야됨
                streamArray.length = 0;
                connection.write(`$${id.length}\r\n${id}\r\n`);
                break;
            }
            case "xrange": {
                const key = args[0].value;
                let startId = args[1].value;
                let endId = args[2].value;

                if (typeof startId !== "string" ||
                    typeof endId !== "string" ||
                    typeof key !== "string") {
                    break;
                }

                const specifyKeyList = streamList.get(key);
                console.log(JSON.stringify(specifyKeyList, null, 2));
                if (typeof specifyKeyList === "undefined"){
                    break;
                }
                if(!startId.includes("-")) {
                    const startIdList = [];
                    for (let i = 0; i < specifyKeyList.length; i++) {
                        startIdList.push(Number(specifyKeyList[i].id.split("-")[1]));
                    }
                    startId = startId.concat("-").concat(String(Math.min(...startIdList)));
                }
                if(!endId.includes("-")) {
                    const endIdList = [];
                    for (let i = 0; i < specifyKeyList.length; i++) {
                        endIdList.push(Number(specifyKeyList[i].id.split("-")[1]));
                    }
                    endId = endId.concat("-").concat(String(Math.max(...endIdList)));
                }
                let strKeyListStartIndex : number = 0;
                let strKeyListEndIndex : number = 0
                const strKeyList = specifyKeyList?.map(specifyKey => specifyKey.id);
                // 2개의 for문을 쓰는 이유는 동일한 id가 왔을때 맨앞에 있던 if문에 맞는 동일한 id가 무시되고 다음으로 넘어가기 때문
                for (let i = 0; i < strKeyList.length; i++) {
                    if (startId === strKeyList[i]) {
                        strKeyListStartIndex = i;
                        break;
                    }
                }
                for (let i = strKeyList.length - 1; i >= 0; i--) {
                    if (endId === strKeyList[i]) {
                        strKeyListEndIndex = i;
                        break;
                    }
                }
                console.log(`strKeyLIstStratIndex = ${strKeyListStartIndex}`);
                console.log(`strKeyListEndIndex = ${strKeyListEndIndex}`);
                const keyLength = strKeyListEndIndex - strKeyListStartIndex + 1;
                connection.write(Buffer.from(`*${keyLength}\r\n`));
                for (let i = strKeyListStartIndex; i <= strKeyListEndIndex; i++) {
                    connection.write(Buffer.from(`*2\r\n`));
                    connection.write(Buffer.from(`$${strKeyList[i].length}\r\n`));
                    connection.write(Buffer.from(`${strKeyList[i]}\r\n`));
                    connection.write(Buffer.from(`*${specifyKeyList[i].fields.length * 2}\r\n`));
                    for (let j = i; j < i + keyLength; j++) {
                        //specifyKeyList는 streamList의 키값 <리스트이름>을 줘서 value인
                        //StreamEntry의 배열을 반환한다.
                        //StreamEntry는 id: string과 fields: StreamKeyValue[]를 가지고있다.
                        //field에 있는 streamKeyValue는 streamKey와 streamValue로 이루어져있다.
                        //출력해야 될거는 fields 즉
                        //fields는 streamKeyValue[]의 배열로 이루어져있있다.
                        //그렇다면 어떤 구조를 가지고 있으며 어떻게 변환해야될까
                        //예를 든 형태는 이렇다. [id: 1-1, [[streamKey: 1. streamValue: 2][streamKey: 2, streamValue 3]]]
                        //그러면 반환은 [ 1, 2, 2, 3]으로 해야하니까
                        //먼저 Map.get(id)로 한다면[[streamKey: 1. streamValue: 2][streamKey: 2, streamValue 3]] 를 반환하고
                        //Map.get(id)[i]로 순회하면서 for문으로 i < Map.get(id).length .이런식으로 한 뒤
                        //Map.get(id)[i].streamKey와 streamValue를 차례대로 넣는다.

                        //const specifyKeyList = streamList.get(key);
                        //const strKeyList = specifyKeyList?.map(specifyKey => specifyKey.id);
                        for (let k  = j; k < specifyKeyList[j].fields.length; k++) {
                            connection.write(Buffer.from(`$${specifyKeyList[j].fields[k].streamKey.length}\r\n`));
                            connection.write(Buffer.from(`${specifyKeyList[j].fields[k].streamKey}\r\n`));
                            connection.write(Buffer.from(`$${specifyKeyList[j].fields[k].streamValue.length}\r\n`));
                            connection.write(Buffer.from(`${specifyKeyList[j].fields[k].streamValue}\r\n`));
                        }

                    }
                }
                break;
            }
        }
    }
}