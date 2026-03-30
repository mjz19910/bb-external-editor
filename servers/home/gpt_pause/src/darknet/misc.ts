import { DarknetServerData, Server } from "../@ns";

export interface DarknetServer extends DarknetServerData {
	isOnline: boolean;
}

export function isDarknetServer2(
	s: { hostname: string } | Server | DarknetServer,
): s is DarknetServer {
	return "blockedRam" in s;
}

export class WithPort {
	static Read = "with_port/read.ts" as const;
}
export class Darknet {
	static OpenCache = "darknet/openCache.ts" as const;
	static MemoryReallocation = "darknet/memoryReallocation.ts" as const;
}
