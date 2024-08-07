import {
  SteamOpenIdQuery,
  VALID_NONCE,
  VALID_OPENID_ENDPOINT,
} from '../../src';

export const RETURN_URL = '/auth/steam';

export const getISODate = (date: Date) => date.toISOString().split('.')[0] + 'Z';

export const query: {
  properties: SteamOpenIdQuery;
  get(): SteamOpenIdQuery;
  change(change: Partial<SteamOpenIdQuery>): SteamOpenIdQuery;
  remove(property: keyof SteamOpenIdQuery): SteamOpenIdQuery;
} = {
  /**
   * Valid query properties
   */
  properties: {
    'openid.mode': 'id_res',
    'openid.ns': VALID_NONCE,
    'openid.identity': `https://steamcommunity.com/openid/id/76561197960435530`,
    'openid.claimed_id': `https://steamcommunity.com/openid/id/76561197960435530`,
    'openid.return_to': RETURN_URL,
    'openid.op_endpoint': VALID_OPENID_ENDPOINT,
    'openid.response_nonce': `${getISODate(new Date())}8df86bac92ad1addaf3735a5aabdc6e2a7`,
    'openid.assoc_handle': '1234567890',
    'openid.signed':
      'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.sig': 'dc6e2a79de2c6aceac495ad5f4c6b6e0bfe30',
  },

  get(): SteamOpenIdQuery {
    return { ...this.properties };
  },

  change(change: Partial<SteamOpenIdQuery>): SteamOpenIdQuery {
    return { ...this.get(), ...change };
  },

  remove(property: keyof SteamOpenIdQuery): SteamOpenIdQuery {
    const properties = this.get();
    delete properties[property];
    return properties;
  },
};
