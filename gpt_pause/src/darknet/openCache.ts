import { DnetOpenCache, ScriptPort } from "../ScriptPort"

export async function main(ns: NS) {
	const trg = ns.args[0] as string
	const cache_file = ns.args[1] as string
	const port = ns.args[2] as number
	const result = ns.dnet.openCache(cache_file)
	const port_com = new ScriptPort(ns, port)
	port_com.mustWrite<DnetOpenCache>({
		type: "open_cache",
		target: trg,
		file: cache_file,
		result,
	})
}
