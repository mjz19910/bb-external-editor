type ReactProps = {
	children?: unknown
	[key: string]: unknown
}

type PreactComponentInstance = {
	__P?: Node | null
	__d?: boolean
	__e?: boolean
	__h?: unknown[]
	__v?: PreactVNode
	__sb?: unknown[]
	base?: Node | null
	constructor?: unknown
	context?: Record<string, unknown>
	props?: ReactProps
	render?: (props: unknown, state: unknown, context: unknown) => unknown
	state?: unknown
	isReactComponent?: true
}

type PreactVNodeType =
	| string
	| Function
	| { displayName?: string; name?: string }
	| null
	| undefined

type PreactVNode = {
	__?: PreactVNode | null
	__b?: number
	__c?: PreactComponentInstance | null
	__e?: Node | null
	__i?: number
	__k?: PreactVNode[] | null
	__u?: number
	__v?: number
	constructor?: undefined
	key?: string | number | null
	props?: ReactProps
	type?: PreactVNodeType
}

type InspectorNodeKind = "host" | "component" | "memo" | "unknown"

type InspectorNode = {
	id: number
	typeName: string              // raw readable name
	effectiveTypeName: string     // cleaned name (e.g. "Button" instead of "Memo(Button)")
	rawType: PreactVNodeType
	kind: InspectorNodeKind
	isMemo: boolean
	memoInnerName: string | null

	depth: number
	parentId: number | null
	childIds: number[]
	props: ReactProps | null
	state: unknown
	key: string | number | null
	dom: Node | null
	wrapper: PreactVNode
	component: PreactComponentInstance | null
	hooks: unknown[] | null
}

export class PreactTreeInspector {
	root: PreactVNode

	wrapperToId = new WeakMap<PreactVNode, number>()
	domToId = new WeakMap<Node, number>()
	domToWrapper = new WeakMap<Node, PreactVNode>()

	nodes: InspectorNode[] = []
	nodesById = new Map<number, InspectorNode>()

	byTypeName: Record<string, number[]> = Object.create(null)
	byTypeRef = new Map<object | Function, number[]>()

	reactElementsByDepth: number[][] = []

	rootId: number | null = null
	private _clickHandler: ((e: MouseEvent) => void) | null = null
	private _interval: number | null = null

	constructor(root: PreactVNode) {
		this.root = root
	}

	scan(): this {
		this.reset()
		this.rootId = this.visit(this.root, 0, null)
		return this
	}

	refresh(newRoot: PreactVNode = this.root): this {
		this.root = newRoot
		return this.scan()
	}

	reset(): void {
		this.wrapperToId = new WeakMap()
		this.domToId = new WeakMap()
		this.domToWrapper = new WeakMap()

		this.nodes = []
		this.nodesById = new Map()

		this.byTypeName = Object.create(null)
		this.byTypeRef = new Map()

		this.reactElementsByDepth = []
		this.rootId = null
	}

	getNodeById(id: number): InspectorNode | null {
		return this.nodes[id] ?? null
	}

	getNodeByDom(dom: Node): InspectorNode | null {
		const id = this.domToId.get(dom)
		return id != null ? this.nodes[id] : null
	}

	getNodeByWrapper(wrapper: PreactVNode): InspectorNode | null {
		const id = this.wrapperToId.get(wrapper)
		return id != null ? this.nodes[id] : null
	}

	getClosestNodeFromDom(dom: Node | null): InspectorNode | null {
		let cur: Node | null = dom
		while (cur) {
			const node = this.getNodeByDom(cur)
			if (node) return node
			cur = cur.parentNode
		}
		return null
	}

	getPathToRoot(id: number): InspectorNode[] {
		const path: InspectorNode[] = []
		let cur: InspectorNode | null = this.nodes[id]
		while (cur) {
			path.push(cur)
			cur = cur.parentId != null ? this.nodes[cur.parentId] : null
		}
		return path.reverse()
	}

	findByTypeName(typeName: string): InspectorNode[] {
		return (this.byTypeName[typeName] || []).map(id => this.nodes[id])
	}

	findByTypeRef(typeRef: object | Function): InspectorNode[] {
		return (this.byTypeRef.get(typeRef) || []).map(id => this.nodes[id])
	}

	findFirstByTypeName(typeName: string): InspectorNode | null {
		const ids = this.byTypeName[typeName] || []
		return ids.length ? this.nodes[ids[0]] : null
	}

	find(predicate: (node: InspectorNode) => boolean): InspectorNode[] {
		return this.nodes.filter(Boolean).filter(predicate)
	}

	countsByType(): Record<string, number> {
		const out: Record<string, number> = {}
		for (const key of Object.keys(this.byTypeName)) {
			out[key] = this.byTypeName[key].length
		}
		return out
	}

