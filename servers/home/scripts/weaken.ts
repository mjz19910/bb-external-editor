export async function main(ns: NS) {
	await ns.weaken(String(ns.args[0]))
}