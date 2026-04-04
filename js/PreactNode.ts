export type PreactNode = {
	__: unknown
	__b: number
	__c: {
		__P: Node
		__d: boolean
		__e: boolean
		__h: unknown[]
		__v: PreactNode
		__sb: unknown[]
		base: Node
		constructor: PreactNode["type"]
		context: Record<string, never>
		props: PreactProps
		render: (e: unknown, t: unknown, n: unknown) => unknown
		state: undefined
		// prototype
		isReactComponent: true
	}
	__e: Node
	__i: number
	__k: PreactNode[]
	__u: number
	__v: number
	constructor: undefined
	key: undefined
	props: PreactProps
	type: string | Function | object /*ComponentClass*/ | null
}
type PreactProps = { children: unknown[] }
