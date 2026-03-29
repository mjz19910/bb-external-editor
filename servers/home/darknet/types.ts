export type ServerAuthDetails2 = {
	isOnline: boolean;
	isConnectedToCurrentServer: boolean;
	hasSession: boolean;
	modelId: string;
	passwordHint: string;
	data: string;
	logTrafficInterval: number;
	passwordLength: number;
	passwordFormat:
		| "numeric"
		| "alphabetic"
		| "alphanumeric"
		| "ASCII"
		| "unicode";
};
export type DarknetServerInfo = {
	connectedToParent: boolean;
	authDetails: ServerAuthDetails2 | null;
	server: { hostname: string } | null;
	parent: string | null;
	password: string | null;
};
export const darknet_files = [
	"api/darknet/probe.ts",
	"api/darknet/stasis.ts",
	"types/darknet_types.ts",
	"api/darknet/probe_one.ts",
	"api/port_file_read.ts",
	"api/darknet/open_cache.ts",
	"api/darknet/update_probe.ts",
];
