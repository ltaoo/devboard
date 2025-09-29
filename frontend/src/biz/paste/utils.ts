export function isCodeContent(type?: null | string) {
  if (!type) {
    return false;
  }
  return ["Go", "Rust", "Python", "JavaScript", "TypeScript", "HTML", "JSON", "React", "Vue"].includes(type);
}
