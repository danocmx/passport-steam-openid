import { SteamOpenIdUser } from 'passport-steam-openid';

// For different express versions, look at:
// https://stackoverflow.com/questions/37377731/extend-express-request-object-using-typescript
declare module 'express-serve-static-core' {
  interface Request {
    user?: SteamOpenIdUser | undefined;
  }
}
