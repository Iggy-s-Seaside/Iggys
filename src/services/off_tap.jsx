import { client, parseData } from './client';

export async function getOffTap() {
    const resp = await client.from('off_tap').select().order('created_at');
    return parseData(resp);
}
