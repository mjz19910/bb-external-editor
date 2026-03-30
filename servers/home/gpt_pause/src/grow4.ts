import { HostInfoDB } from "./HostInfoDB";

function resize_tail_with_char_size(ns: NS, width: number, height: number) {
	ns.ui.resizeTail(width * 9.64, 34 + height * 24);
}

export async function main(ns: NS) {
	const db = new HostInfoDB(ns);
	const f = ns.flags([
		["runner", "home"],
		["target", "n00dles"],
		["threads", 1],
	]) as {
		runner: string;
		target: string;
		threads: number;
		_: ScriptArg[];
	};
	const target = f.target;
	const srv = db.find(target).server as Server;
	if (srv === null) return ns.tprint("missing srv");
	if (srv.moneyAvailable === void 0) {
		return ns.tprint("missing moneyAvailable");
	}
	if (srv.moneyMax === void 0) return ns.tprint("missing moneyAvailable");
	const real_hd = ns.getServerSecurityLevel();
	if (srv.hackDifficulty! != real_hd) {
		ns.tprint(
			`serverSecurityLevel mismatch ${real_hd} != ${srv.hackDifficulty}`,
		);
		return;
	}
	if (srv.moneyAvailable >= srv.moneyMax) {
		ns.tprint("unable to grow moneyAvailable on ", target);
		return;
	}
	ns.ui.openTail();
	resize_tail_with_char_size(ns, 40, 3);
	await ns.grow(f.target);
	const grow_gain = srv.hackDifficulty! - ns.getServerSecurityLevel();
	srv.hackDifficulty! += grow_gain;
	ns.tprint("effect per thread ", grow_gain / f.threads);
}
