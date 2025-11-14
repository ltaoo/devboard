export function uidFactory() {
  let _uid = 0;
  return function uid() {
    _uid += 1;
    return _uid;
  };
}
