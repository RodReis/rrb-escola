export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel de ambiente ausente: ${name}`);
  return value;
}
