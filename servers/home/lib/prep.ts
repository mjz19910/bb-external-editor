
export type PrepPlan = {
	needWeaken: number;
	needGrow: number;
	needGrowWeaken: number;
	totalWeaken: number;
	isPrepped: boolean;
};

export function calcPrepPlan(ns: NS, target: string): PrepPlan {
	const sec = ns.getServerSecurityLevel(target);
	const minSec = ns.getServerMinSecurityLevel(target);
	const money = Math.max(1, ns.getServerMoneyAvailable(target));
	const maxMoney = Math.max(1, ns.getServerMaxMoney(target));

	const secDiff = Math.max(0, sec - minSec - 0.3);
	const weakenPerThread = ns.weakenAnalyze(1);
	const needWeaken = Math.ceil(secDiff / weakenPerThread);

	let needGrow = 0;
	let needGrowWeaken = 0;

	if (money < maxMoney * 0.35) {
		const growthFactor = maxMoney / money;
		needGrow = Math.ceil(ns.growthAnalyze(target, growthFactor));
		const growSec = ns.growthAnalyzeSecurity(needGrow);
		needGrowWeaken = Math.ceil(growSec / weakenPerThread);
	}

	const totalWeaken = needWeaken + needGrowWeaken;
	const isPrepped = needWeaken === 0 && needGrow === 0 &&
		needGrowWeaken === 0;

	return {
		needWeaken,
		needGrow,
		needGrowWeaken,
		totalWeaken,
		isPrepped,
	};
}

export function calcHackThreadsForPercent(
	ns: NS,
	target: string,
	percent = 0.1,
): number {
	const perThread = ns.hackAnalyze(target);
	if (perThread <= 0) return 0;
	return Math.max(1, Math.floor(percent / perThread));
}
