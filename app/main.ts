import * as net from "net"

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment the code below to pass the first stage
const server: net.Server = net.createServer((connection: net.Socket) => {
  // Handle connection
    connection.on("data", (data: Buffer) => {
        console.log("data", data);
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