	describeNode(target: number | InspectorNode): unknown {
		const node = typeof target === "number"
			? this.getNodeById(target)
			: target

		if (!node) return null

		return {
			id: node.id,
			type: node.typeName,
			key: node.key,
			depth: node.depth,
			parentId: node.parentId,
			childIds: node.childIds.slice(),
			props: node.props,
			state: node.state,
			hooks: node.hooks,
			path: this.getPathToRoot(node.id).map(x => x.typeName),
			dom: node.dom,
			component: node.component,
		}
	}

	highlight(target: number | InspectorNode | Node, ms = 1500): HTMLDivElement | null {
		const node =
			typeof target === "number"
				? this.getNodeById(target)
				: target instanceof Node
					? this.getClosestNodeFromDom(target)
					: target

		if (!node?.dom || !(node.dom instanceof Element)) return null

		const r = node.dom.getBoundingClientRect()
		const box = document.createElement("div")
		box.style.position = "fixed"
		box.style.left = r.left + "px"
		box.style.top = r.top + "px"
		box.style.width = r.width + "px"
		box.style.height = r.height + "px"
		box.style.border = "2px solid red"
		box.style.background = "rgba(255,0,0,0.08)"
		box.style.pointerEvents = "none"
		box.style.zIndex = "999999"
		box.style.borderRadius = "4px"

		document.body.appendChild(box)
		setTimeout(() => box.remove(), ms)

		return box
	}

	enableClickInspector(): this {
		this.disableClickInspector()

		this._clickHandler = (e: MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			const node = this.getClosestNodeFromDom(e.target as Node)
			if (!node) {
				console.log("No component found for", e.target)
				return
			}

			console.group("PreactTreeInspector")
			console.log("DOM:", e.target)
			console.log("Node:", node)
			console.log("Path:", this.getPathToRoot(node.id).map(x => x.typeName))
			console.groupEnd()

			this.highlight(node, 2000)
		}

		document.addEventListener("click", this._clickHandler, true)
		console.log("[PreactTreeInspector] Click inspector enabled")
		return this
	}

	disableClickInspector(): this {
		if (this._clickHandler) {
			document.removeEventListener("click", this._clickHandler, true)
			this._clickHandler = null
			console.log("[PreactTreeInspector] Click inspector disabled")
		}
		return this
	}

	startAutoRefresh(ms = 1000): this {
		this.stopAutoRefresh()
		this._interval = window.setInterval(() => this.refresh(), ms)
		return this
	}

	stopAutoRefresh(): this {
		if (this._interval != null) {
			clearInterval(this._interval)
			this._interval = null
		}
		return this
	}

	printTree(): void {
		if (this.rootId == null) return

		const walk = (id: number, indent = "") => {
			const node = this.nodes[id]
			if (!node) return

			console.log(`${indent}${this.getNodeLabel(node)}`)
			for (const childId of node.childIds) {
				walk(childId, indent + "  ")
			}
		}

		walk(this.rootId)
	}

	private getWrapperId(wrapper: PreactVNode): number {
		if (!this.wrapperToId.has(wrapper)) {
			this.wrapperToId.set(wrapper, this.nodes.length)
		}
		return this.wrapperToId.get(wrapper)!
	}

	private getRawType(node: PreactVNode): PreactVNodeType {
		return node?.type ?? node?.__c?.constructor ?? null
	}

	private getTypeName(type: PreactVNodeType, node: PreactVNode): string {
		if (typeof type === "string") return type

		if (typeof type === "function") {
			return (type as Function & { displayName?: string }).displayName || type.name || "(anonymous)"
		}

		if (type && typeof type === "object") {
			const maybeNamed = type as { displayName?: string; name?: string }
			return maybeNamed.displayName || maybeNamed.name || "(object-type)"
		}

		if (node?.__c?.constructor && typeof node.__c.constructor === "function") {
			const c = node.__c.constructor as Function & { displayName?: string }
			return c.displayName || c.name || "(instance)"
		}

		return "(unknown)"
	}

	private getNodeLabel(node: InspectorNode): string {
		const parts = [node.typeName]

		if (node.key != null) parts.push(`key=${String(node.key)}`)

		if (node.props && typeof node.props.className === "string") {
			parts.push(`.${node.props.className}`)
		}

		if (node.props && typeof node.props.id === "string") {
			parts.push(`#${node.props.id}`)
		}

		return parts.join(" ")
	}

	private getDomNode(node: PreactVNode): Node | null {
		return node?.__e || node?.__c?.base || null
	}

	private getChildren(node: PreactVNode): PreactVNode[] {
		return Array.isArray(node?.__k) ? node.__k.filter(Boolean) : []
	}

