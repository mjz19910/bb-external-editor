import { DarknetServer } from "./misc";

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
	ip: string;
	connectedToParent: boolean;
	host?: string;
	server?: DarknetServer;
	authDetails?: ServerAuthDetails2;
	parent?: string;
	password?: string;
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
