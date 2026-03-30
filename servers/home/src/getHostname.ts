import { NS } from "../@ns";
import { ScriptPort } from "../type/ScriptPort";

export async function main(ns: NS) {
	const port = ScriptPort.open_api_port(ns);
	const hostname = ns.getHostname();
	port.write({
		type: "getHostname",
		hostname,
	});
}
