import qs, { ParsedUrlQuery } from 'querystring';
import axios, { AxiosInstance } from 'axios';
import { Strategy } from 'passport';
import { SteamOpenIdError } from './error';
import {
  OPENID_QUERY_PROPS,
  PLAYER_SUMMARY_URL,
  VALID_IDENTITY_ENDPOINT,
  VALID_ID_SELECT,
  VALID_NONCE,
  VALID_OPENID_ENDPOINT,
} from './constant';
import {
  SteamOpenIdUserProfile,
  SteamOpenIdUser,
  SteamOpenIdQuery,
  SteamOpenIdErrorType,
  SteamPlayerSummaryResponse,
  SteamOpenIdStrategyOptionsWithProfile,
  SteamOpenIdStrategyOptionsWithoutProfile,
  VerifyCallback,
} from './type';

/**
 * Strategy that authenticates you via steam openid without the use of any external openid libraries,
 * which can and are source of many vulnerabilities.
 *
 * Functionality should be similar to `passport-steam`.
 *
 * @class SteamOpenIdStrategy
 */
export class SteamOpenIdStrategy<
  TOptions extends
    | SteamOpenIdStrategyOptionsWithProfile
    | SteamOpenIdStrategyOptionsWithoutProfile,
  TUser extends
    | SteamOpenIdUser
    | SteamOpenIdUserProfile = TOptions extends SteamOpenIdStrategyOptionsWithProfile
    ? SteamOpenIdUserProfile
    : SteamOpenIdUser,
