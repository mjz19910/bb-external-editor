import { DnetNotifyNextMutation, ScriptPort } from "../ScriptPort"

export async function main(ns: NS) {
	const f = ns.flags([["port", 1]]) as {
		port: number
		_: ScriptArg[]
	}
	const port_com = new ScriptPort(ns, f.port)
	await ns.dnet.nextMutation()
	port_com.mustWrite<DnetNotifyNextMutation>({
		type: "next_mutation"
	})
}
