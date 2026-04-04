function makeGraphSerializer(root) {
	const seen = new WeakMap()
	const objects = []

	function saveObj(value) {
		const idx = objects.push(value) - 1
		seen.set(value, idx)
		return idx
	}

	function isSkippableObject(v) {
		if (v == null) return false
		if (v instanceof Node) return true
		// if ("$$typeof" in v) return true; // skip React elements
		return false
	}

	const json = JSON.stringify(root, function (_key, value) {
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
			return value
		}

		if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
			return undefined
		}

		if (typeof value === "object") {
			if (isSkippableObject(value)) return undefined
			if (Array.isArray(value) && value.length === 0) return value

			if (seen.has(value)) {
				return {
					$ref: seen.get(value)
				}
			}

			const id = saveObj(value)

			if (Array.isArray(value)) return value

			return {
				$id: id,
				...value
			}
		}

		return value
	}, 2)

	return {
		json,
		objects,
		seen,
	}
}

function _t1() {
	const target = app.__k
	const result = makeGraphSerializer(target)
	result.objects
}

function inspectReactTree(root) {
	const seen = new WeakMap()
	const objects = []
	const reactElementsByDepth = []
	const domElements = []
	const domWrappers = []

	function getId(obj) {
		if (!seen.has(obj)) {
			seen.set(obj, objects.length)
			objects.push(obj)
		}
		return seen.get(obj)
	}

	function walk(node, depth = 0, parentId = null) {
		if (!node || typeof node !== "object") return null
		if (node instanceof Node) return null

		const id = getId(node)

		if (!reactElementsByDepth[depth]) {
			reactElementsByDepth[depth] = []
		}
		reactElementsByDepth[depth].push(id)

		const out = {
			id,
			parentId,
			depth,
			type: node.type?.name || node.type || null,
			key: node.key ?? null,
			props: node.props ?? null,
			state: node.state ?? node.__s ?? null,
			children: [],
			dom: null,
		}

		// common React/Preact-ish DOM link guesses
		const dom = node.base || node.__e || node.stateNode || null
		if (dom instanceof Node) {
			out.dom = dom
			domElements.push(dom)
			domWrappers.push(node)
		}

		// common child slots in React/Preact internals
		const possibleChildren = []

		if (Array.isArray(node.props?.children)) {
			possibleChildren.push(...node.props.children)
		} else if (node.props?.children) {
			possibleChildren.push(node.props.children)
		}

		if (node.__k && Array.isArray(node.__k)) {
			possibleChildren.push(...node.__k)
		}

		for (const child of possibleChildren) {
			if (child && typeof child === "object" && !(child instanceof Node)) {
				const childInfo = walk(child, depth + 1, id)
				if (childInfo) out.children.push(childInfo.id)
			}
		}

		return out
	}

	const tree = walk(root)

	return {
		tree,
		objects,
		reactElementsByDepth,
		domElements,
		domWrappers,
	}
}

function _t2() {
	const result = inspectReactTree(app.__k)
	console.log(result)
	result
}
