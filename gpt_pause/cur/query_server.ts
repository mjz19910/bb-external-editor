import { DarknetServerInfo, OnlineServersMessage, ScriptPort } from "../cur2/ScriptPort"
import { write_info_to_fs_db } from "./write_ip_db"

export async function main(ns: NS) {
	const port = ScriptPort.open_request_port(ns)
	const port2 = ScriptPort.open_reply_port(ns)
	for await (const v of start_read_loop(port2)) {
		const { cmd, args } = v
		handle_query(ns, port, cmd, args)
	}
}

function handle_query(
	ns: NS,
	port: ScriptPort<OnlineServersMessage>,
	query_cmd: string,
	args: string[],
) {
	switch (query_cmd) {
		case "online_check":
			handle_online_check(ns, args, port)
			break
		default:
			ns.tprint("unable to handle message of type ", query_cmd)
			break
	}
}

function handle_online_check(
	ns: NS,
	args: string[],
	port: ScriptPort<OnlineServersMessage>,
) {
	const servers: DarknetServerData[] = []
	const alt_servers: Server[] = []
	for (const ip of args) {
		const srv = ns.getServer(ip)
		if ("isOnline" in srv) servers.push(srv)
		else alt_servers.push(srv)
	}
	port.write({
		type: "online_servers",
		result: {
			darkweb: servers,
			normal: alt_servers,
		},
	})
}

type A<T> = AsyncGenerator<T, void, void>
type B<T> = ScriptPort<T>
async function* start_read_loop<T>(port: B<T>): A<T> {
	for (; ;) {
		while (!port.empty()) {
			yield port.read<T>()
		}
		await port.nextWrite()
	}
}

export function update_ip_files(ns: NS) {
	const ip_db_files = ns.ls("home", "tmp/ip/")
	for (const file of ip_db_files) {
		const file_data = ns.read(file)
		const info: DarknetServerInfo = JSON.parse(file_data)
		const srv = ns.getServer(info.ip)
		if ("hasStasisLink" in srv) {
			info.server = srv
			write_info_to_fs_db(ns, info, file_data)
		} else {
			ns.tprint("invalid darknet server to query ", ns.dnsLookup(info.ip))
		}
	}
}
