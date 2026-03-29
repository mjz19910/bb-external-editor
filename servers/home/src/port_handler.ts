import { ScriptRequest } from "types/port"
class TypedNetscriptPort<T> {
  port: NetscriptPort
  port_id: number
  constructor(public ns: NS, id: number) {
    this.port_id = id
    this.port = ns.getPortHandle(id)
  }
  nextWrite() {
    return this.ns.nextPortWrite(this.port_id)
  }
  read(): T | null {
    const res = this.port.read()
    if (res === "NULL PORT DATA") return null
    return res
  }
  peek(): T | null {
    const res = this.port.peek()
    if (res === "NULL PORT DATA") return null
    return res
  }
  write(data: T | null): T | null {
    return this.ns.writePort(this.port_id, data)
  }
}
const free_ports: number[] = []
let com_port_num = 3
function get_next_open_port() {
  if (free_ports.length > 0) {
    return free_ports.shift()!
  }
  const ret = com_port_num
  com_port_num++
  return ret
}
export async function main(ns: NS) {
  ns.disableLog("sleep")
  const p1 = new TypedNetscriptPort<ScriptRequest>(ns, 2)
  for (let running = true; running;) {
    const res = p1.peek()!
    if (res !== null) {
      p1.read();
      switch (res.type) {
        case "exec": {
          const exec_com_port = get_next_open_port();
          const pid = ns.exec(
            res.script,
            res.host,
            res.threadOrOptions,
            ...res.args,
            "--comPort", exec_com_port
          )
          p1.write({
            type: "reply",
            child_port: exec_com_port,
            child_pid: pid,
          })
          ns.print("exec ", res.script)
          break
        }
        case "shutdown": {
          running = false
          break
        }
        case "close_port": {
          free_ports.push(res.port)
          ns.print("free port ", res.port)
          p1.write({
            type: "complete"
          })
          break
        }
        default: {
          ns.tprint("handle new request ", res)
          break
        }
      }
    }
    await ns.sleep(100)
  }
}
