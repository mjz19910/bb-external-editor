export async function main(ns: NS) {
	const target = String(ns.args[0] ?? "");
	const delay = Number(ns.args[1] ?? 0);

	if (!target) {
		ns.tprint("Usage: run grow.ts <target> [delay]");
		return;
	}

	await ns.grow(target, { additionalMsec: delay });
}
