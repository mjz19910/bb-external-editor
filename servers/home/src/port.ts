export type ExecRequest = {
  type: "exec"
  script: string
  host: string
  threadOrOptions: number
  args: ScriptArg[]
}
export type ShutdownRequest = {
  type: "shutdown"
}
export type ClosePort = {
  type: "close_port"
  port: number
}
export type ReplyResult = {
  type: "reply",
  child_port: number,
  child_pid: number,
};
export type RequestComplete = {
  type: "complete"
}
export type ScriptRequest = RequestComplete | ExecRequest | ShutdownRequest | ClosePort | ReplyResult;
