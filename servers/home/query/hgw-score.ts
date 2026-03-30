/** hgw-score.ts
 * Rank rooted servers for HGW XP / money using Formulas.exe
 */

import { isNormalServer } from "../lib/helper";
import { Player, Server } from "../NetscriptDefinitions.d";

type ScoreRow = {
	target: string;
	hackPct: number;

	weakenTime: number;
	hackChance: number;
	hackPercentPerThread: number;

	h: number;
	g: number;
	w1: number;
	w2: number;
	totalThreads: number;
	batchRam: number;

	moneyStolen: number;
	xpScore: number;
	moneyScore: number;

	minSec: number;
	maxMoney: number;
	reqHack: number;
	serverGrowth: number;
};

function scanAll(ns: NS, start = "home"): string[] {
	const seen = new Set<string>();
	const q = [start];

	while (q.length > 0) {
		const host = q.shift()!;
		if (seen.has(host)) continue;
		seen.add(host);

		for (const n of ns.scan(host)) {
			if (!seen.has(n)) q.push(n);
		}
	}

	return [...seen];
}

function ceilSafe(n: number): number {
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.ceil(n);
}

function pad(s: string, len: number) {
	return s.length >= len ? s : s + " ".repeat(len - s.length);
}

// 1️⃣ Validate server
function isValidTarget(
	player: Player,
	server: Server,
	hackPct: number,
): boolean {
	if (server.moneyMax! <= 0) return false;
	if (server.requiredHackingSkill! > player.skills.hacking * 1.25) {
		return false;
	}
	if (server.serverGrowth! <= 0) return false;
	return true;
}

// 2️⃣ Compute hack threads
function calcHack(ns: NS, server: Server, player: Player, hackPct: number) {
	const f = ns.formulas.hacking;
	const hackPercentPerThread = f.hackPercent(server, player);
	const hackChance = f.hackChance(server, player);
	const h = ceilSafe(hackPct / hackPercentPerThread);
	const actualHackPct = Math.min(0.999999, h * hackPercentPerThread);
	const moneyAfterHack = server.moneyMax! * (1 - actualHackPct);
	return {
		h,
		hackPercentPerThread,
		hackChance,
		actualHackPct,
		moneyAfterHack,
	};
}

// 3️⃣ Compute grow threads
function calcGrow(
	ns: NS,
	server: Server,
	player: Player,
	moneyAfterHack: number,
) {
	const f = ns.formulas.hacking;
	const growMult = server.moneyMax! / Math.max(1, moneyAfterHack);
	const baseGrowth = f.growPercent(server, 1, player);
	const g = ceilSafe(Math.log(growMult) / Math.log(baseGrowth));
	return g;
}

// 4️⃣ Compute weaken threads
function calcWeaken(h: number, g: number) {
	const hackSec = h * 0.002;
	const growSec = g * 0.004;
	const w1 = ceilSafe(hackSec / 0.05);
	const w2 = ceilSafe(growSec / 0.05);
	return { w1, w2 };
}

// 5️⃣ Compute RAM and scale threads by available RAM
function calcBatchRam(
	h: number,
	g: number,
	w1: number,
	w2: number,
	availableRam: number,
) {
	const RAM_HACK = 1.7;
	const RAM_GROW = 1.75;
	const RAM_WEAKEN = 1.75;
	const batchRam = h * RAM_HACK + g * RAM_GROW + (w1 + w2) * RAM_WEAKEN;
	const ramScale = Math.min(1, availableRam / batchRam);
	return { batchRam, ramScale };
}

// 6️⃣ Compute final scores
function calcScores(
	h: number,
	g: number,
	w1: number,
	w2: number,
	batchRam: number,
	ramScale: number,
	weakenTime: number,
	moneyStolen: number,
) {
	const totalThreads = h + g + w1 + w2;
	const scaledThreads = totalThreads * ramScale;
	const batchSeconds = weakenTime / 1000;
	const xpPerMinute = scaledThreads / batchSeconds * 60;
	const moneyPerSecond = moneyStolen / batchSeconds * ramScale;
	return { totalThreads, xpPerMinute, moneyPerSecond };
}

