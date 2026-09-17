import * as net from "net"

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment the code below to pass the first stage
const server: net.Server = net.createServer((connection: net.Socket) => {
    // Handle connection
    connection.on("data", (data: Buffer) => {
        console.log("data", JSON.stringify(data.toString()));
        const arr: string[][] = [];

        // 먼저 '*', '$'가 앞에오면 그 다음 숫자를 읽는다.
        // 그다음 \r\n은 건너뛴다. 여기서 파싱을 해야될 것 같다.
        // arr.push([]) 로 배열을 만들고 (2차원 배열)
        // arr[0].push()에다가 값을 넣는다.
        // 이 때 arr[] 안에 인덱스는 따로 변수를 생성하여 *다음의 숫자까지? 이거는 조금 헷갈리는게
        // '*' 다음의 숫자가 오면 그 숫자는 어떻게 사용해야 될지 모르겠다.
        // 시작 문자는 무조건 있어야한다. '+', '-', ':', '$', '*'
        //---
        // 오류메시지 고려해야한다.
        // 시작 문자가 없을 경우
        // $와 *에 두자리이상의 숫자가 나오는 거 고려하고
        // 숫자나 문자가 끝날 때 \r\n이 있는지 고려하고
        let isError: boolean = false;
        for (let i = 0; i < data.length; i++) {
            // 구조를 어떻게 짜야 되는지 고민이 된다.
            // 일단 처음에 시작문자가 나오는지 확인 / 안나오면 오류메시지 출력
            // 시작문자라면 앞에 숫자와 문자가 나오고 \r\n이 나올때까지 data[i]의 인덱스 i를 증가시키다가
            // 나올때 다시 break로 빠져나와야 될듯

            if (data[i] == '*'.charCodeAt(0)) {
                i++;
                let num: number = 0;
                // 1의 자리수보다 더 많은 자리수를 읽을려면 /r/n 가 올때까지 숫자인지만 확인하면 된다.
                // 1의 자리수 이상일 경우 10 * data[i].charCodeAt(0) + data[i + 1] 이렇게 하는게 나을 것 같다.
                // 그 값을 저장할 변수를 어디다가 놔둬야 되는지 고민이 됨
                // '*' 다음에 숫자가 안나올때도 고려 해야 함
                if (data[i] === '0'.charCodeAt(0)) {
                    isError = true;
                }
                //숫자가 몇자리인지 구하는 코드
                while (!isError && data[i] >= '0'.charCodeAt(0) && data[i] <= '9'.charCodeAt(0)) {
                    num = num * 10 + data[i] - '0'.charCodeAt(0);
                    i++;
                }
                // *다음에 숫자를 읽고 그 숫자는 앞으로 나올 문자열의 개수를 의미한다.
                // \r\n 기준으로 문자열의 개수를 의미한다.
                // \r\n을 파싱하면서 건너뛰는방법을 구한다.
                // * 이 문자 다음으로 시작되는 숫자만큼 배열에 넣어서 나중에 꺼내 출력한다.
                if (data[i] === 13 && data[i + 1] === 10) {
                    i += 2;
                }
                else {
                    isError = true;
                }
            } else if (data[i] == '$'.charCodeAt(0)) {

            } else {

            }
        }
        parseData(data);
        connection.write('+PONG\r\n');
    })
});
//파서를 만든다.
const parseData = (data: Buffer) => {
    // data를 분석한다.
    // data를 한글자씩 읽는다.
    // data를
}
server.listen(6379, "127.0.0.1");
