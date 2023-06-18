import { SteamOpenIdErrorType } from './type';

/**
 * Class used to distinguish between errors caused by user and internal ones.
 *
 * @class SteamOpenIdError
 * @param code can be used to see which kind of error occured programmatically.
 */
export class SteamOpenIdError extends Error {
  constructor(message: string, public readonly code: SteamOpenIdErrorType) {
    super(message);
  }
}
