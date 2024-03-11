import { client, parseData } from './client';

export async function getHappyHour() {
    const resp = await client.from('happy_hour').select().order('created_at');
    return parseData(resp);
}
