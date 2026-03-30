import { isNormalServer } from "../lib/helper";

interface RunnerState {
	target: string;
	hackPct: number;
	threads: Threads; // current allocated threads
	lastFeedback?: RunnerFeedback;
}

interface StateFile {
	runner: RunnerState | null;
	updatedAt: number; // timestamp in ms
	nextScriptId: number; // next unique script ID to use
}

const STATE_FILE = "/tmp/hgw_state.json";

function readState(ns: NS): StateFile {
	if (!ns.fileExists(STATE_FILE, "home")) {
		return { runner: null, updatedAt: Date.now(), nextScriptId: 1 };
	}
	try {
		const data = ns.read(STATE_FILE);
		return JSON.parse(data) as StateFile;
	} catch {
		ns.tprint("Failed to parse HGW state, resetting");
		return { runner: null, updatedAt: Date.now(), nextScriptId: 1 };
	}
}

function writeState(ns: NS, state: StateFile) {
	state.updatedAt = Date.now();
	ns.write(STATE_FILE, JSON.stringify(state, null, 2), "w");
}

type HackFeedback = {
	type: "hack";
	target: string;
	workerId: number;
	h: number;
	moneyStolen: number;
};

type GrowFeedback = {
	type: "grow";
	target: string;
	workerId: number;
	g: number;
	grown: number;
};

type WeakenHackFeedback = {
	type: "weakenHack";
	target: string;
	workerId: number;
	w1: number;
	weakened: number;
};

type WeakenGrowFeedback = {
	type: "weakenGrow";
	target: string;
	workerId: number;
	w2: number;
	weakened: number;
};

// Union of all feedback types
export type RunnerFeedback =
	| HackFeedback
	| GrowFeedback
	| WeakenHackFeedback
	| WeakenGrowFeedback;

type Threads = { h: number; g: number; w1: number; w2: number };

class BaseWorkerScript {
	constructor(
		public id: number,
		public name: string,
		public threads: number,
	) {}
}

class HackWorkerScript extends BaseWorkerScript {
	type: "hack" = "hack";
	ram_amount: 1.7 = 1.7;

	constructor(id: number, threads: number) {
		super(id, `tmp/hgw_hack.ts`, threads);
	}
}

class GrowWorkerScript extends BaseWorkerScript {
	type: "grow" = "grow";
	ram_amount: 1.75 = 1.75;

	constructor(id: number, threads: number) {
		super(id, `tmp/hgw_grow.ts`, threads);
	}
}

class WeakenWorkerScript extends BaseWorkerScript {
	type: "weaken" = "weaken";
	ram_amount: 1.75 = 1.75;

	constructor(id: number, public subtype: "w1" | "w2", threads: number) {
		super(id, `tmp/hgw_weak.ts`, threads);
	}
}

type WorkerScript = HackWorkerScript | GrowWorkerScript | WeakenWorkerScript;

export function estimateThreads(
	ns: NS,
	target: string,
	hackPct: number,
	availableRam: number,
): Threads {
	const f = ns.formulas.hacking;
	const player = ns.getPlayer();
	const server = ns.getServer(target);

	if (!isNormalServer(server)) throw new Error("unexpected darknet server");
	if (server.moneyMax == void 0) throw new Error("server without max money");

	const hackPercentPerThread = f.hackPercent(server, player);
	const h = Math.ceil(hackPct / hackPercentPerThread);
	const moneyAfterHack = server.moneyMax * (1 - h * hackPercentPerThread);

	const baseGrowth = f.growPercent(server, 1, player);
	const g = Math.ceil(
		Math.log(server.moneyMax / Math.max(1, moneyAfterHack)) /
			Math.log(baseGrowth),
	);

	const hackSec = h * 0.002;
	const growSec = g * 0.004;
	const w1 = Math.ceil(hackSec / 0.05);
	const w2 = Math.ceil(growSec / 0.05);

	const RAM_HACK = 1.7;
	const RAM_GROW = 1.75;
	const RAM_WEAKEN = 1.75;

	const batchRam = h * RAM_HACK + g * RAM_GROW + (w1 + w2) * RAM_WEAKEN;
	const scale = Math.min(1, availableRam / batchRam);

	return {
		h: Math.max(1, Math.floor(h * scale)),
		g: Math.max(1, Math.floor(g * scale)),
		w1: Math.max(1, Math.floor(w1 * scale)),
		w2: Math.max(1, Math.floor(w2 * scale)),
	};
}

export function adjustThreads(
	currentThreads: Threads,
	feedback: RunnerFeedback,
	ns: NS,
	hackPct: number,
): Threads {
	const next = { ...currentThreads };

	switch (feedback.type) {
		case "hack": {
			const serverMax = ns.getServerMaxMoney(feedback.target);
			const actualPct = feedback.moneyStolen / Math.max(serverMax, 1);
			const factor = hackPct / Math.max(actualPct, 0.001);
			next.h = Math.max(1, Math.ceil(next.h * factor));
			break;
		}

		case "grow":
			next.g = Math.max(1, feedback.g);
			break;

		case "weakenHack":
			next.w1 = Math.max(1, feedback.w1);
			break;

		case "weakenGrow":
			next.w2 = Math.max(1, feedback.w2);
			break;
	}

	return next;
}

export function start_script(
	ns: NS,
	script: WorkerScript,
	target: string,
	server: Server,
) {
	if (script.threads <= 0) return false;

	const args: (string | number)[] = [target, script.threads, script.id];
	if ("subtype" in script) args.push(script.subtype);

	const pid = ns.exec(script.name, server.hostname, script.threads, ...args);

	if (pid > 0) {
		server.ramUsed += script.threads * script.ram_amount;
		return true;
	}

	if (server.hostname !== "home") ns.rm(script.name, server.hostname);
	ns.rm(script.name, "home");
	return false;
}

