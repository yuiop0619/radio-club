export interface Dish { id: string; cn: string; jp: string; kind: 'drink'|'food'; alc: boolean; by: string; desc: string; descJp: string; line: string; lineJp: string }

export interface Spread { labelCn: string; labelJp: string; [k: string]: unknown }

/* legacy 命名空间（window.RC）的类型桥。
   Phase 2 起越来越多的页面由 Vue 驱动，但仍复用这套经过测试的 legacy 逻辑，
   所以这里把用到的成员逐步补齐；未用到的保持可选，避免误导调用方。 */
export interface Legacy {
  store: {
    get<T>(key: string, fallback: T): T;
    set(key: string, value: unknown): boolean;
    del(key: string): boolean;
  };
  bar: { menu: Dish[]; tray(): {id:string;n:number}[]; served(): Record<string,number> };
  i18n: {
    lang(): string;
    toggle(): void;
    onChange(fn:()=>void): void;
    t(key:string): string;
    apply?(root: ParentNode): void;
    of?(pair: {cn:string;jp:string}): string;
  };
  model: {
    normalize(value:unknown): Record<string, unknown>;
    parse?(value:unknown): Record<string, unknown>;
    formError?(patch:unknown): string | null;
  };
  case: {
    get(): Record<string, unknown>;
    has?(): boolean;
    save?(value:unknown): boolean;
    start?(value:unknown): boolean;
  };
  ui: {
    chrome(options: {title:string;path:string}): void;
    nav(path:string):string;
    siteFoot(options:{active:string}):string;
    bi(cn:string,jp:string):string;
    dialog(options: Record<string, unknown>): void;
    type(host: HTMLElement, text: string, speed: number): void;
  };
  util: { esc(value: unknown): string };
  share: {
    read(key:string): unknown;
    link(key:string, payload:unknown): string;
    copy(text:string): Promise<void>;
  };
  engine: { buildVerdict(c: Record<string, unknown>): Record<string, any> };
  analyst: { MASTERS?: any[]; motifLabel(key:string): {cn:string;jp:string} };
  tarot: {
    spreads: Record<string, Spread>;
    DOMAINS?: any[];
    byId?(id:number): any;
    sealOf?(id:number): string;
    dimOf?(id:number, question:string): {cn:string;jp:string}|null;
    draw?(): unknown;
    drawFor?(spread:string): unknown;
  };
  interpret?: { attach(v:unknown, c:unknown): void; localNote(v:unknown): string };
  gen?: {
    KEY: string;
    isReady(): boolean;
    getCfg(): any;
    chat(messages:any[], opts?:any): Promise<any>;
    interpret(kind:string, ev:unknown, handle?:string): Promise<any>;
    buildMessages(kind:string, ev:unknown, handle?:string): any[];
    save(cfg:any): boolean;
    load(): any;
    test(cfg:any): Promise<any>;
  };
  shareCard?: { init(): void };
  stamps?: { check?(): void };
  cloud?: { connect():Promise<void>; request<T>(body:unknown):Promise<T> };
}

export const rc = (window as unknown as {RC: Legacy}).RC;
