const BIND_META = Symbol("bindMeta")
/** @typedef {{originalFn: Function;thisArg: any;boundArgs: any[]}} BindMeta */

export function interceptFunctionBind() {
    const originalBind = Function.prototype.bind
    // Prevent double-patching
    if (Function.prototype.bind.__intercepted) {
        return
    }
    /**
     * @this {any}
     * @param {any} thisArg
     * @param {any[]} args
     */
    function interceptedBind(thisArg, ...args) {
        const boundFn = originalBind.call(this, thisArg, ...args)
        Object.defineProperty(boundFn, BIND_META, {
            value: {
                originalFn: this,
                thisArg,
                boundArgs: args,
            },
            configurable: true,
            enumerable: false,
            writable: false,
        })
        return boundFn
    }
    Object.defineProperty(interceptedBind, "__intercepted", {
        value: true,
        enumerable: false,
    })
    Function.prototype.bind = interceptedBind
}
/**
 * @param {{ [BIND_META]?: BindMeta }} fn
 */
export function getBindMeta(fn) {
    return fn[BIND_META]
}
