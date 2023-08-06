import { client, parseData } from './client';

export async function getCocktails() {
    const resp = await client.from('cocktails').select().order('created_at');
    return parseData(resp);
}
