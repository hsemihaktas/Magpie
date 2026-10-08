/**
 * invite-code.ts
 * Pure utility for generating single-use invite codes.
 * Kept separate from server actions so it can be tested in isolation.
 */

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generates a random 8-character uppercase alphanumeric invite code.
 * Format invariant: /^[A-Z0-9]{8}$/
 */
export function generateCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}
