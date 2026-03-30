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
	"gpt_pause/src/darknet/probe.ts",
	"gpt_pause/src/darknet/stasis.ts",
	"gpt_pause/src/darknet/types.ts",
	"gpt_pause/src/with_port/read.ts",
	"gpt_pause/src/darknet/open_cache.ts",
	"gpt_pause/src/darknet/update_probe.ts",
];
