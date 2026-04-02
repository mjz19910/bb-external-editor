export function isNormalServer(
	s: { hostname: string } | Server | DarknetServerData,
): s is Server {
	return "moneyMax" in s
}
