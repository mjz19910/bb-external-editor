export async function main(ns: NS) {
	const res = await ns.dnet.setStasisLink(ns.args[0] as boolean)
	ns.tprint("stasis link ", res)
}