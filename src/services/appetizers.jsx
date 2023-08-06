import { client, parseData } from './client';

export async function getAppetizers() {
    const resp = await client.from('appetizers').select().order('created_at');
    return parseData(resp);
}
