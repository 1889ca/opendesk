/** Ambient type declarations for fast-check (property-based testing). */
declare module 'fast-check' {
  export function assert(property: unknown): void;
  export function property(...args: unknown[]): unknown;

  export function record(arbs: Record<string, unknown>): { map(fn: (v: any) => any): unknown } & unknown;
  export function uuid(): unknown;
  export function string(opts?: { minLength?: number; maxLength?: number }): unknown;
  export function stringMatching(regex: RegExp): unknown;
  export function integer(opts?: { min?: number; max?: number }): { map(fn: (v: any) => any): unknown } & unknown;
  export function boolean(): unknown;
  export function option(arb: unknown, opts?: { nil?: null }): unknown;
  export function constantFrom<T>(...values: T[]): unknown;
  export function tuple(...arbs: unknown[]): { map(fn: (v: any) => any): unknown } & unknown;
  export function array(arb: unknown, opts?: { minLength?: number; maxLength?: number }): unknown;

  const fc: {
    assert: typeof assert;
    property: typeof property;
    record: typeof record;
    uuid: typeof uuid;
    string: typeof string;
    stringMatching: typeof stringMatching;
    integer: typeof integer;
    boolean: typeof boolean;
    option: typeof option;
    constantFrom: typeof constantFrom;
    tuple: typeof tuple;
    array: typeof array;
  };

  export default fc;
}
