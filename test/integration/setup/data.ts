import { VALID_NONCE, VALID_OPENID_ENDPOINT } from '../../../src';

export const STEAMID = '76561197960435530';
export const SUCCESSFUL_QUERY: Record<string, string> = {
  'openid.mode': 'id_res',
  'openid.ns': VALID_NONCE,
  'openid.identity': `https://steamcommunity.com/openid/id/${STEAMID}`,
  'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAMID}`,
  'openid.return_to': '/auth/steam',
  'openid.op_endpoint': VALID_OPENID_ENDPOINT,
  'openid.response_nonce': `${new Date().toJSON()}8df86bac92ad1addaf3735a5aabdc6e2a7`,
  'openid.assoc_handle': '1234567890',
  'openid.signed':
    'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
  'openid.sig': 'dc6e2a79de2c6aceac495ad5f4c6b6e0bfe30',
};

export function validateBody(body: Record<string, string>) {
  const queryKeys = Object.keys(SUCCESSFUL_QUERY);
  const bodyKeys = Object.keys(body);

  for (let i = 0; i < queryKeys.length; i++) {
    const key: string = queryKeys[i] as string;
    if (key !== bodyKeys[i] && SUCCESSFUL_QUERY[key] != body[key]) {
      return false;
    }
  }

  return true;
}
