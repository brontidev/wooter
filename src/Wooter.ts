import { TChemin } from "@dldc/chemin"
import RouterGraph, { MethodDefinitionInput, MethodDefinitions } from "./graph/RouterGraph.ts"
import { Data, Methods, MiddlewareHandler, Params, RouteHandler } from "./export/types.ts"
import { Merge } from "./types.ts"
import c from "./export/chemin.ts"

export class Wooter<TData extends Data, TParentParams extends Params = Params> {
    protected graph: RouterGraph

    constructor(protected basePath: TChemin<TParentParams> = c.chemin() as unknown as TChemin<TParentParams>) {
        this.graph = new RouterGraph(basePath)
    }

    route<TParams extends Params>(path: TChemin<TParams>, method: MethodDefinitionInput, handler: RouteHandler<Merge<TParams, TParentParams>, TData>): this
    route<TParams extends Params>(path: TChemin<TParams>, handlers: MethodDefinitions<Merge<TParams, TParentParams>, TData>): this
    route<TParams extends Params>(path: TChemin<TParams>, methodORHandlers: MethodDefinitionInput | MethodDefinitions<Merge<TParams, TParentParams>, TData>, handler?: RouteHandler<Merge<TParams, TParentParams>, TData>): this {
        if((typeof methodORHandlers == "string" || Array.isArray(methodORHandlers))) {
            if(!handler) throw new TypeError()
            if(methodORHandlers === "*") {
                this.graph.addRoute_type1(path, handler)
            } else {
                const methods = [methodORHandlers].flat()
                this.graph.addRoute_type2(path, handler, methods)
            }
        } else {
            const handlers: MethodDefinitions<Merge<TParams, TParentParams>, TData> = methodORHandlers;
            this.graph.addRoute_type0(path, handlers)
        }
        return this
    }

    use<TNextData extends Data = Data>(handler: MiddlewareHandler<Params, TData, TNextData>): Wooter<Merge<TData, TNextData>, TParentParams> {
        this.graph.addMiddleware(handler)
        return this as unknown as Wooter<Merge<TData, TNextData>, TParentParams>
    }

    /**
     * @todo
     */
    router<TParams extends Params>(path: TChemin<TParams>): Wooter<TData, Merge<TParams, TParentParams>> {
        const router = new Wooter<TData, Merge<TParams, TParentParams>>(c.chemin(this.basePath, path) as unknown as TChemin<Merge<TParams, TParentParams>>)
        this.graph.addNamespace(path, router.graph)
        return router
    }
}
