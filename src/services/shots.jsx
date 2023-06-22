import { client, parseData } from './client';

export async function getShots() {
    const resp = await client.from('shots').select();
    return parseData(resp);
}
