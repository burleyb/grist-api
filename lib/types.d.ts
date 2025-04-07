declare module 'ms' {
  function ms(value: string | number, options?: { long: boolean }): number;
  function ms(value: number, options?: { long: boolean }): string;
  export = ms;
}

declare module 'debug' {
  function debug(namespace: string): debug.Debugger;
  namespace debug {
    interface Debugger {
      (formatter: any, ...args: any[]): void;
      enabled: boolean;
      namespace: string;
    }
    function enable(namespaces: string): void;
    function disable(): string;
  }
  export = debug;
} 