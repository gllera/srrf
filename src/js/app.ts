import $ from "cash-dom"
import dayjs from "dayjs"
import calendar from "dayjs/plugin/calendar"
import * as packs from "./logic"

dayjs.extend(calendar)

let showing = "[NONE]"
const html = {
   panel: $(".srr-panel"),
   feed: $(".srr-feed"),
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
   view: {
      panel: $(".vPanel"),
      feed: $(".vFeed"),
   },
}



function show(view: string) {
   switch (view) {
      case "panel":
         html.view.feed.addClass("hidden")
         html.view.panel.removeClass("hidden")
         break
      case "feed":
         html.view.panel.addClass("hidden")
         html.view.feed.removeClass("hidden")
         break
   }

   window.scrollTo({ top: 0, left: 0, behavior: "instant" })
   showing = view
}



async function read(hash: string) {
   let args: Array<string> = hash.split("!")
   const prev = args[1]
   args = args[0].split(".")

   let o = await packs.get(args[0], parseInt(args[1]), parseInt(args[2]), packs.setPrev(prev))
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



async function generateSelectorHtml() {
   const tags = await packs.init()
   const sTagIds = Object.keys(tags).sort((a, b) => tags[a].name.localeCompare(tags[b].name))

   const arr = ['<div class="srr-tabs">']
   for (const tagId of sTagIds)
      arr.push(`<button data-value="${tagId}">${tags[tagId].name}</button>`)
   arr.push('</div>')

   for (const tagId of Object.keys(tags)) {
      const tag: ISubscriptionTag = tags[tagId]
      const subs: { [id: number]: ISubscription } = tag.subscriptions
      const sSubIds = Object.keys(subs).sort((a, b) => subs[a].title.localeCompare(subs[b].title))

      arr.push(`<div class="srr-tabcontent" data-value="${tagId}">`)
      for (const subId of sSubIds)
         if (subs[subId].last_packid > 0)
            arr.push(`<div class="srr-site" data-value="${tagId}.${subId}">${subs[subId].title}</div>`)
      arr.push("</div>")
   }

   html.selector.html(arr.join(""))
}



async function init() {
   await generateSelectorHtml()

   $(".srr-site").on("click", async e => await packs.last(e.target.dataset.value))
   $(".srr-tabs > button").on("click", async e => {
      if (e.target.className == "srr-active")
         return await packs.last(e.target.dataset.value)

      const tagId = e.target.dataset.value
      $(`.srr-tabs > button[     data-value="${tagId}" ]`).addClass("srr-active")
      $(`.srr-tabs > button:not([data-value="${tagId}" ])`).removeClass("srr-active")
      $(`.srr-tabcontent[        data-value="${tagId}" ]`).removeClass("hidden")
      $(`.srr-tabcontent:not([   data-value="${tagId}" ])`).addClass("hidden")
   })

   html.left.on("click", async e => e.target.disabled || await packs.left())
   html.right.on("click", async e => e.target.disabled || await packs.right())
   html.last.on("click", async () => await packs.last())
   html.menu.on("click", async () => {
      if (showing == "panel")
         await read(location.hash.substring(1))
      else
         show("panel")
   })

   window.onhashchange = async e => await read(e.newURL.split("#", 2)[1])

   document.onkeydown = async e => {
      switch (e.key) {
         case "w":
         case "Escape":
            html.menu.first().trigger("click")
            e.preventDefault()
            break
         default:
            if (!html.feed.hasClass("hidden"))
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
   if (hash) {
      const tagId = hash.split(".")[0]
      $(`.srr-tabs > button[data-value="${tagId}"]`).trigger("click")
      await read(hash)
   }
   else {
      $(".srr-tabs > button").first().trigger("click")
      show("panel")
   }

   
}



init()