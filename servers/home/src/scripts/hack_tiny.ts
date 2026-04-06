export async function main(ns: NS) {
	const target = String(ns.args[0])
	await ns.hack(target)
}