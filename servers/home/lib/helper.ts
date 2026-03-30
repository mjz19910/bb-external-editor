import { DarknetServer } from "../darknet/misc";

export function isNormalServer(
	s: { hostname: string } | Server | DarknetServer,
): s is Server {
	return "moneyMax" in s;
}