	private indexByType(typeName: string, rawType: PreactVNodeType, id: number): void {
		if (!this.byTypeName[typeName]) this.byTypeName[typeName] = []
		this.byTypeName[typeName].push(id)

		if (rawType && (typeof rawType === "function" || typeof rawType === "object")) {
			if (!this.byTypeRef.has(rawType)) this.byTypeRef.set(rawType, [])
			this.byTypeRef.get(rawType)!.push(id)
		}
	}

	private getDisplayName(type: PreactVNodeType, node: PreactVNode): string {
		if (typeof type === "string") return type

		if (typeof type === "function") {
			return (type as Function & { displayName?: string }).displayName || type.name || "(anonymous)"
		}

		if (type && typeof type === "object") {
			const maybeNamed = type as { displayName?: string; name?: string }
			return maybeNamed.displayName || maybeNamed.name || "(object-type)"
		}

		if (node?.__c?.constructor && typeof node.__c.constructor === "function") {
			const c = node.__c.constructor as Function & { displayName?: string }
			return c.displayName || c.name || "(instance)"
		}

		return "(unknown)"
	}

	private isMemoType(type: PreactVNodeType, node: PreactVNode): boolean {
		const name = this.getDisplayName(type, node)
		return typeof name === "string" && name.startsWith("Memo")
	}

	private extractMemoInnerName(displayName: string): string | null {
		// Handles:
		// Memo(Button)
		// MemoSomething
		// Memo[Button] (best effort)
		const parenMatch = /^Memo\((.+)\)$/.exec(displayName)
		if (parenMatch) return parenMatch[1]

		const bracketMatch = /^Memo\[(.+)\]$/.exec(displayName)
		if (bracketMatch) return bracketMatch[1]

		if (displayName === "Memo") return null
		if (displayName.startsWith("Memo")) return displayName.slice(4) || null

		return null
	}

	private classifyType(type: PreactVNodeType, node: PreactVNode): {
		kind: InspectorNodeKind
		typeName: string
		effectiveTypeName: string
		isMemo: boolean
		memoInnerName: string | null
	} {
		const typeName = this.getDisplayName(type, node)

		if (typeof type === "string") {
			return {
				kind: "host",
				typeName,
				effectiveTypeName: typeName,
				isMemo: false,
				memoInnerName: null,
			}
		}

		const isMemo = this.isMemoType(type, node)
		const memoInnerName = isMemo ? this.extractMemoInnerName(typeName) : null

		if (isMemo) {
			return {
				kind: "memo",
				typeName,
				effectiveTypeName: memoInnerName || typeName,
				isMemo: true,
				memoInnerName,
			}
		}

		if (type) {
			return {
				kind: "component",
				typeName,
				effectiveTypeName: typeName,
				isMemo: false,
				memoInnerName: null,
			}
		}

		return {
			kind: "unknown",
			typeName,
			effectiveTypeName: typeName,
			isMemo: false,
			memoInnerName: null,
		}
	}

	private visit(node: PreactVNode, depth: number, parentId: number | null): number | null {
		if (!node || typeof node !== "object") return null
		if (node instanceof Node) return null

		let id: number
		if (this.wrapperToId.has(node)) {
			id = this.wrapperToId.get(node)!
			return id
		} else {
			id = this.getWrapperId(node)
		}

		const rawType = this.getRawType(node)
		const typeInfo = this.classifyType(rawType, node)
		const dom = this.getDomNode(node)
		const component = node.__c ?? null
		const hooks = component?.__h ?? null

		const entry: InspectorNode = {
			id,
			typeName: typeInfo.typeName,
			effectiveTypeName: typeInfo.effectiveTypeName,
			rawType,
			kind: typeInfo.kind,
			isMemo: typeInfo.isMemo,
			memoInnerName: typeInfo.memoInnerName,

			depth,
			parentId,
			childIds: [],
			props: node.props ?? component?.props ?? null,
			state: component?.state ?? null,
			key: node.key ?? null,
			dom,
			wrapper: node,
			component,
			hooks,
		}

		this.nodes[id] = entry
		this.nodesById.set(id, entry)

		if (!this.reactElementsByDepth[depth]) this.reactElementsByDepth[depth] = []
		this.reactElementsByDepth[depth].push(id)

		this.indexByType(typeInfo.effectiveTypeName, rawType, id)

		if (dom instanceof Node) {
			this.domToId.set(dom, id)
			this.domToWrapper.set(dom, node)
		}

		const children = this.getChildren(node)
		for (const child of children) {
			const childId = this.visit(child, depth + 1, id)
			if (childId != null) {
				entry.childIds.push(childId)
			}
		}

		return id
	}
}
