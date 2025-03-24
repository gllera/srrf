import $ from "cash-dom"
import dayjs from "dayjs"
import calendar from "dayjs/plugin/relativeTime"
import * as packs from "./logic"

dayjs.extend(calendar)

let showing = "[NONE]"
const html = {
   body: $(".srr-feed"),
   header: $(".srr-header"),
   title: $(".srr-title"),
   content: $(".srr-content"),
   link: $(".srr-link"),
   ext: $(".srr-ext-text"),
   left: $(".srr-left"),
   right: $(".srr-right"),
   website: $(".srr-website"),
   published: $(".srr-published"),
   ctrl: $(".srr-ctrl-left"),
   anchor: $(".srr-dropdown > .anchor")
}

async function read(hash: string) {
   let args: Array<string> = hash.split("!")
   const prev = args[1]
   args = args[0].split(".")

   let o = await packs.get(parseInt(args[0]), parseInt(args[1]), parseInt(args[2]), packs.setPrev(prev))
   if (o == null)
      return

   window.stop()
   html.title.text(o.feed.title)
   html.content.html(o.feed.content)
   html.link.attr({ href: o.feed.link })
   html.ext.text(o.ext.name)

   html.left.prop("disabled", !o.has_left)
   html.right.prop("disabled", !o.has_right)

   let date = dayjs.unix(o.feed.published)
   html.published.text(date.fromNow())
   html.published.attr({ title: date.format("DD/MM/YYYY HH:mm") })

   let website = (o.sub || {}).title || "[DELETED]"
   html.website.text(website)
   html.anchor.data("active", prev !== undefined)

   document.title = "SRR - " + o.feed.title
   window.scrollTo({ top: 0, left: 0, behavior: "instant" })
}

function showSubs() {
   const dd = $("#srr-website-dd")
   const res = Array.from(packs.get_subs().values())
      .sort((a, b) => a.title < b.title ? -1 : 1)
      .map(sub => `<a href="#" data-value="${sub.id}">${sub.title}</a>`)
      .join("")

   dd.html( `<a href="#" data-value="">[ALL]</a>` + res)
   $("#srr-website-dd > a").on("click", async e => {
      e.preventDefault()
      try {
         await packs.last(e.target.dataset.value)
      } catch (_) {}
   })
   dd.toggleClass("show")
}

function showExts() {
   const dd = $("#srr-ext-dd")
   const res = Array.from(packs.get_exts().values())
      .sort((a, b) => a.name < b.name ? -1 : 1)
      .map(ext => `<a href="#" data-value="${ext.id}">${ext.name}</a>`)
      .join("")

   dd.html(res)
   $("#srr-ext-dd > a").on("click", async e => {
      e.preventDefault()
      try {
         packs.setPrev(undefined)
         await packs.get(parseInt(e.target.dataset.value), Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true)
      } catch (_) {}
   })
   dd.toggleClass("show")
}

async function init() {
   await packs.init()

   if (packs.get_exts().size > 1)
      html.ctrl.removeClass("hidden")

   html.left.on( "click", async e => e.target.disabled || await packs.left())
   html.right.on("click", async e => e.target.disabled || await packs.right())
   html.anchor.on("click", async () =>                    await packs.togglePrev())
   html.website.on("click", () => showSubs())
   html.ext.on(    "click", () => showExts())
   $(window).on("click", e => {
      if (!e.target.matches('.dropbtn'))
         $(".dropdown-content").removeClass("show")
   })

   window.onhashchange = async e => await read(e.newURL.split("#", 2)[1])
   document.onkeydown = async e => {
      switch (e.key) {
         case "w": await packs.up();    e.preventDefault(); break
         case "s": await packs.down();  e.preventDefault(); break
         case "ArrowLeft":
         case "a": html.left.trigger("click");  e.preventDefault(); break
         case "ArrowRight":
         case "d": html.right.trigger("click"); e.preventDefault(); break
      }
   }

   await read(location.hash.substring(1))
}

init()