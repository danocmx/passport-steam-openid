import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import nock from 'nock';
import fetchMock from 'fetch-mock';

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
    fetchMock.unmockGlobal();
  });

  it('Successfully receives a redirect from steam', (done) => {
    const response = '<h1>Successful redirect to steam</h1>';

    nock('https://steamcommunity.com')
      .get('/openid/login')
      .query(true)
      .reply((uri) => {
        const url = new URL(uri, 'https://steamcommunity.com');
        if (
          url.searchParams.get('openid.mode') === 'checkid_setup' &&
          url.searchParams.get('openid.ns') === VALID_NONCE &&
          url.searchParams.get('openid.identity') === VALID_ID_SELECT &&
          url.searchParams.get('openid.claimed_id') === VALID_ID_SELECT &&
          url.searchParams.get('openid.return_to') === '/auth/steam'
        ) {
          return [
            200,
            response,
            {
              'Content-Type': 'text/plain',
            },
          ];
        }
        return [
          401,
          'Fail',
          {
            'Content-Type': 'text/plain',
          },
        ];
      });

    chai
      .request(server)
      .get('/auth/steam')
      .redirects(1)
      .end((err, res) => {
        if (err) {
          done(err);
          return;
        }

        res.should.redirectTo(new RegExp(`^${VALID_OPENID_ENDPOINT}`));
        res.should.have.status(200);
        expect(res.type).equal('text/plain');
        expect(res.text).equal(response);

        done();
      });
  });

  it('Successfully authenticates a valid user', (done) => {
    nock('https://steamcommunity.com')
      .post('/openid/login')
      .query(true)
      .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
      .reply(() => {
        return [200, 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n'];
      });

    fetchMock
      .mockGlobal()
      .route('https://steamcommunity.com/openid/login', (args) => {
        const headers = args.options.headers!;
        let found = false;
        for (const [name, value] of Object.entries(headers)) {
          if (typeof name != 'string') {
            continue;
          }

          if (name === 'content-type' && value === 'application/x-www-form-urlencoded') {
            found = true;
          }
        }

        if (args.options.method !== 'post' || !found) {
          return { status: 400, body: 'failed' };
        }

        return ({ status: 200, body: 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n' })
    });

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

        done();
      });
  });

  describe('Fails due to invalid response', () => {
    it('Has invalid response nonce', (done) => {
      nock('https://steamcommunity.com')
        .post('/openid/login', validateBody)
        .reply(200, 'ns:http://specs.openid.net/auth/1.0\nis_valid:true\n');

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
          done();
        });
    });

    it('Has is_valid set to false', (done) => {
      nock('https://steamcommunity.com')
        .post('/openid/login', validateBody)
        .reply(200, 'ns:http://specs.openid.net/auth/2.0\nis_valid:false\n');

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
          done();
        });
    });
  });
});
