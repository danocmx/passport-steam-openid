/**
 * Query parameters that are allowed for be on the authentication request.
 */
export const OPENID_QUERY_PROPS = [
  'openid.ns',
  'openid.mode',
  'openid.op_endpoint',
  'openid.claimed_id',
  'openid.identity',
  'openid.return_to',
  'openid.response_nonce',
  'openid.assoc_handle',
  'openid.signed',
  'openid.sig',
] as const;

// All URLs required for this package.
export const VALID_NONCE = 'http://specs.openid.net/auth/2.0';
export const VALID_ID_SELECT = `${VALID_NONCE}/identifier_select`;
export const VALID_IDENTITY_ENDPOINT = 'https://steamcommunity.com/openid/id';
export const VALID_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
export const PLAYER_SUMMARY_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2';
