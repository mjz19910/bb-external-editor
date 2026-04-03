import { exec } from "./exec2"
import { HostInfoDB } from "./HostInfoDB"

const RUN_PATH = "gpt_pause/src/hack.ts"

export async function main(ns: NS) {
	const runner = "lit"
	const target = "n00dles"
	ns.rm(RUN_PATH, runner)
	ns.scp(RUN_PATH, runner, "home")
	ns.rm("gpt_pause/src/db/hosts.json", runner)
	ns.scp("gpt_pause/src/db/hosts.json", runner, "home")
	const db = new HostInfoDB(ns)
	const runnerInfo = db.find(runner)
	const targetInfo = db.find(target)
	const runnerSrv = runnerInfo.server
	const targetSrv = targetInfo.server
	if (runnerSrv == void 0) return ns.tprint("missing runnerSrv")
	if (targetSrv == void 0) return ns.tprint("missing targetSrv")
	if ("hasStasisLink" in targetSrv) {
		ns.tprint("no")
		return
	}
	if (targetSrv.moneyAvailable === void 0) {
		return ns.tprint("missing moneyAvailable on targetSrv")
	}
	if (targetSrv.moneyAvailable <= 0) {
		return ns.tprint("no moneyAvailable on target server")
	}
	const money_avail = targetSrv.moneyAvailable
	const hack_anal_threads = ns.hackAnalyzeThreads(target, money_avail)
	if (hack_anal_threads <= 0) {
		return ns.tprint("hacking ", target, " is useless")
	}
	const runnerThreads = Math.ceil(hack_anal_threads)
	ns.tprint("hackAnalyzeThreads ", hack_anal_threads)
	ns.tprint("hackAnalyze ", ns.hackAnalyze(target) * runnerThreads)
	const script_ram = ns.getScriptRam(RUN_PATH, "home")
	const runnerMaxThreads = Math.floor(runnerSrv.maxRam / script_ram)
	if (runnerThreads > runnerMaxThreads) {
		return ns.tprint("not enough ram on runner server")
	}
	exec(ns, RUN_PATH, runner, runnerThreads, target, 0)
	await ns.nextPortWrite(1)
	const res = ns.readPort(1) as {
		target: string
		server: Server
	}
	targetSrv.moneyAvailable = res.server.moneyAvailable
	targetSrv.hackDifficulty = res.server.hackDifficulty
	db.save()
	ns.tprint(JSON.stringify(res, void 0, 2))
}