// 🔹 Main scoreTarget using split parts
function scoreTarget(
	ns: NS,
	target: string,
	hackPct = 0.01,
	availableRam = 100,
): ScoreRow | null {
	const player = ns.getPlayer();
	const srv = ns.getServer(target);

	if (!isNormalServer(srv)) return null;

	if (!isValidTarget(player, srv, hackPct)) return null;

	const {
		h,
		hackPercentPerThread,
		hackChance,
		actualHackPct,
		moneyAfterHack,
	} = calcHack(ns, srv, player, hackPct);
	if (moneyAfterHack <= 0) return null;

	const g = calcGrow(ns, srv, player, moneyAfterHack);
	const { w1, w2 } = calcWeaken(h, g);

	const { batchRam, ramScale } = calcBatchRam(h, g, w1, w2, availableRam);
	const moneyStolen = srv.moneyMax! * actualHackPct;

	const { totalThreads, xpPerMinute, moneyPerSecond } = calcScores(
		h,
		g,
		w1,
		w2,
		batchRam,
		ramScale,
		ns.formulas.hacking.weakenTime(srv, player),
		moneyStolen,
	);

	return {
		target,
		hackPct: actualHackPct,
		weakenTime: ns.formulas.hacking.weakenTime(srv, player),
		hackChance,
		hackPercentPerThread,
		h,
		g,
		w1,
		w2,
		totalThreads,
		batchRam,
		moneyStolen,
		xpScore: xpPerMinute,
		moneyScore: moneyPerSecond,
		minSec: srv.minDifficulty!,
		maxMoney: srv.moneyMax!,
		reqHack: srv.requiredHackingSkill!,
		serverGrowth: srv.serverGrowth!,
	};
}

function fmtTime(ms: number): string {
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	return `${h}h${m}m${sec}s`;
}

function fmtNum(n: number): string {
	if (n >= 1e15) return (n / 1e15).toFixed(2) + "q";
	if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
	if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
	if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
	if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
	return n.toFixed(2);
}
function printTable(ns: NS, title: string, rows: ScoreRow[]) {
	ns.tprint("");
	ns.tprint(`=== ${title} ===`);
	ns.tprint(
		[
			pad("target", 20),
			pad("score", 12),
			pad("wt", 10),
			pad("hack%", 8),
			pad("chance", 8),
			pad("h/g/w/w", 18),
			pad("ram", 10),
			pad("money", 12),
			pad("max$", 12),
		].join(" "),
	);

	for (const r of rows.slice(0, 10)) {
		const scoreStr = title.includes("XP")
			? ns.format.number(r.xpScore * 60)
			: "$" + ns.format.number(r.moneyScore);

		ns.tprint(
			[
				pad(`"${r.target}"`, 20),
				pad(scoreStr, 12),
				pad(fmtTime(r.weakenTime), 10),
				pad((r.hackPct * 100).toFixed(2), 8),
				pad((r.hackChance * 100).toFixed(1), 8),
				pad(`${r.h}/${r.g}/${r.w1}/${r.w2}`, 18),
				pad(r.batchRam.toFixed(1), 10),
				pad(fmtNum(r.moneyStolen), 12),
				pad(fmtNum(r.maxMoney), 12),
			].join(" "),
		);
	}
}

export async function main(ns: NS) {
	if (!ns.fileExists("Formulas.exe")) {
		ns.tprint("Formulas.exe not found! Cannot score accurately.");
		return;
	}

	const hackPct = Number(ns.args[0] ?? 0.05);

	const rooted = scanAll(ns)
		.filter((s) => ns.hasRootAccess(s))
		.filter((s) => s !== "home")
		.filter((s) => ns.getServerMaxMoney(s) > 0);

	const rows: ScoreRow[] = [];

	for (const target of rooted) {
		const row = scoreTarget(ns, target, hackPct);
		if (row) rows.push(row);
	}

	if (rows.length === 0) {
		ns.tprint("No valid targets");
		return;
	}

	const byXp = [...rows].sort((a, b) => b.xpScore - a.xpScore);
	const byMoney = [...rows].sort((a, b) => b.moneyScore - a.moneyScore);

	ns.tprint(
		`HGW scoring (Formulas.exe) @ target steal ${
			(hackPct * 100).toFixed(2)
		}%`,
	);
	printTable(ns, "TOP 10 XP TARGETS", byXp);
	printTable(ns, "TOP 10 MONEY TARGETS", byMoney);
}
