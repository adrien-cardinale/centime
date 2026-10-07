import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

export const MAX_PAGE_BYTES = 8 * 1024 * 1024

export type LogEntry = { seq: number; data: string }
export type LogPage = { entries: LogEntry[]; cursor: number; hasMore: boolean }
export type AppendResult =
  | { kind: "ok"; seq: number }
  | { kind: "unauthorized" }
  | { kind: "signup-closed" }
  | { kind: "quota-exceeded" }
export type AccessResult = "ok" | "unauthorized" | "unknown"

export type Store = {
  append(userId: string, secretHash: string, data: string): AppendResult
  check(userId: string, secretHash: string): AccessResult
  read(userId: string, since: number, limit: number): LogPage
  deleteUser(userId: string): void
  close(): void
}

export type StoreOptions = { allowSignup?: boolean; maxUserBytes?: number }

/** Quota par défaut : assez large pour des années de journal chiffré, assez étroit pour protéger le disque. */
export const DEFAULT_MAX_USER_BYTES = 512 * 1024 * 1024

type UserRow = { secret_hash: string }
type MetaRow = { seq: number; size: number }

const SCHEMA = `
  create table if not exists users (
    id text primary key,
    secret_hash text not null,
    created_at text not null
  );
  create table if not exists log (
    user_id text not null references users(id) on delete cascade,
    seq integer not null,
    data text not null,
    created_at text not null,
    primary key (user_id, seq)
  );
`

export function hashesMatch(expected: string, actual: string): boolean {
  const left = Buffer.from(expected)
  const right = Buffer.from(actual)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export function openStore(path: string, { allowSignup = true, maxUserBytes = DEFAULT_MAX_USER_BYTES }: StoreOptions = {}): Store {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path, { create: true })
  db.run("pragma journal_mode = wal")
  db.run("pragma foreign_keys = on")
  db.run(SCHEMA)

  const findUser = db.query<UserRow, [string]>("select secret_hash from users where id = ?")
  const insertUser = db.query("insert into users (id, secret_hash, created_at) values (?, ?, ?)")
  const nextSeq = db.query<{ next: number }, [string]>("select coalesce(max(seq), 0) + 1 as next from log where user_id = ?")
  const usedBytes = db.query<{ used: number }, [string]>(
    "select coalesce(sum(length(data)), 0) as used from log where user_id = ?",
  )
  const insertEntry = db.query("insert into log (user_id, seq, data, created_at) values (?, ?, ?, ?)")
  const readMeta = db.query<MetaRow, [string, number, number]>(
    "select seq, length(data) as size from log where user_id = ? and seq > ? order by seq limit ?",
  )
  const readEntries = db.query<LogEntry, [string, number, number]>(
    "select seq, data from log where user_id = ? and seq >= ? and seq <= ? order by seq",
  )
  const removeUser = db.query("delete from users where id = ?")

  const appendTransaction = db.transaction((userId: string, secretHash: string, data: string): AppendResult => {
    const now = new Date().toISOString()
    const user = findUser.get(userId)
    if (user) {
      if (!hashesMatch(user.secret_hash, secretHash)) return { kind: "unauthorized" }
    } else {
      if (!allowSignup) return { kind: "signup-closed" }
      insertUser.run(userId, secretHash, now)
    }
    // maxUserBytes <= 0 désactive le quota.
    const used = maxUserBytes > 0 ? (usedBytes.get(userId)?.used ?? 0) : 0
    if (maxUserBytes > 0 && used + data.length > maxUserBytes) return { kind: "quota-exceeded" }
    const seq = nextSeq.get(userId)?.next ?? 1
    insertEntry.run(userId, seq, data, now)
    return { kind: "ok", seq }
  })

  return {
    append: (userId, secretHash, data) => appendTransaction(userId, secretHash, data),
    check(userId, secretHash) {
      const user = findUser.get(userId)
      if (!user) return "unknown"
      return hashesMatch(user.secret_hash, secretHash) ? "ok" : "unauthorized"
    },
    read(userId, since, limit) {
      const meta = readMeta.all(userId, since, limit + 1)
      const chosen: MetaRow[] = []
      let total = 0
      for (const row of meta.slice(0, limit)) {
        if (chosen.length > 0 && total + row.size > MAX_PAGE_BYTES) break
        chosen.push(row)
        total += row.size
      }
      const first = chosen[0]
      const last = chosen.at(-1)
      if (!first || !last) return { entries: [], cursor: since, hasMore: false }
      return {
        entries: readEntries.all(userId, first.seq, last.seq),
        cursor: last.seq,
        hasMore: meta.length > chosen.length,
      }
    },
    deleteUser: (userId) => void removeUser.run(userId),
    close: () => db.close(),
  }
}
