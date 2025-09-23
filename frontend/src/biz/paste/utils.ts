export function isCodeContent(type?: null | string) {
  if (!type) {
    return false;
  }
  return ["JavaScript", "TypeScript", "HTML", "JSON", "React", "Vue"].includes(type);
}