> extends Strategy {
  /**
   * Axios instance used for validating the request and fetching profile.
   */
  protected readonly axios: AxiosInstance;

  /**
   * Where in your app, you want to return to from steam.
   *
   * This route has to have passport authentication middleware.
   */
  protected readonly returnURL: string;

  /**
   * Steam Api key used for fetching profile.
   */
  protected readonly apiKey?: string;

  /**
   * Signalizes, if profile should be fetched.
   */
  protected readonly profile: boolean;

  /**
   * optional callback, called when user is successfully authenticated
   */
  protected verify?: VerifyCallback<TUser>;

  /**
   * @constructor
   *
   * @param options.returnURL where steam redirects after parameters are passed
   * @param options.profile if set, we will fetch user's profile from steam api
   * @param options.apiKey api key to fetch user profile, not used if profile is false
   * @param verify optional callback, called when user is successfully authenticated
   */
  constructor(options: TOptions, verify?: VerifyCallback<TUser>) {
    super();

    this.name = 'steam-openid';
    this.axios = axios.create();
    this.returnURL = options.returnURL;
    this.profile = options.profile;
    if (options.profile) this.apiKey = options.apiKey;
    if (verify) this.verify = verify;
  }

  /**
   * Passport handle for authentication. We handle the query, passport does rest.
   *
   * @param req Base IncommingMessage request enhanced with parsed querystring.
   */
  public override async authenticate(req: any) {
    try {
      const user = await this.handleRequest(req);
      if (!this.verify) {
        this.success(user);
        return;
      }

      this.verify(req, user.steamid, user, (err, user) => {
        if (err) {
          this.error(err);
          return;
        }

        if (!user) {
          this.error(new Error('No user was received from callback.'));
          return;
        }

        this.success(user);
      });
    } catch (err) {
      if (this.isRetryableError(err)) {
        this.redirect(this.buildRedirectUrl());
        return;
      }

      this.error(err);
    }
  }

  /**
   * Handles validation request.
   *
   * Can be used in a middleware, if you don't like passport.
   *
   * @param req Base IncommingMessage request enhanced with parsed querystring.
   * @returns
   * @throws {SteamOpenIdError} User related problem, such as:
   *  - open.mode was not correct
   *  - query did not was pass validation
   *  - steam rejected this query
   *  - steamid is invalid
   * @throws {Error} Non-recoverable errors, such as query object missing.
   */
  public async handleRequest(req: any): Promise<TUser> {
    const query: ParsedUrlQuery = this.getQuery(req);
    if (!this.hasAuthQuery(query)) {
      throw new SteamOpenIdError(
        'openid.mode is incorrect.',
        SteamOpenIdErrorType.InvalidMode,
      );
    }

    if (!this.isQueryValid(query)) {
      throw new SteamOpenIdError(
        'Supplied query is invalid.',
        SteamOpenIdErrorType.InvalidQuery,
      );
    }

    // TODO: validate nonce time

    const valid = await this.validateAgainstSteam(query);
    if (!valid) {
      throw new SteamOpenIdError(
        'Failed to validate query against steam.',
        SteamOpenIdErrorType.Unauthorized,
      );
    }

    const steamId = this.getSteamId(query);
    return await this.getUser(steamId);
  }

  /**
   * Checks if error is retryable,
   * meaning user gets redirected to steam openid page.
   *
   * @param err from catch clause
   * @returns true, if error should be retried
   * @returns false, if error is not retriable
   *  and should be handled by the app.
   */
  protected isRetryableError(err: unknown) {
    return (
      err instanceof SteamOpenIdError &&
      err.code == SteamOpenIdErrorType.InvalidMode
    );
  }

  /**
   * Retrieves query parameter from req object and checks if it is an object.
   *
   * @param req Base IncommingMessage request enhanced with parsed querystring.
   * @returns query from said request
   * @throws Error if query cannot be found, non-recoverable error.
   */
  protected getQuery(req: any): ParsedUrlQuery {
    if (!req['query'] || typeof req['query'] != 'object') {
      throw new Error('Query was not found on request object.');
    }

    return req['query'];
  }

  /**
   * Checks if `mode` field from query is correct and thus authentication can begin
   *
   * @param query original query user submitted
   * @returns true, if mode is correct, equal to `id_res`
   * @returns false, if mode is incorrect
   */
  protected hasAuthQuery(query: ParsedUrlQuery) {
    return !!query['openid.mode'] && query['openid.mode'] == 'id_res';
  }

  /**
   * Builds a redirect url for user that is about to authenticate
   *
   * @returns redirect url built with proper parameters
   */
  public buildRedirectUrl() {
    const openIdParams = {
      'openid.mode': 'checkid_setup',
      'openid.ns': VALID_NONCE,
      'openid.identity': VALID_ID_SELECT,
      'openid.claimed_id': VALID_ID_SELECT,
      'openid.return_to': this.returnURL,
    };

    return `${VALID_OPENID_ENDPOINT}?${qs.stringify(openIdParams)}`;
  }

  /**
   * Validates user submitted query, if it contains correct parameters.
   * No excess parameters can be used.
   *
   * @param query original query user submitted
   * @returns true, query contains correct parameters
   * @returns false, query contains incorrect parameters
   */
  protected isQueryValid(query: ParsedUrlQuery): query is SteamOpenIdQuery {
    for (const key of OPENID_QUERY_PROPS) {
      if (!query[key]) {
        return false;
      }
    }

    if (query['openid.ns'] != VALID_NONCE) return false;
    if (query['openid.op_endpoint'] != VALID_OPENID_ENDPOINT) return false;
    if (query['openid.claimed_id'] !== query['openid.identity']) return false;
    if (!this.isValidIdentity(query['openid.claimed_id'])) return false;
    return query['openid.return_to'] == this.returnURL;
  }

  /**
   * Checks if identity starts with correct link.
   *
   * @param identity from querystring
   * @returns true, if identity is a string and starts with correct endpoint
   * @return false, if above criteria was violated
   */
  protected isValidIdentity(identity: string | unknown) {
    return (
      typeof identity == 'string' &&
      !!identity.match(
        /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119[0-9]{10})\/?$/,
      )
    );
  }

  /**
   * Query trusted steam endpoint to validate supplied query.
   *
   * @param query original query user submitted
   * @returns true, if positive response was received
   * @returns false, if request failed, status is incorrect or data signals invalid
   */
  protected validateAgainstSteam(query: SteamOpenIdQuery): Promise<boolean> {
    return this.axios
      .post(VALID_OPENID_ENDPOINT, this.getOpenIdValidationRequestBody(query), {
        maxRedirects: 0,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      .then(({ data, status }) => {
        if (status !== 200) {
          return false;
        }

        return this.isSteamResponseValid(data);
      })
      .catch(() => {
        return false;
      });
  }

  /**
   * Clones query from authentication request, changes mode and stringifies to form data.
   * @param query original query user submitted
   * @returns stringified form data with changed mode
   */
  protected getOpenIdValidationRequestBody(query: SteamOpenIdQuery) {
    const data = { ...query };
    data['openid.mode'] = 'check_authentication';
    return qs.stringify(data);
  }

  /**
   * Validates response from steam to see if query is correct.
   *
   * @param response response received from steama
   * @returns true, if data was in correct format and signals valid query
   * @return false, if data was corrupted or invalid query was signaled
   */
  protected isSteamResponseValid(response: any) {
    if (typeof response != 'string') return false;
    const match = response.match(/^ns:(.+)\nis_valid:(.+)\n$/);
    if (!match) return false;
    if (match[1] != VALID_NONCE) return false;
    return match[2] == 'true';
  }

  /**
   * Parses steamId from `claimed_id` field, which is what openid 2.0 uses.
   *
   * @param query original query user submitted
   * @returns parsed steamId
   */
  protected getSteamId(query: SteamOpenIdQuery) {
    return query['openid.claimed_id']
      .replace(`${VALID_IDENTITY_ENDPOINT}/`, '')
      .replace('/', ''); // Incase steam starts sending links ending with /
  }

  /**
   * Abstract method for getting user that has been authenticated.
   * You can implement fetching user from steamid and thus validating even more,
   * or if you are satisified with just steamId, you can return it as an object
   * and continue without need of an steam api key.
   *
   * @param steamId steamId parsed from `claimed_id`
   * @return generic that was chosen by child class
   */
  protected async getUser(steamId: string): Promise<TUser> {
    // Kind of hacky way to force the generic, but will do for now.
    if (this.profile) {
      return this.fetchPlayerSummary(steamId) as Promise<TUser>;
    }

    return { steamid: steamId } as TUser;
  }

  /**
   * Fetches profile data for authenticated user.
   * Validates the steamId even more.
   *
   * @param steamId parsed steamId from `claimed_id`
   * @returns profile belonging to said steamId
   *
   * @throws {Error} if malformed response was received
   * @throws {AxiosError} if status was not 200
   * @throws {SteamOpenIdError} if profile was not found
   */
  protected async fetchPlayerSummary(
    steamId: string,
  ): Promise<SteamOpenIdUserProfile> {
    const summaryQuery = {
      steamids: steamId,
      key: this.apiKey,
    };

    return this.axios
      .get<SteamPlayerSummaryResponse>(
        `${PLAYER_SUMMARY_URL}/?${qs.stringify(summaryQuery)}`,
      )
      .then(({ data }) => {
        if (!Array.isArray(data?.response?.players)) {
          throw new Error('Malformed response from steam.');
        }

        const user = data.response.players[0];
        if (!user) {
          throw new SteamOpenIdError(
            'Profile was not found on steam.',
            SteamOpenIdErrorType.InvalidSteamId,
          );
        }

        if (user.steamid != steamId) {
          throw new SteamOpenIdError(
            'API returned invalid user.',
            SteamOpenIdErrorType.InvalidSteamId,
          );
        }

        return user;
      });
  }
}
