export interface Dish { id: string; cn: string; jp: string; kind: 'drink'|'food'; alc: boolean; by: string; desc: string; descJp: string; line: string; lineJp: string }
export interface Legacy {
  store: { get<T>(key: string, fallback: T): T; set(key: string, value: unknown): boolean; del(key: string): boolean };
  bar: { menu: Dish[]; tray(): {id:string;n:number}[]; served(): Record<string,number> };
  i18n: { lang(): string; toggle(): void; onChange(fn:()=>void): void; t(key:string): string };
  model: { normalize(value:unknown): Record<string,unknown> };
  case: { get(): Record<string,unknown> };
  ui: { chrome(options: {title:string;path:string}): void; nav(path:string):string; siteFoot(options:{active:string}):string };
}
export const rc = (window as unknown as {RC: Legacy}).RC;
