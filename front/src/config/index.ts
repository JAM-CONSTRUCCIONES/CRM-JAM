const config = {
  apiUrl: import.meta.env.VITE_API_URL as string,
  stage: import.meta.env.VITE_STAGE as string,
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
    region: import.meta.env.VITE_AWS_REGION as string,
  },
};

export default config;
