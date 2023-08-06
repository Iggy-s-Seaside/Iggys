import { client, parseData } from './client';

export async function getOnTap() {
    const resp = await client.from('on_tap').select().order('created_at');
    return parseData(resp);
}
