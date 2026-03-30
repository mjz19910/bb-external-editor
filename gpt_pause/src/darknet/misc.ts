
export interface DarknetServer extends DarknetServerData {
	isOnline: boolean;
}

export function isDarknetServer2(
	s: { hostname: string } | Server | DarknetServer,
): s is DarknetServer {
	return "blockedRam" in s;
}

export class WithPort {
	static Read = "gpt_pause/src/with_port/read.ts" as const;
}
export class Darknet {
	static OpenCache = "gpt_pause/src/darknet/openCache.ts" as const;
	static MemoryReallocation =
		"gpt_pause/src/darknet/memoryReallocation.ts" as const;
}
