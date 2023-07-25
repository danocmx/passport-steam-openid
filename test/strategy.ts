import qs from 'querystring';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import chai, { expect } from 'chai';
import { URL } from 'url';
import {
  SteamOpenIdError,
  SteamOpenIdErrorType,
  SteamOpenIdStrategy,
  SteamOpenIdStrategyOptionsWithoutProfile,
  SteamOpenIdUser,
  VALID_ID_SELECT,
  VALID_NONCE,
  OPENID_QUERY_PROPS,
  VALID_OPENID_ENDPOINT,
  PLAYER_SUMMARY_URL,
} from '../src';
import { RETURN_URL, query } from './setup/data';

chai.use(chaiAsPromised);

describe('SteamOpenIdStrategy Unit Test', () => {
  let strategy: SteamOpenIdStrategy<
    SteamOpenIdStrategyOptionsWithoutProfile,
    SteamOpenIdUser
  >;

  beforeEach(() => {
    strategy = new SteamOpenIdStrategy({
      apiKey: 'an api key',
      profile: false,
      returnURL: RETURN_URL,
    });
  });

  describe('authenticate', () => {
    let successStub: sinon.SinonStub;
    let failStub: sinon.SinonStub;
    let errorStub: sinon.SinonStub;
    let redirectStub: sinon.SinonStub;

    beforeEach(() => {
      strategy.success = () => null;
      strategy.fail = () => null;
      strategy.error = () => null;
      strategy.redirect = () => null;

      successStub = sinon.stub(strategy, 'success');
      failStub = sinon.stub(strategy, 'fail');
      errorStub = sinon.stub(strategy, 'error');
      redirectStub = sinon.stub(strategy, 'redirect');
    });

    it('Authenticates user without verify function', async () => {
      const request = {};
      const user = { steamid: '76561197960435530' };

      const handleRequestStub = sinon
        .stub(strategy, 'handleRequest')
        .resolves(user);

      await strategy.authenticate(request);

      expect(handleRequestStub.callCount).equal(1);
      expect(handleRequestStub.calledWithExactly(request)).equal(true);
      expect(successStub.callCount).equal(1);
      expect(successStub.calledWithExactly(user)).equal(true);
      expect(failStub.callCount).equal(0);
      expect(errorStub.callCount).equal(0);
      expect(redirectStub.callCount).equal(0);
    });

    it('Authenticates and calls verify function', async () => {
      strategy['verify'] = (_, __, user, callback) => {
        callback(null, user);
      };

      const request = {};
      const user = { steamid: '76561197960435530' };

      const verifySpy = sinon.spy(strategy, 'verify' as any);
      const handleRequestStub = sinon
        .stub(strategy, 'handleRequest')
        .resolves(user);

      await strategy.authenticate(request);

      expect(handleRequestStub.callCount).equal(1);
      expect(handleRequestStub.calledWithExactly(request)).equal(true);
      expect(verifySpy.callCount).equal(1);
      expect(verifySpy.calledWithMatch(request, user.steamid, user)).equal(
        true,
      );
      expect(successStub.callCount).equal(1);
      expect(successStub.calledWithExactly(user)).equal(true);
      expect(failStub.callCount).equal(0);
      expect(errorStub.callCount).equal(0);
      expect(redirectStub.callCount).equal(0);
    });

    it('Fails to handle request but gets redirected', async () => {
      const request = {};
      const error = new SteamOpenIdError(
        'Invalid mode',
        SteamOpenIdErrorType.InvalidMode,
      );
      const url = 'redirect url';

      const isRetryableErrorStub = sinon
        .stub(strategy as any, 'isRetryableError')
        .returns(true);
      const buildRedirectUrlStub = sinon
        .stub(strategy as any, 'buildRedirectUrl')
        .returns(url);
      const handleRequestStub = sinon
        .stub(strategy, 'handleRequest')
        .rejects(error);

      await strategy.authenticate(request);

      expect(isRetryableErrorStub.callCount).equal(1);
      expect(isRetryableErrorStub.calledWithExactly(error)).equal(true);
      expect(buildRedirectUrlStub.callCount).equal(1);
      expect(buildRedirectUrlStub.calledWithExactly()).equal(true);
      expect(handleRequestStub.callCount).equal(1);
      expect(handleRequestStub.calledWithExactly(request)).equal(true);
      expect(redirectStub.callCount).equal(1);
      expect(redirectStub.calledWithExactly(url)).equal(true);
      expect(errorStub.callCount).equal(0);
      expect(failStub.callCount).equal(0);
      expect(successStub.callCount).equal(0);
    });

    it('Fails to handle request and terminates', async () => {
      const request = {};
      const error = new Error('Not retryable');

      const handleRequestStub = sinon
        .stub(strategy, 'handleRequest')
        .rejects(error);

      await strategy.authenticate(request);

      expect(handleRequestStub.callCount).equal(1);
      expect(handleRequestStub.calledWithExactly(request)).equal(true);
      expect(errorStub.callCount).equal(1);
      expect(errorStub.calledWithExactly(error)).equal(true);
      expect(failStub.callCount).equal(0);
      expect(successStub.callCount).equal(0);
      expect(redirectStub.callCount).equal(0);
    });

    it('Verify function fails', async () => {
      const error = new Error('Verify error');
      strategy['verify'] = (_, __, ___, callback) => {
        callback(error);
      };

      const request = {};
      const user = { steamid: '76561197960435530' };

      const verifySpy = sinon.spy(strategy, 'verify' as any);
      const handleRequestStub = sinon
        .stub(strategy, 'handleRequest')
        .resolves(user);

      await strategy.authenticate(request);

      expect(handleRequestStub.callCount).equal(1);
      expect(handleRequestStub.calledWithExactly(request)).equal(true);
      expect(verifySpy.callCount).equal(1);
      expect(verifySpy.calledWithMatch(request, user.steamid, user)).equal(
        true,
      );
      expect(errorStub.callCount).equal(1);
      expect(errorStub.calledWithExactly(error)).equal(true);
      expect(failStub.callCount).equal(0);
      expect(successStub.callCount).equal(0);
      expect(redirectStub.callCount).equal(0);
    });

    it('Verify returns no user', async () => {
      strategy['verify'] = (_, __, ___, callback) => {
        callback(null, null);
      };

      const request = {};
      const user = { steamid: '76561197960435530' };

      const verifySpy = sinon.spy(strategy, 'verify' as any);
      const handleRequestStub = sinon
        .stub(strategy, 'handleRequest')
        .resolves(user);

      await strategy.authenticate(request);

      expect(handleRequestStub.callCount).equal(1);
      expect(handleRequestStub.calledWithExactly(request)).equal(true);
      expect(verifySpy.callCount).equal(1);
      expect(verifySpy.calledWithMatch(request, user.steamid, user)).equal(
        true,
      );
      expect(errorStub.callCount).equal(1);
      expect(failStub.callCount).equal(0);
      expect(successStub.callCount).equal(0);
      expect(redirectStub.callCount).equal(0);
    });
  });

  describe('handleRequest', () => {
    const request = {};
    const query = {};

    let getQueryStub: sinon.SinonStub;
    let hasAuthQueryStub: sinon.SinonStub;
    let isQueryValidStub: sinon.SinonStub;
    let validateAgainstSteamStub: sinon.SinonStub;

    beforeEach(() => {
      getQueryStub = sinon.stub(strategy as any, 'getQuery').returns(query);
      hasAuthQueryStub = sinon.stub(strategy as any, 'hasAuthQuery');
      isQueryValidStub = sinon.stub(strategy as any, 'isQueryValid');
      validateAgainstSteamStub = sinon.stub(
        strategy as any,
        'validateAgainstSteam',
      );
    });

    afterEach(() => {
      expect(getQueryStub.callCount).equal(1);
      expect(getQueryStub.calledWithExactly(request)).equal(true);
      expect(hasAuthQueryStub.callCount).equal(1);
      expect(hasAuthQueryStub.calledWithExactly(query)).equal(true);
    });

    it('Handles request correctly', async () => {
      hasAuthQueryStub.returns(true);
      isQueryValidStub.returns(true);
      validateAgainstSteamStub.resolves(true);

      const steamid = '76561197960435530';
      const user = { steamid: '76561197960435530' };

      const getSteamIdStub = sinon
        .stub(strategy as any, 'getSteamId')
        .returns(steamid);
      const getUserStub = sinon.stub(strategy as any, 'getUser').resolves(user);

      expect(await strategy.handleRequest(request)).equal(user);
      expect(getSteamIdStub.callCount).equal(1);
      expect(getSteamIdStub.calledWithExactly(query)).equal(true);
      expect(getUserStub.callCount).equal(1);
      expect(getUserStub.calledWithExactly(steamid)).equal(true);
      expect(isQueryValidStub.callCount).equal(1);
      expect(isQueryValidStub.calledWithExactly(query)).equal(true);
      expect(validateAgainstSteamStub.callCount).equal(1);
      expect(validateAgainstSteamStub.calledWithExactly(query)).equal(true);
    });

    it('Does not have correct mode', async () => {
      hasAuthQueryStub.returns(false);

      let err: any;
      try {
        await strategy.handleRequest(request);
      } catch (e) {
        err = e;
      }

      expect(err).to.be.instanceOf(SteamOpenIdError);
      expect(err).to.have.property('code', SteamOpenIdErrorType.InvalidMode);
    });

    it('Query is invalid', async () => {
      hasAuthQueryStub.returns(true);
      isQueryValidStub.returns(false);

      let err: any;
      try {
        await strategy.handleRequest(request);
      } catch (e) {
        err = e;
      }

      expect(err).to.be.instanceOf(SteamOpenIdError);
      expect(err).to.have.property('code', SteamOpenIdErrorType.InvalidQuery);
      expect(isQueryValidStub.callCount).equal(1);
      expect(isQueryValidStub.calledWithExactly(query)).equal(true);
    });

    it('Steam rejects this authentication request', async () => {
      hasAuthQueryStub.returns(true);
      isQueryValidStub.returns(true);
      validateAgainstSteamStub.resolves(false);

      let err: any;
      try {
        await strategy.handleRequest(request);
      } catch (e) {
        err = e;
      }

      expect(err).to.be.instanceOf(SteamOpenIdError);
      expect(err).to.have.property('code', SteamOpenIdErrorType.Unauthorized);
      expect(isQueryValidStub.callCount).equal(1);
      expect(isQueryValidStub.calledWithExactly(query)).equal(true);
      expect(validateAgainstSteamStub.callCount).equal(1);
      expect(validateAgainstSteamStub.calledWithExactly(query)).equal(true);
    });
  });

  describe('isRetryableError', () => {
    it('Is retriable error', () => {
      const error = new SteamOpenIdError(
        'Message',
        SteamOpenIdErrorType.InvalidMode,
      );
      expect(strategy['isRetryableError'](error)).equal(true);
    });

    it('Not an instance of SteamOpenIdError', () => {
      const error = new Error('Message');
      expect(strategy['isRetryableError'](error)).equal(false);
    });

    it('Wrong error code', () => {
      const error = new SteamOpenIdError(
        'Message',
        SteamOpenIdErrorType.InvalidSteamId,
      );
      expect(strategy['isRetryableError'](error)).equal(false);
    });
  });

  describe('getQuery', () => {
    it('Returns query from request', () => {
      const request = { query: {} };
      expect(strategy['getQuery'](request)).equal(request.query);
    });

    it('Fails because query is not present', () => {
      const request = {};
      expect(strategy['getQuery'].bind(strategy, request)).to.throw(Error);
    });

    it('Fails because query is not an object', () => {
      const request = { query: 'string' };
      expect(strategy['getQuery'].bind(strategy, request)).to.throw(Error);
    });
  });

  describe('hasAuthQuery', () => {
    it('Is an auth query', () => {
      const query = { 'openid.mode': 'id_res' };
      expect(strategy['hasAuthQuery'](query)).equal(true);
    });

    it('Mode is not present', () => {
      const query = {};
      expect(strategy['hasAuthQuery'](query)).equal(false);
    });

    it('Wrong mode', () => {
      const query = { 'openid.mode': 'checkid_setup' };
      expect(strategy['hasAuthQuery'](query)).equal(false);
    });
  });

  describe('buildRedirectUrl', () => {
    it('Builds a redirect url to steam', () => {
      const urlString = strategy['buildRedirectUrl']();
      const url = new URL(urlString);

      expect(url.origin).equal('https://steamcommunity.com');
      expect(url.pathname).equal('/openid/login');

      const VALID_PARAMS: Record<string, string> = {
        'openid.mode': 'checkid_setup',
        'openid.ns': VALID_NONCE,
        'openid.identity': VALID_ID_SELECT,
        'openid.claimed_id': VALID_ID_SELECT,
        'openid.return_to': RETURN_URL,
      };

      url.searchParams.forEach((value, name) => {
        if (VALID_PARAMS[name] !== value) {
          throw new Error(`Unknown param: ${name} = ${value}.`);
        }
      });
    });
  });

  describe('isQueryValid', () => {
    let isValidIdentityStub: sinon.SinonStub;

    beforeEach(() => {
      isValidIdentityStub = sinon.stub(strategy as any, 'isValidIdentity');
    });

    it('Is valid query', () => {
      isValidIdentityStub.returns(true);
      expect(strategy['isQueryValid'](query.get())).equal(true);
      expect(isValidIdentityStub.callCount).equal(1);
      expect(
        isValidIdentityStub.calledWithExactly(
          query.properties['openid.claimed_id'],
        ),
      );
    });

    it('Property is missing', () => {
      for (const property of OPENID_QUERY_PROPS) {
        expect(strategy['isQueryValid'](query.remove(property))).equal(false);
      }
    });

    it('Invalid nonce', () => {
      expect(
        strategy['isQueryValid'](query.change({ 'openid.ns': 'content' })),
      ).equal(false);
    });

    it('Invalid endpoint', () => {
      expect(
        strategy['isQueryValid'](
          query.change({ 'openid.op_endpoint': 'content' }),
        ),
      ).equal(false);
    });

    it("ClaimedId and Identity don' match", () => {
      expect(
        strategy['isQueryValid'](
          query.change({ 'openid.claimed_id': 'content' }),
        ),
      ).equal(false);
      expect(isValidIdentityStub.callCount).equal(0);
    });

    it('ClaimedId is invalid', () => {
      isValidIdentityStub.returns(false);
      const claimedIdValue = 'content';
      expect(
        strategy['isQueryValid'](
          query.change({
            'openid.claimed_id': claimedIdValue,
            'openid.identity': claimedIdValue,
          }),
        ),
      ).equal(false);
      expect(isValidIdentityStub.callCount).equal(1);
      expect(isValidIdentityStub.calledWithExactly(claimedIdValue));
    });

    it('Return does not match', () => {
      isValidIdentityStub.returns(true);
      expect(
        strategy['isQueryValid'](
          query.change({ 'openid.return_to': 'content' }),
        ),
      ).equal(false);
      expect(isValidIdentityStub.callCount).equal(1);
      expect(
        isValidIdentityStub.calledWithExactly(
          query.properties['openid.claimed_id'],
        ),
      );
    });
  });

  describe('isValidIdentity', () => {
    it('Is valid identity', () => {
      const identity = 'https://steamcommunity.com/openid/id/76561197960435530';
      expect(strategy['isValidIdentity'](identity)).equal(true);
    });

    it('Is not a string', () => {
      const identity = null;
      expect(strategy['isValidIdentity'](identity)).equal(false);
    });

    it('Does not match regex', () => {
      const identity =
        'https://localhost:3000?x=https://steamcommunity.com/openid/id/76561197960435530';
      expect(strategy['isValidIdentity'](identity)).equal(false);
    });
  });

  describe('validateAgainstSteam', () => {
    let axiosPostStub: sinon.SinonStub;
    let getOpenIdValidationRequestBodyStub: sinon.SinonStub;
    let isSteamResponseValidStub: sinon.SinonStub;

    const query = {};
    const data = {};
    const body = 'body';

    beforeEach(() => {
      axiosPostStub = sinon.stub(strategy['axios'], 'post');
      getOpenIdValidationRequestBodyStub = sinon
        .stub(strategy as any, 'getOpenIdValidationRequestBody')
        .returns(body);
      isSteamResponseValidStub = sinon.stub(
        strategy as any,
        'isSteamResponseValid',
      );
    });

    afterEach(() => {
      expect(getOpenIdValidationRequestBodyStub.callCount).equal(1);
      expect(getOpenIdValidationRequestBodyStub.calledWithExactly(query)).equal(
        true,
      );
      expect(axiosPostStub.callCount).equal(1);
      expect(
        axiosPostStub.calledWithExactly(VALID_OPENID_ENDPOINT, body, {
          maxRedirects: 0,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );
    });

    it('Validates successfully', async () => {
      axiosPostStub.resolves({ status: 200, data });
      isSteamResponseValidStub.returns(true);

      expect(await strategy['validateAgainstSteam'](query as any)).equal(true);
      expect(isSteamResponseValidStub.callCount).equal(1);
      expect(isSteamResponseValidStub.calledWith(data)).equal(true);
    });

    it('Wrong status code', async () => {
      axiosPostStub.resolves({ status: 100, data });

      expect(await strategy['validateAgainstSteam'](query as any)).equal(false);
      expect(isSteamResponseValidStub.callCount).equal(0);
    });

    it('Response is invalid', async () => {
      axiosPostStub.resolves({ status: 200, data });
      isSteamResponseValidStub.returns(false);

      expect(await strategy['validateAgainstSteam'](query as any)).equal(false);
      expect(isSteamResponseValidStub.callCount).equal(1);
      expect(isSteamResponseValidStub.calledWith(data)).equal(true);
    });

    it('Axios rejects', async () => {
      axiosPostStub.rejects(new Error('Malformed.'));

      expect(await strategy['validateAgainstSteam'](query as any)).equal(false);
      expect(isSteamResponseValidStub.callCount).equal(0);
    });
  });

  describe('getOpenIdValidationRequestBody', () => {
    it('Stringifies query', () => {
      const query = {
        'openid.op_endpoint': VALID_OPENID_ENDPOINT,
        'openid.mode': 'id_res',
      };
      expect(strategy['getOpenIdValidationRequestBody'](query as any)).equal(
        qs.stringify({ ...query, 'openid.mode': 'check_authentication' }),
      );
    });
  });

  it('isSteamResponseValid', () => {
    describe('Is valid steam response', () => {
      const response = `ns:${VALID_NONCE}\nis_valid:true\n`;
      expect(strategy['isSteamResponseValid'](response)).equal(true);
    });

    describe('Response is not a string', () => {
      const response = {};
      expect(strategy['isSteamResponseValid'](response)).equal(false);
    });

    describe('Response does not match', () => {
      const response = `ns:${VALID_NONCE}\nis_valid:true`;
      expect(strategy['isSteamResponseValid'](response)).equal(false);
    });

    describe('Invalid nonce', () => {
      const response = `ns:xddd\nis_valid:true\n`;
      expect(strategy['isSteamResponseValid'](response)).equal(false);
    });

    describe('Marked invalid', () => {
      const response = `ns:${VALID_NONCE}\nis_valid:false\n`;
      expect(strategy['isSteamResponseValid'](response)).equal(false);
    });

    describe('No match', () => {
      const response = `invalid`;
      expect(strategy['isSteamResponseValid'](response)).equal(false);
    });
  });

  describe('getSteamId', () => {
    it('Retrieves steamid from claimed_id property', () => {
      const steamid = '76561197960435530';
      const q = {
        'openid.claimed_id': `https://steamcommunity.com/openid/id/${steamid}`,
      };
      expect(strategy['getSteamId'](q as any)).equal(steamid);
    });
  });

  describe('getUser', () => {
    let fetchPlayerSummaryStub: sinon.SinonStub;

    beforeEach(() => {
      fetchPlayerSummaryStub = sinon.stub(
        strategy as any,
        'fetchPlayerSummary',
      );
    });

    const steamid = '76561197960435530';

    it('Gets user without profile', async () => {
      expect(await strategy['getUser'](steamid)).deep.equal({ steamid });
      expect(fetchPlayerSummaryStub.callCount).equal(0);
    });

    it('Gets user with profile', async () => {
      // @ts-expect-error
      strategy['profile'] = true;

      const profile = { steamid, avatar: 'url' };
      fetchPlayerSummaryStub.resolves(profile);

      expect(await strategy['getUser'](steamid)).equal(profile);
      expect(fetchPlayerSummaryStub.callCount).equal(1);
      expect(fetchPlayerSummaryStub.calledWithExactly(steamid)).equal(true);
    });
  });

  describe('fetchPlayerSummary', async () => {
    let axiosGetStub: sinon.SinonStub;

    const steamid = '76561197960435530';
    const apiKey = 'xxx';

    beforeEach(() => {
      strategy = new SteamOpenIdStrategy({
        apiKey,
        profile: true,
        returnURL: RETURN_URL,
      });

      axiosGetStub = sinon.stub(strategy['axios'], 'get');
    });

    afterEach(() => {
      expect(axiosGetStub.callCount).equal(1);
      expect(
        axiosGetStub.calledWithExactly(
          `${PLAYER_SUMMARY_URL}/?${qs.stringify({
            steamids: steamid,
            key: apiKey,
          })}`,
        ),
      ).equal(true);
    });

    it('Successfully fetches valid user profile', async () => {
      const profile = { steamid };
      axiosGetStub.resolves({ data: { response: { players: [profile] } } });

      expect(await strategy['fetchPlayerSummary'](steamid)).equal(profile);
    });

    it('Malformed response, players is not an array', async () => {
      axiosGetStub.resolves({ data: { response: { players: null } } });

      expect(strategy['fetchPlayerSummary'](steamid)).to.rejectedWith(Error);
    });

    it('Malformed response, response is missing', async () => {
      axiosGetStub.resolves({ data: {} });

      expect(strategy['fetchPlayerSummary'](steamid)).to.rejectedWith(Error);
    });

    it('Malformed response, data is missing', async () => {
      axiosGetStub.resolves({});

      expect(strategy['fetchPlayerSummary'](steamid)).to.rejectedWith(Error);
    });

    it('No user returned', async () => {
      axiosGetStub.resolves({ data: { response: { players: [] } } });

      let err: any;
      try {
        await strategy['fetchPlayerSummary'](steamid);
      } catch (e) {
        err = e;
      }

      expect(err).instanceOf(SteamOpenIdError);
      expect(err).to.have.property('code', SteamOpenIdErrorType.InvalidSteamId);
    });

    it('Wrong user returned', async () => {
      axiosGetStub.resolves({
        data: { response: { players: [{ steamid: 'x' }] } },
      });

      let err: any;
      try {
        await strategy['fetchPlayerSummary'](steamid);
      } catch (e) {
        err = e;
      }

      expect(err).instanceOf(SteamOpenIdError);
      expect(err).to.have.property('code', SteamOpenIdErrorType.InvalidSteamId);
    });
  });
});
