# passport-steam-openid
Passport strategy for authenticating with steam openid without the use of 3rd party openid packages,
which have been proved to be source of many exploits of steam openid system, apparently by design.
This package only relies on [passport](https://www.passportjs.org/) and [axios](https://axios-http.com/).

Library is fully covered with tests, both unit and integration tests to make sure everything runs correctly.

## Usage
```ts
import { SteamOpenIdStrategy } from 'passport-steam-openid';

passport.use(
    new SteamOpenIdStrategy({
        returnURL: 'http://localhost:3000/auth/steam',
        profile: true,
        apiKey: '<insert steam api key>'
    }, (
        req: Request, 
        identifier: string, 
        profile: SteamOpenIdUserProfile, 
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
Released in early stage, library's api is subject to change.

## License
This library is released under MIT license.
