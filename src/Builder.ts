import Stack from "./Stack";

export interface Builder
{
    name: string,
    stack: Stack,
    roles: string[],
    [x: string]: any
}
