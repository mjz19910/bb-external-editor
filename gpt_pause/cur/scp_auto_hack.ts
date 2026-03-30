
export async function main(ns: NS) {
	const a0 = ns.args.shift();
	if (typeof a0 != "string" && typeof a0 != "undefined") {
		return ns.tprint("no scp target");
	}
	const target = a0 ?? "worker-01";
	if (target === "home") {
		return ns.tprint("target not allowed to be home");
	}
	if (ns.fileExists("gpt_pause/src/_/hack.ts", target)) {
		ns.rm("gpt_pause/src/_/hack.ts", target);
		ns.rm("gpt_pause/src/_/grow.ts", target);
		ns.rm("gpt_pause/src/_/weak.ts", target);
		ns.rm("gpt_pause/src/auto_hack.ts", target);
	}
	ns.scp("gpt_pause/src/_/hack.ts", target);
	ns.scp("gpt_pause/src/_/grow.ts", target);
	ns.scp("gpt_pause/src/_/weak.ts", target);
	ns.scp("gpt_pause/src/auto_hack.ts", target);
}
