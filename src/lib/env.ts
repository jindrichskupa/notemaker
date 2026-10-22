const AGE_HEADER = "-----BEGIN AGE ENCRYPTED FILE-----";

/** Same check as Rust `is_encrypted`, without an IPC round trip */
export function isEncrypted(content: string): boolean {
  return content.trim().startsWith(AGE_HEADER);
}

/**
 * Parse dotenv-style text: `KEY=value` per line, `#` comments, optional `export `
 * prefix and surrounding quotes. Later keys override earlier ones.
 */
export function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0])) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}
