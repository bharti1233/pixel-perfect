import { createStore, del, get, set, values } from "idb-keyval";
import type { MyThing } from "@/types/things";

let store: ReturnType<typeof createStore> | null = null;
const db = () => (store ??= createStore("my-things-db", "things"));

export async function listThings(): Promise<MyThing[]> {
  const all = (await values<MyThing>(db())) ?? [];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export const getThing = (id: string) => get<MyThing>(id, db());
export const saveThing = (t: MyThing) => set(t.id, t, db());
export const deleteThing = (id: string) => del(id, db());
