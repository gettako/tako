import { EnvVar } from '@/lib/types';

export function parseDotEnv(content: string): Partial<EnvVar>[] {
  const lines = content.split('\n');
  const result: Partial<EnvVar>[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
      result.push({
        key: trimmed,
        value: '',
        isSecret: false,
      });
      continue;
    }

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Strip enclosing single or double quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    const isSecret =
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('key') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('pass');

    result.push({
      key,
      value,
      isSecret,
    });
  }

  return result;
}

export function formatDotEnv(envVars: EnvVar[]): string {
  return envVars
    .map((item) => {
      // If value contains spaces, quote it
      const val = item.value.includes(' ') ? `"${item.value}"` : item.value;
      return `${item.key}=${val}`;
    })
    .join('\n');
}
