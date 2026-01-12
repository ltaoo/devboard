export function isCodeContent(types?: string[]) {
  if (!types || types.length === 0) {
    return false;
  }
  return types.includes("code");
}

export function isURL(types?: string[]) {
  if (!types || types.length === 0) {
    return false;
  }
  return types.includes("url");
}
