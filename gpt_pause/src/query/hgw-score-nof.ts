/** score-hwgw-nof.ts
 * Rank rooted servers for HWGW XP / money without Formulas.exe
 */

import { buildNetworkMap } from "../../../servers/home/lib/network_map";

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

function ceilSafe(n: number): number {
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.ceil(n);
}

function pad(s: string, len: number) {
	return s.length >= len ? s : s + " ".repeat(len - s.length);
}

function scoreTarget(ns: NS, target: string, hackPct = 0.01): ScoreRow | null {
	const maxMoney = ns.getServerMaxMoney(target);
	const minSec = ns.getServerMinSecurityLevel(target);
	const reqHack = ns.getServerRequiredHackingLevel(target);
	const serverGrowth = ns.getServerGrowth(target);

	if (maxMoney <= 0) return null;
	if (reqHack > ns.getHackingLevel() * 1.25) return null;
	if (serverGrowth <= 0) return null;

	const hackChance = ns.hackAnalyzeChance(target);
	const hackPercentPerThread = ns.hackAnalyze(target);
	const weakenTime = ns.getWeakenTime(target);

	if (!Number.isFinite(hackChance) || hackChance <= 0) return null;
	if (!Number.isFinite(hackPercentPerThread) || hackPercentPerThread <= 0) {
		return null;
	}
	if (!Number.isFinite(weakenTime) || weakenTime <= 0) return null;

	const h = ceilSafe(ns.hackAnalyzeThreads(target, maxMoney * hackPct));
	if (!Number.isFinite(h) || h <= 0) return null;

	const actualHackPct = Math.min(0.999999, h * hackPercentPerThread);
	const moneyAfterHack = maxMoney * (1 - actualHackPct);
	if (moneyAfterHack <= 0) return null;

	const growMult = maxMoney / Math.max(1, moneyAfterHack);
	const g = ceilSafe(ns.growthAnalyze(target, growMult));
	if (!Number.isFinite(g) || g <= 0) return null;

	const hackSec = h * 0.002;
	const growSec = g * 0.004;
	const w1 = ceilSafe(hackSec / 0.05);
	const w2 = ceilSafe(growSec / 0.05);

	const totalThreads = h + g + w1 + w2;
	if (totalThreads <= 0) return null;

	const RAM_HACK = 1.7;
	const RAM_GROW = 1.75;
	const RAM_WEAKEN = 1.75;

	const batchRam = h * RAM_HACK +
		g * RAM_GROW +
		(w1 + w2) * RAM_WEAKEN;

	if (!Number.isFinite(batchRam) || batchRam <= 0) return null;

	const moneyStolen = maxMoney * actualHackPct;

	const xpScore = totalThreads / batchRam / weakenTime;
	const moneyScore = moneyStolen / batchRam / weakenTime;

	return {
		target,
		hackPct: actualHackPct,

		weakenTime,
		hackChance,
		hackPercentPerThread,

		h,
		g,
		w1,
		w2,
		totalThreads,
		batchRam,

		moneyStolen,
		xpScore,
		moneyScore,

		minSec,
		maxMoney,
		reqHack,
		serverGrowth,
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
			pad("score", 7),
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
		ns.tprint(
			[
				pad(`"${r.target}"`, 20),
				pad(
					title.includes("XP")
						? (r.xpScore * (1 << 17)).toFixed(3)
						: r.moneyScore.toFixed(3),
					7,
				),
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
	const hackPct = Number(ns.args[0] ?? 0.05);

	const rooted = buildNetworkMap(ns)
		.allHosts
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
		`HWGW no-formulas scoring @ target steal ${
			(hackPct * 100).toFixed(2)
		}%`,
	);
	printTable(ns, "TOP 10 XP TARGETS", byXp);
	printTable(ns, "TOP 10 MONEY TARGETS", byMoney);
}
