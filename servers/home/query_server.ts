import { DarknetServer } from "./darknet/misc";
import { DarknetServerInfo } from "./darknet/types";
import { OnlineServersMessage } from "./type/helper";
import { ScriptPort } from "./type/ScriptPort";
import { write_info_to_fs_db } from "./write_ip_db";

export async function main(ns: NS) {
	const port = new ScriptPort(ns, 1);
	const port2 = new ScriptPort(ns, 2);
	for await (const { v } of start_read_loop<string>(port2)) {
		const [query_cmd, query_arg] = v.split(" ");
		const args = query_arg === "" ? [] : query_arg.split(",");
		handle_query(ns, port, query_cmd, args);
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
			handle_online_check(ns, args, port);
			break;
		default:
			ns.tprint("unable to handle message of type ", query_cmd);
			break;
	}
}

function handle_online_check(
	ns: NS,
	args: string[],
	port: ScriptPort<OnlineServersMessage>,
) {
	const servers: DarknetServer[] = [];
	const alt_servers: Server[] = [];
	for (const ip of args) {
		const srv = ns.getServer(ip);
		if ("isOnline" in srv) servers.push(srv);
		else alt_servers.push(srv);
	}
	port.write({
		type: "online_servers",
		result: {
			darkweb: servers,
			normal: alt_servers,
		},
	});
}

type A<T> = AsyncGenerator<{ v: T }, void, void>;
type B<T> = ScriptPort<T>;
async function* start_read_loop<T>(port: B<T>): A<T> {
	for (;;) {
		const res = port.readOpt<T>();
		if (res.type === "None") {
			await port.nextWrite();
			continue;
		}
		yield { v: res.value };
	}
}

export function update_ip_files(ns: NS) {
	const ip_db_files = ns.ls("home", "tmp/ip/");
	for (const file of ip_db_files) {
		const file_data = ns.read(file);
		const info: DarknetServerInfo = JSON.parse(file_data);
		const srv = ns.getServer(info.ip) as DarknetServer;
		info.server = srv;
		write_info_to_fs_db(ns, info, file_data);
	}
}
