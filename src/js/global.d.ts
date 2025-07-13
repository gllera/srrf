declare let DB_URL: URL;
declare let DB: Promise<Response>;

interface IDB {
  latest: boolean;
  n_packs: number;
  n_subs: number;
  n_exts: number;
  subs: Array<ISub>;
  subs_mapped: Map<number, ISub>;
  exts: Array<IExt>;
  exts_mapped: Map<number, IExt>;
  last_fetch: number;
}

interface ISub {
  title: string;
  url: string;
  error: string;
  uuid: number;
  packid: number;
  id: number;
}

interface IExt {
  name: string;
  url: string;
  url_parsed: URL;
  id: number;
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
  sub: ISub;
  ext: IExt;
}

interface IState {
    prev: string | undefined,
    packid: number,
    pos: number,
    extId: number,
}