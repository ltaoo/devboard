/// <reference types="vite/client" />

declare namespace fmt {
  function Println(...args: any[]): void;
}

declare global {
  interface Array<T> {
    last(): T | undefined;
  }
}
