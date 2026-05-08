import { Amplify } from 'aws-amplify';
import config from './index';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.cognito.userPoolId,
      userPoolClientId: config.cognito.clientId,
      loginWith: {
        username: true,
      },
    },
  },
  API: {
    REST: {
      JamApi: {
        endpoint: config.apiUrl,
        region: config.cognito.region,
      },
    },
  },
});
