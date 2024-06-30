let db: IDB

let tag: ISubscriptionTag = undefined
const pack: IPack = {
   id: -1,
   tag: "-1",
   arr: [],
   pos: -1,
   prev: undefined,
}



export async function init(): Promise<{ [id: number]: ISubscriptionTag }> {
   let res = await DB
   db = await res.json()
   return db.tags
}



export async function right() {
   if (pack.prev !== undefined) {
      const curr = pack.arr[pack.pos]
      let next = findRightIdx(pack.pos + 1, curr.subId)

      if (next != -1) {
         pack.pos = next
      } else {
         if (pack.prev != "") {
            await download(pack.tag, parseInt(pack.prev))
            pack.pos = findRightIdx(0, curr.subId)
            pack.prev = ""
         }
      }
   } else if (pack.pos + 1 < pack.arr.length) {
      pack.pos++
   } else if (pack.id < tag.packids) {
      await download(pack.tag, pack.id + 1)
      pack.pos = 0
   }

   hashUpdate()
}



export async function left() {
   if (pack.prev !== undefined) {
      const curr = pack.arr[pack.pos]

      if (curr.prev !== undefined) {
         const prev = pack.id.toString()
         await download(pack.tag, curr.prev)
         pack.prev = prev
         pack.pos = findLeftIdx(pack.arr.length - 1, curr.subId)
      } else {
         pack.pos = findLeftIdx(pack.pos - 1, curr.subId)
      }
   } else if (pack.pos > 0) {
      pack.pos--
   } else if (pack.id > 0) {
      await download(pack.tag, pack.id - 1)
      pack.pos = pack.arr.length - 1
   }

   hashUpdate()
}



function findLeftIdx(from: number, subId: number): number {
   for (let i = from; i >= 0; i--)
      if (pack.arr[i].subId == subId)
         return i
   return -1
}



function findRightIdx(from: number, subId: number): number {
   for (let i = from; i < pack.arr.length; i++)
      if (pack.arr[i].subId == subId)
         return i
   return -1
}



export async function last(ids: string = undefined) {
   let tagId: string, subId: string
   if (ids !== undefined) {
      const arr = ids.split(".")
      tagId = arr[0]
      subId = arr[1]
   } else if (pack.tag !== "-1") {
      tagId = pack.tag
      if (pack.prev !== undefined)
         subId = pack.arr[pack.pos].subId.toString()
   }

   if (!(tagId in db.tags)) {
      pack.prev = undefined
      return get("-1", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true)
   }

   tag = db.tags[tagId]
   const sub = tag.subscriptions[subId]
   if (sub === undefined) {
      pack.prev = undefined
      return get(tagId, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true)
   }

   pack.prev = ""
   await download(tagId, sub.last_packid)
   for (let i = pack.arr.length - 1; i >= 0; i--)
      if (pack.arr[i].subId == parseInt(subId))
         return get(tagId, sub.last_packid, i, true)
}



export function setPrev(prev: string): boolean {
   if (pack.prev !== prev) {
      pack.prev = prev
      return true
   }
   return false
}



export async function get(tagId: string, packId: number, pos: number, forceUpd: boolean = false): Promise<IShowFeed> {
   const oTagId = pack.tag, oPackId = pack.id, oPos = pack.pos

   if (!(tagId in db.tags)) {
      tagId = Object.keys(db.tags)[0]
      packId = undefined
      pos = undefined
   }
   tag = db.tags[tagId]

   if (!(0 < packId && packId <= tag.packids)) {
      packId = tag.packids
      pos = undefined
   }
   await download(tagId, packId)

   if (!(0 <= pos && pos < pack.arr.length))
      pos = pack.arr.length - 1
   pack.pos = pos

   if (oTagId != pack.tag || oPackId != pack.id || oPos != pack.pos || forceUpd) {
      hashUpdate()
      return null
   }

   const feed = pack.arr[pack.pos]
   const subs = tag.subscriptions[feed.subId]
   let has_right: boolean, has_left: boolean

   if (pack.prev === undefined) {
      has_left = pack.id > 1 || pack.pos > 0
      has_right = pack.id < tag.packids || pack.pos < pack.arr.length - 1
   }
   else {
      has_left = feed.prev != -1
      has_right = pack.prev != "" || findRightIdx(pack.pos + 1, feed.subId) != -1
   }

   return { feed, subs, has_right, has_left }
}



function hashUpdate() {
   let filter = ""
   if (pack.prev !== undefined)
      filter = `!${pack.prev}`

   const hash = `#${pack.tag}.${pack.id}.${pack.pos}${filter}`

   history.pushState(null, null, hash);
   window.dispatchEvent(new HashChangeEvent('hashchange', {
      newURL: window.location.origin + window.location.pathname + hash,
      oldURL: window.location.href,
   }))
}



async function download(tagId: string, packid: number) {
   if (pack.tag == tagId && pack.id == packid)
      return

   const opts = {}
   let pack_name = tag.latest ? "true" : "false"
   if (packid !== tag.packids) {
      opts["cache"] = "force-cache"
      pack_name = packid.toString()
   }

   const req = await fetch(`${PACKS_URL}/${tagId}/${pack_name}.gz`, opts)
   const reader = req.body
      .pipeThrough(new DecompressionStream("gzip"))
      .pipeThrough(new TextDecoderStream())
      .getReader()

   pack.arr.length = 0

   let data = ""
   while (true) {
      const res = await reader.read()
      if (res.done) break

      data += res.value
      let arr = data.split("\n")
      data = arr.pop()

      for (const line of arr)
         pack.arr.push(JSON.parse(line))
   }

   pack.tag = tagId
   pack.id = packid
}