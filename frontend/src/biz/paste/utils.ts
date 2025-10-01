export function isCodeContent(type?: null | string) {
  if (!type) {
    return false;
  }
  return ["Go", "Rust", "Python", "JavaScript", "TypeScript", "HTML", "JSON", "SQL", "YAML", "React", "Vue"].includes(
    type
  );
}
