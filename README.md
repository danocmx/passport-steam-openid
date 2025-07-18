# passport-steam-openid
Passport strategy for authenticating with steam openid without the use of 3rd party openid packages,
which have been proved to be source of many exploits of steam openid system, apparently by design.
This package only relies on [passport](https://www.passportjs.org/), optionally on [axios](https://axios-http.com/),
as it is the default http client, you can add your own implementation for extra security.

Library is fully covered with tests, both unit and integration tests to make sure everything runs correctly.

## API

Instantiate the `SteamOpenIdStrategy` as following:
```ts
new SteamOpenIdStrategy(options, verify)
```

Options object has the following properties:
- `returnURL` - URL to which steam will redirect user after authentication
- `profile` - If set to true, it will fetch user profile from steam api, otherwise only steamid will be returned
- `apiKey` - Steam api key, required if `options.profile` is set to true
- `maxNonceTimeDelay` - Optional, in seconds, time between creation and verification of nonce date, if not set no verification occurs.
- `httpClient` - Optional, you can implement `IAxiosLikeHttpClient` interface for your own http client

Second parameter of `SteamOpenIdStrategy` is a callback function used for verifying logged in user, with the following parameters:
- `req` - Express request object
- `steamid` - Steam id of the authenticated user
- `profile` - Full profile from GetPlayerSummaries api, if `options.profile` is set to true, otherwise only steamid
- `done` - Passport callback function

Profile if `options.profile` is set to true:
```ts
export type SteamOpenIdUserProfile = {
  steamid: string;
  communityvisibilitystate: number;
  profilestate: number;
  personaname: string;
  commentpermission: number;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  avatarhash: string;
  lastlogoff: number;
  personastate: number;
  realname: string;
  primaryclanid: string;
  timecreated: number;
  personastateflags: number;
  loccountrycode: string;
  locstatecode: string;
};
```

Other it is just:
```ts
export type SteamOpenIdUser = {
  steamid: string;
};
```

## Usage
```ts
import { SteamOpenIdStrategy } from 'passport-steam-openid';

passport.use(
    new SteamOpenIdStrategy({
        returnURL: 'http://localhost:3000/auth/steam',
        profile: true,
        apiKey: '<insert steam api key>', // No need for api key, if profile is set to false
        maxNonceTimeDelay: 30 // Optional, in seconds, time between creation and verification of nonce date
    }, (
        req: Request, 
        identifier: string, 
        profile: SteamOpenIdUserProfile, // if profile is false, then it's only { steamid }, otherwise full profile from GetPlayerSummaries api
        done: VerifyCallback
    ) => {
        // Optional callback called only when successful authentication occurs
        // You can save the user to database here.
    })
)

app.get('/auth/steam', passport.authenticate('steam-openid'), (req, res) => {
    // When requested first by user,
    // they will get redirected to steam and this function is never called.
    // Second time, after user is authenticated, this function is called.
})
```

### Error handling
```ts
app.use(
  (err: Error, req: Request, res: Response): void => {
    if (err instanceof SteamOpenIdError) {
      switch (err.code) {
        case SteamOpenIdErrorType.InvalidQuery:
            // Supplied querystring was invalid
        case SteamOpenIdErrorType.Unauthorized:
            // Steam rejected this authentication request
        case SteamOpenIdErrorType.InvalidSteamId:
            // Steam profile doesn't exist
        case SteamOpenIdErrorType.NonceExpired:
            // Nonce has expired, only if `options.maxNonceTimeDelay` is set
      }
    }
    // ...
  },
);
```

### Sample
Visit [sample](./sample) directory for more elaborate usage example.

## Instalation
Install using npm:
```
npm install passport-steam-openid
```

Library's API has been unchanged and stable for some time now. It will not change unless a breaking change is issued by steam (very unlikely).

## License
This library is released under MIT license.
