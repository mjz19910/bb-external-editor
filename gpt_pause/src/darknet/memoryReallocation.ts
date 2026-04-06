import { DnetNotifyMemoryReallocation, ScriptPort } from "../ScriptPort"

export async function main(ns: NS) {
	const [runner, threads, port] = ns.args as [string, number, number]
	const com = new ScriptPort(ns, port)
	const result = await ns.dnet.memoryReallocation()
	com.mustWrite<DnetNotifyMemoryReallocation>({
		type: "memory_reallocation",
		runner,
		threads,
		result,
	})
}
