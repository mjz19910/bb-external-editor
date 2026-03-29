export async function main(ns: NS) {
	const max_threads = Math.floor(ns.getServerMaxRam() / 4)
	ns.tprintRaw(`run api/loop/share.ts -t ${max_threads}`)
}