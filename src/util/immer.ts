import {StoreApi} from "zustand";
import {Draft, produce} from "immer";

type immer_setter<T> = StoreApi<T>["setState"]
type immer_recipe<T> = (state: Draft<T>) => void;

export function immer_setter<T>(setter: immer_setter<T>) {
    return (recipe: immer_recipe<T>) => {
        setter(produce<T>(recipe));
    }
}