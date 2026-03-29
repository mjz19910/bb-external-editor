export async function main(ns: NS) {
	const f = ns.flags([["port", 1]]) as {
		port: number;
		_: ScriptArg[];
	}
	const p = ns.getPortHandle(f.port)
	const res = await ns.dnet.nextMutation()
	p.write(res)
}