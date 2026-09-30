import net from "net";

type RespSimpleString = {
    type: "SimpleString";
    value: string;
};

type RespInteger = {
    type: "Integer";
    value: string;
};

type RespError = {
    type: "Error";
    value: string;
};

type RespBulkString = {
    type: "BulkString";
    value: string;
};

type RespArray = {
    type: "Array";
    value: RespValue[];
};

export type RespValue =
    | RespSimpleString
    | RespInteger
    | RespError
    | RespBulkString
    | RespArray;

export type ParseResult = {
    value: RespValue;
    nextIdx: number;
};

export type StoreValue = {
    value: string;
    expiresAt: number | null;
}

export type BlockedClient = {
    connection: net.Socket;
    timer: NodeJS.Timeout | undefined;
}

export type StreamKeyValue = {
    streamKey: string;
    streamValue: string;
}

export type StreamEntry = {
    id: string;
    fields: StreamKeyValue[];
}