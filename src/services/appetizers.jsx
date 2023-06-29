import { client, parseData } from './client';

export async function getAppetizers() {
    const resp = await client.from('appetizers').select();
    return parseData(resp);
}
