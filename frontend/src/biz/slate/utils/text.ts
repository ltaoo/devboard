export function deleteTextInRange(text: string, range: [number, number]) {
  if (range[0] === range[1]) {
    return text;
  }
  return text.substring(0, range[0]) + text.substring(range[1]);
}

export function deleteTextAtOffset(text: string, deleted: string, offset: number) {
  if (deleted.length === 0) {
    return text;
  }
  return text.substring(0, offset) + text.substring(offset + deleted.length);
}

export function insertTextAtOffset(text: string, inserted: string, offset: number) {
  return text.substring(0, offset) + inserted + text.substring(offset);
}
