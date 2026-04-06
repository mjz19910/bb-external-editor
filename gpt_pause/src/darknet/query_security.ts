import { PortReleaseMsg, ScriptPort } from "../ScriptPort"

export async function main(ns: NS) {
	const reply_port = ScriptPort.open_request_port(ns)
	const com_port = ScriptPort.open_api_port(ns)
	const res = com_port.readOpt()
	if (res.type === "None") {
		return ns.tprint("port(3): nothing to query")
	}
	const { value: msg } = res
	if (msg.type !== "query_security") return
	ns.tprint("query getting server auth details")
	const infos = msg.infos
	for (const info of infos) {
		const ad = ns.dnet.getServerAuthDetails(info.ip)
		info.authDetails = ad
	}
	reply_port.mustWrite<PortReleaseMsg>({
		type: "port_release",
		port: com_port.port_id,
		infos,
		updated_key: "authDetails",
	})
}
