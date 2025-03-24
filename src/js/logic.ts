let db: IDB
const exts: Map<number, IExt> = new Map()
const pack: Array<IFeed> = []
const state: IState = {
   prev: undefined,
   extId: 0,
   packid: -1,
   pos: -1,
}

export async function init() {
   let res = await DB
   db = await res.json()
   db.subs = db.subs || []
   db.subs_mapped = new Map(db.subs.map((sub) => [sub.id, sub]))
   db.exts = db.exts || []
   db.exts.forEach((e) => {
      e.url_parsed = new URL(e.url, DB_URL)
      e.url = e.url_parsed.toString()
      exts.set(e.id, e)
   })

   exts.set(0, {
      id: 0,
      name: "Root",
      url: DB_URL.toString(),
      url_parsed: DB_URL,
   })
}

export async function up() {
   state.prev = undefined
   let arr = Array.from(exts.keys()).sort()
   let idx = arr.indexOf(state.extId) + 1
   if (idx == arr.length)
      idx = 0
   await get(arr[idx], Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true)
}

export async function down() {
   state.prev = undefined
   let arr = Array.from(exts.keys()).sort()
   let idx = arr.indexOf(state.extId) - 1
   if (idx < 0)
      idx = arr.length - 1
   await get(arr[idx], Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true)
}

export async function right() {
   if (state.prev !== undefined) {
      const curr = pack[state.pos]
      let next = findRightIdx(state.pos + 1, curr.subId)

      if (next != -1) {
         state.pos = next
      } else {
         if (state.prev != "") {
            await downloadPack(parseInt(state.prev))
            state.pos = findRightIdx(0, curr.subId)
            state.prev = ""
         }
      }
   } else if (state.pos + 1 < pack.length) {
      state.pos++
   } else if (state.packid < db.n_packs) {
      await downloadPack(state.packid + 1)
      state.pos = 0
   }

   hashUpdate()
}

export async function left() {
   if (state.prev !== undefined) {
      const curr = pack[state.pos]

      if (curr.prev !== undefined) {
         const prev = state.packid.toString()
         await downloadPack(curr.prev)
         state.prev = prev
         state.pos = findLeftIdx(pack.length - 1, curr.subId)
      } else {
         state.pos = findLeftIdx(state.pos - 1, curr.subId)
      }
   } else if (state.pos > 0) {
      state.pos--
   } else if (state.packid > 0) {
      await downloadPack(state.packid - 1)
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
   const sub: ISub = db.subs_mapped.get(id)

   if (sub === undefined) {
      state.prev = undefined
      return get(state.extId, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true)
   }

   state.prev = ""
   await downloadPack(sub.packid)

   for (let i = pack.length - 1; i >= 0; i--)
      if (pack[i].subId == id)
         return get(state.extId, sub.packid, i, true)
}

export async function togglePrev() {
   if (state.prev === undefined)
      state.prev = ""
   else
      state.prev = undefined
   hashUpdate()
}

export function setPrev(prev: string): boolean {
   if (state.prev !== prev) {
      state.prev = prev
      return true
   }
   return false
}

export async function get(extid: number, packid: number, pos: number, forceUpd: boolean = false): Promise<IShowFeed> {
   const oExtId = state.extId, oPackId = state.packid, oPos = state.pos

   if (!exts.has(extid)) {
      extid = 0
      packid = Number.MAX_SAFE_INTEGER
      pos = Number.MAX_SAFE_INTEGER
   }
   await downloadDB(extid)

   if (!(0 < packid && packid <= db.n_packs)) {
      packid = db.n_packs
      pos = Number.MAX_SAFE_INTEGER
   }
   await downloadPack(packid)

   if (!(0 <= pos && pos < pack.length))
      pos = pack.length - 1
   state.pos = pos

   if (oExtId != state.extId || oPackId != state.packid || oPos != state.pos || forceUpd) {
      hashUpdate()
      return null
   }

   const feed = pack[state.pos]
   let has_right: boolean, has_left: boolean

   if (state.prev === undefined) {
      has_left = state.packid > 1 || state.pos > 0
      has_right = state.packid < db.n_packs || state.pos < pack.length - 1
   }
   else {
      has_left = feed.prev != -1
      has_right = state.prev != "" || findRightIdx(state.pos + 1, feed.subId) != -1
   }

   return {
      feed,
      has_right,
      has_left,
      sub: db.subs_mapped.get(feed.subId),
      ext: exts.get(extid),
    }
}

function hashUpdate() {
   let filter = ""
   if (state.prev !== undefined)
      filter = `!${state.prev}`

   const hash = `#${state.extId}.${state.packid}.${state.pos}${filter}`

   history.pushState(null, null, hash);
   window.dispatchEvent(new HashChangeEvent('hashchange', {
      newURL: window.location.origin + window.location.pathname + hash,
      oldURL: window.location.href,
   }))
}

async function downloadDB(extid: number) {
   if (state.extId == extid)
      return

   let res = await fetch(new URL("db.json", exts.get(extid).url_parsed))
   db = await res.json()
   db.subs = db.subs || []
   db.subs_mapped = new Map(db.subs.map((sub) => [sub.id, sub]))

   state.extId = extid
}

async function downloadPack(packid: number) {
   if (packid > db.n_packs)
      throw new Error(`requested packid "${packid}" is greater than total "${db.n_packs}"`)

   if (packid < 0)
      throw new Error('invalid packid smaller than "0"')

   if (state.packid == packid)
      return

   const opts = {}
   let pack_name = db.latest ? "true" : "false"

   if (packid < db.n_packs) {
      opts["cache"] = "force-cache"
      pack_name = packid.toString()
   }

   const req = await fetch(new URL(`${pack_name}.gz`, exts.get(state.extId).url_parsed), opts)
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

export function get_exts(): Map<number, IExt> {
   return exts
}

export function get_subs(): Map<number, ISub> {
   return db.subs_mapped
}