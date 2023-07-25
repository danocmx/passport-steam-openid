import express, { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import session from 'express-session';
import {
  SteamOpenIdError,
  SteamOpenIdStrategy,
  SteamOpenIdUser,
} from '../../../src';

/**
 * Exported server for superagent.
 *
 * This server acts as a basic implementation
 * of express server with passport authentication,
 * using a single endpoint that handles everything
 * via the provided strategy.
 *
 * This configuration does not fetch user information from the API.
 *
 * Error handling hides all important details of this implementation.
 * Other important factors should be handled by helmet.js
 */
export const server = express();

/**
 * Type definition for user property on request object.
 *
 * Only required for the response from successful authentication.
 */
declare module 'express-serve-static-core' {
  interface Request {
    user?: SteamOpenIdUser | undefined;
  }
}

/**
 * Server setup includes:
 * - passport strategy initialization
 * - passport initialization
 * - session middleware
 * - auth endpoint setup
 * - error handling
 */

passport.use(
  new SteamOpenIdStrategy(
    {
      profile: false,
      returnURL: `/auth/steam`,
    },
    (_req, _steamId, profile, done) => {
      done(null, profile);
    },
  ),
);

passport.serializeUser((user: any, done) => {
  done(null, user.steamid);
});

passport.deserializeUser((user: any, done) => {
  done(null, { steamid: user });
});

server.use(
  session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
  }),
);
server.use(passport.initialize());
server.use(passport.session());

server.get('/auth/steam', passport.authenticate('steam-openid'), (req, res) => {
  res.status(200).send(`Authenticated as ${req.user?.steamid}`);
});

server.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof SteamOpenIdError) {
      res.status(401).send('Unauthorized');
      return;
    }

    res.status(500).send('Internal Server Error.');
  },
);
