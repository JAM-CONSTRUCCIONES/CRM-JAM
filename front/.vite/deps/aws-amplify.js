import { D as Amplify, i as CookieStorage, n as defaultStorage, z as parseAmplifyConfig } from "./base64Encoder-Cn88duoV.js";
import { R as cognitoUserPoolsTokenProvider, n as DefaultIdentityIdStore, t as CognitoAWSCredentialsAndIdentityIdProvider } from "./credentialsProvider-DeGU4jtH.js";
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/credentialsProvider/index.mjs
/**
* Cognito specific implmentation of the CredentialsProvider interface
* that manages setting and getting of AWS Credentials.
*
* @throws configuration expections: `InvalidIdentityPoolIdException`
*  - Auth errors that may arise from misconfiguration.
* @throws service expections: {@link GetCredentialsForIdentityException}, {@link GetIdException}
*
*/
var cognitoCredentialsProvider = new CognitoAWSCredentialsAndIdentityIdProvider(new DefaultIdentityIdStore(defaultStorage));
//#endregion
//#region node_modules/aws-amplify/dist/esm/initSingleton.mjs
var DefaultAmplify = {
	configure(resourceConfig, libraryOptions) {
		const resolvedResourceConfig = parseAmplifyConfig(resourceConfig);
		const cookieBasedKeyValueStorage = new CookieStorage({ sameSite: "lax" });
		const resolvedKeyValueStorage = libraryOptions?.ssr ? cookieBasedKeyValueStorage : defaultStorage;
		const resolvedCredentialsProvider = libraryOptions?.ssr ? new CognitoAWSCredentialsAndIdentityIdProvider(new DefaultIdentityIdStore(cookieBasedKeyValueStorage)) : cognitoCredentialsProvider;
		if (!resolvedResourceConfig.Auth) {
			Amplify.configure(resolvedResourceConfig, libraryOptions);
			return;
		}
		if (libraryOptions?.Auth) {
			Amplify.configure(resolvedResourceConfig, libraryOptions);
			return;
		}
		if (!Amplify.libraryOptions.Auth) {
			cognitoUserPoolsTokenProvider.setAuthConfig(resolvedResourceConfig.Auth);
			cognitoUserPoolsTokenProvider.setKeyValueStorage(resolvedKeyValueStorage);
			Amplify.configure(resolvedResourceConfig, {
				...libraryOptions,
				Auth: {
					tokenProvider: cognitoUserPoolsTokenProvider,
					credentialsProvider: resolvedCredentialsProvider
				}
			});
			return;
		}
		if (libraryOptions) {
			const authLibraryOptions = Amplify.libraryOptions.Auth;
			if (libraryOptions.ssr !== void 0) {
				cognitoUserPoolsTokenProvider.setKeyValueStorage(resolvedKeyValueStorage);
				authLibraryOptions.credentialsProvider = resolvedCredentialsProvider;
			}
			Amplify.configure(resolvedResourceConfig, {
				Auth: authLibraryOptions,
				...libraryOptions
			});
			return;
		}
		Amplify.configure(resolvedResourceConfig);
	},
	getConfig() {
		return Amplify.getConfig();
	}
};
//#endregion
export { DefaultAmplify as Amplify };

//# sourceMappingURL=aws-amplify.js.map