import { dnet_files, DarknetServer, DarknetServerInfo } from "types/dnet_types"

function post_dnet_probe(ns: NS, runner: string, port: number) {
	const infos: DarknetServerInfo[] = []
	const idxs = new Map<string, number>()
	const targets = ns.dnet.probe()
	for (const trg of targets) {
		ns.tprint(`[${trg} /]`)
		const ad = ns.dnet.getServerAuthDetails(trg)
		const info: DarknetServerInfo = {
			type: "server_info",
			parent: runner,
			host: trg,
			authDetails: ad,
			server: null,
			key: null,
			connectedToParent: true,
		}
		const idx = infos.push(info) - 1
		idxs.set(trg, idx)
	}
}
export async function main(ns: NS) {
	const f = ns.flags([["runner", "home"], ["threads", 1], ["port", 1]]) as {
		runner: string
		threads: number
		port: number
		_: ScriptArg[]
	}
	const { runner, port, _: args } = f;
	if (args.length > 0) {
		ns.tprint("extra args for dnet probe_one ", JSON.stringify(args))
		return
	}
	post_dnet_probe(ns, runner, port)
}