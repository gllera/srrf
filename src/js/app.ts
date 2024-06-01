import $ from "cash-dom"
import dayjs from "dayjs"
import calendar from "dayjs/plugin/calendar"
import * as packs from "./logic"

dayjs.extend(calendar)

let showing = "[NONE]"
const html = {
   panel: $(".srr-panel"),
   body: $(".srr-feed"),
   header: $(".srr-header"),
   title: $(".srr-title"),
   content: $(".srr-content"),
   link: $(".srr-link"),
   menu: $(".srr-menu"),
   left: $(".srr-left"),
   right: $(".srr-right"),
   last: $(".srr-last"),
   website: $(".srr-website"),
   tag: $(".srr-tag"),
   published: $(".srr-published"),
   selector: $(".srr-selector"),
}



function show(view: string) {
   switch (view) {
      case "panel":
         html.body.addClass("hidden")
         html.panel.removeClass("hidden")
         break
      case "feed":
         html.body.removeClass("hidden")
         html.panel.addClass("hidden")
         break
   }

   window.scrollTo({ top: 0, left: 0, behavior: "instant" })
   showing = view
}



async function read(hash: string) {
   let args: Array<string> = hash.split("!")
   const prev = args[1]
   args = args[0].split(".")

   let o = await packs.get(parseInt(args[0]), parseInt(args[1]), packs.setPrev(prev))
   if (o == null)
      return

   window.stop()
   html.title.text(o.feed.title)
   html.content.html(o.feed.content)
   html.link.attr({ href: o.feed.link })
   html.left.prop("disabled", !o.has_left)
   html.right.prop("disabled", !o.has_right)

   if (o.feed.published) {
      html.published.removeClass("hidden")
      html.published.text(dayjs.unix(o.feed.published).calendar())
   } else {
      html.tag.addClass("hidden")
   }

   let tag = (o.subs || {}).tag
   if (tag) {
      html.tag.removeClass("hidden")
      html.tag.text("#" + tag)
   } else {
      html.tag.addClass("hidden")
   }

   let website = (o.subs || {}).title || "[DELETED]"
   html.website.text(website)

   document.title = "SRR - " + o.feed.title
   show("feed")
}



async function init() {
   const subs = await packs.init()

   let sorted = Object.keys(subs).sort((a, b) => subs[a].title.localeCompare(subs[b].title))
   let arr = [`<ul><li class="srr-label" data-value="">[ALL]</li>`]
   for (const subId of sorted)
      if (subs[subId].last_packid > 0)
         arr.push(`<li class="srr-label" data-value="${subId}">${subs[subId].title}</li>`)
   arr.push("</ul>")
   html.selector.html(arr.join(""))

   $(".srr-label").on("click", async e => await packs.last(e.target.dataset.value))
   html.menu.on("click", async () => {
      if (showing == "panel")
         await read(location.hash.substring(1))
      else
         show("panel")
   })
   html.left.on("click", async e => e.target.disabled || await packs.left())
   html.right.on("click", async e => e.target.disabled || await packs.right())
   html.last.on("click", async e => await packs.last())

   window.onhashchange = async e => await read(e.newURL.split("#", 2)[1])
   document.onkeydown = async e => {
      switch (e.key) {
         case "w":
         case "Escape":
            html.menu.first().trigger("click")
            e.preventDefault()
            break
         default:
            if (!html.body.hasClass("hidden"))
               switch (e.key) {
                  case "s":
                     await packs.last()
                     e.preventDefault()
                     break
                  case "a":
                     case "ArrowLeft":
                        html.left.trigger("click")
                        e.preventDefault()
                        break
                  case "d":
                  case "ArrowRight":
                     html.right.trigger("click")
                     e.preventDefault()
                     break
               }
      }
   }

   const hash = location.hash.substring(1)
   if (!hash)
      show("panel")
   else
      await read(hash)
}

init()