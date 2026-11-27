export function matchesMatricula(value: unknown, query: string) {
  const target = query.trim().toLocaleLowerCase("es-MX");
  return !target || (typeof value === "string" && value.trim().toLocaleLowerCase("es-MX") === target);
}
