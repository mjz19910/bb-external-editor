import { NS, ScriptArg } from "../../@ns";
import { DarknetServerInfo } from "../../darknet/types";

function post_dnet_probe(ns: NS, runner: string, port: number) {
	const infos: DarknetServerInfo[] = [];
	const idxs = new Map<string, number>();
	const ips = ns.dnet.probe(true);
	for (const ip of ips) {
		ns.tprint(`[${ip} /]`);
		const ad = ns.dnet.getServerAuthDetails(ip);
		const info: DarknetServerInfo = {
			parent: runner,
			ip,
			authDetails: ad,
			connectedToParent: true,
		};
		const idx = infos.push(info) - 1;
		idxs.set(ip, idx);
	}
}
export async function main(ns: NS) {
	const f = ns.flags([["runner", "home"], ["threads", 1], ["port", 1]]) as {
		runner: string;
		threads: number;
		port: number;
		_: ScriptArg[];
	};
	const { runner, port, _: args } = f;
	if (args.length > 0) {
		ns.tprint("extra args for dnet probe_one ", JSON.stringify(args));
		return;
	}
	post_dnet_probe(ns, runner, port);
}
