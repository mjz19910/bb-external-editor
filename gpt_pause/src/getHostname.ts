import { ScriptPort } from "./ScriptPort"

export async function main(ns: NS) {
	const port = ScriptPort.open_api_port(ns)
	const hostname = ns.getHostname()
	port.mustWrite({
		type: "getHostname",
		hostname,
	})
}
