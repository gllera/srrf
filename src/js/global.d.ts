declare let PACKS_URL: string;
declare let DB: Promise<Response>;

interface IDB {
  subids: number;
  packids: number;
  latest: boolean;
  subscriptions: Array<ISubscription>;
}

interface ISubscription {
  url: string;
  title: string;
  tag: string;
  last_uuid: string;
  last_modified: string;
  last_packid: number;
}

interface IFeed {
  subId: number;
  title: string;
  content: string;
  link: string;
  published: number;
  prev: number
}

interface IShowFeed {
  has_right: boolean;
  has_left: boolean;
  feed: IFeed;
  subs: ISubscription;
}

interface IState {
    prev: string,
    packid: number,
    pos: number,
}