import * as net from "net"

console.log("Logs from your program will appear here!");

type RespValue = string | RespValue[];

const server: net.Server = net.createServer((connection: net.Socket) => {
    connection.on("data", (data: Buffer) => {
        console.log("data", JSON.stringify(data.toString()));

        let idx: number = 0;

        parseData(data, idx);

        connection.write('+PONG\r\n');
    })
});

// RESP 데이터를 재귀적으로 파싱한다.
const parseData = (
    data: Buffer,
    idx: number,
) => {


    while (idx < data.length) {
        if (data[idx] == '*'.charCodeAt(0)) {
            idx++;

            // '*' 뒤의 배열 원소 개수를 읽는다.
            let num: number = 0;

            if (data[idx] < '0'.charCodeAt(0) ||
                data[idx] > '9'.charCodeAt(0)) {
                return null;
            }

            // 여러 자리 숫자를 하나의 정수로 변환한다.
            while (data[idx] >= '0'.charCodeAt(0) &&
            data[idx] <= '9'.charCodeAt(0))  {
                num = num * 10 + data[idx] - '0'.charCodeAt(0);
                idx++;
            }

            // 숫자 뒤의 CRLF를 확인한다.
            if (data[idx] === 13 && data[idx + 1] === 10) {
                idx += 2;
            } else {
                return null;
            }

            /*
             * TODO:
             * num개의 RESP 값을 읽어 배열에 저장한다.
             * 중첩 Array(*)는 재귀적으로 처리한다.
             */
            /*
            *여기서 나오는 숫자 값을 저장하고 다음에 재귀돈다음에 *를 제외한 값이 나오면 그거를 배열에 저장해야돼
            * 즉 *숫자 이렇게 나온다면 그 숫자인덱스만큼의 배열 하나를 선언하고 넣어야된다.
            * 다행히 자바스크립트는 가변배열이라서 넣으면 될듯
            *
             */

        } else if (data[idx] == '$'.charCodeAt(0)) {

            let num: number = 0;
            let word: string = "";

            while (data[idx] >= '0'.charCodeAt(0) &&
            data[idx] <= '9'.charCodeAt(0)) {
                num = num * 10 + data[idx] - '0'.charCodeAt(0);
                idx++;
            }

            if (data[idx] === 13 && data[idx + 1] === 10) {
                idx += 2;
            } else {
                return null;
            }
            if (data[idx] == '*'.charCodeAt(0) ||
                data[idx] == ':'.charCodeAt(0) ||
                data[idx] == '$'.charCodeAt(0) ||
                data[idx] == '-'.charCodeAt(0) ||
                data[idx] == '+'.charCodeAt(0)) {
                return null;
            }
            while (num > 0) {
                word += String.fromCharCode(data[idx]);
                idx++;
                num--;
            }

            // 단어를 저장해서 배열에 넣어야된다.
        } else if (data[idx] == ':'.charCodeAt(0)) {

            let word: string = "";

            if (data[idx + 1] == '+'.charCodeAt(0) &&
                data[idx + 1] == '-'.charCodeAt(0)) {
                idx += 2;
            }
            while (data[idx] !== 13 && data[idx + 1] !== 10) {
                word += String.fromCharCode(data[idx]);
                idx++;
            }

        }  else if () {

        }

        idx++;
        const result = parseData(data, idx);

        if (result === null) {z
            return null;
        }
    }
}

server.listen(6379, "127.0.0.1");
