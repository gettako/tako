import { Registry, CreateRegistryInput } from '@/lib/types/registry';

export async function listRegistries(): Promise<Registry[]> {
  const res = await fetch('/api/registries');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch registries: ${res.status}`);
  }
  return res.json();
}

export async function createRegistry(data: CreateRegistryInput): Promise<Registry> {
  const res = await fetch('/api/registries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create registry: ${res.status}`);
  }
  return res.json();
}

export async function deleteRegistry(id: string): Promise<void> {
  const res = await fetch(`/api/registries/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete registry: ${res.status}`);
  }
}
