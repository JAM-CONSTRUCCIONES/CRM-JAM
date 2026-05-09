var USER_AGENT_HEADER = "x-amz-user-agent";
var NO_HUBCALLBACK_PROVIDED_EXCEPTION = "NoHubcallbackProvidedException";
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Logger/types.mjs
var LogType;
(function(LogType) {
	LogType["DEBUG"] = "DEBUG";
	LogType["ERROR"] = "ERROR";
	LogType["INFO"] = "INFO";
	LogType["WARN"] = "WARN";
	LogType["VERBOSE"] = "VERBOSE";
	LogType["NONE"] = "NONE";
})(LogType || (LogType = {}));
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Logger/ConsoleLogger.mjs
var LOG_LEVELS = {
	VERBOSE: 1,
	DEBUG: 2,
	INFO: 3,
	WARN: 4,
	ERROR: 5,
	NONE: 6
};
/**
* Write logs
* @class Logger
*/
var ConsoleLogger = class ConsoleLogger {
	/**
	* @constructor
	* @param {string} name - Name of the logger
	*/
	constructor(name, level = LogType.WARN) {
		this.name = name;
		this.level = level;
		this._pluggables = [];
	}
	_padding(n) {
		return n < 10 ? "0" + n : "" + n;
	}
	_ts() {
		const dt = /* @__PURE__ */ new Date();
		return [this._padding(dt.getMinutes()), this._padding(dt.getSeconds())].join(":") + "." + dt.getMilliseconds();
	}
	configure(config) {
		if (!config) return this._config;
		this._config = config;
		return this._config;
	}
	/**
	* Write log
	* @method
	* @memeberof Logger
	* @param {LogType|string} type - log type, default INFO
	* @param {string|object} msg - Logging message or object
	*/
	_log(type, ...msg) {
		let loggerLevelName = this.level;
		if (ConsoleLogger.LOG_LEVEL) loggerLevelName = ConsoleLogger.LOG_LEVEL;
		if (typeof window !== "undefined" && window.LOG_LEVEL) loggerLevelName = window.LOG_LEVEL;
		const loggerLevel = LOG_LEVELS[loggerLevelName];
		if (!(LOG_LEVELS[type] >= loggerLevel)) return;
		let log = console.log.bind(console);
		if (type === LogType.ERROR && console.error) log = console.error.bind(console);
		if (type === LogType.WARN && console.warn) log = console.warn.bind(console);
		if (ConsoleLogger.BIND_ALL_LOG_LEVELS) {
			if (type === LogType.INFO && console.info) log = console.info.bind(console);
			if (type === LogType.DEBUG && console.debug) log = console.debug.bind(console);
		}
		const prefix = `[${type}] ${this._ts()} ${this.name}`;
		let message = "";
		if (msg.length === 1 && typeof msg[0] === "string") {
			message = `${prefix} - ${msg[0]}`;
			log(message);
		} else if (msg.length === 1) {
			message = `${prefix} ${msg[0]}`;
			log(prefix, msg[0]);
		} else if (typeof msg[0] === "string") {
			let obj = msg.slice(1);
			if (obj.length === 1) obj = obj[0];
			message = `${prefix} - ${msg[0]} ${obj}`;
			log(`${prefix} - ${msg[0]}`, obj);
		} else {
			message = `${prefix} ${msg}`;
			log(prefix, msg);
		}
		for (const plugin of this._pluggables) {
			const logEvent = {
				message,
				timestamp: Date.now()
			};
			plugin.pushLogs([logEvent]);
		}
	}
	/**
	* Write General log. Default to INFO
	* @method
	* @memeberof Logger
	* @param {string|object} msg - Logging message or object
	*/
	log(...msg) {
		this._log(LogType.INFO, ...msg);
	}
	/**
	* Write INFO log
	* @method
	* @memeberof Logger
	* @param {string|object} msg - Logging message or object
	*/
	info(...msg) {
		this._log(LogType.INFO, ...msg);
	}
	/**
	* Write WARN log
	* @method
	* @memeberof Logger
	* @param {string|object} msg - Logging message or object
	*/
	warn(...msg) {
		this._log(LogType.WARN, ...msg);
	}
	/**
	* Write ERROR log
	* @method
	* @memeberof Logger
	* @param {string|object} msg - Logging message or object
	*/
	error(...msg) {
		this._log(LogType.ERROR, ...msg);
	}
	/**
	* Write DEBUG log
	* @method
	* @memeberof Logger
	* @param {string|object} msg - Logging message or object
	*/
	debug(...msg) {
		this._log(LogType.DEBUG, ...msg);
	}
	/**
	* Write VERBOSE log
	* @method
	* @memeberof Logger
	* @param {string|object} msg - Logging message or object
	*/
	verbose(...msg) {
		this._log(LogType.VERBOSE, ...msg);
	}
	addPluggable(pluggable) {
		if (pluggable && pluggable.getCategoryName() === "Logging") {
			this._pluggables.push(pluggable);
			pluggable.configure(this._config);
		}
	}
	listPluggables() {
		return this._pluggables;
	}
};
ConsoleLogger.LOG_LEVEL = null;
ConsoleLogger.BIND_ALL_LOG_LEVELS = false;
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/errors/AmplifyError.mjs
var AmplifyError = class AmplifyError extends Error {
	/**
	*  Constructs an AmplifyError.
	*
	* @param message text that describes the main problem.
	* @param underlyingError the underlying cause of the error.
	* @param recoverySuggestion suggestion to recover from the error.
	*
	*/
	constructor({ message, name, recoverySuggestion, underlyingError, metadata }) {
		super(message);
		this.name = name;
		this.underlyingError = underlyingError;
		this.recoverySuggestion = recoverySuggestion;
		if (metadata) {
			const { extendedRequestId, httpStatusCode, requestId } = metadata;
			this.metadata = {
				extendedRequestId,
				httpStatusCode,
				requestId
			};
		}
		this.constructor = AmplifyError;
		Object.setPrototypeOf(this, AmplifyError.prototype);
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/types/errors.mjs
var AmplifyErrorCode;
(function(AmplifyErrorCode) {
	AmplifyErrorCode["NoEndpointId"] = "NoEndpointId";
	AmplifyErrorCode["PlatformNotSupported"] = "PlatformNotSupported";
	AmplifyErrorCode["Unknown"] = "Unknown";
	AmplifyErrorCode["NetworkError"] = "NetworkError";
})(AmplifyErrorCode || (AmplifyErrorCode = {}));
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/errors/createAssertionFunction.mjs
var createAssertionFunction = (errorMap, AssertionError = AmplifyError) => (assertion, name, additionalContext) => {
	const { message, recoverySuggestion } = errorMap[name];
	if (!assertion) throw new AssertionError({
		name,
		message: additionalContext ? `${message} ${additionalContext}` : message,
		recoverySuggestion
	});
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Hub/index.mjs
var AMPLIFY_SYMBOL = typeof Symbol !== "undefined" ? Symbol("amplify_default") : "@@amplify_default";
var logger$8 = new ConsoleLogger("Hub");
var HubClass = class {
	constructor(name) {
		this.listeners = /* @__PURE__ */ new Map();
		this.protectedChannels = [
			"core",
			"auth",
			"api",
			"analytics",
			"interactions",
			"pubsub",
			"storage",
			"ui",
			"xr"
		];
		this.name = name;
	}
	/**
	* Used internally to remove a Hub listener.
	*
	* @remarks
	* This private method is for internal use only. Instead of calling Hub.remove, call the result of Hub.listen.
	*/
	_remove(channel, listener) {
		const holder = this.listeners.get(channel);
		if (!holder) {
			logger$8.warn(`No listeners for ${channel}`);
			return;
		}
		this.listeners.set(channel, [...holder.filter(({ callback }) => callback !== listener)]);
	}
	dispatch(channel, payload, source, ampSymbol) {
		if (typeof channel === "string" && this.protectedChannels.indexOf(channel) > -1) {
			if (!(ampSymbol === AMPLIFY_SYMBOL)) logger$8.warn(`WARNING: ${channel} is protected and dispatching on it can have unintended consequences`);
		}
		const capsule = {
			channel,
			payload: { ...payload },
			source,
			patternInfo: []
		};
		try {
			this._toListeners(capsule);
		} catch (e) {
			logger$8.error(e);
		}
	}
	listen(channel, callback, listenerName = "noname") {
		let cb;
		if (typeof callback !== "function") throw new AmplifyError({
			name: NO_HUBCALLBACK_PROVIDED_EXCEPTION,
			message: "No callback supplied to Hub"
		});
		else cb = callback;
		let holder = this.listeners.get(channel);
		if (!holder) {
			holder = [];
			this.listeners.set(channel, holder);
		}
		holder.push({
			name: listenerName,
			callback: cb
		});
		return () => {
			this._remove(channel, cb);
		};
	}
	_toListeners(capsule) {
		const { channel, payload } = capsule;
		const holder = this.listeners.get(channel);
		if (holder) holder.forEach((listener) => {
			logger$8.debug(`Dispatching to ${channel} with `, payload);
			try {
				listener.callback(capsule);
			} catch (e) {
				logger$8.error(e);
			}
		});
	}
};
var Hub = new HubClass("__default__");
/**
* @internal
*
* Internal hub used for core Amplify functionality. Not intended for use outside of Amplify.
*
*/
var HubInternal = new HubClass("internal-hub");
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/globalHelpers/index.mjs
var getCrypto = () => {
	if (typeof window === "object" && typeof window.crypto === "object") return window.crypto;
	if (typeof crypto === "object") return crypto;
	throw new AmplifyError({
		name: "MissingPolyfill",
		message: "Cannot resolve the `crypto` function from the environment."
	});
};
var getBtoa = () => {
	if (typeof window !== "undefined" && typeof window.btoa === "function") return window.btoa;
	if (typeof btoa === "function") return btoa;
	throw new AmplifyError({
		name: "Base64EncoderError",
		message: "Cannot resolve the `btoa` function from the environment."
	});
};
var getAtob = () => {
	if (typeof window !== "undefined" && typeof window.atob === "function") return window.atob;
	if (typeof atob === "function") return atob;
	throw new AmplifyError({
		name: "Base64EncoderError",
		message: "Cannot resolve the `atob` function from the environment."
	});
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/convert/base64/base64Decoder.mjs
var base64Decoder = { convert(input, options) {
	let inputStr = input;
	if (options?.urlSafe) inputStr = inputStr.replace(/-/g, "+").replace(/_/g, "/");
	return getAtob()(inputStr);
} };
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/singleton/Auth/utils/errorHelpers.mjs
var AuthConfigurationErrorCode;
(function(AuthConfigurationErrorCode) {
	AuthConfigurationErrorCode["AuthTokenConfigException"] = "AuthTokenConfigException";
	AuthConfigurationErrorCode["AuthUserPoolAndIdentityPoolException"] = "AuthUserPoolAndIdentityPoolException";
	AuthConfigurationErrorCode["AuthUserPoolException"] = "AuthUserPoolException";
	AuthConfigurationErrorCode["InvalidIdentityPoolIdException"] = "InvalidIdentityPoolIdException";
	AuthConfigurationErrorCode["OAuthNotConfigureException"] = "OAuthNotConfigureException";
})(AuthConfigurationErrorCode || (AuthConfigurationErrorCode = {}));
var assert$2 = createAssertionFunction({
	[AuthConfigurationErrorCode.AuthTokenConfigException]: {
		message: "Auth Token Provider not configured.",
		recoverySuggestion: "Make sure to call Amplify.configure in your app."
	},
	[AuthConfigurationErrorCode.AuthUserPoolAndIdentityPoolException]: {
		message: "Auth UserPool or IdentityPool not configured.",
		recoverySuggestion: "Make sure to call Amplify.configure in your app with UserPoolId and IdentityPoolId."
	},
	[AuthConfigurationErrorCode.AuthUserPoolException]: {
		message: "Auth UserPool not configured.",
		recoverySuggestion: "Make sure to call Amplify.configure in your app with userPoolId and userPoolClientId."
	},
	[AuthConfigurationErrorCode.InvalidIdentityPoolIdException]: {
		message: "Invalid identity pool id provided.",
		recoverySuggestion: "Make sure a valid identityPoolId is given in the config."
	},
	[AuthConfigurationErrorCode.OAuthNotConfigureException]: {
		message: "oauth param not configured.",
		recoverySuggestion: "Make sure to call Amplify.configure with oauth parameter in your app."
	}
});
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/singleton/Auth/utils/index.mjs
function assertTokenProviderConfig(cognitoConfig) {
	let assertionValid = true;
	if (!cognitoConfig) assertionValid = false;
	else assertionValid = !!cognitoConfig.userPoolId && !!cognitoConfig.userPoolClientId;
	assert$2(assertionValid, AuthConfigurationErrorCode.AuthUserPoolException);
}
function assertOAuthConfig(cognitoConfig) {
	assert$2(!!cognitoConfig?.loginWith?.oauth?.domain && !!cognitoConfig?.loginWith?.oauth?.redirectSignOut && !!cognitoConfig?.loginWith?.oauth?.redirectSignIn && !!cognitoConfig?.loginWith?.oauth?.responseType, AuthConfigurationErrorCode.OAuthNotConfigureException);
}
function assertIdentityPoolIdConfig(cognitoConfig) {
	assert$2(!!cognitoConfig?.identityPoolId, AuthConfigurationErrorCode.InvalidIdentityPoolIdException);
}
/**
* Decodes payload of JWT token
*
* @param {String} token A string representing a token to be decoded
* @throws {@link Error} - Throws error when token is invalid or payload malformed.
*/
function decodeJWT(token) {
	const tokenParts = token.split(".");
	if (tokenParts.length !== 3) throw new Error("Invalid token");
	try {
		const base64 = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
		const jsonStr = decodeURIComponent(base64Decoder.convert(base64).split("").map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`).join(""));
		return {
			toString: () => token,
			payload: JSON.parse(jsonStr)
		};
	} catch (err) {
		throw new Error("Invalid token payload");
	}
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/retry/isNonRetryableError.mjs
var isNonRetryableError = (obj) => {
	return obj && obj["nonRetryable"];
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/retry/retry.mjs
var logger$7 = new ConsoleLogger("retryUtil");
/**
* @private
* Internal use of Amplify only
*/
async function retry(functionToRetry, args, delayFn, onTerminate) {
	if (typeof functionToRetry !== "function") throw Error("functionToRetry must be a function");
	return new Promise(async (resolve, reject) => {
		let attempt = 0;
		let terminated = false;
		let timeout;
		let wakeUp = () => {};
		let lastError;
		onTerminate && onTerminate.then(() => {
			terminated = true;
			clearTimeout(timeout);
			wakeUp();
		});
		while (!terminated) {
			attempt++;
			logger$7.debug(`${functionToRetry.name} attempt #${attempt} with this vars: ${JSON.stringify(args)}`);
			try {
				resolve(await functionToRetry(...args));
				return;
			} catch (err) {
				lastError = err;
				logger$7.debug(`error on ${functionToRetry.name}`, err);
				if (isNonRetryableError(err)) {
					logger$7.debug(`${functionToRetry.name} non retryable error`, err);
					reject(err);
					return;
				}
				const retryIn = delayFn(attempt, args, err);
				logger$7.debug(`${functionToRetry.name} retrying in ${retryIn} ms`);
				if (retryIn === false || terminated) {
					reject(err);
					return;
				} else await new Promise((_resolve) => {
					wakeUp = _resolve;
					timeout = setTimeout(wakeUp, retryIn);
				});
			}
		}
		reject(lastError);
	});
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/deepFreeze.mjs
var deepFreeze = (object) => {
	const propNames = Reflect.ownKeys(object);
	for (const name of propNames) {
		const value = object[name];
		if (value && typeof value === "object" || typeof value === "function") deepFreeze(value);
	}
	return Object.freeze(object);
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/parseAWSExports.mjs
var logger$6 = new ConsoleLogger("parseAWSExports");
var authTypeMapping = {
	API_KEY: "apiKey",
	AWS_IAM: "iam",
	AMAZON_COGNITO_USER_POOLS: "userPool",
	OPENID_CONNECT: "oidc",
	NONE: "none",
	AWS_LAMBDA: "lambda",
	LAMBDA: "lambda"
};
/**
* Converts the object imported from `aws-exports.js` or `amplifyconfiguration.json` files generated by
* the Amplify CLI into an object that conforms to the {@link ResourcesConfig}.
*
* @param config A configuration object imported  from `aws-exports.js` or `amplifyconfiguration.json`.
*
* @returns An object that conforms to the {@link ResourcesConfig} .
*/
var parseAWSExports = (config = {}) => {
	if (!Object.prototype.hasOwnProperty.call(config, "aws_project_region")) throw new AmplifyError({
		name: "InvalidParameterException",
		message: "Invalid config parameter.",
		recoverySuggestion: "Ensure passing the config object imported from  `amplifyconfiguration.json`."
	});
	const { aws_appsync_apiKey, aws_appsync_authenticationType, aws_appsync_graphqlEndpoint, aws_appsync_region, aws_bots_config, aws_cognito_identity_pool_id, aws_cognito_sign_up_verification_method, aws_cognito_mfa_configuration, aws_cognito_mfa_types, aws_cognito_password_protection_settings, aws_cognito_verification_mechanisms, aws_cognito_signup_attributes, aws_cognito_social_providers, aws_cognito_username_attributes, aws_mandatory_sign_in, aws_mobile_analytics_app_id, aws_mobile_analytics_app_region, aws_user_files_s3_bucket, aws_user_files_s3_bucket_region, aws_user_files_s3_dangerously_connect_to_http_endpoint_for_testing, aws_user_pools_id, aws_user_pools_web_client_id, geo, oauth, predictions, aws_cloud_logic_custom, Notifications, modelIntrospection } = config;
	const amplifyConfig = {};
	if (aws_mobile_analytics_app_id) amplifyConfig.Analytics = { Pinpoint: {
		appId: aws_mobile_analytics_app_id,
		region: aws_mobile_analytics_app_region
	} };
	const { InAppMessaging, Push } = Notifications ?? {};
	if (InAppMessaging?.AWSPinpoint || Push?.AWSPinpoint) {
		if (InAppMessaging?.AWSPinpoint) {
			const { appId, region } = InAppMessaging.AWSPinpoint;
			amplifyConfig.Notifications = { InAppMessaging: { Pinpoint: {
				appId,
				region
			} } };
		}
		if (Push?.AWSPinpoint) {
			const { appId, region } = Push.AWSPinpoint;
			amplifyConfig.Notifications = {
				...amplifyConfig.Notifications,
				PushNotification: { Pinpoint: {
					appId,
					region
				} }
			};
		}
	}
	if (Array.isArray(aws_bots_config)) amplifyConfig.Interactions = { LexV1: Object.fromEntries(aws_bots_config.map((bot) => [bot.name, bot])) };
	if (aws_appsync_graphqlEndpoint) {
		const defaultAuthMode = authTypeMapping[aws_appsync_authenticationType];
		if (!defaultAuthMode) logger$6.debug(`Invalid authentication type ${aws_appsync_authenticationType}. Falling back to IAM.`);
		amplifyConfig.API = { GraphQL: {
			endpoint: aws_appsync_graphqlEndpoint,
			apiKey: aws_appsync_apiKey,
			region: aws_appsync_region,
			defaultAuthMode: defaultAuthMode ?? "iam"
		} };
		if (modelIntrospection) amplifyConfig.API.GraphQL.modelIntrospection = modelIntrospection;
	}
	const mfaConfig = aws_cognito_mfa_configuration ? {
		status: aws_cognito_mfa_configuration && aws_cognito_mfa_configuration.toLowerCase(),
		totpEnabled: aws_cognito_mfa_types?.includes("TOTP") ?? false,
		smsEnabled: aws_cognito_mfa_types?.includes("SMS") ?? false
	} : void 0;
	const passwordFormatConfig = aws_cognito_password_protection_settings ? {
		minLength: aws_cognito_password_protection_settings.passwordPolicyMinLength,
		requireLowercase: aws_cognito_password_protection_settings.passwordPolicyCharacters?.includes("REQUIRES_LOWERCASE") ?? false,
		requireUppercase: aws_cognito_password_protection_settings.passwordPolicyCharacters?.includes("REQUIRES_UPPERCASE") ?? false,
		requireNumbers: aws_cognito_password_protection_settings.passwordPolicyCharacters?.includes("REQUIRES_NUMBERS") ?? false,
		requireSpecialCharacters: aws_cognito_password_protection_settings.passwordPolicyCharacters?.includes("REQUIRES_SYMBOLS") ?? false
	} : void 0;
	const userAttributes = Array.from(new Set([...aws_cognito_verification_mechanisms ?? [], ...aws_cognito_signup_attributes ?? []])).reduce((attributes, key) => ({
		...attributes,
		[key.toLowerCase()]: { required: true }
	}), {});
	const loginWithEmailEnabled = aws_cognito_username_attributes?.includes("EMAIL") ?? false;
	const loginWithPhoneEnabled = aws_cognito_username_attributes?.includes("PHONE_NUMBER") ?? false;
	if (aws_cognito_identity_pool_id || aws_user_pools_id) amplifyConfig.Auth = { Cognito: {
		identityPoolId: aws_cognito_identity_pool_id,
		allowGuestAccess: aws_mandatory_sign_in !== "enable",
		signUpVerificationMethod: aws_cognito_sign_up_verification_method,
		userAttributes,
		userPoolClientId: aws_user_pools_web_client_id,
		userPoolId: aws_user_pools_id,
		mfa: mfaConfig,
		passwordFormat: passwordFormatConfig,
		loginWith: {
			username: !(loginWithEmailEnabled || loginWithPhoneEnabled),
			email: loginWithEmailEnabled,
			phone: loginWithPhoneEnabled
		}
	} };
	const hasOAuthConfig = oauth ? Object.keys(oauth).length > 0 : false;
	const hasSocialProviderConfig = aws_cognito_social_providers ? aws_cognito_social_providers.length > 0 : false;
	if (amplifyConfig.Auth && hasOAuthConfig) amplifyConfig.Auth.Cognito.loginWith = {
		...amplifyConfig.Auth.Cognito.loginWith,
		oauth: {
			...getOAuthConfig(oauth),
			...hasSocialProviderConfig && { providers: parseSocialProviders(aws_cognito_social_providers) }
		}
	};
	if (aws_user_files_s3_bucket) amplifyConfig.Storage = { S3: {
		bucket: aws_user_files_s3_bucket,
		region: aws_user_files_s3_bucket_region,
		dangerouslyConnectToHttpEndpointForTesting: aws_user_files_s3_dangerously_connect_to_http_endpoint_for_testing
	} };
	if (geo) {
		const { amazon_location_service } = geo;
		amplifyConfig.Geo = { LocationService: {
			maps: amazon_location_service.maps,
			geofenceCollections: amazon_location_service.geofenceCollections,
			searchIndices: amazon_location_service.search_indices,
			region: amazon_location_service.region
		} };
	}
	if (aws_cloud_logic_custom) amplifyConfig.API = {
		...amplifyConfig.API,
		REST: aws_cloud_logic_custom.reduce((acc, api) => {
			const { name, endpoint, region, service } = api;
			return {
				...acc,
				[name]: {
					endpoint,
					...service ? { service } : void 0,
					...region ? { region } : void 0
				}
			};
		}, {})
	};
	if (predictions) {
		const { VoiceId: voiceId } = predictions?.convert?.speechGenerator?.defaults ?? {};
		amplifyConfig.Predictions = voiceId ? {
			...predictions,
			convert: {
				...predictions.convert,
				speechGenerator: {
					...predictions.convert.speechGenerator,
					defaults: { voiceId }
				}
			}
		} : predictions;
	}
	return amplifyConfig;
};
var getRedirectUrl = (redirectStr) => redirectStr?.split(",") ?? [];
var getOAuthConfig = ({ domain, scope, redirectSignIn, redirectSignOut, responseType }) => ({
	domain,
	scopes: scope,
	redirectSignIn: getRedirectUrl(redirectSignIn),
	redirectSignOut: getRedirectUrl(redirectSignOut),
	responseType
});
var parseSocialProviders = (aws_cognito_social_providers) => {
	return aws_cognito_social_providers.map((provider) => {
		const updatedProvider = provider.toLowerCase();
		return updatedProvider.charAt(0).toUpperCase() + updatedProvider.slice(1);
	});
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/singleton/constants.mjs
var ADD_OAUTH_LISTENER = Symbol("oauth-listener");
//#endregion
//#region node_modules/uuid/dist/esm-browser/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) byteToHex.push((i + 256).toString(16).slice(1));
function unsafeStringify(arr, offset = 0) {
	return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
//#endregion
//#region node_modules/uuid/dist/esm-browser/rng.js
var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
	if (!getRandomValues) {
		if (typeof crypto === "undefined" || !crypto.getRandomValues) throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
		getRandomValues = crypto.getRandomValues.bind(crypto);
	}
	return getRandomValues(rnds8);
}
var native_default = { randomUUID: typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto) };
//#endregion
//#region node_modules/uuid/dist/esm-browser/v4.js
function v4(options, buf, offset) {
	if (native_default.randomUUID && !buf && !options) return native_default.randomUUID();
	options = options || {};
	const rnds = options.random ?? options.rng?.() ?? rng();
	if (rnds.length < 16) throw new Error("Random bytes length must be >= 16");
	rnds[6] = rnds[6] & 15 | 64;
	rnds[8] = rnds[8] & 63 | 128;
	if (buf) {
		offset = offset || 0;
		if (offset < 0 || offset + 16 > buf.length) throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
		for (let i = 0; i < 16; ++i) buf[offset + i] = rnds[i];
		return buf;
	}
	return unsafeStringify(rnds);
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/parseAmplifyOutputs.mjs
function isAmplifyOutputs(config) {
	const { version } = config;
	if (!version) return false;
	return version.startsWith("1");
}
function parseStorage(amplifyOutputsStorageProperties) {
	if (!amplifyOutputsStorageProperties) return;
	const { bucket_name, aws_region, buckets } = amplifyOutputsStorageProperties;
	return { S3: {
		bucket: bucket_name,
		region: aws_region,
		buckets: buckets && createBucketInfoMap(buckets)
	} };
}
function parseAuth(amplifyOutputsAuthProperties) {
	if (!amplifyOutputsAuthProperties) return;
	const { user_pool_id, user_pool_client_id, identity_pool_id, password_policy, mfa_configuration, mfa_methods, unauthenticated_identities_enabled, oauth, username_attributes, standard_required_attributes, groups, passwordless } = amplifyOutputsAuthProperties;
	const authConfig = { Cognito: {
		userPoolId: user_pool_id,
		userPoolClientId: user_pool_client_id,
		groups
	} };
	if (identity_pool_id) authConfig.Cognito = {
		...authConfig.Cognito,
		identityPoolId: identity_pool_id
	};
	if (password_policy) authConfig.Cognito.passwordFormat = {
		requireLowercase: password_policy.require_lowercase,
		requireNumbers: password_policy.require_numbers,
		requireUppercase: password_policy.require_uppercase,
		requireSpecialCharacters: password_policy.require_symbols,
		minLength: password_policy.min_length ?? 6
	};
	if (mfa_configuration) authConfig.Cognito.mfa = {
		status: getMfaStatus(mfa_configuration),
		smsEnabled: mfa_methods?.includes("SMS"),
		totpEnabled: mfa_methods?.includes("TOTP")
	};
	if (unauthenticated_identities_enabled) authConfig.Cognito.allowGuestAccess = unauthenticated_identities_enabled;
	if (oauth) authConfig.Cognito.loginWith = { oauth: {
		domain: oauth.domain,
		redirectSignIn: oauth.redirect_sign_in_uri,
		redirectSignOut: oauth.redirect_sign_out_uri,
		responseType: oauth.response_type === "token" ? "token" : "code",
		scopes: oauth.scopes,
		providers: getOAuthProviders(oauth.identity_providers)
	} };
	if (username_attributes) authConfig.Cognito.loginWith = {
		...authConfig.Cognito.loginWith,
		email: username_attributes.includes("email"),
		phone: username_attributes.includes("phone_number"),
		username: username_attributes.includes("username")
	};
	if (standard_required_attributes) authConfig.Cognito.userAttributes = standard_required_attributes.reduce((acc, curr) => ({
		...acc,
		[curr]: { required: true }
	}), {});
	if (passwordless) authConfig.Cognito.passwordless = {
		emailOtpEnabled: passwordless.email_otp_enabled,
		smsOtpEnabled: passwordless.sms_otp_enabled,
		webAuthn: passwordless.web_authn ? {
			relyingPartyId: passwordless.web_authn.relying_party_id,
			userVerification: passwordless.web_authn.user_verification
		} : void 0,
		preferredChallenge: passwordless.preferred_challenge
	};
	return authConfig;
}
function parseAnalytics(amplifyOutputsAnalyticsProperties) {
	if (!amplifyOutputsAnalyticsProperties?.amazon_pinpoint) return;
	const { amazon_pinpoint } = amplifyOutputsAnalyticsProperties;
	return { Pinpoint: {
		appId: amazon_pinpoint.app_id,
		region: amazon_pinpoint.aws_region
	} };
}
function parseGeo(amplifyOutputsAnalyticsProperties) {
	if (!amplifyOutputsAnalyticsProperties) return;
	const { aws_region, geofence_collections, maps, search_indices } = amplifyOutputsAnalyticsProperties;
	return { LocationService: {
		region: aws_region,
		searchIndices: search_indices,
		geofenceCollections: geofence_collections,
		maps
	} };
}
function parseData(amplifyOutputsDataProperties) {
	if (!amplifyOutputsDataProperties) return;
	const { aws_region, default_authorization_type, url, api_key, model_introspection } = amplifyOutputsDataProperties;
	return { GraphQL: {
		endpoint: url,
		defaultAuthMode: getGraphQLAuthMode(default_authorization_type),
		region: aws_region,
		apiKey: api_key,
		modelIntrospection: model_introspection
	} };
}
function parseCustom(amplifyOutputsCustomProperties) {
	if (!amplifyOutputsCustomProperties?.events) return;
	const { url, aws_region, api_key, default_authorization_type } = amplifyOutputsCustomProperties.events;
	return { Events: {
		endpoint: url,
		defaultAuthMode: getGraphQLAuthMode(default_authorization_type),
		region: aws_region,
		apiKey: api_key
	} };
}
function parseNotifications(amplifyOutputsNotificationsProperties) {
	if (!amplifyOutputsNotificationsProperties) return;
	const { aws_region, channels, amazon_pinpoint_app_id } = amplifyOutputsNotificationsProperties;
	const hasInAppMessaging = channels.includes("IN_APP_MESSAGING");
	const hasPushNotification = channels.includes("APNS") || channels.includes("FCM");
	if (!(hasInAppMessaging || hasPushNotification)) return;
	const notificationsConfig = {};
	if (hasInAppMessaging) notificationsConfig.InAppMessaging = { Pinpoint: {
		appId: amazon_pinpoint_app_id,
		region: aws_region
	} };
	if (hasPushNotification) notificationsConfig.PushNotification = { Pinpoint: {
		appId: amazon_pinpoint_app_id,
		region: aws_region
	} };
	return notificationsConfig;
}
function parseAmplifyOutputs(amplifyOutputs) {
	const resourcesConfig = {};
	if (amplifyOutputs.storage) resourcesConfig.Storage = parseStorage(amplifyOutputs.storage);
	if (amplifyOutputs.auth) resourcesConfig.Auth = parseAuth(amplifyOutputs.auth);
	if (amplifyOutputs.analytics) resourcesConfig.Analytics = parseAnalytics(amplifyOutputs.analytics);
	if (amplifyOutputs.geo) resourcesConfig.Geo = parseGeo(amplifyOutputs.geo);
	if (amplifyOutputs.data) resourcesConfig.API = parseData(amplifyOutputs.data);
	if (amplifyOutputs.custom) {
		const customConfig = parseCustom(amplifyOutputs.custom);
		if (customConfig && "Events" in customConfig) resourcesConfig.API = {
			...resourcesConfig.API,
			...customConfig
		};
	}
	if (amplifyOutputs.notifications) resourcesConfig.Notifications = parseNotifications(amplifyOutputs.notifications);
	return resourcesConfig;
}
var authModeNames = {
	AMAZON_COGNITO_USER_POOLS: "userPool",
	API_KEY: "apiKey",
	AWS_IAM: "iam",
	AWS_LAMBDA: "lambda",
	OPENID_CONNECT: "oidc"
};
function getGraphQLAuthMode(authType) {
	return authModeNames[authType];
}
var providerNames = {
	GOOGLE: "Google",
	LOGIN_WITH_AMAZON: "Amazon",
	FACEBOOK: "Facebook",
	SIGN_IN_WITH_APPLE: "Apple"
};
function getOAuthProviders(providers = []) {
	return providers.reduce((oAuthProviders, provider) => {
		if (providerNames[provider] !== void 0) oAuthProviders.push(providerNames[provider]);
		return oAuthProviders;
	}, []);
}
function getMfaStatus(mfaConfiguration) {
	if (mfaConfiguration === "OPTIONAL") return "optional";
	if (mfaConfiguration === "REQUIRED") return "on";
	return "off";
}
function createBucketInfoMap(buckets) {
	const mappedBuckets = {};
	buckets.forEach(({ name, bucket_name: bucketName, aws_region: region, paths }) => {
		if (name in mappedBuckets) throw new Error(`Duplicate friendly name found: ${name}. Name must be unique.`);
		mappedBuckets[name] = {
			bucketName,
			region,
			paths: paths ? Object.entries(paths).reduce((acc, [key, value]) => {
				if (value !== void 0) acc[key] = value;
				return acc;
			}, {}) : void 0
		};
	});
	return mappedBuckets;
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/parseAmplifyConfig.mjs
/**
* Parses the variety of configuration shapes that Amplify can accept into a ResourcesConfig.
*
* @param amplifyConfig An Amplify configuration object conforming to one of the supported schemas.
* @return A ResourcesConfig for the provided configuration object.
*/
var parseAmplifyConfig = (amplifyConfig) => {
	if (Object.keys(amplifyConfig).some((key) => key.startsWith("aws_"))) return parseAWSExports(amplifyConfig);
	else if (isAmplifyOutputs(amplifyConfig)) return parseAmplifyOutputs(amplifyConfig);
	else return amplifyConfig;
};
//#endregion
//#region node_modules/tslib/tslib.es6.mjs
/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
var extendStatics = function(d, b) {
	extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d, b) {
		d.__proto__ = b;
	} || function(d, b) {
		for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
	};
	return extendStatics(d, b);
};
function __extends(d, b) {
	if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
	extendStatics(d, b);
	function __() {
		this.constructor = d;
	}
	d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
function __awaiter(thisArg, _arguments, P, generator) {
	function adopt(value) {
		return value instanceof P ? value : new P(function(resolve) {
			resolve(value);
		});
	}
	return new (P || (P = Promise))(function(resolve, reject) {
		function fulfilled(value) {
			try {
				step(generator.next(value));
			} catch (e) {
				reject(e);
			}
		}
		function rejected(value) {
			try {
				step(generator["throw"](value));
			} catch (e) {
				reject(e);
			}
		}
		function step(result) {
			result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
		}
		step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
}
function __generator(thisArg, body) {
	var _ = {
		label: 0,
		sent: function() {
			if (t[0] & 1) throw t[1];
			return t[1];
		},
		trys: [],
		ops: []
	}, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
	return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
		return this;
	}), g;
	function verb(n) {
		return function(v) {
			return step([n, v]);
		};
	}
	function step(op) {
		if (f) throw new TypeError("Generator is already executing.");
		while (g && (g = 0, op[0] && (_ = 0)), _) try {
			if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
			if (y = 0, t) op = [op[0] & 2, t.value];
			switch (op[0]) {
				case 0:
				case 1:
					t = op;
					break;
				case 4:
					_.label++;
					return {
						value: op[1],
						done: false
					};
				case 5:
					_.label++;
					y = op[1];
					op = [0];
					continue;
				case 7:
					op = _.ops.pop();
					_.trys.pop();
					continue;
				default:
					if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
						_ = 0;
						continue;
					}
					if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
						_.label = op[1];
						break;
					}
					if (op[0] === 6 && _.label < t[1]) {
						_.label = t[1];
						t = op;
						break;
					}
					if (t && _.label < t[2]) {
						_.label = t[2];
						_.ops.push(op);
						break;
					}
					if (t[2]) _.ops.pop();
					_.trys.pop();
					continue;
			}
			op = body.call(thisArg, _);
		} catch (e) {
			op = [6, e];
			y = 0;
		} finally {
			f = t = 0;
		}
		if (op[0] & 5) throw op[1];
		return {
			value: op[0] ? op[1] : void 0,
			done: true
		};
	}
}
function __values(o) {
	var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
	if (m) return m.call(o);
	if (o && typeof o.length === "number") return { next: function() {
		if (o && i >= o.length) o = void 0;
		return {
			value: o && o[i++],
			done: !o
		};
	} };
	throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __read(o, n) {
	var m = typeof Symbol === "function" && o[Symbol.iterator];
	if (!m) return o;
	var i = m.call(o), r, ar = [], e;
	try {
		while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
	} catch (error) {
		e = { error };
	} finally {
		try {
			if (r && !r.done && (m = i["return"])) m.call(i);
		} finally {
			if (e) throw e.error;
		}
	}
	return ar;
}
function __spreadArray(to, from, pack) {
	if (pack || arguments.length === 2) {
		for (var i = 0, l = from.length, ar; i < l; i++) if (ar || !(i in from)) {
			if (!ar) ar = Array.prototype.slice.call(from, 0, i);
			ar[i] = from[i];
		}
	}
	return to.concat(ar || Array.prototype.slice.call(from));
}
function __await(v) {
	return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
	if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
	var g = generator.apply(thisArg, _arguments || []), i, q = [];
	return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
		return this;
	}, i;
	function awaitReturn(f) {
		return function(v) {
			return Promise.resolve(v).then(f, reject);
		};
	}
	function verb(n, f) {
		if (g[n]) {
			i[n] = function(v) {
				return new Promise(function(a, b) {
					q.push([
						n,
						v,
						a,
						b
					]) > 1 || resume(n, v);
				});
			};
			if (f) i[n] = f(i[n]);
		}
	}
	function resume(n, v) {
		try {
			step(g[n](v));
		} catch (e) {
			settle(q[0][3], e);
		}
	}
	function step(r) {
		r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
	}
	function fulfill(value) {
		resume("next", value);
	}
	function reject(value) {
		resume("throw", value);
	}
	function settle(f, v) {
		if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
	}
}
function __asyncValues(o) {
	if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
	var m = o[Symbol.asyncIterator], i;
	return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
		return this;
	}, i);
	function verb(n) {
		i[n] = o[n] && function(v) {
			return new Promise(function(resolve, reject) {
				v = o[n](v), settle(resolve, reject, v.done, v.value);
			});
		};
	}
	function settle(resolve, reject, d, v) {
		Promise.resolve(v).then(function(v) {
			resolve({
				value: v,
				done: d
			});
		}, reject);
	}
}
//#endregion
//#region node_modules/@aws-crypto/sha256-js/build/module/constants.js
/**
* @internal
*/
var KEY = new Uint32Array([
	1116352408,
	1899447441,
	3049323471,
	3921009573,
	961987163,
	1508970993,
	2453635748,
	2870763221,
	3624381080,
	310598401,
	607225278,
	1426881987,
	1925078388,
	2162078206,
	2614888103,
	3248222580,
	3835390401,
	4022224774,
	264347078,
	604807628,
	770255983,
	1249150122,
	1555081692,
	1996064986,
	2554220882,
	2821834349,
	2952996808,
	3210313671,
	3336571891,
	3584528711,
	113926993,
	338241895,
	666307205,
	773529912,
	1294757372,
	1396182291,
	1695183700,
	1986661051,
	2177026350,
	2456956037,
	2730485921,
	2820302411,
	3259730800,
	3345764771,
	3516065817,
	3600352804,
	4094571909,
	275423344,
	430227734,
	506948616,
	659060556,
	883997877,
	958139571,
	1322822218,
	1537002063,
	1747873779,
	1955562222,
	2024104815,
	2227730452,
	2361852424,
	2428436474,
	2756734187,
	3204031479,
	3329325298
]);
/**
* @internal
*/
var INIT = [
	1779033703,
	3144134277,
	1013904242,
	2773480762,
	1359893119,
	2600822924,
	528734635,
	1541459225
];
/**
* @internal
*/
var MAX_HASHABLE_LENGTH = Math.pow(2, 53) - 1;
//#endregion
//#region node_modules/@aws-crypto/sha256-js/build/module/RawSha256.js
/**
* @internal
*/
var RawSha256 = function() {
	function RawSha256() {
		this.state = Int32Array.from(INIT);
		this.temp = new Int32Array(64);
		this.buffer = new Uint8Array(64);
		this.bufferLength = 0;
		this.bytesHashed = 0;
		/**
		* @internal
		*/
		this.finished = false;
	}
	RawSha256.prototype.update = function(data) {
		if (this.finished) throw new Error("Attempted to update an already finished hash.");
		var position = 0;
		var byteLength = data.byteLength;
		this.bytesHashed += byteLength;
		if (this.bytesHashed * 8 > MAX_HASHABLE_LENGTH) throw new Error("Cannot hash more than 2^53 - 1 bits");
		while (byteLength > 0) {
			this.buffer[this.bufferLength++] = data[position++];
			byteLength--;
			if (this.bufferLength === 64) {
				this.hashBuffer();
				this.bufferLength = 0;
			}
		}
	};
	RawSha256.prototype.digest = function() {
		if (!this.finished) {
			var bitsHashed = this.bytesHashed * 8;
			var bufferView = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
			var undecoratedLength = this.bufferLength;
			bufferView.setUint8(this.bufferLength++, 128);
			if (undecoratedLength % 64 >= 56) {
				for (var i = this.bufferLength; i < 64; i++) bufferView.setUint8(i, 0);
				this.hashBuffer();
				this.bufferLength = 0;
			}
			for (var i = this.bufferLength; i < 56; i++) bufferView.setUint8(i, 0);
			bufferView.setUint32(56, Math.floor(bitsHashed / 4294967296), true);
			bufferView.setUint32(60, bitsHashed);
			this.hashBuffer();
			this.finished = true;
		}
		var out = new Uint8Array(32);
		for (var i = 0; i < 8; i++) {
			out[i * 4] = this.state[i] >>> 24 & 255;
			out[i * 4 + 1] = this.state[i] >>> 16 & 255;
			out[i * 4 + 2] = this.state[i] >>> 8 & 255;
			out[i * 4 + 3] = this.state[i] >>> 0 & 255;
		}
		return out;
	};
	RawSha256.prototype.hashBuffer = function() {
		var _a = this, buffer = _a.buffer, state = _a.state;
		var state0 = state[0], state1 = state[1], state2 = state[2], state3 = state[3], state4 = state[4], state5 = state[5], state6 = state[6], state7 = state[7];
		for (var i = 0; i < 64; i++) {
			if (i < 16) this.temp[i] = (buffer[i * 4] & 255) << 24 | (buffer[i * 4 + 1] & 255) << 16 | (buffer[i * 4 + 2] & 255) << 8 | buffer[i * 4 + 3] & 255;
			else {
				var u = this.temp[i - 2];
				var t1_1 = (u >>> 17 | u << 15) ^ (u >>> 19 | u << 13) ^ u >>> 10;
				u = this.temp[i - 15];
				var t2_1 = (u >>> 7 | u << 25) ^ (u >>> 18 | u << 14) ^ u >>> 3;
				this.temp[i] = (t1_1 + this.temp[i - 7] | 0) + (t2_1 + this.temp[i - 16] | 0);
			}
			var t1 = (((state4 >>> 6 | state4 << 26) ^ (state4 >>> 11 | state4 << 21) ^ (state4 >>> 25 | state4 << 7)) + (state4 & state5 ^ ~state4 & state6) | 0) + (state7 + (KEY[i] + this.temp[i] | 0) | 0) | 0;
			var t2 = ((state0 >>> 2 | state0 << 30) ^ (state0 >>> 13 | state0 << 19) ^ (state0 >>> 22 | state0 << 10)) + (state0 & state1 ^ state0 & state2 ^ state1 & state2) | 0;
			state7 = state6;
			state6 = state5;
			state5 = state4;
			state4 = state3 + t1 | 0;
			state3 = state2;
			state2 = state1;
			state1 = state0;
			state0 = t1 + t2 | 0;
		}
		state[0] += state0;
		state[1] += state1;
		state[2] += state2;
		state[3] += state3;
		state[4] += state4;
		state[5] += state5;
		state[6] += state6;
		state[7] += state7;
	};
	return RawSha256;
}();
//#endregion
//#region node_modules/@smithy/util-utf8/dist-es/fromUtf8.browser.js
var fromUtf8$1 = (input) => new TextEncoder().encode(input);
//#endregion
//#region node_modules/@aws-crypto/util/build/module/convertToBuffer.js
var fromUtf8 = typeof Buffer !== "undefined" && Buffer.from ? function(input) {
	return Buffer.from(input, "utf8");
} : fromUtf8$1;
function convertToBuffer(data) {
	if (data instanceof Uint8Array) return data;
	if (typeof data === "string") return fromUtf8(data);
	if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
	return new Uint8Array(data);
}
//#endregion
//#region node_modules/@aws-crypto/util/build/module/isEmptyData.js
function isEmptyData(data) {
	if (typeof data === "string") return data.length === 0;
	return data.byteLength === 0;
}
//#endregion
//#region node_modules/@aws-crypto/sha256-js/build/module/jsSha256.js
var Sha256 = function() {
	function Sha256(secret) {
		this.secret = secret;
		this.hash = new RawSha256();
		this.reset();
	}
	Sha256.prototype.update = function(toHash) {
		if (isEmptyData(toHash) || this.error) return;
		try {
			this.hash.update(convertToBuffer(toHash));
		} catch (e) {
			this.error = e;
		}
	};
	Sha256.prototype.digestSync = function() {
		if (this.error) throw this.error;
		if (this.outer) {
			if (!this.outer.finished) this.outer.update(this.hash.digest());
			return this.outer.digest();
		}
		return this.hash.digest();
	};
	Sha256.prototype.digest = function() {
		return __awaiter(this, void 0, void 0, function() {
			return __generator(this, function(_a) {
				return [2, this.digestSync()];
			});
		});
	};
	Sha256.prototype.reset = function() {
		this.hash = new RawSha256();
		if (this.secret) {
			this.outer = new RawSha256();
			var inner = bufferFromSecret(this.secret);
			var outer = new Uint8Array(64);
			outer.set(inner);
			for (var i = 0; i < 64; i++) {
				inner[i] ^= 54;
				outer[i] ^= 92;
			}
			this.hash.update(inner);
			this.outer.update(outer);
			for (var i = 0; i < inner.byteLength; i++) inner[i] = 0;
		}
	};
	return Sha256;
}();
function bufferFromSecret(secret) {
	var input = convertToBuffer(secret);
	if (input.byteLength > 64) {
		var bufferHash = new RawSha256();
		bufferHash.update(input);
		input = bufferHash.digest();
	}
	var buffer = new Uint8Array(64);
	buffer.set(input);
	return buffer;
}
//#endregion
//#region node_modules/@smithy/util-hex-encoding/dist-es/index.js
var SHORT_TO_HEX = {};
var HEX_TO_SHORT = {};
for (let i = 0; i < 256; i++) {
	let encodedByte = i.toString(16).toLowerCase();
	if (encodedByte.length === 1) encodedByte = `0${encodedByte}`;
	SHORT_TO_HEX[i] = encodedByte;
	HEX_TO_SHORT[encodedByte] = i;
}
function toHex(bytes) {
	let out = "";
	for (let i = 0; i < bytes.byteLength; i++) out += SHORT_TO_HEX[bytes[i]];
	return out;
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/types.mjs
var Framework;
(function(Framework) {
	Framework["WebUnknown"] = "0";
	Framework["React"] = "1";
	Framework["NextJs"] = "2";
	Framework["Angular"] = "3";
	Framework["VueJs"] = "4";
	Framework["Nuxt"] = "5";
	Framework["Svelte"] = "6";
	Framework["ServerSideUnknown"] = "100";
	Framework["ReactSSR"] = "101";
	Framework["NextJsSSR"] = "102";
	Framework["AngularSSR"] = "103";
	Framework["VueJsSSR"] = "104";
	Framework["NuxtSSR"] = "105";
	Framework["SvelteSSR"] = "106";
	Framework["ReactNative"] = "201";
	Framework["Expo"] = "202";
})(Framework || (Framework = {}));
var Category;
(function(Category) {
	Category["AI"] = "ai";
	Category["API"] = "api";
	Category["Auth"] = "auth";
	Category["Analytics"] = "analytics";
	Category["DataStore"] = "datastore";
	Category["Geo"] = "geo";
	Category["InAppMessaging"] = "inappmessaging";
	Category["Interactions"] = "interactions";
	Category["Predictions"] = "predictions";
	Category["PubSub"] = "pubsub";
	Category["PushNotification"] = "pushnotification";
	Category["Storage"] = "storage";
})(Category || (Category = {}));
var AiAction;
(function(AiAction) {
	AiAction["CreateConversation"] = "1";
	AiAction["GetConversation"] = "2";
	AiAction["ListConversations"] = "3";
	AiAction["DeleteConversation"] = "4";
	AiAction["SendMessage"] = "5";
	AiAction["ListMessages"] = "6";
	AiAction["OnMessage"] = "7";
	AiAction["Generation"] = "8";
	AiAction["UpdateConversation"] = "9";
})(AiAction || (AiAction = {}));
var AnalyticsAction;
(function(AnalyticsAction) {
	AnalyticsAction["Record"] = "1";
	AnalyticsAction["IdentifyUser"] = "2";
})(AnalyticsAction || (AnalyticsAction = {}));
var ApiAction;
(function(ApiAction) {
	ApiAction["GraphQl"] = "1";
	ApiAction["Get"] = "2";
	ApiAction["Post"] = "3";
	ApiAction["Put"] = "4";
	ApiAction["Patch"] = "5";
	ApiAction["Del"] = "6";
	ApiAction["Head"] = "7";
})(ApiAction || (ApiAction = {}));
var AuthAction;
(function(AuthAction) {
	AuthAction["SignUp"] = "1";
	AuthAction["ConfirmSignUp"] = "2";
	AuthAction["ResendSignUpCode"] = "3";
	AuthAction["SignIn"] = "4";
	AuthAction["FetchMFAPreference"] = "6";
	AuthAction["UpdateMFAPreference"] = "7";
	AuthAction["SetUpTOTP"] = "10";
	AuthAction["VerifyTOTPSetup"] = "11";
	AuthAction["ConfirmSignIn"] = "12";
	AuthAction["DeleteUserAttributes"] = "15";
	AuthAction["DeleteUser"] = "16";
	AuthAction["UpdateUserAttributes"] = "17";
	AuthAction["FetchUserAttributes"] = "18";
	AuthAction["ConfirmUserAttribute"] = "22";
	AuthAction["SignOut"] = "26";
	AuthAction["UpdatePassword"] = "27";
	AuthAction["ResetPassword"] = "28";
	AuthAction["ConfirmResetPassword"] = "29";
	AuthAction["FederatedSignIn"] = "30";
	AuthAction["RememberDevice"] = "32";
	AuthAction["ForgetDevice"] = "33";
	AuthAction["FetchDevices"] = "34";
	AuthAction["SendUserAttributeVerificationCode"] = "35";
	AuthAction["SignInWithRedirect"] = "36";
	AuthAction["StartWebAuthnRegistration"] = "37";
	AuthAction["CompleteWebAuthnRegistration"] = "38";
	AuthAction["ListWebAuthnCredentials"] = "39";
	AuthAction["DeleteWebAuthnCredential"] = "40";
})(AuthAction || (AuthAction = {}));
var DataStoreAction;
(function(DataStoreAction) {
	DataStoreAction["Subscribe"] = "1";
	DataStoreAction["GraphQl"] = "2";
})(DataStoreAction || (DataStoreAction = {}));
var GeoAction;
(function(GeoAction) {
	GeoAction["SearchByText"] = "0";
	GeoAction["SearchByCoordinates"] = "1";
	GeoAction["SearchForSuggestions"] = "2";
	GeoAction["SearchByPlaceId"] = "3";
	GeoAction["SaveGeofences"] = "4";
	GeoAction["GetGeofence"] = "5";
	GeoAction["ListGeofences"] = "6";
	GeoAction["DeleteGeofences"] = "7";
})(GeoAction || (GeoAction = {}));
var InAppMessagingAction;
(function(InAppMessagingAction) {
	InAppMessagingAction["SyncMessages"] = "1";
	InAppMessagingAction["IdentifyUser"] = "2";
	InAppMessagingAction["NotifyMessageInteraction"] = "3";
})(InAppMessagingAction || (InAppMessagingAction = {}));
var InteractionsAction;
(function(InteractionsAction) {
	InteractionsAction["None"] = "0";
})(InteractionsAction || (InteractionsAction = {}));
var PredictionsAction;
(function(PredictionsAction) {
	PredictionsAction["Convert"] = "1";
	PredictionsAction["Identify"] = "2";
	PredictionsAction["Interpret"] = "3";
})(PredictionsAction || (PredictionsAction = {}));
var PubSubAction;
(function(PubSubAction) {
	PubSubAction["Subscribe"] = "1";
})(PubSubAction || (PubSubAction = {}));
var PushNotificationAction;
(function(PushNotificationAction) {
	PushNotificationAction["InitializePushNotifications"] = "1";
	PushNotificationAction["IdentifyUser"] = "2";
})(PushNotificationAction || (PushNotificationAction = {}));
var StorageAction;
(function(StorageAction) {
	StorageAction["UploadData"] = "1";
	StorageAction["DownloadData"] = "2";
	StorageAction["List"] = "3";
	StorageAction["Copy"] = "4";
	StorageAction["Remove"] = "5";
	StorageAction["GetProperties"] = "6";
	StorageAction["GetUrl"] = "7";
	StorageAction["GetDataAccess"] = "8";
	StorageAction["ListCallerAccessGrants"] = "9";
})(StorageAction || (StorageAction = {}));
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/version.mjs
var version = "6.16.2";
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detection/helpers.mjs
var globalExists = () => {
	return typeof global !== "undefined";
};
var windowExists = () => {
	return typeof window !== "undefined";
};
var documentExists = () => {
	return typeof document !== "undefined";
};
var processExists = () => {
	return typeof process !== "undefined";
};
var keyPrefixMatch = (object, prefix) => {
	return !!Object.keys(object).find((key) => key.startsWith(prefix));
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detection/React.mjs
function reactWebDetect() {
	const elementKeyPrefixedWithReact = (key) => {
		return key.startsWith("_react") || key.startsWith("__react");
	};
	const elementIsReactEnabled = (element) => {
		return Object.keys(element).find(elementKeyPrefixedWithReact);
	};
	const allElementsWithId = () => Array.from(document.querySelectorAll("[id]"));
	return documentExists() && allElementsWithId().some(elementIsReactEnabled);
}
function reactSSRDetect() {
	return processExists() && typeof process.env !== "undefined" && !!Object.keys(process.env).find((key) => key.includes("react"));
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detection/Vue.mjs
function vueWebDetect() {
	return windowExists() && keyPrefixMatch(window, "__VUE");
}
function vueSSRDetect() {
	return globalExists() && keyPrefixMatch(global, "__VUE");
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detection/Svelte.mjs
function svelteWebDetect() {
	return windowExists() && keyPrefixMatch(window, "__SVELTE");
}
function svelteSSRDetect() {
	return processExists() && typeof process.env !== "undefined" && !!Object.keys(process.env).find((key) => key.includes("svelte"));
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detection/Next.mjs
function nextWebDetect() {
	return windowExists() && window.next && typeof window.next === "object";
}
function nextSSRDetect() {
	return globalExists() && (keyPrefixMatch(global, "__next") || keyPrefixMatch(global, "__NEXT"));
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detection/Nuxt.mjs
function nuxtWebDetect() {
	return windowExists() && (window.__NUXT__ !== void 0 || window.$nuxt !== void 0);
}
function nuxtSSRDetect() {
	return globalExists() && typeof global.__NUXT_PATHS__ !== "undefined";
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detection/Angular.mjs
function angularWebDetect() {
	const angularVersionSetInDocument = Boolean(documentExists() && document.querySelector("[ng-version]"));
	const angularContentSetInWindow = Boolean(windowExists() && typeof window.ng !== "undefined");
	return angularVersionSetInDocument || angularContentSetInWindow;
}
function angularSSRDetect() {
	return processExists() && typeof process.env === "object" && process.env.npm_lifecycle_script?.startsWith("ng ") || false;
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detection/ReactNative.mjs
function reactNativeDetect() {
	return typeof navigator !== "undefined" && typeof navigator.product !== "undefined" && navigator.product === "ReactNative";
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detection/Expo.mjs
function expoDetect() {
	return globalExists() && typeof global.expo !== "undefined";
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detection/Web.mjs
function webDetect() {
	return windowExists();
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detection/index.mjs
var detectionMap = [
	{
		platform: Framework.Expo,
		detectionMethod: expoDetect
	},
	{
		platform: Framework.ReactNative,
		detectionMethod: reactNativeDetect
	},
	{
		platform: Framework.NextJs,
		detectionMethod: nextWebDetect
	},
	{
		platform: Framework.Nuxt,
		detectionMethod: nuxtWebDetect
	},
	{
		platform: Framework.Angular,
		detectionMethod: angularWebDetect
	},
	{
		platform: Framework.React,
		detectionMethod: reactWebDetect
	},
	{
		platform: Framework.VueJs,
		detectionMethod: vueWebDetect
	},
	{
		platform: Framework.Svelte,
		detectionMethod: svelteWebDetect
	},
	{
		platform: Framework.WebUnknown,
		detectionMethod: webDetect
	},
	{
		platform: Framework.NextJsSSR,
		detectionMethod: nextSSRDetect
	},
	{
		platform: Framework.NuxtSSR,
		detectionMethod: nuxtSSRDetect
	},
	{
		platform: Framework.ReactSSR,
		detectionMethod: reactSSRDetect
	},
	{
		platform: Framework.VueJsSSR,
		detectionMethod: vueSSRDetect
	},
	{
		platform: Framework.AngularSSR,
		detectionMethod: angularSSRDetect
	},
	{
		platform: Framework.SvelteSSR,
		detectionMethod: svelteSSRDetect
	}
];
function detect() {
	return detectionMap.find((detectionEntry) => detectionEntry.detectionMethod())?.platform || Framework.ServerSideUnknown;
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/detectFramework.mjs
var frameworkCache;
var frameworkChangeObservers = [];
var resetTriggered = false;
var SSR_RESET_TIMEOUT = 10;
var WEB_RESET_TIMEOUT = 10;
var PRIME_FRAMEWORK_DELAY = 1e3;
var detectFramework = () => {
	if (!frameworkCache) {
		frameworkCache = detect();
		if (resetTriggered) while (frameworkChangeObservers.length) frameworkChangeObservers.pop()?.();
		else frameworkChangeObservers.forEach((fcn) => {
			fcn();
		});
		resetTimeout(Framework.ServerSideUnknown, SSR_RESET_TIMEOUT);
		resetTimeout(Framework.WebUnknown, WEB_RESET_TIMEOUT);
	}
	return frameworkCache;
};
/**
* @internal Setup observer callback that will be called everytime the framework changes
*/
var observeFrameworkChanges = (fcn) => {
	if (resetTriggered) return;
	frameworkChangeObservers.push(fcn);
};
function clearCache() {
	frameworkCache = void 0;
}
function resetTimeout(framework, delay) {
	if (frameworkCache === framework && !resetTriggered) setTimeout(() => {
		clearCache();
		resetTriggered = true;
		setTimeout(detectFramework, PRIME_FRAMEWORK_DELAY);
	}, delay);
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/customUserAgent.mjs
var customUserAgentState = {};
var getCustomUserAgent = (category, api) => customUserAgentState[category]?.[api]?.additionalDetails;
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Platform/index.mjs
var BASE_USER_AGENT = `aws-amplify`;
/** Sanitize Amplify version string be removing special character + and character post the special character  */
var sanitizeAmplifyVersion = (amplifyVersion) => amplifyVersion.replace(/\+.*/, "");
var PlatformBuilder = class {
	constructor() {
		this.userAgent = `${BASE_USER_AGENT}/${sanitizeAmplifyVersion(version)}`;
	}
	get framework() {
		return detectFramework();
	}
	get isReactNative() {
		return this.framework === Framework.ReactNative || this.framework === Framework.Expo;
	}
	observeFrameworkChanges(fcn) {
		observeFrameworkChanges(fcn);
	}
};
new PlatformBuilder();
var getAmplifyUserAgentObject = ({ category, action } = {}) => {
	const userAgent = [[BASE_USER_AGENT, sanitizeAmplifyVersion(version)]];
	if (category) userAgent.push([category, action]);
	userAgent.push(["framework", detectFramework()]);
	if (category && action) {
		const customState = getCustomUserAgent(category, action);
		if (customState) customState.forEach((state) => {
			userAgent.push(state);
		});
	}
	return userAgent;
};
var getAmplifyUserAgent = (customUserAgentDetails) => {
	return getAmplifyUserAgentObject(customUserAgentDetails).map(([agentKey, agentValue]) => agentKey && agentValue ? `${agentKey}/${agentValue}` : agentKey).join(" ");
};
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/isFunction.js
function isFunction(value) {
	return typeof value === "function";
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/createErrorClass.js
function createErrorClass(createImpl) {
	var _super = function(instance) {
		Error.call(instance);
		instance.stack = (/* @__PURE__ */ new Error()).stack;
	};
	var ctorFunc = createImpl(_super);
	ctorFunc.prototype = Object.create(Error.prototype);
	ctorFunc.prototype.constructor = ctorFunc;
	return ctorFunc;
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/UnsubscriptionError.js
var UnsubscriptionError = createErrorClass(function(_super) {
	return function UnsubscriptionErrorImpl(errors) {
		_super(this);
		this.message = errors ? errors.length + " errors occurred during unsubscription:\n" + errors.map(function(err, i) {
			return i + 1 + ") " + err.toString();
		}).join("\n  ") : "";
		this.name = "UnsubscriptionError";
		this.errors = errors;
	};
});
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/arrRemove.js
function arrRemove(arr, item) {
	if (arr) {
		var index = arr.indexOf(item);
		0 <= index && arr.splice(index, 1);
	}
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/Subscription.js
var Subscription = function() {
	function Subscription(initialTeardown) {
		this.initialTeardown = initialTeardown;
		this.closed = false;
		this._parentage = null;
		this._finalizers = null;
	}
	Subscription.prototype.unsubscribe = function() {
		var e_1, _a, e_2, _b;
		var errors;
		if (!this.closed) {
			this.closed = true;
			var _parentage = this._parentage;
			if (_parentage) {
				this._parentage = null;
				if (Array.isArray(_parentage)) try {
					for (var _parentage_1 = __values(_parentage), _parentage_1_1 = _parentage_1.next(); !_parentage_1_1.done; _parentage_1_1 = _parentage_1.next()) _parentage_1_1.value.remove(this);
				} catch (e_1_1) {
					e_1 = { error: e_1_1 };
				} finally {
					try {
						if (_parentage_1_1 && !_parentage_1_1.done && (_a = _parentage_1.return)) _a.call(_parentage_1);
					} finally {
						if (e_1) throw e_1.error;
					}
				}
				else _parentage.remove(this);
			}
			var initialFinalizer = this.initialTeardown;
			if (isFunction(initialFinalizer)) try {
				initialFinalizer();
			} catch (e) {
				errors = e instanceof UnsubscriptionError ? e.errors : [e];
			}
			var _finalizers = this._finalizers;
			if (_finalizers) {
				this._finalizers = null;
				try {
					for (var _finalizers_1 = __values(_finalizers), _finalizers_1_1 = _finalizers_1.next(); !_finalizers_1_1.done; _finalizers_1_1 = _finalizers_1.next()) {
						var finalizer = _finalizers_1_1.value;
						try {
							execFinalizer(finalizer);
						} catch (err) {
							errors = errors !== null && errors !== void 0 ? errors : [];
							if (err instanceof UnsubscriptionError) errors = __spreadArray(__spreadArray([], __read(errors)), __read(err.errors));
							else errors.push(err);
						}
					}
				} catch (e_2_1) {
					e_2 = { error: e_2_1 };
				} finally {
					try {
						if (_finalizers_1_1 && !_finalizers_1_1.done && (_b = _finalizers_1.return)) _b.call(_finalizers_1);
					} finally {
						if (e_2) throw e_2.error;
					}
				}
			}
			if (errors) throw new UnsubscriptionError(errors);
		}
	};
	Subscription.prototype.add = function(teardown) {
		var _a;
		if (teardown && teardown !== this) if (this.closed) execFinalizer(teardown);
		else {
			if (teardown instanceof Subscription) {
				if (teardown.closed || teardown._hasParent(this)) return;
				teardown._addParent(this);
			}
			(this._finalizers = (_a = this._finalizers) !== null && _a !== void 0 ? _a : []).push(teardown);
		}
	};
	Subscription.prototype._hasParent = function(parent) {
		var _parentage = this._parentage;
		return _parentage === parent || Array.isArray(_parentage) && _parentage.includes(parent);
	};
	Subscription.prototype._addParent = function(parent) {
		var _parentage = this._parentage;
		this._parentage = Array.isArray(_parentage) ? (_parentage.push(parent), _parentage) : _parentage ? [_parentage, parent] : parent;
	};
	Subscription.prototype._removeParent = function(parent) {
		var _parentage = this._parentage;
		if (_parentage === parent) this._parentage = null;
		else if (Array.isArray(_parentage)) arrRemove(_parentage, parent);
	};
	Subscription.prototype.remove = function(teardown) {
		var _finalizers = this._finalizers;
		_finalizers && arrRemove(_finalizers, teardown);
		if (teardown instanceof Subscription) teardown._removeParent(this);
	};
	Subscription.EMPTY = (function() {
		var empty = new Subscription();
		empty.closed = true;
		return empty;
	})();
	return Subscription;
}();
Subscription.EMPTY;
function isSubscription(value) {
	return value instanceof Subscription || value && "closed" in value && isFunction(value.remove) && isFunction(value.add) && isFunction(value.unsubscribe);
}
function execFinalizer(finalizer) {
	if (isFunction(finalizer)) finalizer();
	else finalizer.unsubscribe();
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/config.js
var config = {
	onUnhandledError: null,
	onStoppedNotification: null,
	Promise: void 0,
	useDeprecatedSynchronousErrorHandling: false,
	useDeprecatedNextContext: false
};
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/scheduler/timeoutProvider.js
var timeoutProvider = {
	setTimeout: function(handler, timeout) {
		var args = [];
		for (var _i = 2; _i < arguments.length; _i++) args[_i - 2] = arguments[_i];
		var delegate = timeoutProvider.delegate;
		if (delegate === null || delegate === void 0 ? void 0 : delegate.setTimeout) return delegate.setTimeout.apply(delegate, __spreadArray([handler, timeout], __read(args)));
		return setTimeout.apply(void 0, __spreadArray([handler, timeout], __read(args)));
	},
	clearTimeout: function(handle) {
		var delegate = timeoutProvider.delegate;
		return ((delegate === null || delegate === void 0 ? void 0 : delegate.clearTimeout) || clearTimeout)(handle);
	},
	delegate: void 0
};
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/reportUnhandledError.js
function reportUnhandledError(err) {
	timeoutProvider.setTimeout(function() {
		var onUnhandledError = config.onUnhandledError;
		if (onUnhandledError) onUnhandledError(err);
		else throw err;
	});
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/noop.js
function noop() {}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/NotificationFactories.js
var COMPLETE_NOTIFICATION = (function() {
	return createNotification("C", void 0, void 0);
})();
function errorNotification(error) {
	return createNotification("E", void 0, error);
}
function nextNotification(value) {
	return createNotification("N", value, void 0);
}
function createNotification(kind, value, error) {
	return {
		kind,
		value,
		error
	};
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/errorContext.js
var context = null;
function errorContext(cb) {
	if (config.useDeprecatedSynchronousErrorHandling) {
		var isRoot = !context;
		if (isRoot) context = {
			errorThrown: false,
			error: null
		};
		cb();
		if (isRoot) {
			var _a = context, errorThrown = _a.errorThrown, error = _a.error;
			context = null;
			if (errorThrown) throw error;
		}
	} else cb();
}
function captureError(err) {
	if (config.useDeprecatedSynchronousErrorHandling && context) {
		context.errorThrown = true;
		context.error = err;
	}
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/Subscriber.js
var Subscriber = function(_super) {
	__extends(Subscriber, _super);
	function Subscriber(destination) {
		var _this = _super.call(this) || this;
		_this.isStopped = false;
		if (destination) {
			_this.destination = destination;
			if (isSubscription(destination)) destination.add(_this);
		} else _this.destination = EMPTY_OBSERVER;
		return _this;
	}
	Subscriber.create = function(next, error, complete) {
		return new SafeSubscriber(next, error, complete);
	};
	Subscriber.prototype.next = function(value) {
		if (this.isStopped) handleStoppedNotification(nextNotification(value), this);
		else this._next(value);
	};
	Subscriber.prototype.error = function(err) {
		if (this.isStopped) handleStoppedNotification(errorNotification(err), this);
		else {
			this.isStopped = true;
			this._error(err);
		}
	};
	Subscriber.prototype.complete = function() {
		if (this.isStopped) handleStoppedNotification(COMPLETE_NOTIFICATION, this);
		else {
			this.isStopped = true;
			this._complete();
		}
	};
	Subscriber.prototype.unsubscribe = function() {
		if (!this.closed) {
			this.isStopped = true;
			_super.prototype.unsubscribe.call(this);
			this.destination = null;
		}
	};
	Subscriber.prototype._next = function(value) {
		this.destination.next(value);
	};
	Subscriber.prototype._error = function(err) {
		try {
			this.destination.error(err);
		} finally {
			this.unsubscribe();
		}
	};
	Subscriber.prototype._complete = function() {
		try {
			this.destination.complete();
		} finally {
			this.unsubscribe();
		}
	};
	return Subscriber;
}(Subscription);
var _bind = Function.prototype.bind;
function bind(fn, thisArg) {
	return _bind.call(fn, thisArg);
}
var ConsumerObserver = function() {
	function ConsumerObserver(partialObserver) {
		this.partialObserver = partialObserver;
	}
	ConsumerObserver.prototype.next = function(value) {
		var partialObserver = this.partialObserver;
		if (partialObserver.next) try {
			partialObserver.next(value);
		} catch (error) {
			handleUnhandledError(error);
		}
	};
	ConsumerObserver.prototype.error = function(err) {
		var partialObserver = this.partialObserver;
		if (partialObserver.error) try {
			partialObserver.error(err);
		} catch (error) {
			handleUnhandledError(error);
		}
		else handleUnhandledError(err);
	};
	ConsumerObserver.prototype.complete = function() {
		var partialObserver = this.partialObserver;
		if (partialObserver.complete) try {
			partialObserver.complete();
		} catch (error) {
			handleUnhandledError(error);
		}
	};
	return ConsumerObserver;
}();
var SafeSubscriber = function(_super) {
	__extends(SafeSubscriber, _super);
	function SafeSubscriber(observerOrNext, error, complete) {
		var _this = _super.call(this) || this;
		var partialObserver;
		if (isFunction(observerOrNext) || !observerOrNext) partialObserver = {
			next: observerOrNext !== null && observerOrNext !== void 0 ? observerOrNext : void 0,
			error: error !== null && error !== void 0 ? error : void 0,
			complete: complete !== null && complete !== void 0 ? complete : void 0
		};
		else {
			var context_1;
			if (_this && config.useDeprecatedNextContext) {
				context_1 = Object.create(observerOrNext);
				context_1.unsubscribe = function() {
					return _this.unsubscribe();
				};
				partialObserver = {
					next: observerOrNext.next && bind(observerOrNext.next, context_1),
					error: observerOrNext.error && bind(observerOrNext.error, context_1),
					complete: observerOrNext.complete && bind(observerOrNext.complete, context_1)
				};
			} else partialObserver = observerOrNext;
		}
		_this.destination = new ConsumerObserver(partialObserver);
		return _this;
	}
	return SafeSubscriber;
}(Subscriber);
function handleUnhandledError(error) {
	if (config.useDeprecatedSynchronousErrorHandling) captureError(error);
	else reportUnhandledError(error);
}
function defaultErrorHandler(err) {
	throw err;
}
function handleStoppedNotification(notification, subscriber) {
	var onStoppedNotification = config.onStoppedNotification;
	onStoppedNotification && timeoutProvider.setTimeout(function() {
		return onStoppedNotification(notification, subscriber);
	});
}
var EMPTY_OBSERVER = {
	closed: true,
	next: noop,
	error: defaultErrorHandler,
	complete: noop
};
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/symbol/observable.js
var observable = (function() {
	return typeof Symbol === "function" && Symbol.observable || "@@observable";
})();
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/identity.js
function identity(x) {
	return x;
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/pipe.js
function pipeFromArray(fns) {
	if (fns.length === 0) return identity;
	if (fns.length === 1) return fns[0];
	return function piped(input) {
		return fns.reduce(function(prev, fn) {
			return fn(prev);
		}, input);
	};
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/Observable.js
var Observable = function() {
	function Observable(subscribe) {
		if (subscribe) this._subscribe = subscribe;
	}
	Observable.prototype.lift = function(operator) {
		var observable = new Observable();
		observable.source = this;
		observable.operator = operator;
		return observable;
	};
	Observable.prototype.subscribe = function(observerOrNext, error, complete) {
		var _this = this;
		var subscriber = isSubscriber(observerOrNext) ? observerOrNext : new SafeSubscriber(observerOrNext, error, complete);
		errorContext(function() {
			var _a = _this, operator = _a.operator, source = _a.source;
			subscriber.add(operator ? operator.call(subscriber, source) : source ? _this._subscribe(subscriber) : _this._trySubscribe(subscriber));
		});
		return subscriber;
	};
	Observable.prototype._trySubscribe = function(sink) {
		try {
			return this._subscribe(sink);
		} catch (err) {
			sink.error(err);
		}
	};
	Observable.prototype.forEach = function(next, promiseCtor) {
		var _this = this;
		promiseCtor = getPromiseCtor(promiseCtor);
		return new promiseCtor(function(resolve, reject) {
			var subscriber = new SafeSubscriber({
				next: function(value) {
					try {
						next(value);
					} catch (err) {
						reject(err);
						subscriber.unsubscribe();
					}
				},
				error: reject,
				complete: resolve
			});
			_this.subscribe(subscriber);
		});
	};
	Observable.prototype._subscribe = function(subscriber) {
		var _a;
		return (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber);
	};
	Observable.prototype[observable] = function() {
		return this;
	};
	Observable.prototype.pipe = function() {
		var operations = [];
		for (var _i = 0; _i < arguments.length; _i++) operations[_i] = arguments[_i];
		return pipeFromArray(operations)(this);
	};
	Observable.prototype.toPromise = function(promiseCtor) {
		var _this = this;
		promiseCtor = getPromiseCtor(promiseCtor);
		return new promiseCtor(function(resolve, reject) {
			var value;
			_this.subscribe(function(x) {
				return value = x;
			}, function(err) {
				return reject(err);
			}, function() {
				return resolve(value);
			});
		});
	};
	Observable.create = function(subscribe) {
		return new Observable(subscribe);
	};
	return Observable;
}();
function getPromiseCtor(promiseCtor) {
	var _a;
	return (_a = promiseCtor !== null && promiseCtor !== void 0 ? promiseCtor : config.Promise) !== null && _a !== void 0 ? _a : Promise;
}
function isObserver(value) {
	return value && isFunction(value.next) && isFunction(value.error) && isFunction(value.complete);
}
function isSubscriber(value) {
	return value && value instanceof Subscriber || isObserver(value) && isSubscription(value);
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/lift.js
function hasLift(source) {
	return isFunction(source === null || source === void 0 ? void 0 : source.lift);
}
function operate(init) {
	return function(source) {
		if (hasLift(source)) return source.lift(function(liftedSource) {
			try {
				return init(liftedSource, this);
			} catch (err) {
				this.error(err);
			}
		});
		throw new TypeError("Unable to lift unknown Observable type");
	};
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/operators/OperatorSubscriber.js
function createOperatorSubscriber(destination, onNext, onComplete, onError, onFinalize) {
	return new OperatorSubscriber(destination, onNext, onComplete, onError, onFinalize);
}
var OperatorSubscriber = function(_super) {
	__extends(OperatorSubscriber, _super);
	function OperatorSubscriber(destination, onNext, onComplete, onError, onFinalize, shouldUnsubscribe) {
		var _this = _super.call(this, destination) || this;
		_this.onFinalize = onFinalize;
		_this.shouldUnsubscribe = shouldUnsubscribe;
		_this._next = onNext ? function(value) {
			try {
				onNext(value);
			} catch (err) {
				destination.error(err);
			}
		} : _super.prototype._next;
		_this._error = onError ? function(err) {
			try {
				onError(err);
			} catch (err) {
				destination.error(err);
			} finally {
				this.unsubscribe();
			}
		} : _super.prototype._error;
		_this._complete = onComplete ? function() {
			try {
				onComplete();
			} catch (err) {
				destination.error(err);
			} finally {
				this.unsubscribe();
			}
		} : _super.prototype._complete;
		return _this;
	}
	OperatorSubscriber.prototype.unsubscribe = function() {
		var _a;
		if (!this.shouldUnsubscribe || this.shouldUnsubscribe()) {
			var closed_1 = this.closed;
			_super.prototype.unsubscribe.call(this);
			!closed_1 && ((_a = this.onFinalize) === null || _a === void 0 || _a.call(this));
		}
	};
	return OperatorSubscriber;
}(Subscriber);
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/isArrayLike.js
var isArrayLike = (function(x) {
	return x && typeof x.length === "number" && typeof x !== "function";
});
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/isPromise.js
function isPromise(value) {
	return isFunction(value === null || value === void 0 ? void 0 : value.then);
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/isInteropObservable.js
function isInteropObservable(input) {
	return isFunction(input[observable]);
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/isAsyncIterable.js
function isAsyncIterable(obj) {
	return Symbol.asyncIterator && isFunction(obj === null || obj === void 0 ? void 0 : obj[Symbol.asyncIterator]);
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/throwUnobservableError.js
function createInvalidObservableTypeError(input) {
	return /* @__PURE__ */ new TypeError("You provided " + (input !== null && typeof input === "object" ? "an invalid object" : "'" + input + "'") + " where a stream was expected. You can provide an Observable, Promise, ReadableStream, Array, AsyncIterable, or Iterable.");
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/symbol/iterator.js
function getSymbolIterator() {
	if (typeof Symbol !== "function" || !Symbol.iterator) return "@@iterator";
	return Symbol.iterator;
}
var iterator = getSymbolIterator();
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/isIterable.js
function isIterable(input) {
	return isFunction(input === null || input === void 0 ? void 0 : input[iterator]);
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/isReadableStreamLike.js
function readableStreamLikeToAsyncGenerator(readableStream) {
	return __asyncGenerator(this, arguments, function readableStreamLikeToAsyncGenerator_1() {
		var reader, _a, value, done;
		return __generator(this, function(_b) {
			switch (_b.label) {
				case 0:
					reader = readableStream.getReader();
					_b.label = 1;
				case 1:
					_b.trys.push([
						1,
						,
						9,
						10
					]);
					_b.label = 2;
				case 2: return [4, __await(reader.read())];
				case 3:
					_a = _b.sent(), value = _a.value, done = _a.done;
					if (!done) return [3, 5];
					return [4, __await(void 0)];
				case 4: return [2, _b.sent()];
				case 5: return [4, __await(value)];
				case 6: return [4, _b.sent()];
				case 7:
					_b.sent();
					return [3, 2];
				case 8: return [3, 10];
				case 9:
					reader.releaseLock();
					return [7];
				case 10: return [2];
			}
		});
	});
}
function isReadableStreamLike(obj) {
	return isFunction(obj === null || obj === void 0 ? void 0 : obj.getReader);
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/observable/innerFrom.js
function innerFrom(input) {
	if (input instanceof Observable) return input;
	if (input != null) {
		if (isInteropObservable(input)) return fromInteropObservable(input);
		if (isArrayLike(input)) return fromArrayLike(input);
		if (isPromise(input)) return fromPromise(input);
		if (isAsyncIterable(input)) return fromAsyncIterable(input);
		if (isIterable(input)) return fromIterable(input);
		if (isReadableStreamLike(input)) return fromReadableStreamLike(input);
	}
	throw createInvalidObservableTypeError(input);
}
function fromInteropObservable(obj) {
	return new Observable(function(subscriber) {
		var obs = obj[observable]();
		if (isFunction(obs.subscribe)) return obs.subscribe(subscriber);
		throw new TypeError("Provided object does not correctly implement Symbol.observable");
	});
}
function fromArrayLike(array) {
	return new Observable(function(subscriber) {
		for (var i = 0; i < array.length && !subscriber.closed; i++) subscriber.next(array[i]);
		subscriber.complete();
	});
}
function fromPromise(promise) {
	return new Observable(function(subscriber) {
		promise.then(function(value) {
			if (!subscriber.closed) {
				subscriber.next(value);
				subscriber.complete();
			}
		}, function(err) {
			return subscriber.error(err);
		}).then(null, reportUnhandledError);
	});
}
function fromIterable(iterable) {
	return new Observable(function(subscriber) {
		var e_1, _a;
		try {
			for (var iterable_1 = __values(iterable), iterable_1_1 = iterable_1.next(); !iterable_1_1.done; iterable_1_1 = iterable_1.next()) {
				var value = iterable_1_1.value;
				subscriber.next(value);
				if (subscriber.closed) return;
			}
		} catch (e_1_1) {
			e_1 = { error: e_1_1 };
		} finally {
			try {
				if (iterable_1_1 && !iterable_1_1.done && (_a = iterable_1.return)) _a.call(iterable_1);
			} finally {
				if (e_1) throw e_1.error;
			}
		}
		subscriber.complete();
	});
}
function fromAsyncIterable(asyncIterable) {
	return new Observable(function(subscriber) {
		process$1(asyncIterable, subscriber).catch(function(err) {
			return subscriber.error(err);
		});
	});
}
function fromReadableStreamLike(readableStream) {
	return fromAsyncIterable(readableStreamLikeToAsyncGenerator(readableStream));
}
function process$1(asyncIterable, subscriber) {
	var asyncIterable_1, asyncIterable_1_1;
	var e_2, _a;
	return __awaiter(this, void 0, void 0, function() {
		var value, e_2_1;
		return __generator(this, function(_b) {
			switch (_b.label) {
				case 0:
					_b.trys.push([
						0,
						5,
						6,
						11
					]);
					asyncIterable_1 = __asyncValues(asyncIterable);
					_b.label = 1;
				case 1: return [4, asyncIterable_1.next()];
				case 2:
					if (!(asyncIterable_1_1 = _b.sent(), !asyncIterable_1_1.done)) return [3, 4];
					value = asyncIterable_1_1.value;
					subscriber.next(value);
					if (subscriber.closed) return [2];
					_b.label = 3;
				case 3: return [3, 1];
				case 4: return [3, 11];
				case 5:
					e_2_1 = _b.sent();
					e_2 = { error: e_2_1 };
					return [3, 11];
				case 6:
					_b.trys.push([
						6,
						,
						9,
						10
					]);
					if (!(asyncIterable_1_1 && !asyncIterable_1_1.done && (_a = asyncIterable_1.return))) return [3, 8];
					return [4, _a.call(asyncIterable_1)];
				case 7:
					_b.sent();
					_b.label = 8;
				case 8: return [3, 10];
				case 9:
					if (e_2) throw e_2.error;
					return [7];
				case 10: return [7];
				case 11:
					subscriber.complete();
					return [2];
			}
		});
	});
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/util/executeSchedule.js
function executeSchedule(parentSubscription, scheduler, work, delay, repeat) {
	if (delay === void 0) delay = 0;
	if (repeat === void 0) repeat = false;
	var scheduleSubscription = scheduler.schedule(function() {
		work();
		if (repeat) parentSubscription.add(this.schedule(null, delay));
		else this.unsubscribe();
	}, delay);
	parentSubscription.add(scheduleSubscription);
	if (!repeat) return scheduleSubscription;
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/operators/observeOn.js
function observeOn(scheduler, delay) {
	if (delay === void 0) delay = 0;
	return operate(function(source, subscriber) {
		source.subscribe(createOperatorSubscriber(subscriber, function(value) {
			return executeSchedule(subscriber, scheduler, function() {
				return subscriber.next(value);
			}, delay);
		}, function() {
			return executeSchedule(subscriber, scheduler, function() {
				return subscriber.complete();
			}, delay);
		}, function(err) {
			return executeSchedule(subscriber, scheduler, function() {
				return subscriber.error(err);
			}, delay);
		}));
	});
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/operators/subscribeOn.js
function subscribeOn(scheduler, delay) {
	if (delay === void 0) delay = 0;
	return operate(function(source, subscriber) {
		subscriber.add(scheduler.schedule(function() {
			return source.subscribe(subscriber);
		}, delay));
	});
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/scheduled/scheduleObservable.js
function scheduleObservable(input, scheduler) {
	return innerFrom(input).pipe(subscribeOn(scheduler), observeOn(scheduler));
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/scheduled/schedulePromise.js
function schedulePromise(input, scheduler) {
	return innerFrom(input).pipe(subscribeOn(scheduler), observeOn(scheduler));
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/scheduled/scheduleArray.js
function scheduleArray(input, scheduler) {
	return new Observable(function(subscriber) {
		var i = 0;
		return scheduler.schedule(function() {
			if (i === input.length) subscriber.complete();
			else {
				subscriber.next(input[i++]);
				if (!subscriber.closed) this.schedule();
			}
		});
	});
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/scheduled/scheduleIterable.js
function scheduleIterable(input, scheduler) {
	return new Observable(function(subscriber) {
		var iterator$1;
		executeSchedule(subscriber, scheduler, function() {
			iterator$1 = input[iterator]();
			executeSchedule(subscriber, scheduler, function() {
				var _a;
				var value;
				var done;
				try {
					_a = iterator$1.next(), value = _a.value, done = _a.done;
				} catch (err) {
					subscriber.error(err);
					return;
				}
				if (done) subscriber.complete();
				else subscriber.next(value);
			}, 0, true);
		});
		return function() {
			return isFunction(iterator$1 === null || iterator$1 === void 0 ? void 0 : iterator$1.return) && iterator$1.return();
		};
	});
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/scheduled/scheduleAsyncIterable.js
function scheduleAsyncIterable(input, scheduler) {
	if (!input) throw new Error("Iterable cannot be null");
	return new Observable(function(subscriber) {
		executeSchedule(subscriber, scheduler, function() {
			var iterator = input[Symbol.asyncIterator]();
			executeSchedule(subscriber, scheduler, function() {
				iterator.next().then(function(result) {
					if (result.done) subscriber.complete();
					else subscriber.next(result.value);
				});
			}, 0, true);
		});
	});
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/scheduled/scheduleReadableStreamLike.js
function scheduleReadableStreamLike(input, scheduler) {
	return scheduleAsyncIterable(readableStreamLikeToAsyncGenerator(input), scheduler);
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/scheduled/scheduled.js
function scheduled(input, scheduler) {
	if (input != null) {
		if (isInteropObservable(input)) return scheduleObservable(input, scheduler);
		if (isArrayLike(input)) return scheduleArray(input, scheduler);
		if (isPromise(input)) return schedulePromise(input, scheduler);
		if (isAsyncIterable(input)) return scheduleAsyncIterable(input, scheduler);
		if (isIterable(input)) return scheduleIterable(input, scheduler);
		if (isReadableStreamLike(input)) return scheduleReadableStreamLike(input, scheduler);
	}
	throw createInvalidObservableTypeError(input);
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/observable/from.js
function from(input, scheduler) {
	return scheduler ? scheduled(input, scheduler) : innerFrom(input);
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/isWebWorker.mjs
var isWebWorker = () => {
	if (typeof self === "undefined") return false;
	const selfContext = self;
	return typeof selfContext.WorkerGlobalScope !== "undefined" && self instanceof selfContext.WorkerGlobalScope;
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Reachability/Reachability.mjs
var Reachability = class Reachability {
	networkMonitor(_) {
		const globalObj = isWebWorker() ? self : typeof window !== "undefined" && window;
		if (!globalObj) return from([{ online: true }]);
		return new Observable((observer) => {
			observer.next({ online: globalObj.navigator.onLine });
			const notifyOnline = () => {
				observer.next({ online: true });
			};
			const notifyOffline = () => {
				observer.next({ online: false });
			};
			globalObj.addEventListener("online", notifyOnline);
			globalObj.addEventListener("offline", notifyOffline);
			Reachability._observers.push(observer);
			return () => {
				globalObj.removeEventListener("online", notifyOnline);
				globalObj.removeEventListener("offline", notifyOffline);
				Reachability._observers = Reachability._observers.filter((_observer) => _observer !== observer);
			};
		});
	}
	static _observerOverride(status) {
		for (const observer of this._observers) {
			if (observer.closed) {
				this._observers = this._observers.filter((_observer) => _observer !== observer);
				continue;
			}
			observer?.next && observer.next(status);
		}
	}
};
Reachability._observers = [];
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/singleton/Auth/index.mjs
var logger$5 = new ConsoleLogger("Auth");
var AuthClass = class {
	/**
	* Configure Auth category
	*
	* @internal
	*
	* @param authResourcesConfig - Resources configurations required by Auth providers.
	* @param authOptions - Client options used by library
	*
	* @returns void
	*/
	configure(authResourcesConfig, authOptions) {
		this.authConfig = authResourcesConfig;
		this.authOptions = authOptions;
		if (authResourcesConfig && authResourcesConfig.Cognito?.userPoolEndpoint) logger$5.warn(getCustomEndpointWarningMessage("Amazon Cognito User Pool"));
		if (authResourcesConfig && authResourcesConfig.Cognito?.identityPoolEndpoint) logger$5.warn(getCustomEndpointWarningMessage("Amazon Cognito Identity Pool"));
	}
	/**
	* Fetch the auth tokens, and the temporary AWS credentials and identity if they are configured. By default it
	* will automatically refresh expired auth tokens if a valid refresh token is present. You can force a refresh
	* of non-expired tokens with `{ forceRefresh: true }` input.
	*
	* @param options - Options configuring the fetch behavior.
	*
	* @returns Promise of current auth session {@link AuthSession}.
	*/
	async fetchAuthSession(options = {}) {
		let credentialsAndIdentityId;
		let userSub;
		const tokens = await this.getTokens(options);
		if (tokens) {
			userSub = tokens.accessToken?.payload?.sub;
			credentialsAndIdentityId = await this.authOptions?.credentialsProvider?.getCredentialsAndIdentityId({
				authConfig: this.authConfig,
				tokens,
				authenticated: true,
				forceRefresh: options.forceRefresh
			});
		} else credentialsAndIdentityId = await this.authOptions?.credentialsProvider?.getCredentialsAndIdentityId({
			authConfig: this.authConfig,
			authenticated: false,
			forceRefresh: options.forceRefresh
		});
		return {
			tokens,
			credentials: credentialsAndIdentityId?.credentials,
			identityId: credentialsAndIdentityId?.identityId,
			userSub
		};
	}
	async clearCredentials() {
		await this.authOptions?.credentialsProvider?.clearCredentialsAndIdentityId();
	}
	async getTokens(options) {
		return await this.authOptions?.tokenProvider?.getTokens(options) ?? void 0;
	}
};
var getCustomEndpointWarningMessage = (target) => `You are using a custom Amazon ${target} endpoint, ensure the endpoint is correct.`;
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/singleton/Amplify.mjs
var AmplifyClass = class {
	constructor() {
		this.oAuthListener = void 0;
		this.isConfigured = false;
		this.resourcesConfig = {};
		this.libraryOptions = {};
		this.Auth = new AuthClass();
	}
	/**
	* Configures Amplify for use with your back-end resources.
	*
	* @remarks
	* This API does not perform any merging of either `resourcesConfig` or `libraryOptions`. The most recently
	* provided values will be used after configuration.
	*
	* @remarks
	* `configure` can be used to specify additional library options where available for supported categories.
	*
	* @param resourceConfig - Back-end resource configuration. Typically provided via the `aws-exports.js` file.
	* @param libraryOptions - Additional options for customizing the behavior of the library.
	*/
	configure(resourcesConfig, libraryOptions) {
		this.resourcesConfig = parseAmplifyConfig(resourcesConfig);
		if (libraryOptions) this.libraryOptions = libraryOptions;
		this.resourcesConfig = deepFreeze(this.resourcesConfig);
		this.Auth.configure(this.resourcesConfig.Auth, this.libraryOptions.Auth);
		if (this.resourcesConfig.Analytics?.Pinpoint || this.resourcesConfig.Notifications?.InAppMessaging?.Pinpoint || this.resourcesConfig.Notifications?.PushNotification?.Pinpoint) console.warn("AWS will end support for Amazon Pinpoint on October 30, 2026. The guidance is to use AWS End User Messaging for push notifications and SMS, Amazon Simple Email Service for sending emails, Amazon Connect for campaigns, journeys, endpoints, and engagement analytics. Pinpoint recommends Amazon Kinesis for event collection and mobile analytics.");
		Hub.dispatch("core", {
			event: "configure",
			data: this.resourcesConfig
		}, "Configure", AMPLIFY_SYMBOL);
		this.notifyOAuthListener();
		this.isConfigured = true;
	}
	/**
	* Provides access to the current back-end resource configuration for the Library.
	*
	* @returns Returns the immutable back-end resource configuration.
	*/
	getConfig() {
		if (!this.isConfigured) console.warn(`Amplify has not been configured. Please call Amplify.configure() before using this service.`);
		return this.resourcesConfig;
	}
	/** @internal */
	[ADD_OAUTH_LISTENER](listener) {
		if (this.resourcesConfig.Auth?.Cognito.loginWith?.oauth) listener(this.resourcesConfig.Auth?.Cognito);
		else this.oAuthListener = listener;
	}
	notifyOAuthListener() {
		if (!this.resourcesConfig.Auth?.Cognito.loginWith?.oauth || !this.oAuthListener) return;
		this.oAuthListener(this.resourcesConfig.Auth?.Cognito);
		this.oAuthListener = void 0;
	}
};
/**
* The `Amplify` utility is used to configure the library.
*
* @remarks
* `Amplify` orchestrates cross-category communication within the library.
*/
var Amplify = new AmplifyClass();
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/singleton/apis/internal/fetchAuthSession.mjs
var fetchAuthSession$1 = (amplify, options) => {
	return amplify.Auth.fetchAuthSession(options);
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/singleton/apis/fetchAuthSession.mjs
/**
* Fetch the auth session including the tokens and credentials if they are available. By default it
* will automatically refresh expired auth tokens if a valid refresh token is present. You can force a refresh
* of non-expired tokens with `{ forceRefresh: true }` input.
*
* @param options - Options configuring the fetch behavior.
* @throws {@link AuthError} - Throws error when session information cannot be refreshed.
* @returns Promise<AuthSession>
*/
var fetchAuthSession = (options) => {
	return fetchAuthSession$1(Amplify, options);
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/singleton/apis/clearCredentials.mjs
function clearCredentials() {
	return Amplify.Auth.clearCredentials();
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/serde/responseInfo.mjs
var parseMetadata = (response) => {
	const { headers, statusCode } = response;
	return {
		...isMetadataBearer(response) ? response.$metadata : {},
		httpStatusCode: statusCode,
		requestId: headers["x-amzn-requestid"] ?? headers["x-amzn-request-id"] ?? headers["x-amz-request-id"],
		extendedRequestId: headers["x-amz-id-2"],
		cfId: headers["x-amz-cf-id"]
	};
};
var isMetadataBearer = (response) => typeof response?.$metadata === "object";
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/serde/json.mjs
/**
* Utility functions for serializing and deserializing of JSON protocol in general(including: REST-JSON, JSON-RPC, etc.)
*/
/**
* Error parser for AWS JSON protocol.
*/
var parseJsonError = async (response) => {
	if (!response || response.statusCode < 300) return;
	const body = await parseJsonBody(response);
	const sanitizeErrorCode = (rawValue) => {
		const [cleanValue] = rawValue.toString().split(/[,:]+/);
		if (cleanValue.includes("#")) return cleanValue.split("#")[1];
		return cleanValue;
	};
	const code = sanitizeErrorCode(response.headers["x-amzn-errortype"] ?? body.code ?? body.__type ?? "UnknownError");
	const message = body.message ?? body.Message ?? "Unknown error";
	const error = new Error(message);
	return Object.assign(error, {
		name: code,
		$metadata: parseMetadata(response)
	});
};
/**
* Parse JSON response body to JavaScript object.
*/
var parseJsonBody = async (response) => {
	if (!response.body) throw new Error("Missing response payload");
	const output = await response.body.json();
	return Object.assign(output, { $metadata: parseMetadata(response) });
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/internal/composeServiceApi.mjs
/**
* Compose a service API handler that accepts input as defined shape and responds conforming to defined output shape.
* A service API handler is composed with:
* * A transfer handler
* * A serializer function
* * A deserializer function
* * A default config object
*
* The returned service API handler, when called, will trigger the following workflow:
* 1. When calling the service API handler function, the default config object is merged into the input config
* object to assign the default values of some omitted configs, resulting to a resolved config object.
* 2. The `endpointResolver` function from the default config object will be invoked with the resolved config object and
* API input object resulting to an endpoint instance.
* 3. The serializer function is invoked with API input object and the endpoint instance resulting to an HTTP request
* instance.
* 4. The HTTP request instance and the resolved config object is passed to the transfer handler function.
* 5. The transfer handler function resolves to an HTTP response instance(can be either successful or failed status code).
* 6. The deserializer function is invoked with the HTTP response instance resulting to the API output object, and
* return to the caller.
*
*
* @param transferHandler Async function for dispatching HTTP requests and returning HTTP response.
* @param serializer  Async function for converting object in defined input shape into HTTP request targeting a given
* 	endpoint.
* @param deserializer Async function for converting HTTP response into output object in defined output shape, or error
* 	shape.
* @param defaultConfig  object containing default options to be consumed by transfer handler, serializer and
*  deserializer.
* @returns a async service API handler function that accepts a config object and input object in defined shape, returns
* 	an output object in defined shape. It may also throw error instance in defined shape in deserializer. The config
*  object type is composed with options type of transferHandler, endpointResolver function as well as endpointResolver
*  function's input options type, region string. The config object property will be marked as optional if it's also
* 	defined in defaultConfig.
*
* @internal
*/
var composeServiceApi = (transferHandler, serializer, deserializer, defaultConfig) => {
	return async (config, input) => {
		const resolvedConfig = {
			...defaultConfig,
			...config
		};
		return deserializer(await transferHandler(await serializer(input, await resolvedConfig.endpointResolver(resolvedConfig, input)), { ...resolvedConfig }));
	};
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/retry/constants.mjs
var MAX_DELAY_MS = 300 * 1e3;
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/retry/jitteredBackoff.mjs
/**
* @private
* Internal use of Amplify only
*/
function jitteredBackoff$1(maxDelayMs = MAX_DELAY_MS) {
	const BASE_TIME_MS = 100;
	const JITTER_FACTOR = 100;
	return (attempt) => {
		const delay = 2 ** attempt * BASE_TIME_MS + JITTER_FACTOR * Math.random();
		return delay > maxDelayMs ? false : delay;
	};
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/retry/constants.mjs
var AMZ_SDK_INVOCATION_ID_HEADER = "amz-sdk-invocation-id";
var AMZ_SDK_REQUEST_HEADER = "amz-sdk-request";
var DEFAULT_MAX_DELAY_MS = 300 * 1e3;
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/retry/jitteredBackoff.mjs
var jitteredBackoff = (attempt) => {
	const delay = jitteredBackoff$1(DEFAULT_MAX_DELAY_MS)(attempt);
	return delay === false ? DEFAULT_MAX_DELAY_MS : delay;
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/retry/isClockSkewError.mjs
var CLOCK_SKEW_ERROR_CODES = [
	"AuthFailure",
	"InvalidSignatureException",
	"RequestExpired",
	"RequestInTheFuture",
	"RequestTimeTooSkewed",
	"SignatureDoesNotMatch",
	"BadRequestException"
];
/**
* Given an error code, returns true if it is related to a clock skew error.
*
* @param errorCode String representation of some error.
* @returns True if given error is present in `CLOCK_SKEW_ERROR_CODES`, false otherwise.
*
* @internal
*/
var isClockSkewError = (errorCode) => !!errorCode && CLOCK_SKEW_ERROR_CODES.includes(errorCode);
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/retry/defaultRetryDecider.mjs
/**
* Get retry decider function
* @param errorParser Function to load JavaScript error from HTTP response
*/
var getRetryDecider = (errorParser) => async (response, error) => {
	const parsedError = error ?? await errorParser(response) ?? void 0;
	const errorCode = parsedError?.code || parsedError?.name;
	const statusCode = response?.statusCode;
	return { retryable: isConnectionError(error) || isThrottlingError(statusCode, errorCode) || isClockSkewError(errorCode) || isServerSideError(statusCode, errorCode) };
};
var THROTTLING_ERROR_CODES = [
	"BandwidthLimitExceeded",
	"EC2ThrottledException",
	"LimitExceededException",
	"PriorRequestNotComplete",
	"ProvisionedThroughputExceededException",
	"RequestLimitExceeded",
	"RequestThrottled",
	"RequestThrottledException",
	"SlowDown",
	"ThrottledException",
	"Throttling",
	"ThrottlingException",
	"TooManyRequestsException"
];
var TIMEOUT_ERROR_CODES = [
	"TimeoutError",
	"RequestTimeout",
	"RequestTimeoutException"
];
var isThrottlingError = (statusCode, errorCode) => statusCode === 429 || !!errorCode && THROTTLING_ERROR_CODES.includes(errorCode);
var isConnectionError = (error) => [AmplifyErrorCode.NetworkError, "ERR_NETWORK"].includes(error?.name);
var isServerSideError = (statusCode, errorCode) => !!statusCode && [
	500,
	502,
	503,
	504
].includes(statusCode) || !!errorCode && TIMEOUT_ERROR_CODES.includes(errorCode);
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/foundation/factories/serviceClients/cognitoIdentity/constants.mjs
/**
* The service name used to sign requests if the API requires authentication.
*/
var COGNITO_IDENTITY_SERVICE_NAME = "cognito-identity";
var DEFAULT_SERVICE_CLIENT_API_CONFIG = {
	service: COGNITO_IDENTITY_SERVICE_NAME,
	retryDecider: getRetryDecider(parseJsonError),
	computeDelay: jitteredBackoff,
	cache: "no-store"
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/retry/retryMiddleware.mjs
/**
* Middleware that executes the retry logic.
*/
var retryMiddlewareFactory = ({ maxAttempts = 3, retryDecider, computeDelay, abortSignal }) => {
	if (maxAttempts < 1) throw new Error("maxAttempts must be greater than 0");
	return (next, context) => async function retryMiddleware(request) {
		let error;
		let attemptsCount = context.attemptsCount ?? 0;
		let response;
		const handleTerminalErrorOrResponse = () => {
			if (response) {
				addOrIncrementMetadataAttempts(response, attemptsCount);
				return response;
			} else {
				addOrIncrementMetadataAttempts(error, attemptsCount);
				throw error;
			}
		};
		while (!abortSignal?.aborted && attemptsCount < maxAttempts) {
			try {
				response = await next(request);
				error = void 0;
			} catch (e) {
				error = e;
				response = void 0;
			}
			attemptsCount = (context.attemptsCount ?? 0) > attemptsCount ? context.attemptsCount ?? 0 : attemptsCount + 1;
			context.attemptsCount = attemptsCount;
			const { isCredentialsExpiredError, retryable } = await retryDecider(response, error, context);
			if (retryable) {
				context.isCredentialsExpired = !!isCredentialsExpiredError;
				if (!abortSignal?.aborted && attemptsCount < maxAttempts) await cancellableSleep(computeDelay(attemptsCount), abortSignal);
				continue;
			} else return handleTerminalErrorOrResponse();
		}
		if (abortSignal?.aborted) throw new Error("Request aborted.");
		else return handleTerminalErrorOrResponse();
	};
};
var cancellableSleep = (timeoutMs, abortSignal) => {
	if (abortSignal?.aborted) return Promise.resolve();
	let timeoutId;
	let sleepPromiseResolveFn;
	const sleepPromise = new Promise((resolve) => {
		sleepPromiseResolveFn = resolve;
		timeoutId = setTimeout(resolve, timeoutMs);
	});
	abortSignal?.addEventListener("abort", function cancelSleep(_) {
		clearTimeout(timeoutId);
		abortSignal?.removeEventListener("abort", cancelSleep);
		sleepPromiseResolveFn();
	});
	return sleepPromise;
};
var addOrIncrementMetadataAttempts = (nextHandlerOutput, attempts) => {
	if (Object.prototype.toString.call(nextHandlerOutput) !== "[object Object]") return;
	nextHandlerOutput.$metadata = {
		...nextHandlerOutput.$metadata ?? {},
		attempts
	};
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/amplifyUuid/index.mjs
var amplifyUuid = v4;
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/retry/amzSdkInvocationIdHeaderMiddleware.mjs
/**
* Middleware injects a UUID string to `amz-sdk-invocation-id` header.
* if the header is not set already. This header is helpful to provide
* observability to group the requests caused by automatic retry.
*
* This middleware is standalone because of extra UUID dependency, we will
* NOT use this middleware for API categories.
*
* Ref: https://sdk.amazonaws.com/kotlin/api/smithy-kotlin/api/1.0.9/http-client/aws.smithy.kotlin.runtime.http.operation/-http-operation-context/-sdk-invocation-id.html
*/
var amzSdkInvocationIdHeaderMiddlewareFactory = () => (next) => {
	return async function amzSdkInvocationIdHeaderMiddleware(request) {
		if (!request.headers["amz-sdk-invocation-id"]) request.headers[AMZ_SDK_INVOCATION_ID_HEADER] = amplifyUuid();
		return next(request);
	};
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/retry/amzSdkRequestHeaderMiddleware.mjs
/**
* Middleware injects `amz-sdk-request` header to indicate the retry state at the time an HTTP request is made.
* This middleware should co-exist with retryMiddleware as it relies on the retryAttempts value in middleware context
* set by the retry middleware.
*
* Example header: `amz-sdk-request: attempt=1; max=3`.
*
* This middleware is standalone because of extra headers may conflict with custom endpoint settings(e.g. CORS), we will
* NOT use this middleware for API categories.
*/
var amzSdkRequestHeaderMiddlewareFactory = ({ maxAttempts = 3 }) => (next, context) => {
	return async function amzSdkRequestHeaderMiddleware(request) {
		const attemptsCount = context.attemptsCount ?? 0;
		request.headers[AMZ_SDK_REQUEST_HEADER] = `attempt=${attemptsCount + 1}; max=${maxAttempts}`;
		return next(request);
	};
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/userAgent/middleware.mjs
/**
* Middleware injects user agent string to specified header(default to 'x-amz-user-agent'),
* if the header is not set already.
*
* TODO: incorporate new user agent design
*/
var userAgentMiddlewareFactory = ({ userAgentHeader = "x-amz-user-agent", userAgentValue = "" }) => (next) => {
	return async function userAgentMiddleware(request) {
		if (userAgentValue.trim().length === 0) return await next(request);
		else {
			const headerName = userAgentHeader.toLowerCase();
			request.headers[headerName] = request.headers[headerName] ? `${request.headers[headerName]} ${userAgentValue}` : userAgentValue;
			return await next(request);
		}
	};
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/internal/composeTransferHandler.mjs
/**
* Compose a transfer handler with a core transfer handler and a list of middleware.
* @param coreHandler Core transfer handler
* @param middleware	List of middleware
* @returns A transfer handler whose option type is the union of the core
* 	transfer handler's option type and the middleware's option type.
* @internal
*/
var composeTransferHandler = (coreHandler, middleware) => (request, options) => {
	const context = {};
	let composedHandler = (composeHandlerRequest) => coreHandler(composeHandlerRequest, options);
	for (let i = middleware.length - 1; i >= 0; i--) {
		const m = middleware[i];
		composedHandler = m(options)(composedHandler, context);
	}
	return composedHandler(request);
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/utils/memoization.mjs
/**
* Cache the payload of a response body. It allows multiple calls to the body,
* for example, when reading the body in both retry decider and error deserializer.
* Caching body is allowed here because we call the body accessor(blob(), json(),
* etc.) when body is small or streaming implementation is not available(RN).
*
* @internal
*/
var withMemoization = (payloadAccessor) => {
	let cached;
	return () => {
		if (!cached) cached = payloadAccessor();
		return cached;
	};
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/handlers/fetch.mjs
var shouldSendBody = (method) => !["HEAD", "GET"].includes(method.toUpperCase());
var fetchTransferHandler = async ({ url, method, headers, body }, { abortSignal, cache, withCrossDomainCredentials }) => {
	let resp;
	try {
		resp = await fetch(url, {
			method,
			headers,
			body: shouldSendBody(method) ? body : void 0,
			signal: abortSignal,
			cache,
			credentials: withCrossDomainCredentials ? "include" : "same-origin"
		});
	} catch (e) {
		if (e instanceof TypeError) throw new AmplifyError({
			name: AmplifyErrorCode.NetworkError,
			message: "A network error has occurred.",
			underlyingError: e
		});
		throw e;
	}
	const responseHeaders = {};
	resp.headers?.forEach((value, key) => {
		responseHeaders[key.toLowerCase()] = value;
	});
	const httpResponse = {
		statusCode: resp.status,
		headers: responseHeaders,
		body: null
	};
	const bodyWithMixin = Object.assign(resp.body ?? {}, {
		text: withMemoization(() => resp.text()),
		blob: withMemoization(() => resp.blob()),
		json: withMemoization(() => resp.json())
	});
	return {
		...httpResponse,
		body: bodyWithMixin
	};
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/handlers/aws/unauthenticated.mjs
var unauthenticatedHandler = composeTransferHandler(fetchTransferHandler, [
	userAgentMiddlewareFactory,
	amzSdkInvocationIdHeaderMiddlewareFactory,
	retryMiddlewareFactory,
	amzSdkRequestHeaderMiddlewareFactory
]);
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/foundation/factories/middleware/createDisableCacheMiddleware.mjs
/**
* A Cognito Identity-specific middleware that disables caching for all requests.
*/
var createDisableCacheMiddleware = () => (next) => async function disableCacheMiddleware(request) {
	request.headers["cache-control"] = "no-store";
	return next(request);
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/foundation/factories/serviceClients/cognitoIdentity/handler/cognitoIdentityTransferHandler.mjs
/**
* A Cognito Identity-specific transfer handler that does NOT sign requests, and
* disables caching.
*
* @internal
*/
var cognitoIdentityTransferHandler = composeTransferHandler(unauthenticatedHandler, [createDisableCacheMiddleware]);
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/foundation/factories/serviceClients/cognitoIdentity/serde/createClientSerializer.mjs
var createClientSerializer = (operation) => (input, endpoint) => {
	return buildHttpRpcRequest(endpoint, getSharedHeaders(operation), JSON.stringify(input));
};
var getSharedHeaders = (operation) => ({
	"content-type": "application/x-amz-json-1.1",
	"x-amz-target": `AWSCognitoIdentityService.${operation}`
});
var buildHttpRpcRequest = ({ url }, headers, body) => ({
	headers,
	url,
	body,
	method: "POST"
});
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/foundation/factories/serviceClients/cognitoIdentity/createGetCredentialsForIdentityClient.mjs
var createGetCredentialsForIdentityClient = (config) => composeServiceApi(cognitoIdentityTransferHandler, createClientSerializer("GetCredentialsForIdentity"), getCredentialsForIdentityDeserializer, {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config,
	userAgentValue: getAmplifyUserAgent()
});
var getCredentialsForIdentityDeserializer = async (response) => {
	if (response.statusCode >= 300) throw await parseJsonError(response);
	const body = await parseJsonBody(response);
	return {
		IdentityId: body.IdentityId,
		Credentials: deserializeCredentials(body.Credentials),
		$metadata: parseMetadata(response)
	};
};
var deserializeCredentials = ({ Expiration, ...rest } = {}) => ({
	...rest,
	Expiration: Expiration && /* @__PURE__ */ new Date(Expiration * 1e3)
});
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/foundation/factories/serviceClients/cognitoIdentity/createGetIdClient.mjs
var createGetIdClient = (config) => composeServiceApi(cognitoIdentityTransferHandler, createClientSerializer("GetId"), getIdDeserializer, {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config,
	userAgentValue: getAmplifyUserAgent()
});
var getIdDeserializer = async (response) => {
	if (response.statusCode >= 300) throw await parseJsonError(response);
	return {
		IdentityId: (await parseJsonBody(response)).IdentityId,
		$metadata: parseMetadata(response)
	};
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/endpoints/partitions.mjs
/**
* Default partition for AWS services. This is used when the region is not provided or the region is not recognized.
*
* @internal
*/
var defaultPartition = {
	id: "aws",
	outputs: { dnsSuffix: "amazonaws.com" },
	regionRegex: "^(us|eu|ap|sa|ca|me|af)\\-\\w+\\-\\d+$",
	regions: ["aws-global"]
};
/**
* This data is adapted from the partition file from AWS SDK shared utilities but remove some contents for bundle size
* concern. Information removed are `dualStackDnsSuffix`, `supportDualStack`, `supportFIPS`, restricted partitions, and
* list of regions for each partition other than global regions.
*
* * Ref: https://docs.aws.amazon.com/general/latest/gr/rande.html#regional-endpoints
* * Ref: https://github.com/aws/aws-sdk-js-v3/blob/0201baef03c2379f1f6f7150b9d401d4b230d488/packages/util-endpoints/src/lib/aws/partitions.json#L1
*
* @internal
*/
var partitionsInfo = { partitions: [defaultPartition, {
	id: "aws-cn",
	outputs: { dnsSuffix: "amazonaws.com.cn" },
	regionRegex: "^cn\\-\\w+\\-\\d+$",
	regions: ["aws-cn-global"]
}] };
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/endpoints/getDnsSuffix.mjs
/**
* Get the AWS Services endpoint URL's DNS suffix for a given region. A typical AWS regional service endpoint URL will
* follow this pattern: {endpointPrefix}.{region}.{dnsSuffix}. For example, the endpoint URL for Cognito Identity in
* us-east-1 will be cognito-identity.us-east-1.amazonaws.com. Here the DnsSuffix is `amazonaws.com`.
*
* @param region
* @returns The DNS suffix
*
* @internal
*/
var getDnsSuffix = (region) => {
	const { partitions } = partitionsInfo;
	for (const { regions, outputs, regionRegex } of partitions) {
		const regex = new RegExp(regionRegex);
		if (regions.includes(region) || regex.test(region)) return outputs.dnsSuffix;
	}
	return defaultPartition.outputs.dnsSuffix;
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/amplifyUrl/index.mjs
var AmplifyUrl = URL;
var AmplifyUrlSearchParams = URLSearchParams;
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/foundation/factories/serviceClients/cognitoIdentity/cognitoIdentityPoolEndpointResolver.mjs
var cognitoIdentityPoolEndpointResolver = ({ region }) => ({ url: new AmplifyUrl(`https://${COGNITO_IDENTITY_SERVICE_NAME}.${region}.${getDnsSuffix(region)}`) });
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/errors/PlatformNotSupportedError.mjs
var PlatformNotSupportedError = class extends AmplifyError {
	constructor() {
		super({
			name: AmplifyErrorCode.PlatformNotSupported,
			message: "Function not supported on current platform"
		});
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/storage/KeyValueStorage.mjs
/**
* @internal
*/
var KeyValueStorage = class {
	constructor(storage) {
		this.storage = storage;
	}
	/**
	* This is used to set a specific item in storage
	* @param {string} key - the key for the item
	* @param {object} value - the value
	* @returns {string} value that was set
	*/
	async setItem(key, value) {
		if (!this.storage) throw new PlatformNotSupportedError();
		this.storage.setItem(key, value);
	}
	/**
	* This is used to get a specific key from storage
	* @param {string} key - the key for the item
	* This is used to clear the storage
	* @returns {string} the data item
	*/
	async getItem(key) {
		if (!this.storage) throw new PlatformNotSupportedError();
		return this.storage.getItem(key);
	}
	/**
	* This is used to remove an item from storage
	* @param {string} key - the key being set
	* @returns {string} value - value that was deleted
	*/
	async removeItem(key) {
		if (!this.storage) throw new PlatformNotSupportedError();
		this.storage.removeItem(key);
	}
	/**
	* This is used to clear the storage
	* @returns {string} nothing
	*/
	async clear() {
		if (!this.storage) throw new PlatformNotSupportedError();
		this.storage.clear();
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/storage/InMemoryStorage.mjs
/**
* @internal
*/
var InMemoryStorage = class {
	constructor() {
		this.storage = /* @__PURE__ */ new Map();
	}
	get length() {
		return this.storage.size;
	}
	key(index) {
		if (index > this.length - 1) return null;
		return Array.from(this.storage.keys())[index];
	}
	setItem(key, value) {
		this.storage.set(key, value);
	}
	getItem(key) {
		return this.storage.get(key) ?? null;
	}
	removeItem(key) {
		this.storage.delete(key);
	}
	clear() {
		this.storage.clear();
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/storage/utils.mjs
/**
* @internal
* @returns Either a reference to window.localStorage or an in-memory storage as fallback
*/
var logger$4 = new ConsoleLogger("CoreStorageUtils");
var getLocalStorageWithFallback = () => {
	try {
		if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
	} catch (e) {
		logger$4.info("localStorage not found. InMemoryStorage is used as a fallback.");
	}
	return new InMemoryStorage();
};
/**
* @internal
* @returns Either a reference to window.sessionStorage or an in-memory storage as fallback
*/
var getSessionStorageWithFallback = () => {
	try {
		if (typeof window !== "undefined" && window.sessionStorage) {
			window.sessionStorage.getItem("test");
			return window.sessionStorage;
		}
		throw new Error("sessionStorage is not defined");
	} catch (e) {
		logger$4.info("sessionStorage not found. InMemoryStorage is used as a fallback.");
		return new InMemoryStorage();
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/storage/DefaultStorage.mjs
/**
* @internal
*/
var DefaultStorage = class extends KeyValueStorage {
	constructor() {
		super(getLocalStorageWithFallback());
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/storage/SessionStorage.mjs
/**
* @internal
*/
var SessionStorage = class extends KeyValueStorage {
	constructor() {
		super(getSessionStorageWithFallback());
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/storage/SyncKeyValueStorage.mjs
/**
* @internal
*/
var SyncKeyValueStorage = class {
	constructor(storage) {
		this._storage = storage;
	}
	get storage() {
		if (!this._storage) throw new PlatformNotSupportedError();
		return this._storage;
	}
	/**
	* This is used to set a specific item in storage
	* @param {string} key - the key for the item
	* @param {object} value - the value
	* @returns {string} value that was set
	*/
	setItem(key, value) {
		this.storage.setItem(key, value);
	}
	/**
	* This is used to get a specific key from storage
	* @param {string} key - the key for the item
	* This is used to clear the storage
	* @returns {string} the data item
	*/
	getItem(key) {
		return this.storage.getItem(key);
	}
	/**
	* This is used to remove an item from storage
	* @param {string} key - the key being set
	* @returns {string} value - value that was deleted
	*/
	removeItem(key) {
		this.storage.removeItem(key);
	}
	/**
	* This is used to clear the storage
	* @returns {string} nothing
	*/
	clear() {
		this.storage.clear();
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/storage/SyncSessionStorage.mjs
/**
* @internal
*/
var SyncSessionStorage = class extends SyncKeyValueStorage {
	constructor() {
		super(getSessionStorageWithFallback());
	}
};
//#endregion
//#region node_modules/js-cookie/dist/js.cookie.mjs
/*! js-cookie v3.0.5 | MIT */
function assign(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var key in source) target[key] = source[key];
	}
	return target;
}
var defaultConverter = {
	read: function(value) {
		if (value[0] === "\"") value = value.slice(1, -1);
		return value.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
	},
	write: function(value) {
		return encodeURIComponent(value).replace(/%(2[346BF]|3[AC-F]|40|5[BDE]|60|7[BCD])/g, decodeURIComponent);
	}
};
function init(converter, defaultAttributes) {
	function set(name, value, attributes) {
		if (typeof document === "undefined") return;
		attributes = assign({}, defaultAttributes, attributes);
		if (typeof attributes.expires === "number") attributes.expires = new Date(Date.now() + attributes.expires * 864e5);
		if (attributes.expires) attributes.expires = attributes.expires.toUTCString();
		name = encodeURIComponent(name).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
		var stringifiedAttributes = "";
		for (var attributeName in attributes) {
			if (!attributes[attributeName]) continue;
			stringifiedAttributes += "; " + attributeName;
			if (attributes[attributeName] === true) continue;
			stringifiedAttributes += "=" + attributes[attributeName].split(";")[0];
		}
		return document.cookie = name + "=" + converter.write(value, name) + stringifiedAttributes;
	}
	function get(name) {
		if (typeof document === "undefined" || arguments.length && !name) return;
		var cookies = document.cookie ? document.cookie.split("; ") : [];
		var jar = {};
		for (var i = 0; i < cookies.length; i++) {
			var parts = cookies[i].split("=");
			var value = parts.slice(1).join("=");
			try {
				var found = decodeURIComponent(parts[0]);
				jar[found] = converter.read(value, found);
				if (name === found) break;
			} catch (e) {}
		}
		return name ? jar[name] : jar;
	}
	return Object.create({
		set,
		get,
		remove: function(name, attributes) {
			set(name, "", assign({}, attributes, { expires: -1 }));
		},
		withAttributes: function(attributes) {
			return init(this.converter, assign({}, this.attributes, attributes));
		},
		withConverter: function(converter) {
			return init(assign({}, this.converter, converter), this.attributes);
		}
	}, {
		attributes: { value: Object.freeze(defaultAttributes) },
		converter: { value: Object.freeze(converter) }
	});
}
var api = init(defaultConverter, { path: "/" });
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/storage/CookieStorage.mjs
var CookieStorage = class {
	constructor(data = {}) {
		const { path, domain, expires, sameSite, secure } = data;
		this.domain = domain;
		this.path = path || "/";
		this.expires = Object.prototype.hasOwnProperty.call(data, "expires") ? expires : 365;
		this.secure = Object.prototype.hasOwnProperty.call(data, "secure") ? secure : true;
		if (Object.prototype.hasOwnProperty.call(data, "sameSite")) {
			if (!sameSite || ![
				"strict",
				"lax",
				"none"
			].includes(sameSite)) throw new Error("The sameSite value of cookieStorage must be \"lax\", \"strict\" or \"none\".");
			if (sameSite === "none" && !this.secure) throw new Error("sameSite = None requires the Secure attribute in latest browser versions.");
			this.sameSite = sameSite;
		}
	}
	async setItem(key, value) {
		api.set(key, value, this.getData());
	}
	async getItem(key) {
		return api.get(key) ?? null;
	}
	async removeItem(key) {
		api.remove(key, this.getData());
	}
	async clear() {
		const cookie = api.get();
		const promises = Object.keys(cookie).map((key) => this.removeItem(key));
		await Promise.all(promises);
	}
	getData() {
		return {
			path: this.path,
			expires: this.expires,
			domain: this.domain,
			secure: this.secure,
			...this.sameSite && { sameSite: this.sameSite }
		};
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/storage/index.mjs
var defaultStorage = new DefaultStorage();
new SessionStorage();
var syncSessionStorage = new SyncSessionStorage();
new KeyValueStorage(new InMemoryStorage());
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Cache/constants.mjs
/**
* Default cache config
*/
var defaultConfig = {
	keyPrefix: "aws-amplify-cache",
	capacityInBytes: 1048576,
	itemMaxSize: 21e4,
	defaultTTL: 2592e5,
	defaultPriority: 5,
	warningThreshold: .8
};
var currentSizeKey = "CurSize";
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Cache/utils/cacheHelpers.mjs
/**
* return the byte size of the string
* @param str
*/
function getByteLength(str) {
	let ret = 0;
	ret = str.length;
	for (let i = str.length; i >= 0; i -= 1) {
		const charCode = str.charCodeAt(i);
		if (charCode > 127 && charCode <= 2047) ret += 1;
		else if (charCode > 2047 && charCode <= 65535) ret += 2;
		if (charCode >= 56320 && charCode <= 57343) i -= 1;
	}
	return ret;
}
/**
* get current time
*/
function getCurrentTime() {
	return (/* @__PURE__ */ new Date()).getTime();
}
var getCurrentSizeKey = (keyPrefix) => `${keyPrefix}${currentSizeKey}`;
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Cache/utils/errorHelpers.mjs
var CacheErrorCode;
(function(CacheErrorCode) {
	CacheErrorCode["NoCacheItem"] = "NoCacheItem";
	CacheErrorCode["NullNextNode"] = "NullNextNode";
	CacheErrorCode["NullPreviousNode"] = "NullPreviousNode";
})(CacheErrorCode || (CacheErrorCode = {}));
var assert$1 = createAssertionFunction({
	[CacheErrorCode.NoCacheItem]: { message: "Item not found in the cache storage." },
	[CacheErrorCode.NullNextNode]: { message: "Next node is null." },
	[CacheErrorCode.NullPreviousNode]: { message: "Previous node is null." }
});
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Cache/StorageCacheCommon.mjs
var logger$3 = new ConsoleLogger("StorageCache");
/**
* Initialization of the cache
*
*/
var StorageCacheCommon = class {
	/**
	* Initialize the cache
	*
	* @param config - Custom configuration for this instance.
	*/
	constructor({ config, keyValueStorage }) {
		this.config = {
			...defaultConfig,
			...config
		};
		this.keyValueStorage = keyValueStorage;
		this.sanitizeConfig();
	}
	getModuleName() {
		return "Cache";
	}
	/**
	* Set custom configuration for the cache instance.
	*
	* @param config - customized configuration (without keyPrefix, which can't be changed)
	*
	* @return - the current configuration
	*/
	configure(config) {
		if (config) {
			if (config.keyPrefix) logger$3.warn("keyPrefix can not be re-configured on an existing Cache instance.");
			this.config = {
				...this.config,
				...config
			};
		}
		this.sanitizeConfig();
		return this.config;
	}
	/**
	* return the current size of the cache
	* @return {Promise}
	*/
	async getCurrentCacheSize() {
		let size = await this.getStorage().getItem(getCurrentSizeKey(this.config.keyPrefix));
		if (!size) {
			await this.getStorage().setItem(getCurrentSizeKey(this.config.keyPrefix), "0");
			size = "0";
		}
		return Number(size);
	}
	/**
	* Set item into cache. You can put number, string, boolean or object.
	* The cache will first check whether has the same key.
	* If it has, it will delete the old item and then put the new item in
	* The cache will pop out items if it is full
	* You can specify the cache item options. The cache will abort and output a warning:
	* If the key is invalid
	* If the size of the item exceeds itemMaxSize.
	* If the value is undefined
	* If incorrect cache item configuration
	* If error happened with browser storage
	*
	* @param {String} key - the key of the item
	* @param {Object} value - the value of the item
	* @param {Object} [options] - optional, the specified meta-data
	*
	* @return {Promise}
	*/
	async setItem(key, value, options) {
		logger$3.debug(`Set item: key is ${key}, value is ${value} with options: ${options}`);
		if (!key || key === "CurSize") {
			logger$3.warn(`Invalid key: should not be empty or reserved key: '${currentSizeKey}'`);
			return;
		}
		if (typeof value === "undefined") {
			logger$3.warn(`The value of item should not be undefined!`);
			return;
		}
		const cacheItemOptions = {
			priority: options?.priority !== void 0 ? options.priority : this.config.defaultPriority,
			expires: options?.expires !== void 0 ? options.expires : this.config.defaultTTL + getCurrentTime()
		};
		if (cacheItemOptions.priority < 1 || cacheItemOptions.priority > 5) {
			logger$3.warn(`Invalid parameter: priority due to out or range. It should be within 1 and 5.`);
			return;
		}
		const prefixedKey = `${this.config.keyPrefix}${key}`;
		const item = this.fillCacheItem(prefixedKey, value, cacheItemOptions);
		if (item.byteSize > this.config.itemMaxSize) {
			logger$3.warn(`Item with key: ${key} you are trying to put into is too big!`);
			return;
		}
		try {
			const val = await this.getStorage().getItem(prefixedKey);
			if (val) await this.removeCacheItem(prefixedKey, JSON.parse(val).byteSize);
			if (await this.isCacheFull(item.byteSize)) {
				const validKeys = await this.clearInvalidAndGetRemainingKeys();
				if (await this.isCacheFull(item.byteSize)) {
					const sizeToPop = await this.sizeToPop(item.byteSize);
					await this.popOutItems(validKeys, sizeToPop);
				}
			}
			return this.setCacheItem(prefixedKey, item);
		} catch (e) {
			logger$3.warn(`setItem failed! ${e}`);
		}
	}
	/**
	* Get item from cache. It will return null if item doesn’t exist or it has been expired.
	* If you specified callback function in the options,
	* then the function will be executed if no such item in the cache
	* and finally put the return value into cache.
	* Please make sure the callback function will return the value you want to put into the cache.
	* The cache will abort output a warning:
	* If the key is invalid
	* If error happened with AsyncStorage
	*
	* @param {String} key - the key of the item
	* @param {Object} [options] - the options of callback function
	*
	* @return {Promise} - return a promise resolves to be the value of the item
	*/
	async getItem(key, options) {
		logger$3.debug(`Get item: key is ${key} with options ${options}`);
		let cached;
		if (!key || key === "CurSize") {
			logger$3.warn(`Invalid key: should not be empty or reserved key: '${currentSizeKey}'`);
			return null;
		}
		const prefixedKey = `${this.config.keyPrefix}${key}`;
		try {
			cached = await this.getStorage().getItem(prefixedKey);
			if (cached != null) if (await this.isExpired(prefixedKey)) await this.removeCacheItem(prefixedKey, JSON.parse(cached).byteSize);
			else return (await this.updateVisitedTime(JSON.parse(cached), prefixedKey)).data;
			if (options?.callback) {
				const val = options.callback();
				if (val !== null) await this.setItem(key, val, options);
				return val;
			}
			return null;
		} catch (e) {
			logger$3.warn(`getItem failed! ${e}`);
			return null;
		}
	}
	/**
	* remove item from the cache
	* The cache will abort output a warning:
	* If error happened with AsyncStorage
	* @param {String} key - the key of the item
	* @return {Promise}
	*/
	async removeItem(key) {
		logger$3.debug(`Remove item: key is ${key}`);
		if (!key || key === "CurSize") {
			logger$3.warn(`Invalid key: should not be empty or reserved key: '${currentSizeKey}'`);
			return;
		}
		const prefixedKey = `${this.config.keyPrefix}${key}`;
		try {
			const val = await this.getStorage().getItem(prefixedKey);
			if (val) await this.removeCacheItem(prefixedKey, JSON.parse(val).byteSize);
		} catch (e) {
			logger$3.warn(`removeItem failed! ${e}`);
		}
	}
	/**
	* Return all the keys owned by this cache.
	* Will return an empty array if error occurred.
	*
	* @return {Promise}
	*/
	async getAllKeys() {
		try {
			return await this.getAllCacheKeys();
		} catch (e) {
			logger$3.warn(`getAllkeys failed! ${e}`);
			return [];
		}
	}
	getStorage() {
		return this.keyValueStorage;
	}
	/**
	* check whether item is expired
	*
	* @param key - the key of the item
	*
	* @return true if the item is expired.
	*/
	async isExpired(key) {
		const text = await this.getStorage().getItem(key);
		assert$1(text !== null, CacheErrorCode.NoCacheItem, `Key: ${key}`);
		const item = JSON.parse(text);
		if (getCurrentTime() >= item.expires) return true;
		return false;
	}
	/**
	* delete item from cache
	*
	* @param prefixedKey - the key of the item
	* @param size - optional, the byte size of the item
	*/
	async removeCacheItem(prefixedKey, size) {
		const item = await this.getStorage().getItem(prefixedKey);
		assert$1(item !== null, CacheErrorCode.NoCacheItem, `Key: ${prefixedKey}`);
		const itemSize = size ?? JSON.parse(item).byteSize;
		await this.decreaseCurrentSizeInBytes(itemSize);
		try {
			await this.getStorage().removeItem(prefixedKey);
		} catch (removeItemError) {
			await this.increaseCurrentSizeInBytes(itemSize);
			logger$3.error(`Failed to remove item: ${removeItemError}`);
		}
	}
	/**
	* produce a JSON object with meta-data and data value
	* @param value - the value of the item
	* @param options - optional, the specified meta-data
	*
	* @return - the item which has the meta-data and the value
	*/
	fillCacheItem(key, value, options) {
		const item = {
			key,
			data: value,
			timestamp: getCurrentTime(),
			visitedTime: getCurrentTime(),
			priority: options.priority ?? 0,
			expires: options.expires ?? 0,
			type: typeof value,
			byteSize: 0
		};
		item.byteSize = getByteLength(JSON.stringify(item));
		item.byteSize = getByteLength(JSON.stringify(item));
		return item;
	}
	sanitizeConfig() {
		if (this.config.itemMaxSize > this.config.capacityInBytes) {
			logger$3.error("Invalid parameter: itemMaxSize. It should be smaller than capacityInBytes. Setting back to default.");
			this.config.itemMaxSize = defaultConfig.itemMaxSize;
		}
		if (this.config.defaultPriority > 5 || this.config.defaultPriority < 1) {
			logger$3.error("Invalid parameter: defaultPriority. It should be between 1 and 5. Setting back to default.");
			this.config.defaultPriority = defaultConfig.defaultPriority;
		}
		if (Number(this.config.warningThreshold) > 1 || Number(this.config.warningThreshold) < 0) {
			logger$3.error("Invalid parameter: warningThreshold. It should be between 0 and 1. Setting back to default.");
			this.config.warningThreshold = defaultConfig.warningThreshold;
		}
		if (this.config.capacityInBytes > 5 * 1024 * 1024) {
			logger$3.error("Cache Capacity should be less than 5MB. Setting back to default. Setting back to default.");
			this.config.capacityInBytes = defaultConfig.capacityInBytes;
		}
	}
	/**
	* increase current size of the cache
	*
	* @param amount - the amount of the cache szie which need to be increased
	*/
	async increaseCurrentSizeInBytes(amount) {
		const size = await this.getCurrentCacheSize();
		await this.getStorage().setItem(getCurrentSizeKey(this.config.keyPrefix), (size + amount).toString());
	}
	/**
	* decrease current size of the cache
	*
	* @param amount - the amount of the cache size which needs to be decreased
	*/
	async decreaseCurrentSizeInBytes(amount) {
		const size = await this.getCurrentCacheSize();
		await this.getStorage().setItem(getCurrentSizeKey(this.config.keyPrefix), (size - amount).toString());
	}
	/**
	* update the visited time if item has been visited
	*
	* @param item - the item which need to be updated
	* @param prefixedKey - the key of the item
	*
	* @return the updated item
	*/
	async updateVisitedTime(item, prefixedKey) {
		item.visitedTime = getCurrentTime();
		await this.getStorage().setItem(prefixedKey, JSON.stringify(item));
		return item;
	}
	/**
	* put item into cache
	*
	* @param prefixedKey - the key of the item
	* @param itemData - the value of the item
	* @param itemSizeInBytes - the byte size of the item
	*/
	async setCacheItem(prefixedKey, item) {
		await this.increaseCurrentSizeInBytes(item.byteSize);
		try {
			await this.getStorage().setItem(prefixedKey, JSON.stringify(item));
		} catch (setItemErr) {
			await this.decreaseCurrentSizeInBytes(item.byteSize);
			logger$3.error(`Failed to set item ${setItemErr}`);
		}
	}
	/**
	* total space needed when poping out items
	*
	* @param itemSize
	*
	* @return total space needed
	*/
	async sizeToPop(itemSize) {
		const spaceItemNeed = await this.getCurrentCacheSize() + itemSize - this.config.capacityInBytes;
		const cacheThresholdSpace = (1 - this.config.warningThreshold) * this.config.capacityInBytes;
		return spaceItemNeed > cacheThresholdSpace ? spaceItemNeed : cacheThresholdSpace;
	}
	/**
	* see whether cache is full
	*
	* @param itemSize
	*
	* @return true if cache is full
	*/
	async isCacheFull(itemSize) {
		return itemSize + await this.getCurrentCacheSize() > this.config.capacityInBytes;
	}
	/**
	* get all the items we have, sort them by their priority,
	* if priority is same, sort them by their last visited time
	* pop out items from the low priority (5 is the lowest)
	* @private
	* @param keys - all the keys in this cache
	* @param sizeToPop - the total size of the items which needed to be poped out
	*/
	async popOutItems(keys, sizeToPop) {
		const items = [];
		let remainedSize = sizeToPop;
		for (const key of keys) {
			const val = await this.getStorage().getItem(key);
			if (val != null) {
				const item = JSON.parse(val);
				items.push(item);
			}
		}
		items.sort((a, b) => {
			if (a.priority > b.priority) return -1;
			else if (a.priority < b.priority) return 1;
			else if (a.visitedTime < b.visitedTime) return -1;
			else return 1;
		});
		for (const item of items) {
			await this.removeCacheItem(item.key, item.byteSize);
			remainedSize -= item.byteSize;
			if (remainedSize <= 0) return;
		}
	}
	/**
	* Scan the storage and combine the following operations for efficiency
	*   1. Clear out all expired keys owned by this cache, not including the size key.
	*   2. Return the remaining keys.
	*
	* @return The remaining valid keys
	*/
	async clearInvalidAndGetRemainingKeys() {
		const remainingKeys = [];
		const keys = await this.getAllCacheKeys({ omitSizeKey: true });
		for (const key of keys) if (await this.isExpired(key)) await this.removeCacheItem(key);
		else remainingKeys.push(key);
		return remainingKeys;
	}
	/**
	* clear the entire cache
	* The cache will abort and output a warning if error occurs
	* @return {Promise}
	*/
	async clear() {
		logger$3.debug(`Clear Cache`);
		try {
			const keys = await this.getAllKeys();
			for (const key of keys) {
				const prefixedKey = `${this.config.keyPrefix}${key}`;
				await this.getStorage().removeItem(prefixedKey);
			}
		} catch (e) {
			logger$3.warn(`clear failed! ${e}`);
		}
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/Cache/StorageCache.mjs
var logger$2 = new ConsoleLogger("StorageCache");
new class StorageCache extends StorageCacheCommon {
	/**
	* initialize the cache
	* @param config - the configuration of the cache
	*/
	constructor(config) {
		const storage = getLocalStorageWithFallback();
		super({
			config,
			keyValueStorage: new KeyValueStorage(storage)
		});
		this.storage = storage;
		this.getItem = this.getItem.bind(this);
		this.setItem = this.setItem.bind(this);
		this.removeItem = this.removeItem.bind(this);
	}
	async getAllCacheKeys(options) {
		const { omitSizeKey } = options ?? {};
		const keys = [];
		for (let i = 0; i < this.storage.length; i++) {
			const key = this.storage.key(i);
			if (omitSizeKey && key === getCurrentSizeKey(this.config.keyPrefix)) continue;
			if (key?.startsWith(this.config.keyPrefix)) keys.push(key.substring(this.config.keyPrefix.length));
		}
		return keys;
	}
	/**
	* Return a new instance of cache with customized configuration.
	* @param {Object} config - the customized configuration
	* @return {Object} - the new instance of Cache
	*/
	createInstance(config) {
		if (!config.keyPrefix || config.keyPrefix === defaultConfig.keyPrefix) {
			logger$2.error("invalid keyPrefix, setting keyPrefix with timeStamp");
			config.keyPrefix = getCurrentTime.toString();
		}
		return new StorageCache(config);
	}
}();
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/I18n/I18n.mjs
var logger$1 = new ConsoleLogger("I18n");
/**
* Language translation utility.
*/
var I18n$1 = class I18n {
	constructor() {
		/**
		* @private
		*/
		this._options = null;
		/**
		* @private
		*/
		this._lang = null;
		/**
		* @private
		*/
		this._dict = {};
	}
	/**
	* Sets the default language from the configuration when required.
	*/
	setDefaultLanguage() {
		if (!this._lang && typeof window !== "undefined" && window && window.navigator) this._lang = window.navigator.language;
		logger$1.debug(this._lang);
	}
	/**
	* @method
	* Explicitly setting language
	* @param {String} lang
	*/
	setLanguage(lang) {
		this._lang = lang;
	}
	/**
	* @method
	* Get value
	* @param {String} key
	* @param {String} defVal - Default value
	*/
	get(key, defVal = void 0) {
		this.setDefaultLanguage();
		if (!this._lang) return typeof defVal !== "undefined" ? defVal : key;
		const lang = this._lang;
		let val = this.getByLanguage(key, lang);
		if (val) return val;
		if (lang.indexOf("-") > 0) val = this.getByLanguage(key, lang.split("-")[0]);
		if (val) return val;
		return typeof defVal !== "undefined" ? defVal : key;
	}
	/**
	* @method
	* Get value according to specified language
	* @param {String} key
	* @param {String} language - Specified langurage to be used
	* @param {String} defVal - Default value
	*/
	getByLanguage(key, language, defVal = null) {
		if (!language) return defVal;
		const langDict = this._dict[language];
		if (!langDict) return defVal;
		return langDict[key];
	}
	/**
	* @method
	* Add vocabularies for one language
	* @param {String} language - Language of the dictionary
	* @param {Object} vocabularies - Object that has key-value as dictionary entry
	*/
	putVocabulariesForLanguage(language, vocabularies) {
		let langDict = this._dict[language];
		if (!langDict) langDict = this._dict[language] = {};
		this._dict[language] = {
			...langDict,
			...vocabularies
		};
	}
	/**
	* @method
	* Add vocabularies for one language
	* @param {Object} vocabularies - Object that has language as key,
	*                                vocabularies of each language as value
	*/
	putVocabularies(vocabularies) {
		Object.keys(vocabularies).forEach((key) => {
			this.putVocabulariesForLanguage(key, vocabularies[key]);
		});
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/I18n/errorHelpers.mjs
var I18nErrorCode;
(function(I18nErrorCode) {
	I18nErrorCode["NotConfigured"] = "NotConfigured";
})(I18nErrorCode || (I18nErrorCode = {}));
var assert = createAssertionFunction({ [I18nErrorCode.NotConfigured]: { message: "i18n is not configured." } });
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/I18n/index.mjs
var logger = new ConsoleLogger("I18n");
var _config = { language: null };
var _i18n = null;
(class I18n {
	/**
	* @static
	* @method
	* Configure I18n part
	* @param {Object} config - Configuration of the I18n
	*/
	static configure(config) {
		logger.debug("configure I18n");
		if (!config) return _config;
		_config = Object.assign({}, _config, config.I18n || config);
		I18n.createInstance();
		return _config;
	}
	static getModuleName() {
		return "I18n";
	}
	/**
	* @static
	* @method
	* Create an instance of I18n for the library
	*/
	static createInstance() {
		logger.debug("create I18n instance");
		if (_i18n) return;
		_i18n = new I18n$1();
	}
	/**
	* @static @method
	* Explicitly setting language
	* @param {String} lang
	*/
	static setLanguage(lang) {
		I18n.checkConfig();
		assert(!!_i18n, I18nErrorCode.NotConfigured);
		_i18n.setLanguage(lang);
	}
	/**
	* @static @method
	* Get value
	* @param {String} key
	* @param {String} defVal - Default value
	*/
	static get(key, defVal) {
		if (!I18n.checkConfig()) return typeof defVal === "undefined" ? key : defVal;
		assert(!!_i18n, I18nErrorCode.NotConfigured);
		return _i18n.get(key, defVal);
	}
	/**
	* @static
	* @method
	* Add vocabularies for one language
	* @param {String} language - Language of the dictionary
	* @param {Object} vocabularies - Object that has key-value as dictionary entry
	*/
	static putVocabulariesForLanguage(language, vocabularies) {
		I18n.checkConfig();
		assert(!!_i18n, I18nErrorCode.NotConfigured);
		_i18n.putVocabulariesForLanguage(language, vocabularies);
	}
	/**
	* @static
	* @method
	* Add vocabularies for one language
	* @param {Object} vocabularies - Object that has language as key,
	*                                vocabularies of each language as value
	*/
	static putVocabularies(vocabularies) {
		I18n.checkConfig();
		assert(!!_i18n, I18nErrorCode.NotConfigured);
		_i18n.putVocabularies(vocabularies);
	}
	static checkConfig() {
		if (!_i18n) I18n.createInstance();
		return true;
	}
}).createInstance();
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/convert/base64/bytesToString.mjs
function bytesToString(input) {
	return Array.from(input, (byte) => String.fromCodePoint(byte)).join("");
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/convert/base64/base64Encoder.mjs
var base64Encoder = { convert(input, options = {
	urlSafe: false,
	skipPadding: false
}) {
	const inputStr = typeof input === "string" ? input : bytesToString(input);
	let encodedStr = getBtoa()(inputStr);
	if (options.urlSafe) encodedStr = encodedStr.replace(/\+/g, "-").replace(/\//g, "_");
	if (options.skipPadding) encodedStr = encodedStr.replace(/=/g, "");
	return encodedStr;
} };
//#endregion
export { AmplifyErrorCode as $, createOperatorSubscriber as A, ADD_OAUTH_LISTENER as B, parseJsonError as C, Amplify as D, fetchAuthSession$1 as E, AuthAction as F, assertTokenProviderConfig as G, isNonRetryableError as H, Category as I, getCrypto as J, decodeJWT as K, toHex as L, Observable as M, getAmplifyUserAgent as N, Reachability as O, ApiAction as P, createAssertionFunction as Q, Sha256 as R, parseJsonBody as S, fetchAuthSession as T, assertIdentityPoolIdConfig as U, retry as V, assertOAuthConfig as W, Hub as X, AMPLIFY_SYMBOL as Y, HubInternal as Z, getRetryDecider as _, cognitoIdentityPoolEndpointResolver as a, MAX_DELAY_MS as b, getDnsSuffix as c, unauthenticatedHandler as d, AmplifyError as et, fetchTransferHandler as f, retryMiddlewareFactory as g, amplifyUuid as h, CookieStorage as i, operate as j, innerFrom as k, createGetIdClient as l, userAgentMiddlewareFactory as m, defaultStorage as n, USER_AGENT_HEADER as nt, AmplifyUrl as o, composeTransferHandler as p, base64Decoder as q, syncSessionStorage as r, AmplifyUrlSearchParams as s, base64Encoder as t, ConsoleLogger as tt, createGetCredentialsForIdentityClient as u, jitteredBackoff as v, clearCredentials as w, composeServiceApi as x, jitteredBackoff$1 as y, parseAmplifyConfig as z };

//# sourceMappingURL=base64Encoder-Cn88duoV.js.map