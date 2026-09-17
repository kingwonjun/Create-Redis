import * as net from "net"

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment the code below to pass the first stage
const server: net.Server = net.createServer((connection: net.Socket) => {
    // Handle connection
    connection.on("data", (data: Buffer) => {
        console.log("data", JSON.stringify(data.toString()));

        if ()

        parseData(data);
        connection.write('+PONG\r\n');
    })
});

//파서를 만든다.
const parseData = (data: Buffer) => {

    // 재귀적 자료구조를 사용, 그 타입을 다시 배열에 선언
    type RespValue = string | RespValue[];
    const arr: RespValue[] = [];

    /*
     * RESP 파싱 전체 흐름
     *
     * 1. RESP 값은 반드시 시작 문자(+, -, :, $, *) 중 하나로 시작해야 한다.
     *    시작 문자가 없으면 오류 처리한다.
     *
     * 2. '*' 또는 '$' 뒤에는 숫자가 온다.
     *    - 숫자는 한 자리 이상일 수 있으므로 \r\n 전까지 연속해서 읽어야 한다.
     *    - 숫자 다음에는 반드시 \r\n이 와야 한다.
     *
     * 3. '*' 뒤의 숫자는 앞으로 나올 RESP 값의 개수를 의미한다.
     *    - *0도 정상적인 값이므로 고려해야 한다.
     *    - TODO: 이 숫자를 이용해서 arr에 값을 어떻게 나눠 담을지 결정해야 한다.
     *
     * 4. '$' 뒤의 숫자는 뒤에 나올 문자열의 길이를 의미한다.
     *
     * 5. arr.push([])로 내부 배열을 만든 뒤
     *    arr[index].push(...) 형태로 파싱한 값을 저장할 예정.
     *    - TODO: arr의 index를 어떤 기준으로 증가시킬지 결정해야 한다.
     *
     * 오류 처리
     * - 올바른 시작 문자가 없는 경우
     * - '*' 또는 '$' 뒤에 숫자가 없는 경우
     * - 숫자가 여러 자리인 경우도 정상적으로 읽어야 함
     * - 필요한 위치에 \r\n이 없는 경우
     */

    let isError: boolean = false;

    for (let i = 0; i < data.length; i++) {

        if (data[i] == '*'.charCodeAt(0)) {
            i++;
            let num: number = 0;

            /*
             * Array(*)
             *
             * '*' 다음의 숫자를 읽는다.
             * 숫자는 여러 자리일 수 있으므로 숫자가 계속되는 동안 반복한다.
             *
             * 예:
             * *2\r\n  -> num = 2
             * *12\r\n -> num = 12
             *
             * '*' 바로 다음에 숫자가 없으면 오류 처리한다.
             * *0 역시 정상적인 RESP Array이므로 허용해야 한다.
             */

            if (data[i] < '0'.charCodeAt(0) || data[i] > '9'.charCodeAt(0)) {
                isError = true;
            }

            // 여러 자리 숫자를 하나의 정수로 변환한다.
            while (data[i] >= '0'.charCodeAt(0) && data[i] <= '9'.charCodeAt(0)) {
                num = num * 10 + data[i] - '0'.charCodeAt(0);
                i++;
            }

            /*
             * 숫자를 모두 읽은 뒤에는 반드시 \r\n이 와야 한다.
             * 정상이라면 \r\n을 건너뛰고 다음 RESP 값을 읽는다.
             */
            if (data[i] === 13 && data[i + 1] === 10) {
                i += 2;
            } else {
                isError = true;
            }

            /*
             * TODO:
             * num만큼 뒤의 RESP 값을 읽어서 배열에 저장하는 로직 구현
             */

            /**
             * 고민:  앞에 * 의 값이 나왔는데도 읽는 도중 *가 또나오면 배열이 중첩된다.
             * ['a', ['a', 'b']]
             * 이렇게
             * 배열은 어떤 방식으로 중첩시킬 수 있을까?
             * 위에 배열은 arr[0][0] = 'a' 이고
             * arr[0][1]이 = ['a', 'b'] 배열이다. 맞나? 이거.... 타입이 안맞는데?
             *
             * --> type RespValue = string | RespValue[]; 으로 재귀적 자료구조 썻다.
             * 재귀적 자료구조란 자기와 같은 종류를 자기 안에 또 넣을 수 있는 자료구조
             *
             * 이 자료구조를 사용해서 배열을 중첩시시킨다.
             * TODO: RespValue를 이용하여 '*' 나오는 부분의 로직을 완성시킨다.
             */

            /**
             * 고민 : *3\r\n 이렇게 나오면 다시 시작 문자가 나온다.
             * 그 시작 문자로 다시 일일이 적어서 분기를 내야되는데
             * 현재로썬 재귀와 함수로 만들어서 쓸 생각밖에 안나는 것 같다.
             * 그리고 중첩 *가 나와버리면 일단 배열을 다시 선언한뒤
             * 재귀를 쓰면서 값을 넣고 재귀에서 다시 올라와서 arr.push(배열) 로 한꺼번에 넣어야 될것 같다.
             */

        } else if (data[i] == '$'.charCodeAt(0)) {

            // TODO: Bulk String 파싱

        } else if (data[i] == ':'.charCodeAt(0)) {

            // TODO: Integer 파싱할때 부호 +, - 고려해야한다.

        } else if (data[i] == '-'.charCodeAt(0) ||
            data[i] == '+'.charCodeAt(0)) {

            // TODO: 올바른 RESP 시작 문자가 아닌 경우 오류 처리
        } else {

        }
    }
}
server.listen(6379, "127.0.0.1");
