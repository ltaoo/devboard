export function isCodeContent(types?: string[]) {
  if (!types || types.length === 0) {
    return false;
  }
  return types.includes("code");
}
