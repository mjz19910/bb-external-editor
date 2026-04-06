
export async function main(ns: NS) {
	const target = ns.args[0]
	if (typeof target != "string") return ns.tprint("invalid target " + target)
	const threads = ns.args[1]
	if (typeof threads != "number") {
		return ns.tprint("invalid threads " + threads)
	}
	const id = ns.args[2]
	if (typeof id != "number") throw new Error("Missing id")
	const grown = await ns.grow(target, { threads })
	ns.tryWritePort(1, {
		type: "grow",
		workerId: id,
		target,
		g: threads,
		grown,
	})
}
