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