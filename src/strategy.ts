import qs, { ParsedUrlQuery } from 'querystring';
import { Strategy } from 'passport';
import { SteamOpenIdError } from './error';
import {
  OPENID_QUERY_PROPS,
  PLAYER_SUMMARY_URL,
  VALID_ASSOC_HANDLE,
  VALID_IDENTITY_ENDPOINT,
  VALID_ID_SELECT,
  VALID_NONCE,
  VALID_OPENID_ENDPOINT,
  VALID_SIGNED_FIELD,
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
  IAxiosLikeHttpClient,
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
  protected readonly http: IAxiosLikeHttpClient;

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
   * Optional setting for validating nonce time delay,
   * in seconds.
   *
   * Measures time between nonce creation date and verification.
   */
  protected maxNonceTimeDelay: number | undefined;

  /**
   * @constructor
   *
   * @param options.returnURL where steam redirects after parameters are passed
   * @param options.profile if set, we will fetch user's profile from steam api
   * @param options.apiKey api key to fetch user profile, not used if profile is false
   * @param options.maxNonceTimeDelay optional setting for validating nonce time delay,
   *  this is just an extra security measure, it is not required nor recommended, but
   *  might be extra layer of security you want to have.
   * @param verify optional callback, called when user is successfully authenticated
   */
  constructor(options: TOptions, verify?: VerifyCallback<TUser>) {
    super();

    this.name = 'steam-openid';
    this.returnURL = options.returnURL;
    this.profile = options.profile;
    this.maxNonceTimeDelay = options.maxNonceTimeDelay;
    if (options.profile) this.apiKey = options.apiKey;
    if (verify) this.verify = verify;

    if (options.httpClient) {
      this.http = options.httpClient;
    } else {
      try {
        // Eslint was throwing schema errors at me, so it's just excluded here
        // instead of the config
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const axios = require('axios');

        this.http = axios.create();
      } catch (e) {
        throw new Error(
          'Could not import axios as the default http client, either\n' +
            ' - run `npm install axios`\n' +
            ' - implement `IAxiosLikeHttpClient` interface and pass it as `httpClient` option\n',
        );
      }
    }
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

    if (this.hasNonceExpired(query)) {
      throw new SteamOpenIdError(
        'Nonce time delay was too big.',
        SteamOpenIdErrorType.NonceExpired,
      );
    }

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
   * Check if nonce date has expired against current delay setting,
   * if no setting was set, then it is considered as not expired.
   *
   * @param nonceDate date when nonce was created
   * @returns true, if nonce has expired and error should be thrown
   */
  protected hasNonceExpired(query: SteamOpenIdQuery): boolean {
    if (typeof this.maxNonceTimeDelay == 'undefined') {
      return false;
    }

    const nonceDate = new Date(query['openid.response_nonce'].slice(0, 20));
    const nonceSeconds = Math.floor(nonceDate.getTime() / 1000);
    const nowSeconds = Math.floor(Date.now() / 1000);
    return nowSeconds - nonceSeconds > this.maxNonceTimeDelay;
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
      // Every prop has to be present
      if (!query[key]) {
        return false;
      }
    }

    for (const key of Object.keys(query)) {
      // Do not allow any extra properties
      if (!OPENID_QUERY_PROPS.includes(key as any)) {
        return false;
      }
    }

    if (query['openid.ns'] !== VALID_NONCE) return false;
    if (query['openid.op_endpoint'] !== VALID_OPENID_ENDPOINT) return false;
    if (query['openid.claimed_id'] !== query['openid.identity']) return false;
    if (!this.isValidIdentity(query['openid.claimed_id'])) return false;
    if (query['openid.assoc_handle'] !== VALID_ASSOC_HANDLE) return false;
    if (query['openid.signed'] !== VALID_SIGNED_FIELD) return false;
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
    return this.http
      .post(VALID_OPENID_ENDPOINT, this.getOpenIdValidationRequestBody(query), {
        maxRedirects: 0,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://steamcommunity.com',
          Referer: 'https://steamcommunity.com',
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

    const { data } = await this.http.get<SteamPlayerSummaryResponse>(
      `${PLAYER_SUMMARY_URL}/?${qs.stringify(summaryQuery)}`,
    );

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
  }
}
