export type SDict<T> = { [key: string]: T };
export type IDict<T> = { [key: number]: T };
export type Dict<K extends (string | number), V> = {
    [key in K]: V;
};
