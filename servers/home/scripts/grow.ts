export async function main(ns: NS) {
	await ns.grow(String(ns.args[0]))
}