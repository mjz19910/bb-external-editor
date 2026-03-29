import {
	DarknetResponseCode,
	DarknetResult,
	ScriptArg,
} from "./NetscriptDefinitions.d";
import { DarknetServer, isDarknetServer2 } from "./darknet/misc";
import { Darknet, WithPort } from "./darknet_paths";

type ServerAuthDetails2 = {
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

type DarknetServerInfo = {
	connectedToParent: boolean;
	authDetails: ServerAuthDetails2;
	server: DarknetServer;
	parent: string | null;
	password: string | null;
};

const ROMAN_NUMERAL_VALUES: Record<string, number> = {
	M: 1000,
	D: 500,
	C: 100,
	L: 50,
	X: 10,
	V: 5,
	I: 1,
};

function decode_roman_num(ns: NS, val: string): number {
	if (val.length === 0) return 0;
	if (val.length === 1) {
		const v = ROMAN_NUMERAL_VALUES[val[0]];
		if (v !== undefined) return v;
		throw new Error(`Unable to decode Roman numeral (len=1) "${val}"`);
	}

	// Look at first two letters to handle subtraction cases
	const first = ROMAN_NUMERAL_VALUES[val[0]];
	const second = ROMAN_NUMERAL_VALUES[val[1]];
	if (first === undefined || second === undefined) {
		throw new Error(`Unknown Roman numeral char: "${val}"`);
	}

	if (first < second) {
		// Subtractive notation, e.g., IV = 4
		return second - first + decode_roman_num(ns, val.slice(2));
	} else {
		// Regular additive notation
		return first + decode_roman_num(ns, val.slice(1));
	}
}
/**
 * Simple recursive permutation generator
 */
function permute<T>(arr: T[]): T[][] {
	if (arr.length <= 1) return [arr];
	const result: T[][] = [];

	for (let i = 0; i < arr.length; i++) {
		const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
		for (const p of permute(rest)) {
			result.push([arr[i], ...p]);
		}
	}

	return result;
}
type AuthFlowState = {
	runner: string;
	host: string;
	port: number;
	info: DarknetServerInfo;
};
const logging = false;
const ac_mgr_regexp = /The password is a number between (\d+) and (\d+)/;
export const dog_names = [
	"fido",
	"spot",
	"rover",
	"max",
];
interface FactorsBleedResult extends DarknetResult {
	code: DarknetResponseCode;
	message: string;
	data: `${boolean}`;
	passwordAttempted: string;
}
class AuthManager {
	constructor(public ns: NS) { }
	extract_info(opts: AuthFlowState) {
		const { info } = opts;
		const { server: srv } = info;
		const { hostname: host } = srv;
		return { opts, srv, host, authDetails: info.authDetails };
	}
	submit_auth_result(
		c: AuthFlowState,
		auth: DarknetResult,
		password: string,
	) {
		const ns = this.ns;
		if (!auth.success) {
			if (logging) {
				ns.tprint(
					"auth failed for ",
					JSON.stringify(c.host),
					" code=",
					auth.code,
					" ",
					JSON.stringify(auth.message),
				);
			}
			return true;
		}
		ns.tprint(
			`Authentication succeeded for ${c.host} password="`,
			password,
			'"',
		);
		c.info.password = password;
		ns.writePort(c.port, {
			type: "dnet_authenticate",
			by: c.runner,
			for: c.host,
			auth,
			key: password,
		});
		return false;
	}
	async doAuth(opts: AuthFlowState, password: string) {
		const { host } = opts;
		const auth: DarknetResult = await this.ns.dnet.authenticate(
			host,
			password,
		);
		this.submit_auth_result(opts, auth, password);
	}
	// password=""
	async ZeroLogon(opts: AuthFlowState) {
		await this.doAuth(opts, "");
	}
	// cspell:words Factori_0s Factori-0s Factorios
	/** Solve a Factori-0s Darknet auth flow, using both valid factor sieve and invalid factor filtering */
	async Factori_0s(c: AuthFlowState) {
		const ns = this.ns;
		const factors: number[] = []; // confirmed valid factors >= 100
		const invalidFactors: Set<number> = new Set(); // numbers ruled out by data === "false"
		let cur_num = 2; // start at 100 to satisfy min factor constraint
		const info = c.info;
		const srv = info.server;
		const host = srv.hostname;

		ns.tprint(`Starting Factorios auth flow for ${host}`);

		for (; ;) {
			// Skip numbers that are invalid or less than 100
			while (invalidFactors.has(cur_num)) {
				cur_num++;
			}

			// Compute remainders modulo known factors
			const fac_res = [1];
			for (const fac of factors) {
				if (fac === 1) continue;
				fac_res.push(cur_num % fac);
			}
			ns.tprint(`factor_remainders = ${fac_res}`);

			const pw = cur_num.toString();
			ns.tprint(
				`authenticate(Factorios) for ${host} with "${pw}"`,
			);

			const auth = await ns.dnet.authenticate(host, pw);
			ns.tprint("Factorios auth result:", auth);

			if (this.submit_auth_result(c, auth, pw)) break;

			ns.tprint(`heartbleed(Factorios) for ${host}`);
			const bleed_res = await ns.dnet.heartbleed(host);
			if (!bleed_res.success) {
				ns.tprint("heartbleed failed:", bleed_res);
				break;
			}

			for (const log of bleed_res.logs) {
				let data: FactorsBleedResult | null = null;
				try {
					data = JSON.parse(log) as FactorsBleedResult;
				} catch {
					ns.tprint("heartbleed text_log ", log);
				}
				if (!data) continue;
				if (data.code != 401) {
					throw new Error(
						"Invalid heartbleed(Factors) result code=" + data.code,
					);
				}
				ns.tprint(
					`Factorios bleed status:`,
					data,
					`pw=${data.passwordAttempted} num=${cur_num}`,
				);

				const candidate = cur_num;
				const { data: feedback_raw } = data;
				const feedback = feedback_raw === "true";

				if (feedback) {
					if (factors.includes(candidate)) continue;
					factors.push(candidate);
					ns.tprint(`New valid factor discovered: ${candidate}`);
				} else {
					invalidFactors.add(candidate);
					invalidFactors.add(candidate * 2);
					invalidFactors.add(candidate * 3);
					ns.tprint(`Number ruled out as factor: ${candidate}`);
				}
			}
		}
	}
	// hint="The password is shuffled 359"
	async Php(opts: AuthFlowState) {
		const ns = this.ns;
		const { info } = opts;
		const ad = info.authDetails;
		const { server: srv } = info;
		const { hostname: host } = srv;
		if (!ad) return ns.tprint("No authDetails for ", host);
		const digits: string[] = ad.passwordHint.split("");
		ns.tprint("Trying all permutations of digits: ", digits.join(","));
		const calc_results: string[] = permute(digits).map((arr) =>
			arr.join("")
		);
		ns.tprint(`Generated ${calc_results.length} candidate passwords`);
		for (const pw of calc_results) {
			ns.tprint(`authenticate(PHP) for ${host} with "${pw}"`);
			const auth: DarknetResult = await ns.dnet.authenticate(
				host,
				pw,
			);
			if (this.submit_auth_result(opts, auth, pw)) break;
		}
	}
	async FreshInstall(c: AuthFlowState) {
		const ns = this.ns;
		const { host, authDetails } = this.extract_info(c);
		if (!authDetails) return;
		const {
			passwordFormat: format,
			passwordLength: pw_length,
			passwordHint: _hint,
		} = authDetails;
		const valid_passwords = {
			"0000": "numeric" as const,
			"12345": "numeric" as const,
			"admin": "alphabetic" as const,
			"password": "alphabetic" as const,
		};
		const pw_tries = [];
		for (const pw in valid_passwords) {
			if (valid_passwords[pw as keyof typeof valid_passwords] == format) {
				pw_tries.push(pw);
			}
		}
		for (const pw_attempt of pw_tries) {
			if (pw_length != pw_attempt.length) continue;
			const auth = await ns.dnet.authenticate(host, pw_attempt);
			if (this.submit_auth_result(c, auth, pw_attempt)) break;
		}
	}
	async DeepGreen(c: AuthFlowState) {
		const ns = this.ns;
		type DeepGreenBleedData = {
			code: 401;
			message: string;
			passwordAttempted: string;
		};
		const authDetails = c.info.authDetails;
		if (!authDetails) return;
		const {
			passwordFormat: _format,
			passwordLength: _pw_length,
			passwordHint: _hint,
		} = authDetails;
		const chars = "0123456789".split("");
		const pw_arr = Array.from<string | null>({ length: _pw_length }).fill(
			null,
		);
		for (const char of chars) {
			const pw = pw_arr.map((v) => v === null ? char : v).join("");
			const auth: DarknetResult = await ns.dnet.authenticate(c.host, pw);
			if (this.submit_auth_result(c, auth, pw)) break;
			const bleed_res = await ns.dnet.heartbleed(c.host);
			if (!bleed_res.success) {
				ns.tprint("heartbleed failed:", bleed_res);
				break;
			}
			for (const log of bleed_res.logs) {
				let data: DeepGreenBleedData | null = null;
				try {
					data = JSON.parse(log) as DeepGreenBleedData;
				} catch {
					ns.tprint("heartbleed text_log ", log);
				}
				if (!data) continue;
				if (data.code != 401) {
					throw new Error("Invalid bleed result code=" + data.code);
				}
				ns.tprint("heartbleed log ", data.message);
			}
		}
	}
	async CloudBlare(opts: AuthFlowState) {
		const { info } = opts;
		const authDetails = info.authDetails;
		if (!authDetails) return;
		const { data } = authDetails;
		let pw = "";
		for (const dig of data.matchAll(/\d+/g)) {
			pw += dig;
		}
		await this.doAuth(opts, pw);
	}
	async DeskMemo(c: AuthFlowState) {
		const pw = c.info.authDetails!.passwordHint.match(/\d+/)![0];
		await this.doAuth(c, pw);
	}
	// "The password is a number between 0 and 10"
	async AccountsManager(c: AuthFlowState) {
		const ns = this.ns;
		type AccMgrBleedData = {
			code: 401;
			message: string;
			passwordAttempted: string;
			data: boolean;
		} | {
			code: 200;
		};
		const { host, authDetails } = this.extract_info(c);
		const ad = authDetails;
		let match = ad.passwordHint.match(ac_mgr_regexp);
		if (!match) {
			throw new Error(
				"Invalid AccountsManager hint " + ad.passwordHint,
			);
		}
		const [, min_arg, max_arg] = match as [string, string, string];
		const min = +min_arg, max = +max_arg;
		for (let i = min; i < max; i++) {
			const pw = "" + i;
			const auth = await ns.dnet.authenticate(host, pw);
			if (this.submit_auth_result(c, auth, pw)) break;
			const bleed_res = await ns.dnet.heartbleed(host);
			if (!bleed_res.success) {
				ns.tprint("heartbleed failed:", bleed_res);
				break;
			}
			for (const log of bleed_res.logs) {
				let data: AccMgrBleedData | null = null;
				try {
					data = JSON.parse(log) as AccMgrBleedData;
				} catch {
					ns.tprint("heartbleed text_log ", log);
				}
				if (!data) continue;
				if (data.code === 200) {
					ns.tprint("heartbleed(AccMgr,200) log ", data);
					continue;
				}
				if (data.code != 401) {
					const err_code = (data as { code: number }).code;
					throw new Error(
						"Invalid heartbleed(AccMgr) result code=" + err_code,
					);
				}
				ns.tprint("heartbleed log ", data.message);
			}
		}
	}
	async NIL(c: AuthFlowState) {
		const ns = this.ns;
		type HeartbleedPasswordAttempt = {
			code: 401;
			message: string;
			passwordAttempted: string;
		};
		const info = c.info;
		const { authDetails } = info;
		const chars = "0123456789".split("");
		const { passwordLength: len } = authDetails;
		const srv = info.server;
		const host = srv.hostname;
		const pw_arr = Array.from<string | null>({ length: len }).fill(null);
		for (const char of chars) {
			const pw = pw_arr.map((v) => v === null ? char : v).join("");
			const auth = await ns.dnet.authenticate(host, pw);
			if (this.submit_auth_result(c, auth, pw)) break;
			const bleed_res = await ns.dnet.heartbleed(host);
			if (!bleed_res.success) {
				ns.tprint("heartbleed failed:", bleed_res);
				break;
			}
			for (const log of bleed_res.logs) {
				let data: HeartbleedPasswordAttempt | null = null;
				try {
					data = JSON.parse(log) as HeartbleedPasswordAttempt;
				} catch {
					ns.tprint("heartbleed text_log ", log);
				}
				if (!data) continue;
				if (data.code != 401) {
					throw new Error(
						"Invalid heartbleed(Nil) result code=" + data.code,
					);
				}
				const p = data.message.split(",");
				for (let i = 0; i < p.length; i++) {
					if (p[i] === "yes") pw_arr[i] = char;
				}
			}
		}
	}
	async BellaCuore(c: AuthFlowState) {
		const ad = c.info.authDetails!;
		const num = decode_roman_num(this.ns, ad.data);
		const pw = "" + num;
		await this.doAuth(c, pw);
	}
	async Pr0verFl0(c: AuthFlowState) {
		const { info } = c;
		const { authDetails: ad, server: srv } = info;
		const { passwordFormat, passwordHint, passwordLength: len, data } = ad;
		const { hostname: host } = srv;
		this.ns.tprint("new ProverFlo auth flow for ", host, " len=", len);
		this.ns.tprint("  hint ", passwordHint);
		this.ns.tprint("  data ", data);
		this.ns.tprint("  fmt ", passwordFormat);
		throw new Error("Incomplete auth");
	}
	async OpenWebAccessPoint(c: AuthFlowState) {
		const ad = c.info.authDetails!;
		this.ns.tprint(
			"new OpenWeb auth flow for ",
			JSON.stringify(c.info.server.hostname),
			" len=",
			ad.passwordLength,
		);
		this.ns.tprint("  hint ", JSON.stringify(ad.passwordHint));
		this.ns.tprint("  data ", ad.data);
		throw new Error("Incomplete auth");
	}
	async Laika(c: AuthFlowState, num: number) {
		await this.doAuth(c, dog_names[num - 1]);
	}
}
function decode_model_id(id: string) {
	switch (id) {
		case "FreshInstall_1.0":
		case "DeskMemo_3.1":
		case "CloudBlare(tm)":
		case "AccountsManager_4.2":
		case "Pr0verFl0":
		case "NIL":
		case "OpenWebAccessPoint":
		case "PHP 5.4":
		case "ZeroLogon":
		case "BellaCuore":
		case "DeepGreen":
		case "Laika4":
		case "Factori-Os":
			return id;
		default:
			return null;
	}
}
async function post_dnet_probe(
	ns: NS,
	infos: DarknetServerInfo[],
	infos_idx_map: Map<string, number>,
	runner: string,
) {
	for (const info of infos) {
		info.parent = null;
		info.connectedToParent = false;
	}
	const targets = ns.dnet.probe();
	for (const trg of targets) {
		await ns.sleep(0);
		const srv = ns.getServer(trg);
		if (!isDarknetServer2(srv)) continue;
		const ad = ns.dnet.getServerAuthDetails(trg);
		const info: DarknetServerInfo = {
			parent: runner,
			server: srv,
			authDetails: ad,
			password: null,
			connectedToParent: true,
		};
		if (infos_idx_map.has(trg)) {
			const i = infos_idx_map.get(trg)!;
			const prev_info = infos[i];
			infos[i] = info;
			if (prev_info.password !== null) {
				info.password = prev_info.password;
			}
			continue;
		}
		infos.push(info);
		infos_idx_map.set(trg, infos.length - 1);
	}
}

const SELF = "darknet_probe.ts";

export async function main(ns: NS) {
	ns.ui.openTail();
	const infos: DarknetServerInfo[] = [];
	const infos_idx_map = new Map<string, number>();

	const f = ns.flags([["runner", "home"], ["threads", 1], ["port", 1]]) as {
		runner: string;
		threads: number;
		port: number;
		_: ScriptArg[];
	};
	if (f._.length > 0) {
		ns.tprint("too many arguments for dnet probe");
		return;
	}
	const runner = f.runner;
	const port = f.port;
	const local_probe = ns.dnet.probe();
	const dnet_files_dyn: string[] = [];
	dnet_files_dyn.push(SELF);
	dnet_files_dyn.push("lib/helper.ts");
	dnet_files_dyn.push("darknet/misc.ts");
	dnet_files_dyn.push("NetscriptDefinitions.d.ts");
	dnet_files_dyn.push(Darknet.MemoryReallocation);
	dnet_files_dyn.push(WithPort.Read);
	if (local_probe.length == 1 && local_probe[0] == "darkweb") {
		return ns.tprint("unable to start on home");
	}
	const am = new AuthManager(ns);
	for (; ;) {
		await ns.sleep(100);
		post_dnet_probe(ns, infos, infos_idx_map, runner);
		ns.writePort(port, {
			type: "dnet_probe",
			by: runner,
			infos,
		});
		for (let i = 0; i < infos.length; i++) {
			let info = infos[i];
			if (!info.connectedToParent) continue;
			const ad = info.authDetails;
			if (!ad) continue;
			const srv = info.server;
			const host = srv.hostname;
			const c: AuthFlowState = { info, host, runner, port };
			const handler_id = decode_model_id(ad.modelId);
			// spell:words Factori-Os BellaCuore
			switch (handler_id) {
				case "Factori-Os":
					await am.Factori_0s(c);
					break;
				case "AccountsManager_4.2":
					await am.AccountsManager(c);
					break;
				case "CloudBlare(tm)":
					await am.CloudBlare(c);
					break;
				case "DeskMemo_3.1":
					await am.DeskMemo(c);
					break;
				case "FreshInstall_1.0":
					await am.FreshInstall(c);
					break;
				case "Laika4":
					await am.Laika(c, 4);
					break;
				case "PHP 5.4":
					await am.Php(c);
					break;
				default: {
					if (handler_id) {
						await am[handler_id]({
							info,
							host: host,
							runner,
							port,
						});
					} else {
						ns.tprint("no_handler=", { id: ad.modelId });
					}
				}
			}
			if (info.password === null) continue;
			ns.writePort(port, {
				type: "dnet_probe",
				by: runner,
				for: host,
				password: info.password,
			});
		}
		if (infos.length === 0) {
			ns.tprint("no results");
			break;
		}
	}
}
