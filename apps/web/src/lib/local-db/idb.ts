const DATABASE_NAME = "centime"
const STORE_NAME = "kv"

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("IndexedDB indisponible"))
  })
}

async function run<Result>(mode: IDBTransactionMode, task: (store: IDBObjectStore) => IDBRequest<Result>): Promise<Result> {
  const database = await open()
  try {
    return await new Promise<Result>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const request = task(transaction.objectStore(STORE_NAME))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error ?? new Error("Écriture IndexedDB impossible"))
      transaction.onabort = () => reject(transaction.error ?? new Error("Transaction IndexedDB annulée"))
    })
  } finally {
    database.close()
  }
}

export async function idbGet(key: string): Promise<Uint8Array | null> {
  const value = await run<unknown>("readonly", (store) => store.get(key))
  return value instanceof Uint8Array ? value : null
}

export async function idbSet(key: string, value: Uint8Array): Promise<void> {
  await run("readwrite", (store) => store.put(value, key))
}

export async function idbDelete(key: string): Promise<void> {
  await run("readwrite", (store) => store.delete(key))
}
