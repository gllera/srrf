let db: IDB
const pack: Array<IFeed> = []
const idxs: Array<number> = []

const state: IState = {
   prev: undefined,
   packid: -1,
   pos: -1,
}

export async function init(): Promise<ISubscription[]> {
   let res = await DB
   db = await res.json()
   return db.subscriptions
}

export async function right() {
   if (state.prev !== undefined) {
      const curr = pack[state.pos]
      let next = findRightIdx(state.pos + 1, curr.subId)

      if (next != -1) {
         state.pos = next
      } else {
         if (state.prev != "") {
            await download(parseInt(state.prev))
            state.pos = findRightIdx(0, curr.subId)
            state.prev = ""
         }
      }
   } else if (state.pos + 1 < pack.length) {
      state.pos++
   } else if (state.packid < db.packids) {
      await download(state.packid + 1)
      state.pos = 0
   }

   hashUpdate()
}

export async function left() {
   if (state.prev !== undefined) {
      const curr = pack[state.pos]

      if (curr.prev !== undefined) {
         const prev = state.packid.toString()
         await download(curr.prev)
         state.prev = prev
         state.pos = findLeftIdx(pack.length - 1, curr.subId)
      } else {
         state.pos = findLeftIdx(state.pos - 1, curr.subId)
      }
   } else if (state.pos > 0) {
      state.pos--
   } else if (state.packid > 0) {
      await download(state.packid - 1)
      state.pos = pack.length - 1
   }

   hashUpdate()
}

function findLeftIdx(from: number, subId: number): number {
   for (let i = from; i >= 0; i--)
      if (pack[i].subId == subId)
         return i
   return -1
}

function findRightIdx(from: number, subId: number): number {
   for (let i = from; i < pack.length; i++)
      if (pack[i].subId == subId)
         return i
   return -1
}

export async function last(subId: string = undefined) {
   if (subId == undefined && state.prev != undefined)
      subId = String(pack[state.pos].subId)

   const id = parseInt(subId)
   const sub: ISubscription = db.subscriptions[id]

   if (sub === undefined) {
      state.prev = undefined
      return get(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true)
   }

   state.prev = ""
   await download(sub.last_packid)

   for (let i = pack.length - 1; i >= 0; i--)
      if (pack[i].subId == id)
         return get(sub.last_packid, i, true)
}

export function setPrev(prev: string): boolean {
   if (state.prev !== prev) {
      state.prev = prev
      return true
   }
   return false
}

export async function get(packId: number, pos: number, forceUpd: boolean = false): Promise<IShowFeed> {
   const oPackId = state.packid, oPos = state.pos

   if (!(0 < packId && packId <= db.packids)) {
      packId = db.packids
      pos = Number.MAX_SAFE_INTEGER
   }
   await download(packId)

   if (!(0 <= pos && pos < pack.length))
      pos = pack.length - 1
   state.pos = pos

   if (oPackId != state.packid || oPos != state.pos || forceUpd) {
      hashUpdate()
      return null
   }

   const feed = pack[state.pos]
   const subs = db.subscriptions[feed.subId]
   let has_right: boolean, has_left: boolean

   if (state.prev === undefined) {
      has_left = state.packid > 1 || state.pos > 0
      has_right = state.packid < db.packids || state.pos < pack.length - 1
   }
   else {
      has_left = feed.prev != -1
      has_right = state.prev != "" || findRightIdx(state.pos + 1, feed.subId) != -1
   }

   return { feed, subs, has_right, has_left }
}

function hashUpdate() {
   let filter = ""
   if (state.prev !== undefined)
      filter = `!${state.prev}`

   const hash = `#${state.packid}.${state.pos}${filter}`

   history.pushState(null, null, hash);
   window.dispatchEvent(new HashChangeEvent('hashchange', {
      newURL: window.location.origin + window.location.pathname + hash,
      oldURL: window.location.href,
   }))
}

async function download(packid: number) {
   if (packid > db.packids)
      throw new Error(`requested packid "${packid}" is greater than total "${db.packids}"`)

   if (packid < 0)
      throw new Error('invalid packid smaller than "0"')

   if (state.packid == packid)
      return

   const opts = {}
   let pack_name = db.latest ? "true" : "false"

   if (packid < db.packids) {
      opts["cache"] = "force-cache"
      pack_name = packid.toString()
   }

   const req = await fetch(`${PACKS_URL}/${pack_name}.gz`, opts)
   const reader = req.body
      .pipeThrough(new DecompressionStream("gzip"))
      .pipeThrough(new TextDecoderStream())
      .getReader()

   pack.length = 0

   let prev = ""
   while (true) {
      const res = await reader.read()
      if (res.done) break

      prev += res.value
      let arr = prev.split("\n")
      prev = arr.pop()

      for (const line of arr)
         pack.push(JSON.parse(line))
   }

   state.packid = packid
}