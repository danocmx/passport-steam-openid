import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import nock from 'nock';

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
  it('Successfully receives a redirect from steam', (done) => {
    const response = '<h1>Successful redirect to steam</h1>';

    nock('https://steamcommunity.com')
      .get('/openid/login')
      .query((query) => {
        return (
          query['openid.mode'] === 'checkid_setup' &&
          query['openid.ns'] === VALID_NONCE &&
          query['openid.identity'] === VALID_ID_SELECT &&
          query['openid.claimed_id'] === VALID_ID_SELECT &&
          query['openid.return_to'] === '/auth/steam'
        );
      })
      .reply(200, response, {
        'Content-Type': 'text/plain',
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
      .post('/openid/login', validateBody)
      .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
      .reply(200, 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n');

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
