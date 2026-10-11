export interface Registry {
  id: string;
  name: string;
  serverUrl: string;
  username: string;
  password?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegistryInput {
  name: string;
  serverUrl: string;
  username: string;
  password: string;
}
