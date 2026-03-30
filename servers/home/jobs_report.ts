import { getJobSnapshot } from "./lib/jobs";

export async function main(ns: NS) {
	const snap = getJobSnapshot(ns);

	ns.tprint(`Total hack: ${snap.totalHack}`);
	ns.tprint(`Total grow: ${snap.totalGrow}`);
	ns.tprint(`Total weaken: ${snap.totalWeaken}`);
	ns.tprint(`Total threads: ${snap.totalJobs}`);
	ns.tprint("");

	const targets = Object.values(snap.byTarget).sort((a, b) =>
		b.total - a.total
	);

	if (targets.length === 0) {
		ns.tprint("No active worker jobs found.");
		return;
	}

	for (const t of targets) {
		ns.tprint(
			`${t.target.padEnd(20)} ` +
				`hack=${String(t.hack).padStart(5)} ` +
				`grow=${String(t.grow).padStart(5)} ` +
				`weak=${String(t.weaken).padStart(5)} ` +
				`total=${String(t.total).padStart(5)}`,
		);
	}
}
