export async function main(ns: NS) {
	for (; ;) {
		await ns.share()
		if (!ns.getPortHandle(3).empty()) break
	}
}