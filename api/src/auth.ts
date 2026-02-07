import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const toHex = (buffer: Buffer): string => buffer.toString("hex");

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt.toString("hex"), 64);
  return `${toHex(salt)}:${toHex(hash)}`;
};

export const verifyPassword = (password: string, encodedHash: string): boolean => {
  const [saltHex, hashHex] = encodedHash.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt.toString("hex"), expected.length);

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(new Uint8Array(actual), new Uint8Array(expected));
};

export const randomId = (size = 12): string => randomBytes(size).toString("hex");

export const randomToken = (): string => randomBytes(32).toString("base64url");
