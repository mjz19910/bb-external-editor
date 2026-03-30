export async function main(ns: NS) {
	const hackScript = "src/hack2.ts";
	const growScript = "src/grow2.ts";
	const weakenScript = "tmp/weak.ts";
	const a0 = ns.args.shift();
	if (typeof a0 != "string" && typeof a0 != "undefined") {
		return ns.tprint("no scp target");
	}
	const target = a0 ?? "worker-01";
	if (target === "home") {
		return ns.tprint("target not allowed to be home");
	}
	if (!ns.fileExists("NetscriptDefinitions.d.ts", target)) {
		ns.scp("NetscriptDefinitions.d.ts", target);
	}
	if (ns.fileExists("_/hack.ts", target)) {
		ns.rm("_/hack.ts", target);
		ns.rm("_/grow.ts", target);
		ns.rm("_/weak.ts", target);
		ns.rm("auto_hack.ts", target);
	}
	ns.write("_/hack.ts", ns.read(hackScript), "w");
	ns.scp("_/hack.ts", target);
	ns.write("_/grow.ts", ns.read(growScript), "w");
	ns.scp("_/grow.ts", target);
	ns.write("_/weak.ts", ns.read(weakenScript), "w");
	ns.scp("_/weak.ts", target);
	ns.scp("auto_hack.ts", target);
}
