export async function main(ns: NS) {
	await ns.hack(String(ns.args[0]))
}