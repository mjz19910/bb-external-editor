export async function main(ns: NS) {
	const target = ns.args[0]

	if (typeof target !== "string") {
		ns.tprint("ERROR: Missing target argument.")
		return
	}

	while (true) {
		await ns.weaken(target)
	}
}