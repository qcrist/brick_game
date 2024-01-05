import {useState} from "react";

export function useConst<T>(supplier: () => T) {
    const [ref] = useState(supplier);
    return ref;
}