export function handleFeedback(ns: NS, fb: RunnerFeedback) {
	switch (fb.type) {
		case "hack":
			ns.tprint(
				`[hack] target=${fb.target} worker=${fb.workerId} h=${fb.h} stolen=${fb.moneyStolen}`,
			);
			break;
		case "grow":
			ns.tprint(
				`[grow] target=${fb.target} worker=${fb.workerId} g=${fb.g} grown=${fb.grown}`,
			);
			break;
		case "weakenHack":
			ns.tprint(
				`[weakenHack] target=${fb.target} worker=${fb.workerId} w1=${fb.w1} weakened=${fb.weakened}`,
			);
			break;
		case "weakenGrow":
			ns.tprint(
				`[weakenGrow] target=${fb.target} worker=${fb.workerId} w2=${fb.w2} weakened=${fb.weakened}`,
			);
			break;
	}
}

export function drainAllFeedback(
	ns: NS,
	target: string,
	activeScripts: Map<string, WorkerScript[]>,
	servers: Server[],
	currentThreads: Threads,
	hackPct: number,
): Threads {
	let nextThreads = { ...currentThreads };
	let raw: string | number;

	while ((raw = ns.readPort(1)) !== "NULL PORT DATA") {
		if (typeof raw !== "string") continue;

		let fb: RunnerFeedback;
		try {
			fb = JSON.parse(raw) as RunnerFeedback;
		} catch {
			ns.tprint(`[WARN] Failed to parse port data: ${raw}`);
			continue;
		}

		if (fb.target !== target) continue;

		handleFeedback(ns, fb);
		nextThreads = adjustThreads(nextThreads, fb, ns, hackPct);

		for (const server of servers) {
			const scripts = activeScripts.get(server.hostname);
			if (!scripts) continue;

			const idx = scripts.findIndex((s) => s.id === fb.workerId);
			if (idx === -1) continue;

			const script = scripts[idx];
			const released = script.threads * script.ram_amount;

			server.ramUsed -= released;
			server.ramUsed = Math.max(server.ramUsed, 0);

			scripts.splice(idx, 1);

			ns.print(
				`[RAM RELEASE] server=${server.hostname} worker=${fb.workerId} ` +
					`type=${fb.type} released=${released.toFixed(2)}GB ` +
					`used=${server.ramUsed.toFixed(2)}/${server.maxRam}`,
			);

			break;
		}
	}

	return nextThreads;
}

export async function run_forever(ns: NS, target: string, hackPct = 0.05) {
	const purchasedServers = ns.cloud.getServerNames();
	if (purchasedServers.length === 0) {
		ns.tprint("No purchased servers found");
		return;
	}

	const files = [
		`tmp/hgw_hack.ts`,
		`tmp/hgw_grow.ts`,
		`tmp/hgw_weak.ts`,
	];

	const activeScripts = new Map<string, WorkerScript[]>();

	for (const hostname of purchasedServers) {
		activeScripts.set(hostname, []);
		if (hostname !== "home") {
			ns.scp(files, hostname);
		}
	}

	ns.atExit(() => {
		for (const hostname of purchasedServers) {
			if (hostname === "home") continue;
			for (const file of files) {
				ns.rm(file, hostname);
			}
		}
	});

	let currentThreads: Threads = { h: 1, g: 1, w1: 1, w2: 1 };

	while (true) {
		const servers = purchasedServers.map((hostname) => {
			const server = ns.getServer(hostname);
			if (!isNormalServer(server)) {
				throw new Error("Unable to handle darknet servers");
			}
			return server;
		});

		currentThreads = drainAllFeedback(
			ns,
			target,
			activeScripts,
			servers,
			currentThreads,
			hackPct,
		);

		for (const server of servers) {
			const freeRam = server.maxRam - server.ramUsed;
			const minBatchRam = 1.7 + 1.75 + 1.75 + 1.75;

			if (freeRam < minBatchRam) continue;

			const batchThreads = estimateThreads(ns, target, hackPct, freeRam);
			const [hackId, growId, w1Id, w2Id] = getNextScriptIds(ns, 4);

			const scripts: WorkerScript[] = [
				new HackWorkerScript(hackId, batchThreads.h),
				new GrowWorkerScript(growId, batchThreads.g),
				new WeakenWorkerScript(w1Id, "w1", batchThreads.w1),
				new WeakenWorkerScript(w2Id, "w2", batchThreads.w2),
			];

			for (const script of scripts) {
				if (start_script(ns, script, target, server)) {
					activeScripts.get(server.hostname)!.push(script);
				}
			}
		}

		await ns.sleep(50);
	}
}

export function getNextScriptIds(ns: NS, count: number): number[] {
	const state = readState(ns);
	const ids: number[] = [];

	for (let i = 0; i < count; i++) {
		ids.push(state.nextScriptId++);
	}

	writeState(ns, state);
	return ids;
}

export async function main(ns: NS) {
	ns.disableLog("sleep");
	ns.disableLog("exec");
	ns.disableLog("getServerUsedRam");
	ns.disableLog("getServerMaxRam");

	const target = ns.args[0];
	if (typeof target !== "string" || !target) {
		ns.tprint(`Usage: run hgw_scheduler.ts <target>`);
		return;
	}

	ns.ui.openTail();

	await run_forever(ns, target);
}
