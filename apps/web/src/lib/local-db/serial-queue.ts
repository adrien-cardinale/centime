export type SerialQueue = <Result>(task: () => Promise<Result>) => Promise<Result>

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve()
  return <Result>(task: () => Promise<Result>) => {
    const next = tail.then(task)
    tail = next.catch(() => undefined)
    return next
  }
}
