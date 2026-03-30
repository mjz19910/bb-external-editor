export async function main(ns: NS) {
	const pid = ns.exec(ns.args[0] as string, "home", 1);
	ns.tprint("started pid=", pid, " on home");
}
