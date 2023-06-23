declare namespace Express {
  import { SteamOpenIdUser } from '../../dist';

  export interface Request {
    user?: SteamOpenIdUser | undefined;
  }
}
