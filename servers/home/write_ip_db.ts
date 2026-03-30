import { DarknetServerInfo } from "./darknet/types";

export function write_info_to_fs_db(
	ns: NS,
	info: DarknetServerInfo,
	cur_data?: string,
) {
	const srv = info.server;
	if (srv.ip === void 0 || srv.ip === "") {
		ns.tprint("missing ip field on srv.ip ", info);
		return;
	}
	const host = info.server.hostname;
	if (host === void 0 || host === "") {
		ns.tprint("missing hostname for ", info.server.ip);
		return;
	}
	const ip_save_path = `tmp/ip/${srv.ip}.txt`;
	const host_save_path = `tmp/host/${host.replaceAll(/[:]/g, "_")}.txt`;
	const new_content = JSON.stringify(info, void 0, "\t");
	if (new_content !== cur_data) {
		ns.write(ip_save_path, new_content, "w");
		ns.write(host_save_path, new_content, "w");
	}
}
