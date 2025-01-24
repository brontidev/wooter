import { IChemin, chemin } from "./export/chemin.ts";

export default class Wooter<TData extends Record<string, unknown> = Record<string, unknown>> {
    constructor(private base?: IChemin) {}
}