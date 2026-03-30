import { DarknetServerInfo } from "./darknet/types";
const default_server = {
	"isOnline": false,
	"hostname": "",
	"hasAdminRights": false,
	"isConnectedTo": false,
	"cpuCores": 1,
	"ramUsed": 0,
	"maxRam": 0,
	"backdoorInstalled": false,
	"hasStasisLink": false,
	"blockedRam": 0,
	"modelId": "",
	"staticPasswordHint": "",
	"passwordHintData": "",
	"difficulty": 0,
	"depth": -1,
	"requiredCharismaSkill": 0,
	"logTrafficInterval": -1,
	"isStationary": false,
	"purchasedByPlayer": false,
};
export function write_info_to_fs_db(
	ns: NS,
	info: DarknetServerInfo,
	cur_data?: string,
) {
	const ip_save_path = `tmp/ip/${info.ip}.txt`;
	const host_save_path = `tmp/host/${info.host.replaceAll(/[:]/g, "_")}.txt`;
	for (const k1 of Object.keys(info.server)) {
		const k = k1 as keyof typeof info.server;
		if (k === "ip") continue;
		if (info.server[k] === default_server[k]) {
			delete info.server[k];
		}
	}
	const new_content = JSON.stringify(info, void 0, "\t");
	if (new_content !== cur_data) {
		ns.write(ip_save_path, new_content, "w");
		ns.write(host_save_path, new_content, "w");
	}
}
