export const REQUEST_PORT = 1
export const REPLY_PORT = 2
export const API_PORT = 3

export type HeartbleedPasswordAttempt = {
	code: 401
	message: string
	passwordAttempted: string
}
export type DeepGreenBleedData = {
	code: 401
	message: string
	passwordAttempted: string
}
export interface FactorsBleedResult extends DarknetResult {
	code: DarknetResult["code"] & {}
	message: string
	data: `${boolean}`
	passwordAttempted: string
}
export type SubmitAuthArgs = [
	opts: AuthFlowState,
	auth: DarknetResult,
	password: string,
]
export type AccMgrBleedData = {
	code: 401
	message: string
	passwordAttempted: string
	data: string
} | {
	code: 200
}
export type AuthFlowState = {
	runner: string
	host: string
	port: ScriptPort<PortMessage>
	info: DarknetServerInfo
}
export type WaitMessage = {
	type: "wait"
	on: "darknet.nextMutation"
	reply_port: number
}
export type DarknetAuthenticateMessage = {
	type: "darknet.authenticate"
	by: string
	for: string
	auth: DarknetResult
	password: string
	info: DarknetServerInfo
}
export type DarknetProbeMessage = {
	type: "darknet.probe"
	alt: "names"
	by: string
	infos: DarknetServerInfo[]
} | {
	type: "darknet.probe"
	alt: "ip"
	by: string
	infos: DarknetServerInfo[]
}
export type DarknetFoundPassProbeMessage = {
	type: "found_password"
	by: string
	for: string
	password: string
	info: DarknetServerInfo
}
export type NewWordsMessage = {
	type: "new_words"
	from_dict: "commonPasswordDictionary"
	list: string[]
}

export type DarknetServerInfo = {
	ip: string
	connectedToParent: boolean
	host?: string
	server?: DarknetServerData
	authDetails?: ServerAuthDetails2
	parent?: string
	password?: string
}

export type QuitMessage = { type: "quit" }
export type TimeoutCheckMsg = { type: "timeout_check" }
export type ServerAuthDetails2 = {
	isOnline: boolean
	isConnectedToCurrentServer: boolean
	hasSession: boolean
	modelId: string
	passwordHint: string
	data: string
	logTrafficInterval: number
	passwordLength: number
	passwordFormat:
	| "numeric"
	| "alphabetic"
	| "alphanumeric"
	| "ASCII"
	| "unicode"
}

export type QuerySecurityMsg = {
	type: "query_security"
	infos: DarknetServerInfo[]
}
export type HostnameReplyMsg = {
	type: "getHostname"
	hostname: string
}
export type PortReleaseMsg = {
	type: "port_release"
	port: number
	infos: DarknetServerInfo[]
	updated_key: keyof DarknetServerInfo
}

export function isNone<T>(val: Optional<T>): val is OptNone {
	return val.type === "None"
}

export function empty_opt(): { type: "None" } {
	return { type: "None" }
}

export function assign_opt<T>(opt: Optional<T>, val: T) {
	opt.type = "Some"
	if (isNone(opt)) return
	opt.value = val
}

export type OnlineCheckMsg = {
	cmd: "online_check"
	args: string[]
}

export type OptNone = { type: "None" }
export type OptSome<T> = { type: "Some"; value: T }
export type Optional<T> = OptNone | OptSome<T>
export type OnlineServersMessage = {
	type: "online_servers"
	result: {
		darkweb: DarknetServerData[]
		normal: Server[]
	}
}
export type PortMessage =
	| DarknetAuthenticateMessage
	| DarknetFoundPassProbeMessage
	| DarknetProbeMessage
	| NewWordsMessage
	| OnlineServersMessage
	| PortReleaseMsg
	| QuitMessage
	| TimeoutCheckMsg
	| WaitMessage
export type ApiMessage = QuerySecurityMsg | HostnameReplyMsg


export function some_opt<T>(value: T): { type: "Some"; value: T } {
	return { type: "Some", value }
}

export const Null = "NULL PORT DATA" as const
export type Null = typeof Null
export type NS_Port = {
	read(): unknown
	peek(): unknown
	write(value: unknown): unknown
	full(): boolean
	tryWrite(value: unknown): boolean
	nextWrite(): Promise<void>
	empty(): boolean
	clear(): void
}

export class PortEmptyError extends Error {
	constructor(portId: number) {
		super(`Port ${portId} is empty`)
		this.name = "PortEmptyError"
	}
}

