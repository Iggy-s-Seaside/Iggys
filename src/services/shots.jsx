import { client, parseData } from './client';

export async function getShots() {
    const resp = await client.from('shots').select().order('created_at');
    return parseData(resp);
}
