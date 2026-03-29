import { DarknetServerData, Server } from "../NetscriptDefinitions.d";

export interface DarknetServer extends DarknetServerData {
	isOnline: boolean;
}

export function isDarknetServer(
	s: { hostname: string } | Server | DarknetServer,
): s is DarknetServer {
	return "blockedRam" in s;
}