export class PortFullError extends Error {
	constructor(portId: number) {
		super(`Port ${portId} is full`)
		this.name = "PortFullError"
	}
}

export function peek<T>(port: NS_Port): T | Null {
	return port.peek() as T | Null
}

export function readPort<T>(port: NS_Port): T | Null {
	return port.read() as T | Null
}

export function writePort<TIn, TOut = TIn>(
	port: NS_Port,
	input: TIn,
): TOut | Null {
	return port.write(input) as TOut | Null
}

export function optFromRaw<U>(value: U | Null): Optional<U> {
	return value === Null ? empty_opt() : some_opt(value)
}

export function rawPeekOpt<T>(port: NS_Port): Optional<T> {
	return optFromRaw<T>(peek(port))
}

export function rawReadOpt<T>(port: NS_Port): Optional<T> {
	return optFromRaw<T>(readPort(port))
}

export function rawWriteOpt<TIn, TOut = TIn>(port: NS_Port, input: TIn): Optional<TOut> {
	return optFromRaw<TOut>(writePort(port, input))
}

export function fromRaw<U>(value: U | Null): U | undefined {
	return value === Null ? undefined : value
}

export function rawPeek<T>(port: NS_Port): T | undefined {
	return fromRaw(peek(port))
}

export function rawRead<T>(port: NS_Port): T | undefined {
	return fromRaw(readPort(port))
}

export function rawWrite<TIn, TOut = TIn>(port: NS_Port, input: TIn): TOut | undefined {
	return fromRaw(writePort(port, input))
}

export function readIntoObj<T, K extends string>(port: NS_Port, obj: Record<K, T>, key: K) {
	const data = readPort<T>(port)
	if (data === "NULL PORT DATA") return false
	obj[key] = data
	return true
}

export function readIntoOpt<T>(port: NS_Port, readResult: Optional<T>) {
	const data = readPort<T>(port)
	if (data === "NULL PORT DATA") return false
	assign_opt(readResult, data)
	return true
}

export function readInto<T>(port: NS_Port, readResults: T[]) {
	const data = readPort<T>(port)
	if (data === "NULL PORT DATA") return false
	readResults.push(data)
	return true
}

export function rawReadAll<T>(port: NS_Port) {
	const results: T[] = []
	while (readInto(port, results)) { }
	return results
}

function assertNotNull<U>(value: U | Null): U {
	if (value === Null) throw new Error("Invalid state")
	return value
}

function mustRead<T>(port: NetscriptPort): T {
	return assertNotNull(readPort(port))
}

function mustPeek<T>(port: NetscriptPort): T {
	return assertNotNull(peek(port))
}

export class ScriptPort<BaseType> {
	static open_api_port(ns: NS) {
		return new ScriptPort<ApiMessage>(ns, API_PORT)
	}
	static open_reply_port(ns: NS) {
		return new ScriptPort<OnlineCheckMsg>(ns, REPLY_PORT)
	}
	static open_request_port(ns: NS) {
		return new ScriptPort<PortMessage>(ns, REQUEST_PORT)
	}
	readonly ns: NS
	port_id: number
	readonly #port: NS_Port

	constructor(ns: NS, port_id: number) {
		this.ns = ns
		this.port_id = port_id
		this.#port = ns.getPortHandle(port_id)
	}

	peek<T extends BaseType = BaseType>(): T {
		return mustPeek<T>(this.#port)
	}

	read<T extends BaseType = BaseType>(): T {
		return mustRead<T>(this.#port)
	}

	tryRead<T extends BaseType = BaseType>(): T | undefined {
		return rawRead<T>(this.#port)
	}

	readOpt<T extends BaseType = BaseType>(): Optional<T> {
		return rawReadOpt<T>(this.#port)
	}

	readAll<T extends BaseType = BaseType>() {
		return rawReadAll<T>(this.#port)
	}

	writeOpt<T extends BaseType, U>(data: T): Optional<U> {
		return rawWriteOpt<T, U>(this.#port, data)
	}

	tryWrite<T extends BaseType = BaseType>(data: T): boolean {
		return this.#port.tryWrite(data)
	}

	nextWrite() {
		return this.#port.nextWrite()
	}

	full() {
		return this.#port.full()
	}

	empty() {
		return this.#port.empty()
	}

	clear() {
		this.#port.clear()
	}
}
