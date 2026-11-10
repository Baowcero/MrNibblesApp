function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const ACCESS_TTL_SECONDS = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900);
export const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);

export function accessSecret(): Uint8Array {
  return new TextEncoder().encode(required('JWT_ACCESS_SECRET'));
}
