import { DoneCallback } from 'passport';

export type BaseSteamOpenIdStrategyOptions = {
  returnURL: string;
};

export type SteamOpenIdStrategyOptionsWithProfile = {
  profile: true;
  apiKey: string;
} & BaseSteamOpenIdStrategyOptions;

export type SteamOpenIdStrategyOptionsWithoutProfile = {
  profile: false;
} & BaseSteamOpenIdStrategyOptions;

export type SteamOpenIdStrategyOptions =
  | SteamOpenIdStrategyOptionsWithProfile
  | SteamOpenIdStrategyOptionsWithoutProfile;

/**
 * Enum used to distinguish between user-related errors.
 *
 * @enum SteamOpenIdErrorType
 */
export enum SteamOpenIdErrorType {
  /**
   * Invalid mode for authentication, should trigger redirect.
   */
  InvalidMode = 0,
  /**
   * Query has a wrong parameter or has excess parameters.
   */
  InvalidQuery = 1,
  /**
   * Steam rejected our query.
   */
  Unauthorized = 2,
  /**
   * SteamId is not valid.
   */
  InvalidSteamId = 3,
}

/** When profile is not used, we just send a steamid. */
export type SteamOpenIdUser = {
  steamid: string;
};

/** Api response for profile */
export type SteamPlayerSummaryResponse = {
  response: {
    players: SteamOpenIdUserProfile[];
  };
};

/**
 * Steam Player Summary
 */
export type SteamOpenIdUserProfile = {
  steamid: string;
  communityvisibilitystate: number;
  profilestate: number;
  personaname: string;
  commentpermission: number;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  avatarhash: string;
  lastlogoff: number;
  personastate: number;
  realname: string;
  primaryclanid: string;
  timecreated: number;
  personastateflags: number;
  loccountrycode: string;
  locstatecode: string;
};

/**
 * Optional callback inserted into the constructor of SteamOpenIdStrategy.
 */
export type VerifyCallback<
  TUser extends SteamOpenIdUser | SteamOpenIdUserProfile,
> = (req: any, identifier: string, profile: TUser, done: DoneCallback) => any;

export type SteamOpenIdQuery = {
  'openid.ns': string;
  'openid.mode': string;
  'openid.op_endpoint': string;
  'openid.claimed_id': string;
  'openid.identity': string;
  'openid.return_to': string;
  'openid.response_nonce': string;
  'openid.assoc_handle': string;
  'openid.signed': string;
  'openid.sig': string;
};
