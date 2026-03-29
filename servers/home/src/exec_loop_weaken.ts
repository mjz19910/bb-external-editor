import { Server } from "../NetscriptDefinitions.d";
import { exec } from "./exec2";
import { HostInfoDB } from "./HostInfoDB";
const RUN_PATH = "api/loop/weaken.ts";
export async function main(ns: NS) {
	const runner = "lit";
	const target = "n00dles";
	ns.rm(RUN_PATH, runner);
	ns.scp(RUN_PATH, runner, "home");
	ns.rm("db/hosts.json", runner);
	ns.scp("db/hosts.json", runner, "home");
	const db = new HostInfoDB(ns);
	const runSrv = db.find(runner).server;
	const srv = db.find(target).server;
	if (runSrv == void 0) return ns.tprint("missing runSrv");
	if (srv == void 0) return ns.tprint("missing srv");
	if (srv.hackDifficulty == srv.minDifficulty) {
		return ns.tprint("unable to weaken target");
	}
	const script_ram = ns.getScriptRam(RUN_PATH, "home");
	const runMaxThreads = Math.floor(runSrv.maxRam / script_ram);
	const difficultyChange = srv.hackDifficulty! - srv.minDifficulty!;
	const weaken_anal = ns.weakenAnalyze(1);
	let runThreads = Math.ceil(difficultyChange / weaken_anal);
	if (runThreads > runMaxThreads) runThreads = runMaxThreads;
	exec(ns, RUN_PATH, runner, runThreads, target);
	await ns.nextPortWrite(1);
	const res = ns.readPort(1) as {
		target: string;
		server: Server;
	};
	ns.tprint(JSON.stringify(res, void 0, 2));
	srv.moneyAvailable = res.server.moneyAvailable;
	srv.hackDifficulty = res.server.hackDifficulty;
	db.save();
}
