// deno-lint-ignore-file ban-types no-explicit-any
const BIND_META = Symbol("bindMeta")

type BindMeta = {
	originalFn: Function
	thisArg: any
	boundArgs: any[]
}

declare global {
	interface Function {
		[BIND_META]?: BindMeta
	}
}

export function interceptFunctionBind() {
	const originalBind = Function.prototype.bind

	// Prevent double-patching
	if ((Function.prototype.bind as any).__intercepted) return

	function interceptedBind(this: Function, thisArg: any, ...args: any[]) {
		const boundFn = originalBind.call(this, thisArg, ...args) as Function

		Object.defineProperty(boundFn, BIND_META, {
			value: {
				originalFn: this,
				thisArg,
				boundArgs: args
			},
			configurable: true,
			enumerable: false,
			writable: false
		})

		return boundFn
	}

	Object.defineProperty(interceptedBind, "__intercepted", {
		value: true,
		enumerable: false
	})

	Function.prototype.bind = interceptedBind
}

export function getBindMeta(fn: Function): BindMeta | undefined {
	return fn[BIND_META]
}
