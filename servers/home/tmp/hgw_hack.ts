export async function main(ns: NS) {
	const target = ns.args[0];
	if (typeof target != "string") return ns.tprint("invalid target " + target)
	const threads = ns.args[1];
	if (typeof threads != "number") return ns.tprint("invalid threads " + threads)
	const id = ns.args[2];
	if (typeof id != "number") throw new Error("Missing id");
	const hacked = await ns.hack(target, { threads });
	ns.tryWritePort(1, {
		type: "hack",
		moneyStolen: hacked,
		workerId: id,
		target,
		h: threads,
	});
}