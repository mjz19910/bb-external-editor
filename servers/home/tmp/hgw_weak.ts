export async function main(ns: NS) {
	const target = ns.args[0];
	if (typeof target != "string") return ns.tprint("invalid target " + target)
	const threads = ns.args[1];
	if (typeof threads != "number") return ns.tprint("invalid threads " + threads)
	const id = ns.args[2];
	if (typeof id != "number") throw new Error("Missing id");
	const type = ns.args[3];
	if (type != "w1" && type != "w2") return ns.tprint("invalid weaken type " + type);
	const weakened = await ns.weaken(target, { threads });
	const msg = make_msg(type, id, target, threads, weakened)
	ns.tryWritePort(1, msg);
}

function make_msg(subtype: "w1" | "w2", id: number, target: string, threads: number, weakened: number) {
	if (subtype === "w1") {
		return {
			type: "weakenHack" as const,
			workerId: id,
			target,
			w1: threads,
			weakened
		};

	}
	return {
		type: "weakenGrow" as const,
		workerId: id,
		target,
		w2: threads,
		weakened
	};
}