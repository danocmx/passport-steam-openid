import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import fetchMock, { CallLog } from 'fetch-mock';
import qs from 'querystring';

import { server } from './setup/server';
import { STEAMID, SUCCESSFUL_QUERY, validateBody } from './setup/data';
import {
  VALID_ID_SELECT,
  VALID_NONCE,
  VALID_OPENID_ENDPOINT,
} from '../../src/constant';

chai.use(chaiHttp);
chai.should();

describe('SteamOpenIdStrategy Integration Test', () => {
  afterEach(() => {
    fetchMock.hardReset();
  });

  function fetchMockSteamResponse(body: string) {
    fetchMock.mockGlobal().route(VALID_OPENID_ENDPOINT, () => {
      return {
        status: 200,
        body,
      };
    });
  }

  function expectSteamValidationFetch() {
    const calls = fetchMock.callHistory.calls();
    if (calls.length !== 1) {
      throw new Error('Steam validation fetch was not called.');
    }

    const call = calls[0] as CallLog;
    expect(call.url).equal(VALID_OPENID_ENDPOINT);
    expect(call.options.method).equal('post');
    expect(call.options.redirect).equal('error');

    const headers = call.options.headers as Record<string, string>;
    expect(headers['content-type']).equal('application/x-www-form-urlencoded');

    const steamUrl = 'https://steamcommunity.com';
    expect(headers.origin).equal(steamUrl);
    expect(headers.referer).equal(steamUrl);

    const body = qs.parse(call.options.body as string);
    expect(validateBody(body as Record<string, string>)).equal(true);
  }

  it('Successfully redirects to steam', (done) => {
    chai
      .request(server)
      .get('/auth/steam')
      .redirects(0)
      .end((err, res) => {
        if (err) {
          done(err);
          return;
        }

        res.should.redirectTo(new RegExp(`^${VALID_OPENID_ENDPOINT}`));
        res.should.have.status(302);

        const location = res.header.location;
        if (!location) {
          throw new Error('Redirect location was not set.');
        }

        const url = new URL(location);
        expect(url.searchParams.get('openid.mode')).equal('checkid_setup');
        expect(url.searchParams.get('openid.ns')).equal(VALID_NONCE);
        expect(url.searchParams.get('openid.identity')).equal(VALID_ID_SELECT);
        expect(url.searchParams.get('openid.claimed_id')).equal(
          VALID_ID_SELECT,
        );
        expect(url.searchParams.get('openid.return_to')).equal('/auth/steam');

        done();
      });
  });

  it('Successfully authenticates a valid user', (done) => {
    fetchMockSteamResponse(
      'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n',
    );

    chai
      .request(server)
      .get('/auth/steam')
      .query(SUCCESSFUL_QUERY)
      .redirects(0)
      .end((err, res) => {
        if (err) {
          done(err);
          return;
        }

        res.should.have.status(200);
        expect(res.text).equal(`Authenticated as ${STEAMID}`);
        expectSteamValidationFetch();

        done();
      });
  });

  describe('Fails due to invalid response', () => {
    it('Has invalid response nonce', (done) => {
      fetchMockSteamResponse(
        'ns:http://specs.openid.net/auth/1.0\nis_valid:true\n',
      );

      chai
        .request(server)
        .get('/auth/steam')
        .query(SUCCESSFUL_QUERY)
        .redirects(0)
        .end((err, res) => {
          if (err) {
            done(err);
            return;
          }

          res.should.have.status(401);
          expectSteamValidationFetch();
          done();
        });
    });

    it('Has is_valid set to false', (done) => {
      fetchMockSteamResponse(
        'ns:http://specs.openid.net/auth/2.0\nis_valid:false\n',
      );

      chai
        .request(server)
        .get('/auth/steam')
        .query(SUCCESSFUL_QUERY)
        .redirects(0)
        .end((err, res) => {
          if (err) {
            done(err);
            return;
          }

          res.should.have.status(401);
          expectSteamValidationFetch();
          done();
        });
    });
  });
});
