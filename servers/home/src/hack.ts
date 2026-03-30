import { HostInfoDB } from "./HostInfoDB";

export async function main(ns: NS) {
	const f = ns.flags([["runner", "home"], ["threads", 1]]) as {
		runner: string;
		threads: number;
		_: ScriptArg[];
	};
	if (f._[0] === void 0 || typeof f._[0] !== "string") {
		ns.tprint("ERROR no hack target");
		return;
	}
	if (f._[1] === void 0 || typeof f._[1] !== "number") {
		ns.tprint("ERROR no earnings min");
		return;
	}
	const target = f._[0];
	const earnings_min = f._[1];
	const runner = f.runner;
	const threads = f.threads;
	const db = new HostInfoDB(ns);
	const targetInfo = db.find(target);
	if (targetInfo === void 0) {
		ns.tprint("missing targetSrv");
		return;
	}
	const targetSrv = targetInfo.server as Server;
	if (targetSrv === null) {
		ns.tprint("missing targetSrv");
		return;
	}
	if (targetSrv.moneyAvailable === void 0) {
		ns.tprint("missing moneyAvailable");
		return;
	}
	if (targetSrv.hackDifficulty === void 0) {
		ns.tprint("missing hackDifficulty");
		return;
	}
	if (targetSrv.minDifficulty === void 0) {
		ns.tprint("missing minDifficulty");
		return;
	}
	let earned_total = 0;
	const num_fmt = ns.format.number;
	while (true) {
		ns.tprint(`hack ${target} on ${runner} (t=${threads})`);
		let earned = await ns.hack(target);
		ns.tprint(
			`hack ${target} for ${num_fmt(earned)}(${earned}) (t=${threads})`,
		);
		earned_total += earned;
		targetSrv.moneyAvailable -= earned;
		targetSrv.hackDifficulty += threads * 0.002;
		if (earned == targetSrv.moneyMax || earned <= earnings_min) break;
	}
	ns.print(
		"hack ",
		target,
		" earned ",
		num_fmt(earned_total),
		" ",
		earned_total,
	);
	db.save();
	ns.writePort(1, {
		target,
		server: targetSrv,
	});
	setTimeout(function () {
		const doc = globalThis["document"];
		const btns = doc.querySelectorAll<HTMLElement>(
			'.react-draggable:has([title^="api/loop/hack."]) [title=Collapse]',
		);
		for (const collapse_btn of btns) {
			collapse_btn.click();
		}
	}, 2500);
}
export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
	if (args.length === 0) return data.servers;
	if (typeof args[0] != "string") return [];
	if (data.servers.includes(args[0])) return [];
	return data.servers;
}
