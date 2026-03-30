import { NS, Server } from "../../@ns";
import { isNormalServer } from "./lib/helper";
import { exec } from "./exec2";
import { HostInfoDB } from "./HostInfoDB";
const RUN_PATH = "api/loop/grow.ts";
export async function main(ns: NS) {
	const runner = "lit";
	const target = "n00dles";
	ns.rm(RUN_PATH, runner);
	ns.scp(RUN_PATH, runner, "home");
	ns.rm("db/hosts.json", runner);
	ns.scp("db/hosts.json", runner, "home");
	const db = new HostInfoDB(ns);
	const runInfo = db.find(runner);
	const targetInfo = db.find(target);
	const runSrv = runInfo.server;
	const srv = targetInfo.server;
	if (runSrv == void 0) return ns.tprint("missing runSrv");
	if (srv == void 0) return ns.tprint("missing srv");
	if (!isNormalServer(srv)) {
		ns.tprint("!isNormalServer()");
		return;
	}
	if (srv.moneyMax == void 0) return ns.tprint("missing srv.moneyMax");
	if (srv.moneyAvailable === void 0) {
		return ns.tprint("missing srv.moneyAvailable");
	}
	if (srv.hackDifficulty === void 0) {
		return ns.tprint("missing srv.hackDifficulty");
	}
	if (srv.moneyMax <= 0) return ns.tprint("unable grow money");
	if (srv.moneyAvailable >= srv.moneyMax) {
		ns.tprint("unable to grow moneyAvailable on ", target);
		return;
	}
	const max_factor = srv.moneyMax / (srv.moneyAvailable + 1);
	let runThreads = Math.ceil(ns.growthAnalyze(target, max_factor)) - 1;
	const security_inc = ns.growthAnalyzeSecurity(runThreads);
	const recent_scripts = ns.getRecentScripts();
	for (const script of recent_scripts) {
		if (script.filename === RUN_PATH) {
			ns.ui.closeTail(script.pid);
			break;
		}
	}
	const script_ram = ns.getScriptRam(RUN_PATH, "home");
	const runMaxThreads = Math.floor(runSrv.maxRam / script_ram);
	if (runThreads > runMaxThreads) {
		runThreads = runMaxThreads;
	}
	ns.tprint("security increase ", security_inc);
	exec(ns, RUN_PATH, runner, runThreads, target, 1.05);
	await ns.nextPortWrite(1);
	const res = ns.readPort(1) as {
		target: string;
		server: Server;
	};
	srv.moneyAvailable = res.server.moneyMax;
	const orig_diff = srv.hackDifficulty;
	srv.hackDifficulty = ns.getServerSecurityLevel();
	ns.tprint("real security increase ", orig_diff - srv.hackDifficulty);
	db.save();
	ns.tprint(JSON.stringify(res, void 0, 2));
}
