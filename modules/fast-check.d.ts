/** Ambient type declarations for fast-check (property-based testing). */
declare module 'fast-check' {
  interface Arbitrary<T = unknown> {
    map<U>(fn: (v: T) => U): Arbitrary<U>;
    filter(predicate: (v: T) => boolean): Arbitrary<T>;
  }

  export function assert(property: unknown, params?: { numRuns?: number; seed?: number; timeout?: number }): void;
  export function property(...args: unknown[]): unknown;
  export function pre(condition: boolean): void;

  export function record<T extends Record<string, unknown> = Record<string, unknown>>(arbs: { [K in keyof T]: Arbitrary<T[K]> | unknown }, opts?: { requiredKeys?: string[] }): Arbitrary<T>;
  export function uuid(): Arbitrary<string>;
  export function string(opts?: { minLength?: number; maxLength?: number }): Arbitrary<string>;
  export function stringMatching(regex: RegExp): Arbitrary<string>;
  export function integer(opts?: { min?: number; max?: number }): Arbitrary<number>;
  export function nat(max?: number): Arbitrary<number>;
  export function boolean(): Arbitrary<boolean>;
  export function option(arb: unknown, opts?: { nil?: null }): Arbitrary;
  export function constant<T>(value: T): Arbitrary<T>;
  export function constantFrom<T>(...values: T[]): Arbitrary<T>;
  export function oneof<T>(...arbs: Arbitrary<T>[]): Arbitrary<T>;
  export function tuple(...arbs: unknown[]): Arbitrary<unknown[]>;
  export function array(arb: unknown, opts?: { minLength?: number; maxLength?: number }): Arbitrary<unknown[]>;
  export function uniqueArray(arb: unknown, opts?: { minLength?: number; maxLength?: number; comparator?: string }): Arbitrary<unknown[]>;
  export function uint8Array(opts?: { minLength?: number; maxLength?: number }): Arbitrary<Uint8Array>;

  const fc: {
    assert: typeof assert;
    property: typeof property;
    pre: typeof pre;
    record: typeof record;
    uuid: typeof uuid;
    string: typeof string;
    stringMatching: typeof stringMatching;
    integer: typeof integer;
    nat: typeof nat;
    boolean: typeof boolean;
    option: typeof option;
    constant: typeof constant;
    constantFrom: typeof constantFrom;
    oneof: typeof oneof;
    tuple: typeof tuple;
    array: typeof array;
    uniqueArray: typeof uniqueArray;
    uint8Array: typeof uint8Array;
  };

  export default fc;
}
