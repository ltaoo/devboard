declare global {
  interface Array<T> {
    last(): T | null;
  }
}

export {};
