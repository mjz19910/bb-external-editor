export interface DarknetServer extends DarknetServerData {
	isOnline: boolean;
}

export function isDarknetServer2(
	s: { hostname: string } | Server | DarknetServer,
): s is DarknetServer {
	return "blockedRam" in s;
}
