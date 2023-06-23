import 'dotenv/config';
import passport from 'passport';
import session from 'express-session';
import express, { NextFunction, Request, Response } from 'express';
import { SteamOpenIdError, SteamOpenIdStrategy } from 'passport-steam-openid';

const PORT = 3000;
const URL_BASE =
  process.env.NODE_END == 'production'
    ? process.env.URL_BASE
    : `http://localhost:${PORT}`;

passport.use(
  new SteamOpenIdStrategy(
    {
      profile: false,
      returnURL: `${URL_BASE}/auth/steam`,
    },
    (_req, steamId, profile, done) => {
      console.log(`Verified ${steamId}.`);
      done(null, profile);
    },
  ),
);

passport.serializeUser((user: any, done) => {
  console.log(`Serialized ${user.steamid}.`);
  done(null, user.steamid);
});

passport.deserializeUser((user: any, done) => {
  console.log(`Deserialized ${user}.`);
  done(null, { steamid: user });
});

const app = express();

app.use(
  session({
    secret: process.env.COOKIE_SECRET,
    resave: true,
    saveUninitialized: true,
  }),
);
app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/steam', passport.authenticate('steam-openid'), (req, res) => {
  res.status(200).send(`Authenticated as ${req.user?.steamid}`);
});

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error(err);

    if (err instanceof SteamOpenIdError) {
      res.status(401).send('Unauthorized');
      return;
    }

    res.status(500).send('Internal Server Error.');
  },
);

app.listen(PORT, () => {
  console.log(`Listening at ${URL_BASE}.`);
});
