export async function main(ns: NS) {
	let runner = ns.getHostname()
	if (runner === "home") runner = "darkweb"
	ns.scp([
		"api/dnet/probe.ts",
		"api/dnet/stasis.ts",
		"api/dnet/update_probe.ts",
	], runner, "home")
	ns.tprint("scp dnet files to ", runner)
}