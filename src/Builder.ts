import Stack from "./Stack";

export interface Builder
{
    name: string,
    enabled: boolean,
    stack: Stack,
    roles: string[],
    parent?: Builder,
    child?: Builder,
    config?: any,
    [x: string]: any
}
