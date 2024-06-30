declare let PACKS_URL: string
declare let DB: Promise<Response>

interface IDB {
  subids: number
  tagids: number
  tags: { [id: string] : ISubscriptionTag }
}

interface ISubscriptionTag {
  name: string
  packids: number
  latest: boolean
  subscriptions: { [id: string] : ISubscription }
}

interface ISubscription {
  url: string
  title: string
  tag: string
  last_uuid: string
  last_modified: string
  last_packid: number
}

interface IFeed {
  subId: number
  title: string
  content: string
  link: string
  published: number
  prev: number
}

interface IShowFeed {
  has_right: boolean
  has_left: boolean
  feed: IFeed
  subs: ISubscription
}

interface IPack {
  id: number
  tag: string
  arr: Array<IFeed>
  pos: number
  prev: string
}