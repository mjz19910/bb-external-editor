import { DarknetServerInfo } from "./darknet/types";

export function write_info_to_fs_db(
	ns: NS,
	info: DarknetServerInfo,
	cur_data?: string,
) {
	const ip_save_path = `tmp/ip/${info.ip}.txt`;
	const host_save_path = `tmp/host/${info.host.replaceAll(/[:]/g, "_")}.txt`;
	const new_content = JSON.stringify(info, void 0, "\t");
	if (new_content !== cur_data) {
		ns.write(ip_save_path, new_content, "w");
		ns.write(host_save_path, new_content, "w");
	}
}
