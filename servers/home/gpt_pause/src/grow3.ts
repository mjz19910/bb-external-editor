import { NS, ScriptArg, Server, AutocompleteData } from "../@ns";
import { HostInfoDB } from "./HostInfoDB";

export async function main(ns: NS) {
	const f = ns.flags([["runner", "home"], ["threads", 1]]) as {
		runner: string;
		threads: number;
		_: ScriptArg[];
	};
	if (f._[0] === void 0) {
		ns.tprint("ERROR missing grow target");
		return;
	}
	if (typeof f._[0] !== "string") {
		ns.tprint("ERROR invalid host");
		return;
	}
	if (f._[1] === void 0) {
		ns.tprint("ERROR provide grow min");
		return;
	}
	if (typeof f._[1] !== "number") {
		ns.tprint("ERROR invalid grow min");
		return;
	}
	const target = f._[0];
	const grow_min = f._[1];
	const runner = f.runner;
	const threads = f.threads;
	const db = new HostInfoDB(ns);
	const targetInfo = db.find(target);
	if (targetInfo.server == void 0) {
		ns.tprint("missing targetSrv");
		return;
	}
	const targetSrv = targetInfo.server as Server;
	if (targetSrv.moneyAvailable === void 0) {
		ns.tprint("missing moneyAvailable on targetSrv");
		return;
	}
	while (true) {
		ns.tprint(`grow ${target} on ${runner} (t=${threads})`);
		let result = await ns.grow(target);
		ns.tprint(`grow ${target} by ${result}`);
		if (targetSrv.moneyAvailable == 0) {
			targetSrv.moneyAvailable = 1;
		}
		targetSrv.moneyAvailable *= result;
		if (result < grow_min) break;
	}
	db.save();
	ns.writePort(1, {
		target,
		server: targetSrv,
	});
	setTimeout(function () {
		const btn = globalThis["document"].querySelector<HTMLElement>(
			'.react-draggable:has([title^="api/loop/grow."]) [title=Collapse]',
		)!;
		btn.click();
	}, 2500);
}

export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
	if (args.length === 0) return data.servers;
	if (args.length == 2) return [];
	if (typeof args[0] != "string") return [];
	if (data.servers.includes(args[0])) return ["1.05"];
	return data.servers;
}
