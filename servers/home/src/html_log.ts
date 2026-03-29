type PromiseParts<Result> = {
  resolve(value: Result): void;
  reject(value?: any): void;
  promise: Promise<Result>;
}

function promise_parts<T>() {
  const m: { ctx?: Omit<PromiseParts<T>, "promise"> } = {};
  const promise = new Promise<T>(function (resolve, reject) {
    m.ctx = { resolve, reject };
  })
  if (!m.ctx) throw null;
  return {
    resolve: m.ctx.resolve,
    reject: m.ctx.reject,
    promise,
  }
}

export async function main(ns: NS) {
  ns.clearLog()
  ns.ui.openTail()
  const p = promise_parts<React.MouseEvent<HTMLButtonElement, MouseEvent>>()
  ns.printRaw(React.createElement<React.ComponentProps<"button">>("button", {
    onClick: (event) => {
      p.resolve(event);
    }
  }, ["test"]))
  const event = await Promise.race([
    p.promise,
    new Promise<null>(a => setTimeout(function () { a(null); }, 300)),
  ])
  if (event) {
    console.log("got ui click", event)
  }
  const t_node = React.createElement("div", { id: "portal_div", children: ["extra"] })
  const portal = ReactDOM.createPortal(t_node, document.head)
  console.log("portal", portal)
  ns.printRaw(portal)
  await ns.sleep(50)
  const doc_div = document.querySelector("#portal_div")
}