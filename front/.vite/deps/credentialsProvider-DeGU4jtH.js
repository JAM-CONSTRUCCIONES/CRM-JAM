import { $ as AmplifyErrorCode, B as ADD_OAUTH_LISTENER, C as parseJsonError, D as Amplify, E as fetchAuthSession$1, F as AuthAction, G as assertTokenProviderConfig, I as Category, J as getCrypto, K as decodeJWT, N as getAmplifyUserAgent, Q as createAssertionFunction, R as Sha256, S as parseJsonBody, T as fetchAuthSession, U as assertIdentityPoolIdConfig, W as assertOAuthConfig, X as Hub, Y as AMPLIFY_SYMBOL, Z as HubInternal, _ as getRetryDecider, a as cognitoIdentityPoolEndpointResolver, c as getDnsSuffix, d as unauthenticatedHandler, et as AmplifyError, l as createGetIdClient, n as defaultStorage, nt as USER_AGENT_HEADER, o as AmplifyUrl, p as composeTransferHandler, q as base64Decoder, r as syncSessionStorage, t as base64Encoder, tt as ConsoleLogger, u as createGetCredentialsForIdentityClient, v as jitteredBackoff, w as clearCredentials, x as composeServiceApi } from "./base64Encoder-Cn88duoV.js";
//#region node_modules/@aws-amplify/core/dist/esm/utils/isBrowser.mjs
var isBrowser = () => typeof window !== "undefined" && typeof window.document !== "undefined";
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/generateRandomString.mjs
var generateRandomString = (length) => {
	const STATE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const result = [];
	const randomNums = new Uint8Array(length);
	getCrypto().getRandomValues(randomNums);
	for (const num of randomNums) result.push(STATE_CHARSET[num % 62]);
	return result.join("");
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/urlSafeDecode.mjs
function urlSafeDecode(hex) {
	return (hex.match(/.{2}/g) || []).map((char) => String.fromCharCode(parseInt(char, 16))).join("");
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/urlSafeEncode.mjs
function urlSafeEncode(str) {
	return str.split("").map((char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/deDupeAsyncFunction.mjs
/**
* returns in-flight promise if there is one
*
* @param asyncFunction - asyncFunction to be deduped.
* @returns - the return type of the callback
*/
var deDupeAsyncFunction = (asyncFunction) => {
	let inflightPromise;
	return async (...args) => {
		if (inflightPromise) return inflightPromise;
		inflightPromise = new Promise((resolve, reject) => {
			asyncFunction(...args).then((result) => {
				resolve(result);
			}).catch((error) => {
				reject(error);
			}).finally(() => {
				inflightPromise = void 0;
			});
		});
		return inflightPromise;
	};
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/isTokenExpired.mjs
function isTokenExpired({ expiresAt, clockDrift, tolerance = 5e3 }) {
	return Date.now() + clockDrift + tolerance > expiresAt;
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/deviceName/getDeviceName.mjs
/**
* Retrieves the device name using the User-Agent Client Hints API if available,
* falling back to the traditional userAgent string if not.
*
* @returns {Promise<string>} A promise that resolves with a string representing the device name.
*
* Example Output:
* navigator.userAgentData:
*   'macOS 14.2.1 arm macOS Not A(Brand/99.0.0.0;Google Chrome/121.0.6167.160;Chromium/121.0.6167.160'
* navigator.userAgent:
*   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0'
*/
var getDeviceName = async () => {
	const { userAgentData } = navigator;
	if (!userAgentData) return navigator.userAgent;
	const { platform = "", platformVersion = "", model = "", architecture = "", fullVersionList = [] } = await userAgentData.getHighEntropyValues([
		"platform",
		"platformVersion",
		"architecture",
		"model",
		"fullVersionList"
	]);
	return [
		platform,
		platformVersion,
		architecture,
		model,
		platform,
		fullVersionList.map((v) => `${v.brand}/${v.version}`).join(";")
	].filter((value) => value).join(" ") || navigator.userAgent;
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/cryptoSecureRandomInt.mjs
function cryptoSecureRandomInt() {
	return getCrypto().getRandomValues(new Uint32Array(1))[0];
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/WordArray.mjs
/**
* Hex encoding strategy.
* Converts a word array to a hex string.
* @param {WordArray} wordArray The word array.
* @return {string} The hex string.
* @static
*/
function hexStringify(wordArray) {
	const { words } = wordArray;
	const { sigBytes } = wordArray;
	const hexChars = [];
	for (let i = 0; i < sigBytes; i++) {
		const bite = words[i >>> 2] >>> 24 - i % 4 * 8 & 255;
		hexChars.push((bite >>> 4).toString(16));
		hexChars.push((bite & 15).toString(16));
	}
	return hexChars.join("");
}
var WordArray = class WordArray {
	constructor(words, sigBytes) {
		this.words = [];
		let Words = words;
		Words = this.words = Words || [];
		if (sigBytes !== void 0) this.sigBytes = sigBytes;
		else this.sigBytes = Words.length * 4;
	}
	random(nBytes) {
		const words = [];
		for (let i = 0; i < nBytes; i += 4) words.push(cryptoSecureRandomInt());
		return new WordArray(words, nBytes);
	}
	toString() {
		return hexStringify(this);
	}
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/errors/types/validation.mjs
var AuthValidationErrorCode;
(function(AuthValidationErrorCode) {
	AuthValidationErrorCode["EmptySignInUsername"] = "EmptySignInUsername";
	AuthValidationErrorCode["EmptySignInPassword"] = "EmptySignInPassword";
	AuthValidationErrorCode["CustomAuthSignInPassword"] = "CustomAuthSignInPassword";
	AuthValidationErrorCode["EmptySignUpUsername"] = "EmptySignUpUsername";
	AuthValidationErrorCode["EmptySignUpPassword"] = "EmptySignUpPassword";
	AuthValidationErrorCode["EmptyConfirmSignUpUsername"] = "EmptyConfirmSignUpUsername";
	AuthValidationErrorCode["EmptyConfirmSignUpCode"] = "EmptyConfirmSignUpCode";
	AuthValidationErrorCode["EmptyResendSignUpCodeUsername"] = "EmptyresendSignUpCodeUsername";
	AuthValidationErrorCode["EmptyChallengeResponse"] = "EmptyChallengeResponse";
	AuthValidationErrorCode["EmptyConfirmResetPasswordUsername"] = "EmptyConfirmResetPasswordUsername";
	AuthValidationErrorCode["EmptyConfirmResetPasswordNewPassword"] = "EmptyConfirmResetPasswordNewPassword";
	AuthValidationErrorCode["EmptyConfirmResetPasswordConfirmationCode"] = "EmptyConfirmResetPasswordConfirmationCode";
	AuthValidationErrorCode["EmptyResetPasswordUsername"] = "EmptyResetPasswordUsername";
	AuthValidationErrorCode["EmptyVerifyTOTPSetupCode"] = "EmptyVerifyTOTPSetupCode";
	AuthValidationErrorCode["EmptyConfirmUserAttributeCode"] = "EmptyConfirmUserAttributeCode";
	AuthValidationErrorCode["IncorrectMFAMethod"] = "IncorrectMFAMethod";
	AuthValidationErrorCode["EmptyUpdatePassword"] = "EmptyUpdatePassword";
	AuthValidationErrorCode["InvalidPreferredChallenge"] = "InvalidPreferredChallenge";
})(AuthValidationErrorCode || (AuthValidationErrorCode = {}));
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/common/AuthErrorStrings.mjs
var validationErrorMap = {
	[AuthValidationErrorCode.EmptyChallengeResponse]: { message: "challengeResponse is required to confirmSignIn" },
	[AuthValidationErrorCode.EmptyConfirmResetPasswordUsername]: { message: "username is required to confirmResetPassword" },
	[AuthValidationErrorCode.EmptyConfirmSignUpCode]: { message: "code is required to confirmSignUp" },
	[AuthValidationErrorCode.EmptyConfirmSignUpUsername]: { message: "username is required to confirmSignUp" },
	[AuthValidationErrorCode.EmptyConfirmResetPasswordConfirmationCode]: { message: "confirmationCode is required to confirmResetPassword" },
	[AuthValidationErrorCode.EmptyConfirmResetPasswordNewPassword]: { message: "newPassword is required to confirmResetPassword" },
	[AuthValidationErrorCode.EmptyResendSignUpCodeUsername]: { message: "username is required to confirmSignUp" },
	[AuthValidationErrorCode.EmptyResetPasswordUsername]: { message: "username is required to resetPassword" },
	[AuthValidationErrorCode.EmptySignInPassword]: { message: "password is required to signIn" },
	[AuthValidationErrorCode.EmptySignInUsername]: { message: "username is required to signIn" },
	[AuthValidationErrorCode.EmptySignUpPassword]: { message: "password is required to signUp" },
	[AuthValidationErrorCode.EmptySignUpUsername]: { message: "username is required to signUp" },
	[AuthValidationErrorCode.CustomAuthSignInPassword]: {
		message: "A password is not needed when signing in with CUSTOM_WITHOUT_SRP",
		recoverySuggestion: "Do not include a password in your signIn call."
	},
	[AuthValidationErrorCode.IncorrectMFAMethod]: {
		message: "Incorrect MFA method was chosen. It should be either SMS, TOTP, or EMAIL",
		recoverySuggestion: "Try to pass SMS, TOTP, or EMAIL as the challengeResponse"
	},
	[AuthValidationErrorCode.EmptyVerifyTOTPSetupCode]: { message: "code is required to verifyTotpSetup" },
	[AuthValidationErrorCode.EmptyUpdatePassword]: { message: "oldPassword and newPassword are required to changePassword" },
	[AuthValidationErrorCode.EmptyConfirmUserAttributeCode]: { message: "confirmation code is required to confirmUserAttribute" },
	[AuthValidationErrorCode.InvalidPreferredChallenge]: {
		message: "The preferred challenge is not enabled in your backend configuration",
		recoverySuggestion: "Ensure the authentication method is enabled in your Amplify backend configuration"
	}
};
var AuthErrorStrings;
(function(AuthErrorStrings) {
	AuthErrorStrings["DEFAULT_MSG"] = "Authentication Error";
	AuthErrorStrings["EMPTY_EMAIL"] = "Email cannot be empty";
	AuthErrorStrings["EMPTY_PHONE"] = "Phone number cannot be empty";
	AuthErrorStrings["EMPTY_USERNAME"] = "Username cannot be empty";
	AuthErrorStrings["INVALID_USERNAME"] = "The username should either be a string or one of the sign in types";
	AuthErrorStrings["EMPTY_PASSWORD"] = "Password cannot be empty";
	AuthErrorStrings["EMPTY_CODE"] = "Confirmation code cannot be empty";
	AuthErrorStrings["SIGN_UP_ERROR"] = "Error creating account";
	AuthErrorStrings["NO_MFA"] = "No valid MFA method provided";
	AuthErrorStrings["INVALID_MFA"] = "Invalid MFA type";
	AuthErrorStrings["EMPTY_CHALLENGE"] = "Challenge response cannot be empty";
	AuthErrorStrings["NO_USER_SESSION"] = "Failed to get the session because the user is empty";
	AuthErrorStrings["NETWORK_ERROR"] = "Network Error";
	AuthErrorStrings["DEVICE_CONFIG"] = "Device tracking has not been configured in this User Pool";
	AuthErrorStrings["AUTOSIGNIN_ERROR"] = "Please use your credentials to sign in";
	AuthErrorStrings["OAUTH_ERROR"] = "Couldn't finish OAuth flow, check your User Pool HostedUI settings";
})(AuthErrorStrings || (AuthErrorStrings = {}));
var AuthErrorCodes;
(function(AuthErrorCodes) {
	AuthErrorCodes["SignInException"] = "SignInException";
	AuthErrorCodes["OAuthSignInError"] = "OAuthSignInException";
})(AuthErrorCodes || (AuthErrorCodes = {}));
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/errors/AuthError.mjs
var AuthError = class AuthError extends AmplifyError {
	constructor(params) {
		super(params);
		this.constructor = AuthError;
		Object.setPrototypeOf(this, AuthError.prototype);
	}
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/errors/utils/assertValidationError.mjs
function assertValidationError(assertion, name) {
	const { message, recoverySuggestion } = validationErrorMap[name];
	if (!assertion) throw new AuthError({
		name,
		message,
		recoverySuggestion
	});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/parsers/regionParsers.mjs
function getRegionFromUserPoolId(userPoolId) {
	const region = userPoolId?.split("_")[0];
	if (!userPoolId || userPoolId.indexOf("_") < 0 || !region || typeof region !== "string") throw new AuthError({
		name: "InvalidUserPoolId",
		message: "Invalid user pool id provided."
	});
	return region;
}
function getRegionFromIdentityPoolId(identityPoolId) {
	if (!identityPoolId || !identityPoolId.includes(":")) throw new AuthError({
		name: "InvalidIdentityPoolIdException",
		message: "Invalid identity pool id provided.",
		recoverySuggestion: "Make sure a valid identityPoolId is given in the config."
	});
	return identityPoolId.split(":")[0];
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/apiHelpers.mjs
/**
* Transforms a user attributes object into an array of AttributeType objects.
* @param attributes user attributes to be mapped to AttributeType objects.
* @returns an array of AttributeType objects.
*/
function toAttributeType(attributes) {
	return Object.entries(attributes).map(([key, value]) => ({
		Name: key,
		Value: value
	}));
}
/**
* Transforms an array of AttributeType objects into a user attributes object.
*
* @param attributes - an array of AttributeType objects.
* @returns AuthUserAttributes object.
*/
function toAuthUserAttribute(attributes) {
	const userAttributes = {};
	attributes?.forEach((attribute) => {
		if (attribute.Name) userAttributes[attribute.Name] = attribute.Value;
	});
	return userAttributes;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/types/errors.mjs
var AssociateSoftwareTokenException;
(function(AssociateSoftwareTokenException) {
	AssociateSoftwareTokenException["ConcurrentModificationException"] = "ConcurrentModificationException";
	AssociateSoftwareTokenException["ForbiddenException"] = "ForbiddenException";
	AssociateSoftwareTokenException["InternalErrorException"] = "InternalErrorException";
	AssociateSoftwareTokenException["InvalidParameterException"] = "InvalidParameterException";
	AssociateSoftwareTokenException["NotAuthorizedException"] = "NotAuthorizedException";
	AssociateSoftwareTokenException["ResourceNotFoundException"] = "ResourceNotFoundException";
	AssociateSoftwareTokenException["SoftwareTokenMFANotFoundException"] = "SoftwareTokenMFANotFoundException";
})(AssociateSoftwareTokenException || (AssociateSoftwareTokenException = {}));
var ChangePasswordException;
(function(ChangePasswordException) {
	ChangePasswordException["ForbiddenException"] = "ForbiddenException";
	ChangePasswordException["InternalErrorException"] = "InternalErrorException";
	ChangePasswordException["InvalidParameterException"] = "InvalidParameterException";
	ChangePasswordException["InvalidPasswordException"] = "InvalidPasswordException";
	ChangePasswordException["LimitExceededException"] = "LimitExceededException";
	ChangePasswordException["NotAuthorizedException"] = "NotAuthorizedException";
	ChangePasswordException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	ChangePasswordException["ResourceNotFoundException"] = "ResourceNotFoundException";
	ChangePasswordException["TooManyRequestsException"] = "TooManyRequestsException";
	ChangePasswordException["UserNotConfirmedException"] = "UserNotConfirmedException";
	ChangePasswordException["UserNotFoundException"] = "UserNotFoundException";
})(ChangePasswordException || (ChangePasswordException = {}));
var ConfirmDeviceException;
(function(ConfirmDeviceException) {
	ConfirmDeviceException["ForbiddenException"] = "ForbiddenException";
	ConfirmDeviceException["InternalErrorException"] = "InternalErrorException";
	ConfirmDeviceException["InvalidLambdaResponseException"] = "InvalidLambdaResponseException";
	ConfirmDeviceException["InvalidParameterException"] = "InvalidParameterException";
	ConfirmDeviceException["InvalidPasswordException"] = "InvalidPasswordException";
	ConfirmDeviceException["InvalidUserPoolConfigurationException"] = "InvalidUserPoolConfigurationException";
	ConfirmDeviceException["NotAuthorizedException"] = "NotAuthorizedException";
	ConfirmDeviceException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	ConfirmDeviceException["ResourceNotFoundException"] = "ResourceNotFoundException";
	ConfirmDeviceException["TooManyRequestsException"] = "TooManyRequestsException";
	ConfirmDeviceException["UsernameExistsException"] = "UsernameExistsException";
	ConfirmDeviceException["UserNotConfirmedException"] = "UserNotConfirmedException";
	ConfirmDeviceException["UserNotFoundException"] = "UserNotFoundException";
})(ConfirmDeviceException || (ConfirmDeviceException = {}));
var ConfirmForgotPasswordException;
(function(ConfirmForgotPasswordException) {
	ConfirmForgotPasswordException["CodeMismatchException"] = "CodeMismatchException";
	ConfirmForgotPasswordException["ExpiredCodeException"] = "ExpiredCodeException";
	ConfirmForgotPasswordException["ForbiddenException"] = "ForbiddenException";
	ConfirmForgotPasswordException["InternalErrorException"] = "InternalErrorException";
	ConfirmForgotPasswordException["InvalidLambdaResponseException"] = "InvalidLambdaResponseException";
	ConfirmForgotPasswordException["InvalidParameterException"] = "InvalidParameterException";
	ConfirmForgotPasswordException["InvalidPasswordException"] = "InvalidPasswordException";
	ConfirmForgotPasswordException["LimitExceededException"] = "LimitExceededException";
	ConfirmForgotPasswordException["NotAuthorizedException"] = "NotAuthorizedException";
	ConfirmForgotPasswordException["ResourceNotFoundException"] = "ResourceNotFoundException";
	ConfirmForgotPasswordException["TooManyFailedAttemptsException"] = "TooManyFailedAttemptsException";
	ConfirmForgotPasswordException["TooManyRequestsException"] = "TooManyRequestsException";
	ConfirmForgotPasswordException["UnexpectedLambdaException"] = "UnexpectedLambdaException";
	ConfirmForgotPasswordException["UserLambdaValidationException"] = "UserLambdaValidationException";
	ConfirmForgotPasswordException["UserNotConfirmedException"] = "UserNotConfirmedException";
	ConfirmForgotPasswordException["UserNotFoundException"] = "UserNotFoundException";
})(ConfirmForgotPasswordException || (ConfirmForgotPasswordException = {}));
var ConfirmSignUpException;
(function(ConfirmSignUpException) {
	ConfirmSignUpException["AliasExistsException"] = "AliasExistsException";
	ConfirmSignUpException["CodeMismatchException"] = "CodeMismatchException";
	ConfirmSignUpException["ExpiredCodeException"] = "ExpiredCodeException";
	ConfirmSignUpException["ForbiddenException"] = "ForbiddenException";
	ConfirmSignUpException["InternalErrorException"] = "InternalErrorException";
	ConfirmSignUpException["InvalidLambdaResponseException"] = "InvalidLambdaResponseException";
	ConfirmSignUpException["InvalidParameterException"] = "InvalidParameterException";
	ConfirmSignUpException["LimitExceededException"] = "LimitExceededException";
	ConfirmSignUpException["NotAuthorizedException"] = "NotAuthorizedException";
	ConfirmSignUpException["ResourceNotFoundException"] = "ResourceNotFoundException";
	ConfirmSignUpException["TooManyFailedAttemptsException"] = "TooManyFailedAttemptsException";
	ConfirmSignUpException["TooManyRequestsException"] = "TooManyRequestsException";
	ConfirmSignUpException["UnexpectedLambdaException"] = "UnexpectedLambdaException";
	ConfirmSignUpException["UserLambdaValidationException"] = "UserLambdaValidationException";
	ConfirmSignUpException["UserNotFoundException"] = "UserNotFoundException";
})(ConfirmSignUpException || (ConfirmSignUpException = {}));
var DeleteUserAttributesException;
(function(DeleteUserAttributesException) {
	DeleteUserAttributesException["ForbiddenException"] = "ForbiddenException";
	DeleteUserAttributesException["InternalErrorException"] = "InternalErrorException";
	DeleteUserAttributesException["InvalidParameterException"] = "InvalidParameterException";
	DeleteUserAttributesException["NotAuthorizedException"] = "NotAuthorizedException";
	DeleteUserAttributesException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	DeleteUserAttributesException["ResourceNotFoundException"] = "ResourceNotFoundException";
	DeleteUserAttributesException["TooManyRequestsException"] = "TooManyRequestsException";
	DeleteUserAttributesException["UserNotConfirmedException"] = "UserNotConfirmedException";
	DeleteUserAttributesException["UserNotFoundException"] = "UserNotFoundException";
})(DeleteUserAttributesException || (DeleteUserAttributesException = {}));
var DeleteUserException;
(function(DeleteUserException) {
	DeleteUserException["ForbiddenException"] = "ForbiddenException";
	DeleteUserException["InternalErrorException"] = "InternalErrorException";
	DeleteUserException["InvalidParameterException"] = "InvalidParameterException";
	DeleteUserException["NotAuthorizedException"] = "NotAuthorizedException";
	DeleteUserException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	DeleteUserException["ResourceNotFoundException"] = "ResourceNotFoundException";
	DeleteUserException["TooManyRequestsException"] = "TooManyRequestsException";
	DeleteUserException["UserNotConfirmedException"] = "UserNotConfirmedException";
	DeleteUserException["UserNotFoundException"] = "UserNotFoundException";
})(DeleteUserException || (DeleteUserException = {}));
var ForgetDeviceException;
(function(ForgetDeviceException) {
	ForgetDeviceException["ForbiddenException"] = "ForbiddenException";
	ForgetDeviceException["InternalErrorException"] = "InternalErrorException";
	ForgetDeviceException["InvalidParameterException"] = "InvalidParameterException";
	ForgetDeviceException["InvalidUserPoolConfigurationException"] = "InvalidUserPoolConfigurationException";
	ForgetDeviceException["NotAuthorizedException"] = "NotAuthorizedException";
	ForgetDeviceException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	ForgetDeviceException["ResourceNotFoundException"] = "ResourceNotFoundException";
	ForgetDeviceException["TooManyRequestsException"] = "TooManyRequestsException";
	ForgetDeviceException["UserNotConfirmedException"] = "UserNotConfirmedException";
	ForgetDeviceException["UserNotFoundException"] = "UserNotFoundException";
})(ForgetDeviceException || (ForgetDeviceException = {}));
var ForgotPasswordException;
(function(ForgotPasswordException) {
	ForgotPasswordException["CodeDeliveryFailureException"] = "CodeDeliveryFailureException";
	ForgotPasswordException["ForbiddenException"] = "ForbiddenException";
	ForgotPasswordException["InternalErrorException"] = "InternalErrorException";
	ForgotPasswordException["InvalidEmailRoleAccessPolicyException"] = "InvalidEmailRoleAccessPolicyException";
	ForgotPasswordException["InvalidLambdaResponseException"] = "InvalidLambdaResponseException";
	ForgotPasswordException["InvalidParameterException"] = "InvalidParameterException";
	ForgotPasswordException["InvalidSmsRoleAccessPolicyException"] = "InvalidSmsRoleAccessPolicyException";
	ForgotPasswordException["InvalidSmsRoleTrustRelationshipException"] = "InvalidSmsRoleTrustRelationshipException";
	ForgotPasswordException["LimitExceededException"] = "LimitExceededException";
	ForgotPasswordException["NotAuthorizedException"] = "NotAuthorizedException";
	ForgotPasswordException["ResourceNotFoundException"] = "ResourceNotFoundException";
	ForgotPasswordException["TooManyRequestsException"] = "TooManyRequestsException";
	ForgotPasswordException["UnexpectedLambdaException"] = "UnexpectedLambdaException";
	ForgotPasswordException["UserLambdaValidationException"] = "UserLambdaValidationException";
	ForgotPasswordException["UserNotFoundException"] = "UserNotFoundException";
})(ForgotPasswordException || (ForgotPasswordException = {}));
var GetUserException;
(function(GetUserException) {
	GetUserException["ForbiddenException"] = "ForbiddenException";
	GetUserException["InternalErrorException"] = "InternalErrorException";
	GetUserException["InvalidParameterException"] = "InvalidParameterException";
	GetUserException["NotAuthorizedException"] = "NotAuthorizedException";
	GetUserException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	GetUserException["ResourceNotFoundException"] = "ResourceNotFoundException";
	GetUserException["TooManyRequestsException"] = "TooManyRequestsException";
	GetUserException["UserNotConfirmedException"] = "UserNotConfirmedException";
	GetUserException["UserNotFoundException"] = "UserNotFoundException";
})(GetUserException || (GetUserException = {}));
var GetIdException;
(function(GetIdException) {
	GetIdException["ExternalServiceException"] = "ExternalServiceException";
	GetIdException["InternalErrorException"] = "InternalErrorException";
	GetIdException["InvalidParameterException"] = "InvalidParameterException";
	GetIdException["LimitExceededException"] = "LimitExceededException";
	GetIdException["NotAuthorizedException"] = "NotAuthorizedException";
	GetIdException["ResourceConflictException"] = "ResourceConflictException";
	GetIdException["ResourceNotFoundException"] = "ResourceNotFoundException";
	GetIdException["TooManyRequestsException"] = "TooManyRequestsException";
})(GetIdException || (GetIdException = {}));
var GetCredentialsForIdentityException;
(function(GetCredentialsForIdentityException) {
	GetCredentialsForIdentityException["ExternalServiceException"] = "ExternalServiceException";
	GetCredentialsForIdentityException["InternalErrorException"] = "InternalErrorException";
	GetCredentialsForIdentityException["InvalidIdentityPoolConfigurationException"] = "InvalidIdentityPoolConfigurationException";
	GetCredentialsForIdentityException["InvalidParameterException"] = "InvalidParameterException";
	GetCredentialsForIdentityException["NotAuthorizedException"] = "NotAuthorizedException";
	GetCredentialsForIdentityException["ResourceConflictException"] = "ResourceConflictException";
	GetCredentialsForIdentityException["ResourceNotFoundException"] = "ResourceNotFoundException";
	GetCredentialsForIdentityException["TooManyRequestsException"] = "TooManyRequestsException";
})(GetCredentialsForIdentityException || (GetCredentialsForIdentityException = {}));
var GetUserAttributeVerificationException;
(function(GetUserAttributeVerificationException) {
	GetUserAttributeVerificationException["CodeDeliveryFailureException"] = "CodeDeliveryFailureException";
	GetUserAttributeVerificationException["ForbiddenException"] = "ForbiddenException";
	GetUserAttributeVerificationException["InternalErrorException"] = "InternalErrorException";
	GetUserAttributeVerificationException["InvalidEmailRoleAccessPolicyException"] = "InvalidEmailRoleAccessPolicyException";
	GetUserAttributeVerificationException["InvalidLambdaResponseException"] = "InvalidLambdaResponseException";
	GetUserAttributeVerificationException["InvalidParameterException"] = "InvalidParameterException";
	GetUserAttributeVerificationException["InvalidSmsRoleAccessPolicyException"] = "InvalidSmsRoleAccessPolicyException";
	GetUserAttributeVerificationException["InvalidSmsRoleTrustRelationshipException"] = "InvalidSmsRoleTrustRelationshipException";
	GetUserAttributeVerificationException["LimitExceededException"] = "LimitExceededException";
	GetUserAttributeVerificationException["NotAuthorizedException"] = "NotAuthorizedException";
	GetUserAttributeVerificationException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	GetUserAttributeVerificationException["ResourceNotFoundException"] = "ResourceNotFoundException";
	GetUserAttributeVerificationException["TooManyRequestsException"] = "TooManyRequestsException";
	GetUserAttributeVerificationException["UnexpectedLambdaException"] = "UnexpectedLambdaException";
	GetUserAttributeVerificationException["UserLambdaValidationException"] = "UserLambdaValidationException";
	GetUserAttributeVerificationException["UserNotConfirmedException"] = "UserNotConfirmedException";
	GetUserAttributeVerificationException["UserNotFoundException"] = "UserNotFoundException";
})(GetUserAttributeVerificationException || (GetUserAttributeVerificationException = {}));
var GlobalSignOutException;
(function(GlobalSignOutException) {
	GlobalSignOutException["ForbiddenException"] = "ForbiddenException";
	GlobalSignOutException["InternalErrorException"] = "InternalErrorException";
	GlobalSignOutException["InvalidParameterException"] = "InvalidParameterException";
	GlobalSignOutException["NotAuthorizedException"] = "NotAuthorizedException";
	GlobalSignOutException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	GlobalSignOutException["ResourceNotFoundException"] = "ResourceNotFoundException";
	GlobalSignOutException["TooManyRequestsException"] = "TooManyRequestsException";
	GlobalSignOutException["UserNotConfirmedException"] = "UserNotConfirmedException";
})(GlobalSignOutException || (GlobalSignOutException = {}));
var InitiateAuthException;
(function(InitiateAuthException) {
	InitiateAuthException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	InitiateAuthException["ForbiddenException"] = "ForbiddenException";
	InitiateAuthException["InternalErrorException"] = "InternalErrorException";
	InitiateAuthException["InvalidLambdaResponseException"] = "InvalidLambdaResponseException";
	InitiateAuthException["InvalidParameterException"] = "InvalidParameterException";
	InitiateAuthException["InvalidSmsRoleAccessPolicyException"] = "InvalidSmsRoleAccessPolicyException";
	InitiateAuthException["InvalidSmsRoleTrustRelationshipException"] = "InvalidSmsRoleTrustRelationshipException";
	InitiateAuthException["InvalidUserPoolConfigurationException"] = "InvalidUserPoolConfigurationException";
	InitiateAuthException["NotAuthorizedException"] = "NotAuthorizedException";
	InitiateAuthException["ResourceNotFoundException"] = "ResourceNotFoundException";
	InitiateAuthException["TooManyRequestsException"] = "TooManyRequestsException";
	InitiateAuthException["UnexpectedLambdaException"] = "UnexpectedLambdaException";
	InitiateAuthException["UserLambdaValidationException"] = "UserLambdaValidationException";
	InitiateAuthException["UserNotConfirmedException"] = "UserNotConfirmedException";
	InitiateAuthException["UserNotFoundException"] = "UserNotFoundException";
})(InitiateAuthException || (InitiateAuthException = {}));
var ResendConfirmationException;
(function(ResendConfirmationException) {
	ResendConfirmationException["CodeDeliveryFailureException"] = "CodeDeliveryFailureException";
	ResendConfirmationException["ForbiddenException"] = "ForbiddenException";
	ResendConfirmationException["InternalErrorException"] = "InternalErrorException";
	ResendConfirmationException["InvalidEmailRoleAccessPolicyException"] = "InvalidEmailRoleAccessPolicyException";
	ResendConfirmationException["InvalidLambdaResponseException"] = "InvalidLambdaResponseException";
	ResendConfirmationException["InvalidParameterException"] = "InvalidParameterException";
	ResendConfirmationException["InvalidSmsRoleAccessPolicyException"] = "InvalidSmsRoleAccessPolicyException";
	ResendConfirmationException["InvalidSmsRoleTrustRelationshipException"] = "InvalidSmsRoleTrustRelationshipException";
	ResendConfirmationException["LimitExceededException"] = "LimitExceededException";
	ResendConfirmationException["NotAuthorizedException"] = "NotAuthorizedException";
	ResendConfirmationException["ResourceNotFoundException"] = "ResourceNotFoundException";
	ResendConfirmationException["TooManyRequestsException"] = "TooManyRequestsException";
	ResendConfirmationException["UnexpectedLambdaException"] = "UnexpectedLambdaException";
	ResendConfirmationException["UserLambdaValidationException"] = "UserLambdaValidationException";
	ResendConfirmationException["UserNotFoundException"] = "UserNotFoundException";
})(ResendConfirmationException || (ResendConfirmationException = {}));
var RespondToAuthChallengeException;
(function(RespondToAuthChallengeException) {
	RespondToAuthChallengeException["AliasExistsException"] = "AliasExistsException";
	RespondToAuthChallengeException["CodeMismatchException"] = "CodeMismatchException";
	RespondToAuthChallengeException["ExpiredCodeException"] = "ExpiredCodeException";
	RespondToAuthChallengeException["ForbiddenException"] = "ForbiddenException";
	RespondToAuthChallengeException["InternalErrorException"] = "InternalErrorException";
	RespondToAuthChallengeException["InvalidLambdaResponseException"] = "InvalidLambdaResponseException";
	RespondToAuthChallengeException["InvalidParameterException"] = "InvalidParameterException";
	RespondToAuthChallengeException["InvalidPasswordException"] = "InvalidPasswordException";
	RespondToAuthChallengeException["InvalidSmsRoleAccessPolicyException"] = "InvalidSmsRoleAccessPolicyException";
	RespondToAuthChallengeException["InvalidSmsRoleTrustRelationshipException"] = "InvalidSmsRoleTrustRelationshipException";
	RespondToAuthChallengeException["InvalidUserPoolConfigurationException"] = "InvalidUserPoolConfigurationException";
	RespondToAuthChallengeException["MFAMethodNotFoundException"] = "MFAMethodNotFoundException";
	RespondToAuthChallengeException["NotAuthorizedException"] = "NotAuthorizedException";
	RespondToAuthChallengeException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	RespondToAuthChallengeException["ResourceNotFoundException"] = "ResourceNotFoundException";
	RespondToAuthChallengeException["SoftwareTokenMFANotFoundException"] = "SoftwareTokenMFANotFoundException";
	RespondToAuthChallengeException["TooManyRequestsException"] = "TooManyRequestsException";
	RespondToAuthChallengeException["UnexpectedLambdaException"] = "UnexpectedLambdaException";
	RespondToAuthChallengeException["UserLambdaValidationException"] = "UserLambdaValidationException";
	RespondToAuthChallengeException["UserNotConfirmedException"] = "UserNotConfirmedException";
	RespondToAuthChallengeException["UserNotFoundException"] = "UserNotFoundException";
})(RespondToAuthChallengeException || (RespondToAuthChallengeException = {}));
var SetUserMFAPreferenceException;
(function(SetUserMFAPreferenceException) {
	SetUserMFAPreferenceException["ForbiddenException"] = "ForbiddenException";
	SetUserMFAPreferenceException["InternalErrorException"] = "InternalErrorException";
	SetUserMFAPreferenceException["InvalidParameterException"] = "InvalidParameterException";
	SetUserMFAPreferenceException["NotAuthorizedException"] = "NotAuthorizedException";
	SetUserMFAPreferenceException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	SetUserMFAPreferenceException["ResourceNotFoundException"] = "ResourceNotFoundException";
	SetUserMFAPreferenceException["UserNotConfirmedException"] = "UserNotConfirmedException";
	SetUserMFAPreferenceException["UserNotFoundException"] = "UserNotFoundException";
})(SetUserMFAPreferenceException || (SetUserMFAPreferenceException = {}));
var SignUpException;
(function(SignUpException) {
	SignUpException["CodeDeliveryFailureException"] = "CodeDeliveryFailureException";
	SignUpException["InternalErrorException"] = "InternalErrorException";
	SignUpException["InvalidEmailRoleAccessPolicyException"] = "InvalidEmailRoleAccessPolicyException";
	SignUpException["InvalidLambdaResponseException"] = "InvalidLambdaResponseException";
	SignUpException["InvalidParameterException"] = "InvalidParameterException";
	SignUpException["InvalidPasswordException"] = "InvalidPasswordException";
	SignUpException["InvalidSmsRoleAccessPolicyException"] = "InvalidSmsRoleAccessPolicyException";
	SignUpException["InvalidSmsRoleTrustRelationshipException"] = "InvalidSmsRoleTrustRelationshipException";
	SignUpException["NotAuthorizedException"] = "NotAuthorizedException";
	SignUpException["ResourceNotFoundException"] = "ResourceNotFoundException";
	SignUpException["TooManyRequestsException"] = "TooManyRequestsException";
	SignUpException["UnexpectedLambdaException"] = "UnexpectedLambdaException";
	SignUpException["UserLambdaValidationException"] = "UserLambdaValidationException";
	SignUpException["UsernameExistsException"] = "UsernameExistsException";
})(SignUpException || (SignUpException = {}));
var UpdateUserAttributesException;
(function(UpdateUserAttributesException) {
	UpdateUserAttributesException["AliasExistsException"] = "AliasExistsException";
	UpdateUserAttributesException["CodeDeliveryFailureException"] = "CodeDeliveryFailureException";
	UpdateUserAttributesException["CodeMismatchException"] = "CodeMismatchException";
	UpdateUserAttributesException["ExpiredCodeException"] = "ExpiredCodeException";
	UpdateUserAttributesException["ForbiddenException"] = "ForbiddenException";
	UpdateUserAttributesException["InternalErrorException"] = "InternalErrorException";
	UpdateUserAttributesException["InvalidEmailRoleAccessPolicyException"] = "InvalidEmailRoleAccessPolicyException";
	UpdateUserAttributesException["InvalidLambdaResponseException"] = "InvalidLambdaResponseException";
	UpdateUserAttributesException["InvalidParameterException"] = "InvalidParameterException";
	UpdateUserAttributesException["InvalidSmsRoleAccessPolicyException"] = "InvalidSmsRoleAccessPolicyException";
	UpdateUserAttributesException["InvalidSmsRoleTrustRelationshipException"] = "InvalidSmsRoleTrustRelationshipException";
	UpdateUserAttributesException["NotAuthorizedException"] = "NotAuthorizedException";
	UpdateUserAttributesException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	UpdateUserAttributesException["ResourceNotFoundException"] = "ResourceNotFoundException";
	UpdateUserAttributesException["TooManyRequestsException"] = "TooManyRequestsException";
	UpdateUserAttributesException["UnexpectedLambdaException"] = "UnexpectedLambdaException";
	UpdateUserAttributesException["UserLambdaValidationException"] = "UserLambdaValidationException";
	UpdateUserAttributesException["UserNotConfirmedException"] = "UserNotConfirmedException";
	UpdateUserAttributesException["UserNotFoundException"] = "UserNotFoundException";
})(UpdateUserAttributesException || (UpdateUserAttributesException = {}));
var VerifySoftwareTokenException;
(function(VerifySoftwareTokenException) {
	VerifySoftwareTokenException["CodeMismatchException"] = "CodeMismatchException";
	VerifySoftwareTokenException["EnableSoftwareTokenMFAException"] = "EnableSoftwareTokenMFAException";
	VerifySoftwareTokenException["ForbiddenException"] = "ForbiddenException";
	VerifySoftwareTokenException["InternalErrorException"] = "InternalErrorException";
	VerifySoftwareTokenException["InvalidParameterException"] = "InvalidParameterException";
	VerifySoftwareTokenException["InvalidUserPoolConfigurationException"] = "InvalidUserPoolConfigurationException";
	VerifySoftwareTokenException["NotAuthorizedException"] = "NotAuthorizedException";
	VerifySoftwareTokenException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	VerifySoftwareTokenException["ResourceNotFoundException"] = "ResourceNotFoundException";
	VerifySoftwareTokenException["SoftwareTokenMFANotFoundException"] = "SoftwareTokenMFANotFoundException";
	VerifySoftwareTokenException["TooManyRequestsException"] = "TooManyRequestsException";
	VerifySoftwareTokenException["UserNotConfirmedException"] = "UserNotConfirmedException";
	VerifySoftwareTokenException["UserNotFoundException"] = "UserNotFoundException";
})(VerifySoftwareTokenException || (VerifySoftwareTokenException = {}));
var VerifyUserAttributeException;
(function(VerifyUserAttributeException) {
	VerifyUserAttributeException["AliasExistsException"] = "AliasExistsException";
	VerifyUserAttributeException["CodeMismatchException"] = "CodeMismatchException";
	VerifyUserAttributeException["ExpiredCodeException"] = "ExpiredCodeException";
	VerifyUserAttributeException["ForbiddenException"] = "ForbiddenException";
	VerifyUserAttributeException["InternalErrorException"] = "InternalErrorException";
	VerifyUserAttributeException["InvalidParameterException"] = "InvalidParameterException";
	VerifyUserAttributeException["LimitExceededException"] = "LimitExceededException";
	VerifyUserAttributeException["NotAuthorizedException"] = "NotAuthorizedException";
	VerifyUserAttributeException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	VerifyUserAttributeException["ResourceNotFoundException"] = "ResourceNotFoundException";
	VerifyUserAttributeException["TooManyRequestsException"] = "TooManyRequestsException";
	VerifyUserAttributeException["UserNotConfirmedException"] = "UserNotConfirmedException";
	VerifyUserAttributeException["UserNotFoundException"] = "UserNotFoundException";
})(VerifyUserAttributeException || (VerifyUserAttributeException = {}));
var UpdateDeviceStatusException;
(function(UpdateDeviceStatusException) {
	UpdateDeviceStatusException["ForbiddenException"] = "ForbiddenException";
	UpdateDeviceStatusException["InternalErrorException"] = "InternalErrorException";
	UpdateDeviceStatusException["InvalidParameterException"] = "InvalidParameterException";
	UpdateDeviceStatusException["InvalidUserPoolConfigurationException"] = "InvalidUserPoolConfigurationException";
	UpdateDeviceStatusException["NotAuthorizedException"] = "NotAuthorizedException";
	UpdateDeviceStatusException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	UpdateDeviceStatusException["ResourceNotFoundException"] = "ResourceNotFoundException";
	UpdateDeviceStatusException["TooManyRequestsException"] = "TooManyRequestsException";
	UpdateDeviceStatusException["UserNotConfirmedException"] = "UserNotConfirmedException";
	UpdateDeviceStatusException["UserNotFoundException"] = "UserNotFoundException";
})(UpdateDeviceStatusException || (UpdateDeviceStatusException = {}));
var ListDevicesException;
(function(ListDevicesException) {
	ListDevicesException["ForbiddenException"] = "ForbiddenException";
	ListDevicesException["InternalErrorException"] = "InternalErrorException";
	ListDevicesException["InvalidParameterException"] = "InvalidParameterException";
	ListDevicesException["InvalidUserPoolConfigurationException"] = "InvalidUserPoolConfigurationException";
	ListDevicesException["NotAuthorizedException"] = "NotAuthorizedException";
	ListDevicesException["PasswordResetRequiredException"] = "PasswordResetRequiredException";
	ListDevicesException["ResourceNotFoundException"] = "ResourceNotFoundException";
	ListDevicesException["TooManyRequestsException"] = "TooManyRequestsException";
	ListDevicesException["UserNotConfirmedException"] = "UserNotConfirmedException";
	ListDevicesException["UserNotFoundException"] = "UserNotFoundException";
})(ListDevicesException || (ListDevicesException = {}));
var SETUP_TOTP_EXCEPTION = "SetUpTOTPException";
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/errors/constants.mjs
var USER_UNAUTHENTICATED_EXCEPTION = "UserUnAuthenticatedException";
var USER_ALREADY_AUTHENTICATED_EXCEPTION = "UserAlreadyAuthenticatedException";
var DEVICE_METADATA_NOT_FOUND_EXCEPTION = "DeviceMetadataNotFoundException";
var AUTO_SIGN_IN_EXCEPTION = "AutoSignInException";
var INVALID_REDIRECT_EXCEPTION = "InvalidRedirectException";
var INVALID_APP_SCHEME_EXCEPTION = "InvalidAppSchemeException";
var INVALID_PREFERRED_REDIRECT_EXCEPTION = "InvalidPreferredRedirectUrlException";
var invalidRedirectException = new AuthError({
	name: INVALID_REDIRECT_EXCEPTION,
	message: "signInRedirect or signOutRedirect had an invalid format or was not found.",
	recoverySuggestion: "Please make sure the signIn/Out redirect in your oauth config is valid."
});
new AuthError({
	name: INVALID_APP_SCHEME_EXCEPTION,
	message: "A valid non-http app scheme was not found in the config.",
	recoverySuggestion: "Please make sure a valid custom app scheme is present in the config."
});
var invalidPreferredRedirectUrlException = new AuthError({
	name: INVALID_PREFERRED_REDIRECT_EXCEPTION,
	message: "The given preferredRedirectUrl does not match any items in the redirectSignOutUrls array from the config.",
	recoverySuggestion: "Please make sure a matching preferredRedirectUrl is provided."
});
var invalidOriginException = new AuthError({
	name: "InvalidOriginException",
	message: "redirect is coming from a different origin. The oauth flow needs to be initiated from the same origin",
	recoverySuggestion: "Please call signInWithRedirect from the same origin."
});
var OAUTH_SIGNOUT_EXCEPTION = "OAuthSignOutException";
var TOKEN_REFRESH_EXCEPTION = "TokenRefreshException";
var UNEXPECTED_SIGN_IN_INTERRUPTION_EXCEPTION = "UnexpectedSignInInterruptionException";
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/types.mjs
function assertAuthTokens(tokens) {
	if (!tokens || !tokens.accessToken) throw new AuthError({
		name: USER_UNAUTHENTICATED_EXCEPTION,
		message: "User needs to be authenticated to call this API.",
		recoverySuggestion: "Sign in before calling this API again."
	});
}
function assertIdTokenInAuthTokens(tokens) {
	if (!tokens || !tokens.idToken) throw new AuthError({
		name: USER_UNAUTHENTICATED_EXCEPTION,
		message: "User needs to be authenticated to call this API.",
		recoverySuggestion: "Sign in before calling this API again."
	});
}
var oAuthTokenRefreshException = new AuthError({
	name: TOKEN_REFRESH_EXCEPTION,
	message: `Token refresh is not supported when authenticated with the 'implicit grant' (token) oauth flow. 
	Please change your oauth configuration to use 'code grant' flow.`,
	recoverySuggestion: `Please logout and change your Amplify configuration to use "code grant" flow. 
	E.g { responseType: 'code' }`
});
var tokenRefreshException = new AuthError({
	name: USER_UNAUTHENTICATED_EXCEPTION,
	message: "User needs to be authenticated to call this API.",
	recoverySuggestion: "Sign in before calling this API again."
});
function assertAuthTokensWithRefreshToken(tokens) {
	if (isAuthenticatedWithImplicitOauthFlow(tokens)) throw oAuthTokenRefreshException;
	if (!isAuthenticatedWithRefreshToken(tokens)) throw tokenRefreshException;
}
function assertDeviceMetadata(deviceMetadata) {
	if (!deviceMetadata || !deviceMetadata.deviceKey || !deviceMetadata.deviceGroupKey || !deviceMetadata.randomPassword) throw new AuthError({
		name: DEVICE_METADATA_NOT_FOUND_EXCEPTION,
		message: "Either deviceKey, deviceGroupKey or secretPassword were not found during the sign-in process.",
		recoverySuggestion: "Make sure to not clear storage after calling the signIn API."
	});
}
var OAuthStorageKeys = {
	inflightOAuth: "inflightOAuth",
	oauthSignIn: "oauthSignIn",
	oauthPKCE: "oauthPKCE",
	oauthState: "oauthState"
};
function isAuthenticated(tokens) {
	return tokens?.accessToken || tokens?.idToken;
}
function isAuthenticatedWithRefreshToken(tokens) {
	return isAuthenticated(tokens) && tokens?.refreshToken;
}
function isAuthenticatedWithImplicitOauthFlow(tokens) {
	return isAuthenticated(tokens) && !tokens?.refreshToken;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/internal/getCurrentUser.mjs
var getCurrentUser$1 = async (amplify) => {
	const authConfig = amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const tokens = await amplify.Auth.getTokens({ forceRefresh: false });
	assertAuthTokens(tokens);
	const { "cognito:username": username, sub } = tokens.idToken?.payload ?? {};
	const authUser = {
		username,
		userId: sub
	};
	const signInDetails = getSignInDetailsFromTokens(tokens);
	if (signInDetails) authUser.signInDetails = signInDetails;
	return authUser;
};
function getSignInDetailsFromTokens(tokens) {
	return tokens?.signInDetails;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/getCurrentUser.mjs
/**
* Gets the current user from the idToken.
*
* @param input -  The GetCurrentUserInput object.
* @returns GetCurrentUserOutput
* @throws - {@link InitiateAuthException} - Thrown when the service fails to refresh the tokens.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
var getCurrentUser = async () => {
	return getCurrentUser$1(Amplify);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/utils/getAuthUserAgentValue.mjs
var getAuthUserAgentValue = (action, customUserAgentDetails) => getAmplifyUserAgent({
	category: Category.Auth,
	action,
	...customUserAgentDetails
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/shared/serde/createUserPoolSerializer.mjs
var createUserPoolSerializer = (operation) => (input, endpoint) => {
	return buildHttpRpcRequest(endpoint, getSharedHeaders(operation), JSON.stringify(input));
};
var getSharedHeaders = (operation) => ({
	"content-type": "application/x-amz-json-1.1",
	"x-amz-target": `AWSCognitoIdentityProviderService.${operation}`
});
var buildHttpRpcRequest = ({ url }, headers, body) => ({
	headers,
	url,
	body,
	method: "POST"
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/errors/utils/assertServiceError.mjs
function assertServiceError(error) {
	if (!error || error.name === "Error" || error instanceof TypeError) throw new AuthError({
		name: AmplifyErrorCode.Unknown,
		message: "An unknown error has occurred.",
		underlyingError: error
	});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/shared/serde/createUserPoolDeserializer.mjs
var createUserPoolDeserializer = () => async (response) => {
	if (response.statusCode >= 300) {
		const error = await parseJsonError(response);
		assertServiceError(error);
		throw new AuthError({
			name: error.name,
			message: error.message,
			metadata: error.$metadata
		});
	}
	return parseJsonBody(response);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/shared/handler/cognitoUserPoolTransferHandler.mjs
/**
* A Cognito Identity-specific middleware that disables caching for all requests.
*/
var disableCacheMiddlewareFactory = () => (next, _) => async function disableCacheMiddleware(request) {
	request.headers["cache-control"] = "no-store";
	return next(request);
};
/**
* A Cognito Identity-specific transfer handler that does NOT sign requests, and
* disables caching.
*
* @internal
*/
var cognitoUserPoolTransferHandler = composeTransferHandler(unauthenticatedHandler, [disableCacheMiddlewareFactory]);
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/constants.mjs
/**
* The service name used to sign requests if the API requires authentication.
*/
var COGNITO_IDP_SERVICE_NAME = "cognito-idp";
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/constants.mjs
var DEFAULT_SERVICE_CLIENT_API_CONFIG = {
	service: COGNITO_IDP_SERVICE_NAME,
	retryDecider: getRetryDecider(parseJsonError),
	computeDelay: jitteredBackoff,
	get userAgentValue() {
		return getAmplifyUserAgent();
	},
	cache: "no-store"
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createInitiateAuthClient.mjs
var createInitiateAuthClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("InitiateAuth"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createRespondToAuthChallengeClient.mjs
var createRespondToAuthChallengeClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("RespondToAuthChallenge"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createVerifySoftwareTokenClient.mjs
var createVerifySoftwareTokenClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("VerifySoftwareToken"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createAssociateSoftwareTokenClient.mjs
var createAssociateSoftwareTokenClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("AssociateSoftwareToken"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/cognitoUserPoolEndpointResolver.mjs
var cognitoUserPoolEndpointResolver = ({ region }) => ({ url: new AmplifyUrl(`https://${COGNITO_IDP_SERVICE_NAME}.${region}.${getDnsSuffix(region)}`) });
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/factories/createCognitoUserPoolEndpointResolver.mjs
var createCognitoUserPoolEndpointResolver = ({ endpointOverride }) => (input) => {
	if (endpointOverride) return { url: new AmplifyUrl(endpointOverride) };
	return cognitoUserPoolEndpointResolver(input);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createGetTokensFromRefreshTokenClient.mjs
var createGetTokensFromRefreshTokenClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("GetTokensFromRefreshToken"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/refreshAuthTokens.mjs
var refreshAuthTokensFunction = async ({ tokens, authConfig, username, clientMetadata }) => {
	assertTokenProviderConfig(authConfig?.Cognito);
	const { userPoolId, userPoolClientId, userPoolEndpoint } = authConfig.Cognito;
	const region = getRegionFromUserPoolId(userPoolId);
	assertAuthTokensWithRefreshToken(tokens);
	const { AuthenticationResult } = await createGetTokensFromRefreshTokenClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({ region }, {
		ClientId: userPoolClientId,
		RefreshToken: tokens.refreshToken,
		DeviceKey: tokens.deviceMetadata?.deviceKey,
		ClientMetadata: clientMetadata
	});
	const accessToken = decodeJWT(AuthenticationResult?.AccessToken ?? "");
	const idToken = AuthenticationResult?.IdToken ? decodeJWT(AuthenticationResult.IdToken) : void 0;
	const { iat } = accessToken.payload;
	if (!iat) throw new AuthError({
		name: "iatNotFoundException",
		message: "iat not found in access token"
	});
	return {
		accessToken,
		idToken,
		clockDrift: iat * 1e3 - (/* @__PURE__ */ new Date()).getTime(),
		refreshToken: AuthenticationResult?.RefreshToken ?? tokens.refreshToken,
		username
	};
};
var refreshAuthTokens = deDupeAsyncFunction(refreshAuthTokensFunction);
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/tokenProvider/types.mjs
var AuthTokenStorageKeys = {
	accessToken: "accessToken",
	idToken: "idToken",
	oidcProvider: "oidcProvider",
	clockDrift: "clockDrift",
	refreshToken: "refreshToken",
	deviceKey: "deviceKey",
	randomPasswordKey: "randomPasswordKey",
	deviceGroupKey: "deviceGroupKey",
	signInDetails: "signInDetails",
	oauthMetadata: "oauthMetadata"
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/tokenProvider/errorHelpers.mjs
var TokenProviderErrorCode;
(function(TokenProviderErrorCode) {
	TokenProviderErrorCode["InvalidAuthTokens"] = "InvalidAuthTokens";
})(TokenProviderErrorCode || (TokenProviderErrorCode = {}));
var assert = createAssertionFunction({ [TokenProviderErrorCode.InvalidAuthTokens]: {
	message: "Invalid tokens.",
	recoverySuggestion: "Make sure the tokens are valid."
} });
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/tokenProvider/constants.mjs
var AUTH_KEY_PREFIX = "CognitoIdentityServiceProvider";
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/tokenProvider/TokenStore.mjs
var DefaultTokenStore = class {
	getKeyValueStorage() {
		if (!this.keyValueStorage) throw new AuthError({
			name: "KeyValueStorageNotFoundException",
			message: "KeyValueStorage was not found in TokenStore"
		});
		return this.keyValueStorage;
	}
	setKeyValueStorage(keyValueStorage) {
		this.keyValueStorage = keyValueStorage;
	}
	setAuthConfig(authConfig) {
		this.authConfig = authConfig;
	}
	async loadTokens() {
		try {
			const authKeys = await this.getAuthKeys();
			const accessTokenString = await this.getKeyValueStorage().getItem(authKeys.accessToken);
			if (!accessTokenString) throw new AuthError({
				name: "NoSessionFoundException",
				message: "Auth session was not found. Make sure to call signIn."
			});
			const accessToken = decodeJWT(accessTokenString);
			const itString = await this.getKeyValueStorage().getItem(authKeys.idToken);
			const idToken = itString ? decodeJWT(itString) : void 0;
			const refreshToken = await this.getKeyValueStorage().getItem(authKeys.refreshToken) ?? void 0;
			const clockDriftString = await this.getKeyValueStorage().getItem(authKeys.clockDrift) ?? "0";
			const clockDrift = Number.parseInt(clockDriftString);
			const signInDetails = await this.getKeyValueStorage().getItem(authKeys.signInDetails);
			const tokens = {
				accessToken,
				idToken,
				refreshToken,
				deviceMetadata: await this.getDeviceMetadata() ?? void 0,
				clockDrift,
				username: await this.getLastAuthUser()
			};
			if (signInDetails) tokens.signInDetails = JSON.parse(signInDetails);
			return tokens;
		} catch (err) {
			return null;
		}
	}
	async storeTokens(tokens) {
		assert(tokens !== void 0, TokenProviderErrorCode.InvalidAuthTokens);
		const lastAuthUser = tokens.username;
		await this.getKeyValueStorage().setItem(this.getLastAuthUserKey(), lastAuthUser);
		const authKeys = await this.getAuthKeys();
		await this.getKeyValueStorage().setItem(authKeys.accessToken, tokens.accessToken.toString());
		if (tokens.idToken) await this.getKeyValueStorage().setItem(authKeys.idToken, tokens.idToken.toString());
		else await this.getKeyValueStorage().removeItem(authKeys.idToken);
		if (tokens.refreshToken) await this.getKeyValueStorage().setItem(authKeys.refreshToken, tokens.refreshToken);
		else await this.getKeyValueStorage().removeItem(authKeys.refreshToken);
		if (tokens.deviceMetadata) {
			if (tokens.deviceMetadata.deviceKey) await this.getKeyValueStorage().setItem(authKeys.deviceKey, tokens.deviceMetadata.deviceKey);
			if (tokens.deviceMetadata.deviceGroupKey) await this.getKeyValueStorage().setItem(authKeys.deviceGroupKey, tokens.deviceMetadata.deviceGroupKey);
			await this.getKeyValueStorage().setItem(authKeys.randomPasswordKey, tokens.deviceMetadata.randomPassword);
		}
		if (tokens.signInDetails) await this.getKeyValueStorage().setItem(authKeys.signInDetails, JSON.stringify(tokens.signInDetails));
		else await this.getKeyValueStorage().removeItem(authKeys.signInDetails);
		await this.getKeyValueStorage().setItem(authKeys.clockDrift, `${tokens.clockDrift}`);
	}
	async clearTokens() {
		const authKeys = await this.getAuthKeys();
		await Promise.all([
			this.getKeyValueStorage().removeItem(authKeys.accessToken),
			this.getKeyValueStorage().removeItem(authKeys.idToken),
			this.getKeyValueStorage().removeItem(authKeys.clockDrift),
			this.getKeyValueStorage().removeItem(authKeys.refreshToken),
			this.getKeyValueStorage().removeItem(authKeys.signInDetails),
			this.getKeyValueStorage().removeItem(this.getLastAuthUserKey()),
			this.getKeyValueStorage().removeItem(authKeys.oauthMetadata)
		]);
	}
	async getDeviceMetadata(username) {
		const authKeys = await this.getAuthKeys(username);
		const deviceKey = await this.getKeyValueStorage().getItem(authKeys.deviceKey);
		const deviceGroupKey = await this.getKeyValueStorage().getItem(authKeys.deviceGroupKey);
		const randomPassword = await this.getKeyValueStorage().getItem(authKeys.randomPasswordKey);
		return randomPassword && deviceGroupKey && deviceKey ? {
			deviceKey,
			deviceGroupKey,
			randomPassword
		} : null;
	}
	async clearDeviceMetadata(username) {
		const authKeys = await this.getAuthKeys(username);
		await Promise.all([
			this.getKeyValueStorage().removeItem(authKeys.deviceKey),
			this.getKeyValueStorage().removeItem(authKeys.deviceGroupKey),
			this.getKeyValueStorage().removeItem(authKeys.randomPasswordKey)
		]);
	}
	async getAuthKeys(username) {
		assertTokenProviderConfig(this.authConfig?.Cognito);
		const lastAuthUser = username ?? await this.getLastAuthUser();
		return createKeysForAuthStorage$2(AUTH_KEY_PREFIX, `${this.authConfig.Cognito.userPoolClientId}.${lastAuthUser}`);
	}
	getLastAuthUserKey() {
		assertTokenProviderConfig(this.authConfig?.Cognito);
		return `${AUTH_KEY_PREFIX}.${this.authConfig.Cognito.userPoolClientId}.LastAuthUser`;
	}
	async getLastAuthUser() {
		return await this.getKeyValueStorage().getItem(this.getLastAuthUserKey()) ?? "username";
	}
	async setOAuthMetadata(metadata) {
		const { oauthMetadata: oauthMetadataKey } = await this.getAuthKeys();
		await this.getKeyValueStorage().setItem(oauthMetadataKey, JSON.stringify(metadata));
	}
	async getOAuthMetadata() {
		const { oauthMetadata: oauthMetadataKey } = await this.getAuthKeys();
		const oauthMetadata = await this.getKeyValueStorage().getItem(oauthMetadataKey);
		return oauthMetadata && JSON.parse(oauthMetadata);
	}
};
var createKeysForAuthStorage$2 = (provider, identifier) => {
	return getAuthStorageKeys(AuthTokenStorageKeys)(`${provider}`, identifier);
};
function getAuthStorageKeys(authKeys) {
	const keys = Object.values({ ...authKeys });
	return (prefix, identifier) => keys.reduce((acc, authKey) => ({
		...acc,
		[authKey]: `${prefix}.${identifier}.${authKey}`
	}), {});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/signInWithRedirectStore.mjs
var V5_HOSTED_UI_KEY = "amplify-signin-with-hostedUI";
var name = "CognitoIdentityServiceProvider";
var DefaultOAuthStore = class {
	constructor(keyValueStorage) {
		this.keyValueStorage = keyValueStorage;
	}
	async clearOAuthInflightData() {
		assertTokenProviderConfig(this.cognitoConfig);
		const authKeys = createKeysForAuthStorage$1(name, this.cognitoConfig.userPoolClientId);
		await Promise.all([
			this.keyValueStorage.removeItem(authKeys.inflightOAuth),
			this.keyValueStorage.removeItem(authKeys.oauthPKCE),
			this.keyValueStorage.removeItem(authKeys.oauthState)
		]);
	}
	async clearOAuthData() {
		assertTokenProviderConfig(this.cognitoConfig);
		const authKeys = createKeysForAuthStorage$1(name, this.cognitoConfig.userPoolClientId);
		await this.clearOAuthInflightData();
		await this.keyValueStorage.removeItem(V5_HOSTED_UI_KEY);
		return this.keyValueStorage.removeItem(authKeys.oauthSignIn);
	}
	loadOAuthState() {
		assertTokenProviderConfig(this.cognitoConfig);
		const authKeys = createKeysForAuthStorage$1(name, this.cognitoConfig.userPoolClientId);
		return this.keyValueStorage.getItem(authKeys.oauthState);
	}
	storeOAuthState(state) {
		assertTokenProviderConfig(this.cognitoConfig);
		const authKeys = createKeysForAuthStorage$1(name, this.cognitoConfig.userPoolClientId);
		return this.keyValueStorage.setItem(authKeys.oauthState, state);
	}
	loadPKCE() {
		assertTokenProviderConfig(this.cognitoConfig);
		const authKeys = createKeysForAuthStorage$1(name, this.cognitoConfig.userPoolClientId);
		return this.keyValueStorage.getItem(authKeys.oauthPKCE);
	}
	storePKCE(pkce) {
		assertTokenProviderConfig(this.cognitoConfig);
		const authKeys = createKeysForAuthStorage$1(name, this.cognitoConfig.userPoolClientId);
		return this.keyValueStorage.setItem(authKeys.oauthPKCE, pkce);
	}
	setAuthConfig(authConfigParam) {
		this.cognitoConfig = authConfigParam;
	}
	async loadOAuthInFlight() {
		assertTokenProviderConfig(this.cognitoConfig);
		const authKeys = createKeysForAuthStorage$1(name, this.cognitoConfig.userPoolClientId);
		return await this.keyValueStorage.getItem(authKeys.inflightOAuth) === "true";
	}
	async storeOAuthInFlight(inflight) {
		assertTokenProviderConfig(this.cognitoConfig);
		const authKeys = createKeysForAuthStorage$1(name, this.cognitoConfig.userPoolClientId);
		await this.keyValueStorage.setItem(authKeys.inflightOAuth, `${inflight}`);
	}
	async loadOAuthSignIn() {
		assertTokenProviderConfig(this.cognitoConfig);
		const authKeys = createKeysForAuthStorage$1(name, this.cognitoConfig.userPoolClientId);
		const isLegacyHostedUISignIn = await this.keyValueStorage.getItem(V5_HOSTED_UI_KEY);
		const [isOAuthSignIn, preferPrivateSession] = (await this.keyValueStorage.getItem(authKeys.oauthSignIn))?.split(",") ?? [];
		return {
			isOAuthSignIn: isOAuthSignIn === "true" || isLegacyHostedUISignIn === "true",
			preferPrivateSession: preferPrivateSession === "true"
		};
	}
	async storeOAuthSignIn(oauthSignIn, preferPrivateSession = false) {
		assertTokenProviderConfig(this.cognitoConfig);
		const authKeys = createKeysForAuthStorage$1(name, this.cognitoConfig.userPoolClientId);
		await this.keyValueStorage.setItem(authKeys.oauthSignIn, `${oauthSignIn},${preferPrivateSession}`);
	}
};
var createKeysForAuthStorage$1 = (provider, identifier) => {
	return getAuthStorageKeys(OAuthStorageKeys)(provider, identifier);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/oAuthStore.mjs
var oAuthStore = new DefaultOAuthStore(defaultStorage);
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/inflightPromise.mjs
var inflightPromises = [];
var addInflightPromise = (resolver) => {
	inflightPromises.push(resolver);
};
var resolveAndClearInflightPromises = () => {
	while (inflightPromises.length) inflightPromises.pop()?.();
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/tokenProvider/TokenOrchestrator.mjs
var TokenOrchestrator = class {
	constructor() {
		this.waitForInflightOAuth = isBrowser() ? async () => {
			if (!await oAuthStore.loadOAuthInFlight()) return;
			if (this.inflightPromise) return this.inflightPromise;
			this.inflightPromise = new Promise((resolve, _reject) => {
				addInflightPromise(resolve);
			});
			return this.inflightPromise;
		} : async () => {};
	}
	setAuthConfig(authConfig) {
		oAuthStore.setAuthConfig(authConfig.Cognito);
		this.authConfig = authConfig;
	}
	setTokenRefresher(tokenRefresher) {
		this.tokenRefresher = tokenRefresher;
	}
	setAuthTokenStore(tokenStore) {
		this.tokenStore = tokenStore;
	}
	getTokenStore() {
		if (!this.tokenStore) throw new AuthError({
			name: "EmptyTokenStoreException",
			message: "TokenStore not set"
		});
		return this.tokenStore;
	}
	getTokenRefresher() {
		if (!this.tokenRefresher) throw new AuthError({
			name: "EmptyTokenRefresherException",
			message: "TokenRefresher not set"
		});
		return this.tokenRefresher;
	}
	setClientMetadataProvider(clientMetadataProvider) {
		this.clientMetadataProvider = clientMetadataProvider;
	}
	async getTokens(options) {
		let tokens;
		try {
			assertTokenProviderConfig(this.authConfig?.Cognito);
		} catch (_err) {
			return null;
		}
		await this.waitForInflightOAuth();
		this.inflightPromise = void 0;
		tokens = await this.getTokenStore().loadTokens();
		const username = await this.getTokenStore().getLastAuthUser();
		if (tokens === null) return null;
		const idTokenExpired = !!tokens?.idToken && isTokenExpired({
			expiresAt: (tokens.idToken?.payload?.exp ?? 0) * 1e3,
			clockDrift: tokens.clockDrift ?? 0
		});
		const accessTokenExpired = isTokenExpired({
			expiresAt: (tokens.accessToken?.payload?.exp ?? 0) * 1e3,
			clockDrift: tokens.clockDrift ?? 0
		});
		if (options?.forceRefresh || idTokenExpired || accessTokenExpired) {
			tokens = await this.refreshTokens({
				tokens,
				username,
				clientMetadata: options?.clientMetadata ?? await this.clientMetadataProvider?.()
			});
			if (tokens === null) return null;
		}
		return {
			accessToken: tokens?.accessToken,
			idToken: tokens?.idToken,
			signInDetails: tokens?.signInDetails
		};
	}
	async refreshTokens({ tokens, username, clientMetadata }) {
		try {
			const { signInDetails } = tokens;
			const newTokens = await this.getTokenRefresher()({
				tokens,
				authConfig: this.authConfig,
				username,
				clientMetadata
			});
			newTokens.signInDetails = signInDetails;
			await this.setTokens({ tokens: newTokens });
			Hub.dispatch("auth", { event: "tokenRefresh" }, "Auth", AMPLIFY_SYMBOL);
			return newTokens;
		} catch (err) {
			return this.handleErrors(err);
		}
	}
	handleErrors(err) {
		assertServiceError(err);
		if (this.isAuthenticationError(err)) this.clearTokens();
		Hub.dispatch("auth", {
			event: "tokenRefresh_failure",
			data: { error: err }
		}, "Auth", AMPLIFY_SYMBOL);
		if (err.name.startsWith("NotAuthorizedException")) return null;
		throw err;
	}
	isAuthenticationError(err) {
		return [
			"NotAuthorizedException",
			"TokenRevokedException",
			"UserNotFoundException",
			"PasswordResetRequiredException",
			"UserNotConfirmedException",
			"RefreshTokenReuseException"
		].some((errorName) => err?.name?.startsWith?.(errorName));
	}
	async setTokens({ tokens }) {
		return this.getTokenStore().storeTokens(tokens);
	}
	async clearTokens() {
		return this.getTokenStore().clearTokens();
	}
	getDeviceMetadata(username) {
		return this.getTokenStore().getDeviceMetadata(username);
	}
	clearDeviceMetadata(username) {
		return this.getTokenStore().clearDeviceMetadata(username);
	}
	setOAuthMetadata(metadata) {
		return this.getTokenStore().setOAuthMetadata(metadata);
	}
	getOAuthMetadata() {
		return this.getTokenStore().getOAuthMetadata();
	}
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/tokenProvider/CognitoUserPoolsTokenProvider.mjs
var CognitoUserPoolsTokenProvider = class {
	constructor() {
		this.authTokenStore = new DefaultTokenStore();
		this.authTokenStore.setKeyValueStorage(defaultStorage);
		this.tokenOrchestrator = new TokenOrchestrator();
		this.tokenOrchestrator.setAuthTokenStore(this.authTokenStore);
		this.tokenOrchestrator.setTokenRefresher(refreshAuthTokens);
	}
	getTokens(options = {}) {
		return this.tokenOrchestrator.getTokens(options);
	}
	setKeyValueStorage(keyValueStorage) {
		this.authTokenStore.setKeyValueStorage(keyValueStorage);
	}
	setClientMetadataProvider(clientMetadataProvider) {
		this.tokenOrchestrator.setClientMetadataProvider(clientMetadataProvider);
	}
	setAuthConfig(authConfig) {
		this.authTokenStore.setAuthConfig(authConfig);
		this.tokenOrchestrator.setAuthConfig(authConfig);
	}
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/tokenProvider/tokenProvider.mjs
/**
* The default provider for the JWT access token and ID token issued from the configured Cognito user pool. It manages
* the refresh and storage of the tokens. It stores the tokens in `window.localStorage` if available, and falls back to
* in-memory storage if not.
*/
var cognitoUserPoolsTokenProvider = new CognitoUserPoolsTokenProvider();
var { tokenOrchestrator } = cognitoUserPoolsTokenProvider;
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/tokenProvider/cacheTokens.mjs
async function cacheCognitoTokens(AuthenticationResult) {
	if (AuthenticationResult.AccessToken) {
		const accessToken = decodeJWT(AuthenticationResult.AccessToken);
		const accessTokenIssuedAtInMillis = (accessToken.payload.iat || 0) * 1e3;
		const currentTime = (/* @__PURE__ */ new Date()).getTime();
		const clockDrift = accessTokenIssuedAtInMillis > 0 ? accessTokenIssuedAtInMillis - currentTime : 0;
		let idToken;
		let refreshToken;
		let deviceMetadata;
		if (AuthenticationResult.RefreshToken) refreshToken = AuthenticationResult.RefreshToken;
		if (AuthenticationResult.IdToken) idToken = decodeJWT(AuthenticationResult.IdToken);
		if (AuthenticationResult?.NewDeviceMetadata) deviceMetadata = AuthenticationResult.NewDeviceMetadata;
		const tokens = {
			accessToken,
			idToken,
			refreshToken,
			clockDrift,
			deviceMetadata,
			username: AuthenticationResult.username
		};
		if (AuthenticationResult?.signInDetails) tokens.signInDetails = AuthenticationResult.signInDetails;
		await tokenOrchestrator.setTokens({ tokens });
	} else throw new AmplifyError({
		message: "Invalid tokens",
		name: "InvalidTokens",
		recoverySuggestion: "Check Cognito UserPool settings"
	});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/dispatchSignedInHubEvent.mjs
var ERROR_MESSAGE = "Unable to get user session following successful sign-in.";
var dispatchSignedInHubEvent = async () => {
	try {
		Hub.dispatch("auth", {
			event: "signedIn",
			data: await getCurrentUser()
		}, "Auth", AMPLIFY_SYMBOL);
	} catch (error) {
		if (error.name === "UserUnAuthenticatedException") throw new AuthError({
			name: UNEXPECTED_SIGN_IN_INTERRUPTION_EXCEPTION,
			message: ERROR_MESSAGE,
			recoverySuggestion: "This most likely is due to auth tokens not being persisted. If you are using cookie store, please ensure cookies can be correctly set from your server."
		});
		throw error;
	}
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/utils/store/autoSignInStore.mjs
function defaultState() {
	return { active: false };
}
var autoSignInReducer = (state, action) => {
	switch (action.type) {
		case "SET_USERNAME": return {
			...state,
			username: action.value
		};
		case "SET_SESSION": return {
			...state,
			session: action.value
		};
		case "START": return {
			...state,
			active: true
		};
		case "RESET": return defaultState();
		default: return state;
	}
};
var createAutoSignInStore = (reducer) => {
	let currentState = reducer(defaultState(), { type: "RESET" });
	return {
		getState: () => currentState,
		dispatch: (action) => {
			currentState = reducer(currentState, action);
		}
	};
};
var autoSignInStore = createAutoSignInStore(autoSignInReducer);
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/utils/store/signInStore.mjs
var MS_TO_EXPIRY = 180 * 1e3;
var TGT_STATE = "CognitoSignInState";
var SIGN_IN_STATE_KEYS = {
	username: `${TGT_STATE}.username`,
	challengeName: `${TGT_STATE}.challengeName`,
	signInSession: `${TGT_STATE}.signInSession`,
	expiry: `${TGT_STATE}.expiry`
};
var signInReducer = (state, action) => {
	switch (action.type) {
		case "SET_SIGN_IN_SESSION":
			persistSignInState({ signInSession: action.value });
			return {
				...state,
				signInSession: action.value
			};
		case "SET_SIGN_IN_STATE":
			persistSignInState(action.value);
			return { ...action.value };
		case "SET_CHALLENGE_NAME":
			persistSignInState({ challengeName: action.value });
			return {
				...state,
				challengeName: action.value
			};
		case "SET_USERNAME":
			persistSignInState({ username: action.value });
			return {
				...state,
				username: action.value
			};
		case "SET_INITIAL_STATE": return getInitialState();
		case "RESET_STATE":
			clearPersistedSignInState();
			return getDefaultState();
		default: return state;
	}
};
var isExpired = (expiryDate) => {
	return Number(expiryDate) <= Date.now();
};
var resetActiveSignInState = () => {
	signInStore.dispatch({ type: "RESET_STATE" });
};
var clearPersistedSignInState = () => {
	for (const stateKey of Object.values(SIGN_IN_STATE_KEYS)) syncSessionStorage.removeItem(stateKey);
};
var getDefaultState = () => ({
	username: void 0,
	challengeName: void 0,
	signInSession: void 0
});
var getInitialState = () => {
	const expiry = syncSessionStorage.getItem(SIGN_IN_STATE_KEYS.expiry);
	if (!expiry || isExpired(expiry)) {
		clearPersistedSignInState();
		return getDefaultState();
	}
	return {
		username: syncSessionStorage.getItem(SIGN_IN_STATE_KEYS.username) ?? void 0,
		challengeName: syncSessionStorage.getItem(SIGN_IN_STATE_KEYS.challengeName) ?? void 0,
		signInSession: syncSessionStorage.getItem(SIGN_IN_STATE_KEYS.signInSession) ?? void 0
	};
};
var createStore = (reducer) => {
	let currentState = reducer(getDefaultState(), { type: "SET_INITIAL_STATE" });
	return {
		getState: () => currentState,
		dispatch: (action) => {
			currentState = reducer(currentState, action);
		}
	};
};
var signInStore = createStore(signInReducer);
function setActiveSignInState(state) {
	signInStore.dispatch({
		type: "SET_SIGN_IN_STATE",
		value: state
	});
}
var persistSignInState = ({ challengeName, signInSession, username }) => {
	username && syncSessionStorage.setItem(SIGN_IN_STATE_KEYS.username, username);
	challengeName && syncSessionStorage.setItem(SIGN_IN_STATE_KEYS.challengeName, challengeName);
	if (signInSession) {
		syncSessionStorage.setItem(SIGN_IN_STATE_KEYS.signInSession, signInSession);
		syncSessionStorage.setItem(SIGN_IN_STATE_KEYS.expiry, String(Date.now() + MS_TO_EXPIRY));
	}
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/utils/passkey/errors/passkeyErrorPlatformConstants.mjs
var NOT_SUPPORTED_RECOVERY_SUGGESTION = "Passkeys may not be supported on this device. Ensure your application is running in a secure context (HTTPS) and Web Authentication API is supported.";
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/utils/passkey/errors/passkeyError.mjs
var PasskeyError = class PasskeyError extends AmplifyError {
	constructor(params) {
		super(params);
		this.constructor = PasskeyError;
		Object.setPrototypeOf(this, PasskeyError.prototype);
	}
};
var PasskeyErrorCode;
(function(PasskeyErrorCode) {
	PasskeyErrorCode["PasskeyNotSupported"] = "PasskeyNotSupported";
	PasskeyErrorCode["PasskeyAlreadyExists"] = "PasskeyAlreadyExists";
	PasskeyErrorCode["InvalidPasskeyRegistrationOptions"] = "InvalidPasskeyRegistrationOptions";
	PasskeyErrorCode["InvalidPasskeyAuthenticationOptions"] = "InvalidPasskeyAuthenticationOptions";
	PasskeyErrorCode["RelyingPartyMismatch"] = "RelyingPartyMismatch";
	PasskeyErrorCode["PasskeyRegistrationFailed"] = "PasskeyRegistrationFailed";
	PasskeyErrorCode["PasskeyRetrievalFailed"] = "PasskeyRetrievalFailed";
	PasskeyErrorCode["PasskeyRegistrationCanceled"] = "PasskeyRegistrationCanceled";
	PasskeyErrorCode["PasskeyAuthenticationCanceled"] = "PasskeyAuthenticationCanceled";
	PasskeyErrorCode["PasskeyOperationAborted"] = "PasskeyOperationAborted";
})(PasskeyErrorCode || (PasskeyErrorCode = {}));
var ABORT_OR_CANCEL_RECOVERY_SUGGESTION = "User may have canceled the ceremony or another interruption has occurred. Check underlying error for details.";
var MISCONFIGURATION_RECOVERY_SUGGESTION = "Ensure your user pool is configured to support the WEB_AUTHN as an authentication factor.";
var passkeyErrorMap = {
	[PasskeyErrorCode.PasskeyNotSupported]: {
		message: "Passkeys may not be supported on this device.",
		recoverySuggestion: NOT_SUPPORTED_RECOVERY_SUGGESTION
	},
	[PasskeyErrorCode.InvalidPasskeyRegistrationOptions]: {
		message: "Invalid passkey registration options.",
		recoverySuggestion: MISCONFIGURATION_RECOVERY_SUGGESTION
	},
	[PasskeyErrorCode.InvalidPasskeyAuthenticationOptions]: {
		message: "Invalid passkey authentication options.",
		recoverySuggestion: MISCONFIGURATION_RECOVERY_SUGGESTION
	},
	[PasskeyErrorCode.PasskeyRegistrationFailed]: {
		message: "Device failed to create passkey.",
		recoverySuggestion: NOT_SUPPORTED_RECOVERY_SUGGESTION
	},
	[PasskeyErrorCode.PasskeyRetrievalFailed]: {
		message: "Device failed to retrieve passkey.",
		recoverySuggestion: "Passkeys may not be available on this device. Try an alternative authentication factor like PASSWORD, EMAIL_OTP, or SMS_OTP."
	},
	[PasskeyErrorCode.PasskeyAlreadyExists]: {
		message: "Passkey already exists in authenticator.",
		recoverySuggestion: "Proceed with existing passkey or try again after deleting the credential."
	},
	[PasskeyErrorCode.PasskeyRegistrationCanceled]: {
		message: "Passkey registration ceremony has been canceled.",
		recoverySuggestion: ABORT_OR_CANCEL_RECOVERY_SUGGESTION
	},
	[PasskeyErrorCode.PasskeyAuthenticationCanceled]: {
		message: "Passkey authentication ceremony has been canceled.",
		recoverySuggestion: ABORT_OR_CANCEL_RECOVERY_SUGGESTION
	},
	[PasskeyErrorCode.PasskeyOperationAborted]: {
		message: "Passkey operation has been aborted.",
		recoverySuggestion: ABORT_OR_CANCEL_RECOVERY_SUGGESTION
	},
	[PasskeyErrorCode.RelyingPartyMismatch]: {
		message: "Relying party does not match current domain.",
		recoverySuggestion: "Ensure relying party identifier matches current domain."
	}
};
var assertPasskeyError = createAssertionFunction(passkeyErrorMap, PasskeyError);
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/utils/passkey/errors/handlePasskeyError.mjs
/**
* Handles Overlapping Passkey Errors Between Registration & Authentication
* https://w3c.github.io/webauthn/#sctn-create-request-exceptions
* https://w3c.github.io/webauthn/#sctn-get-request-exceptions
*
* @param err unknown
* @returns PasskeyError
*/
var handlePasskeyError = (err) => {
	if (err instanceof Error) {
		if (err.name === "AbortError") {
			const { message, recoverySuggestion } = passkeyErrorMap[PasskeyErrorCode.PasskeyOperationAborted];
			return new PasskeyError({
				name: PasskeyErrorCode.PasskeyOperationAborted,
				message,
				recoverySuggestion,
				underlyingError: err
			});
		}
		if (err.name === "SecurityError") {
			const { message, recoverySuggestion } = passkeyErrorMap[PasskeyErrorCode.RelyingPartyMismatch];
			return new PasskeyError({
				name: PasskeyErrorCode.RelyingPartyMismatch,
				message,
				recoverySuggestion,
				underlyingError: err
			});
		}
	}
	return new PasskeyError({
		name: AmplifyErrorCode.Unknown,
		message: "An unknown error has occurred.",
		underlyingError: err
	});
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/utils/passkey/errors/handlePasskeyAuthenticationError.mjs
/**
* Handle Passkey Authentication Errors
* https://w3c.github.io/webauthn/#sctn-get-request-exceptions
*
* @param err unknown
* @returns PasskeyError
*/
var handlePasskeyAuthenticationError = (err) => {
	if (err instanceof PasskeyError) return err;
	if (err instanceof Error) {
		if (err.name === "NotAllowedError") {
			const { message, recoverySuggestion } = passkeyErrorMap[PasskeyErrorCode.PasskeyAuthenticationCanceled];
			return new PasskeyError({
				name: PasskeyErrorCode.PasskeyAuthenticationCanceled,
				message,
				recoverySuggestion,
				underlyingError: err
			});
		}
	}
	return handlePasskeyError(err);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/utils/passkey/getIsPasskeySupported.mjs
/**
* Determines if passkey is supported in current context
* Will return false if executed in non-secure context
* @returns boolean
*/
var getIsPasskeySupported = () => {
	return isBrowser() && window.isSecureContext && "credentials" in navigator && typeof window.PublicKeyCredential === "function";
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/convert/base64url/convertArrayBufferToBase64Url.mjs
/**
* Converts an ArrayBuffer to a base64url encoded string
* @param buffer - the ArrayBuffer instance of a Uint8Array
* @returns string - a base64url encoded string
*/
var convertArrayBufferToBase64Url = (buffer) => {
	return base64Encoder.convert(new Uint8Array(buffer), {
		urlSafe: true,
		skipPadding: true
	});
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/convert/base64url/convertBase64UrlToArrayBuffer.mjs
/**
* Converts a base64url encoded string to an ArrayBuffer
* @param base64url - a base64url encoded string
* @returns ArrayBuffer
*/
var convertBase64UrlToArrayBuffer = (base64url) => {
	return Uint8Array.from(base64Decoder.convert(base64url, { urlSafe: true }), (x) => x.charCodeAt(0)).buffer;
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/utils/passkey/serde.mjs
/**
* Deserializes Public Key Credential Creation Options JSON
* @param input PasskeyCreateOptionsJson
* @returns PublicKeyCredentialCreationOptions
*/
var deserializeJsonToPkcCreationOptions = (input) => {
	const userIdBuffer = convertBase64UrlToArrayBuffer(input.user.id);
	const challengeBuffer = convertBase64UrlToArrayBuffer(input.challenge);
	const excludeCredentialsWithBuffer = (input.excludeCredentials || []).map((excludeCred) => ({
		...excludeCred,
		id: convertBase64UrlToArrayBuffer(excludeCred.id)
	}));
	return {
		...input,
		excludeCredentials: excludeCredentialsWithBuffer,
		challenge: challengeBuffer,
		user: {
			...input.user,
			id: userIdBuffer
		}
	};
};
/**
* Serializes a Public Key Credential With Attestation to JSON
* @param input PasskeyCreateResult
* @returns PasskeyCreateResultJson
*/
var serializePkcWithAttestationToJson = (input) => {
	const response = {
		clientDataJSON: convertArrayBufferToBase64Url(input.response.clientDataJSON),
		attestationObject: convertArrayBufferToBase64Url(input.response.attestationObject),
		transports: input.response.getTransports(),
		publicKeyAlgorithm: input.response.getPublicKeyAlgorithm(),
		authenticatorData: convertArrayBufferToBase64Url(input.response.getAuthenticatorData())
	};
	const publicKey = input.response.getPublicKey();
	if (publicKey) response.publicKey = convertArrayBufferToBase64Url(publicKey);
	const resultJson = {
		type: input.type,
		id: input.id,
		rawId: convertArrayBufferToBase64Url(input.rawId),
		clientExtensionResults: input.getClientExtensionResults(),
		response
	};
	if (input.authenticatorAttachment) resultJson.authenticatorAttachment = input.authenticatorAttachment;
	return resultJson;
};
/**
* Deserializes Public Key Credential Get Options JSON
* @param input PasskeyGetOptionsJson
* @returns PublicKeyCredentialRequestOptions
*/
var deserializeJsonToPkcGetOptions = (input) => {
	const challengeBuffer = convertBase64UrlToArrayBuffer(input.challenge);
	const allowedCredentialsWithBuffer = (input.allowCredentials || []).map((allowedCred) => ({
		...allowedCred,
		id: convertBase64UrlToArrayBuffer(allowedCred.id)
	}));
	return {
		...input,
		challenge: challengeBuffer,
		allowCredentials: allowedCredentialsWithBuffer
	};
};
/**
* Serializes a Public Key Credential With Attestation to JSON
* @param input PasskeyGetResult
* @returns PasskeyGetResultJson
*/
var serializePkcWithAssertionToJson = (input) => {
	const response = {
		clientDataJSON: convertArrayBufferToBase64Url(input.response.clientDataJSON),
		authenticatorData: convertArrayBufferToBase64Url(input.response.authenticatorData),
		signature: convertArrayBufferToBase64Url(input.response.signature)
	};
	if (input.response.userHandle) response.userHandle = convertArrayBufferToBase64Url(input.response.userHandle);
	const resultJson = {
		id: input.id,
		rawId: convertArrayBufferToBase64Url(input.rawId),
		type: input.type,
		clientExtensionResults: input.getClientExtensionResults(),
		response
	};
	if (input.authenticatorAttachment) resultJson.authenticatorAttachment = input.authenticatorAttachment;
	return resultJson;
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/utils/passkey/types/shared.mjs
function assertValidCredentialCreationOptions(credentialCreationOptions) {
	assertPasskeyError([
		!!credentialCreationOptions,
		!!credentialCreationOptions?.challenge,
		!!credentialCreationOptions?.user,
		!!credentialCreationOptions?.rp,
		!!credentialCreationOptions?.pubKeyCredParams
	].every(Boolean), PasskeyErrorCode.InvalidPasskeyRegistrationOptions);
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/utils/passkey/types/index.mjs
function assertCredentialIsPkcWithAuthenticatorAttestationResponse(credential) {
	assertPasskeyError(credential && credential instanceof PublicKeyCredential && credential.response instanceof AuthenticatorAttestationResponse, PasskeyErrorCode.PasskeyRegistrationFailed);
}
function assertCredentialIsPkcWithAuthenticatorAssertionResponse(credential) {
	assertPasskeyError(credential && credential instanceof PublicKeyCredential && credential.response instanceof AuthenticatorAssertionResponse, PasskeyErrorCode.PasskeyRetrievalFailed);
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/utils/passkey/getPasskey.mjs
var getPasskey = async (input) => {
	try {
		assertPasskeyError(getIsPasskeySupported(), PasskeyErrorCode.PasskeyNotSupported);
		const passkeyGetOptions = deserializeJsonToPkcGetOptions(input);
		const credential = await navigator.credentials.get({ publicKey: passkeyGetOptions });
		assertCredentialIsPkcWithAuthenticatorAssertionResponse(credential);
		return serializePkcWithAssertionToJson(credential);
	} catch (err) {
		throw handlePasskeyAuthenticationError(err);
	}
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createConfirmDeviceClient.mjs
var createConfirmDeviceClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("ConfirmDevice"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/textEncoder/index.mjs
var textEncoder = { convert(input) {
	return new TextEncoder().encode(input);
} };
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/BigInteger/BigInteger.mjs
function BigInteger(a, b) {
	if (a != null) this.fromString(a, b);
}
function nbi() {
	return new BigInteger(null, null);
}
var dbits;
function am1(i, x, w, j, c, n) {
	while (--n >= 0) {
		const v = x * this[i++] + w[j] + c;
		c = Math.floor(v / 67108864);
		w[j++] = v & 67108863;
	}
	return c;
}
function am2(i, x, w, j, c, n) {
	const xl = x & 32767;
	const xh = x >> 15;
	while (--n >= 0) {
		let l = this[i] & 32767;
		const h = this[i++] >> 15;
		const m = xh * l + h * xl;
		l = xl * l + ((m & 32767) << 15) + w[j] + (c & 1073741823);
		c = (l >>> 30) + (m >>> 15) + xh * h + (c >>> 30);
		w[j++] = l & 1073741823;
	}
	return c;
}
function am3(i, x, w, j, c, n) {
	const xl = x & 16383;
	const xh = x >> 14;
	while (--n >= 0) {
		let l = this[i] & 16383;
		const h = this[i++] >> 14;
		const m = xh * l + h * xl;
		l = xl * l + ((m & 16383) << 14) + w[j] + c;
		c = (l >> 28) + (m >> 14) + xh * h;
		w[j++] = l & 268435455;
	}
	return c;
}
var inBrowser = typeof navigator !== "undefined";
if (inBrowser && navigator.appName === "Microsoft Internet Explorer") {
	BigInteger.prototype.am = am2;
	dbits = 30;
} else if (inBrowser && navigator.appName !== "Netscape") {
	BigInteger.prototype.am = am1;
	dbits = 26;
} else {
	BigInteger.prototype.am = am3;
	dbits = 28;
}
BigInteger.prototype.DB = dbits;
BigInteger.prototype.DM = (1 << dbits) - 1;
BigInteger.prototype.DV = 1 << dbits;
var BI_FP = 52;
BigInteger.prototype.FV = Math.pow(2, BI_FP);
BigInteger.prototype.F1 = BI_FP - dbits;
BigInteger.prototype.F2 = 2 * dbits - BI_FP;
var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = [];
var rr = "0".charCodeAt(0), vv;
for (vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
rr = "a".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
rr = "A".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
function int2char(n) {
	return BI_RM.charAt(n);
}
function intAt(s, i) {
	const c = BI_RC[s.charCodeAt(i)];
	return c == null ? -1 : c;
}
function bnpCopyTo(r) {
	for (let i = this.t - 1; i >= 0; --i) r[i] = this[i];
	r.t = this.t;
	r.s = this.s;
}
function bnpFromInt(x) {
	this.t = 1;
	this.s = x < 0 ? -1 : 0;
	if (x > 0) this[0] = x;
	else if (x < -1) this[0] = x + this.DV;
	else this.t = 0;
}
function nbv(i) {
	const r = nbi();
	r.fromInt(i);
	return r;
}
function bnpFromString(s, b) {
	let k;
	if (b === 16) k = 4;
	else if (b === 8) k = 3;
	else if (b === 2) k = 1;
	else if (b === 32) k = 5;
	else if (b === 4) k = 2;
	else throw new Error("Only radix 2, 4, 8, 16, 32 are supported");
	this.t = 0;
	this.s = 0;
	let i = s.length;
	let mi = false;
	let sh = 0;
	while (--i >= 0) {
		const x = intAt(s, i);
		if (x < 0) {
			if (s.charAt(i) === "-") mi = true;
			continue;
		}
		mi = false;
		if (sh === 0) this[this.t++] = x;
		else if (sh + k > this.DB) {
			this[this.t - 1] |= (x & (1 << this.DB - sh) - 1) << sh;
			this[this.t++] = x >> this.DB - sh;
		} else this[this.t - 1] |= x << sh;
		sh += k;
		if (sh >= this.DB) sh -= this.DB;
	}
	this.clamp();
	if (mi) BigInteger.ZERO.subTo(this, this);
}
function bnpClamp() {
	const c = this.s & this.DM;
	while (this.t > 0 && this[this.t - 1] == c) --this.t;
}
function bnToString(b) {
	if (this.s < 0) return "-" + this.negate().toString(b);
	let k;
	if (b == 16) k = 4;
	else if (b === 8) k = 3;
	else if (b === 2) k = 1;
	else if (b === 32) k = 5;
	else if (b === 4) k = 2;
	else throw new Error("Only radix 2, 4, 8, 16, 32 are supported");
	const km = (1 << k) - 1;
	let d;
	let m = false;
	let r = "";
	let i = this.t;
	let p = this.DB - i * this.DB % k;
	if (i-- > 0) {
		if (p < this.DB && (d = this[i] >> p) > 0) {
			m = true;
			r = int2char(d);
		}
		while (i >= 0) {
			if (p < k) {
				d = (this[i] & (1 << p) - 1) << k - p;
				d |= this[--i] >> (p += this.DB - k);
			} else {
				d = this[i] >> (p -= k) & km;
				if (p <= 0) {
					p += this.DB;
					--i;
				}
			}
			if (d > 0) m = true;
			if (m) r += int2char(d);
		}
	}
	return m ? r : "0";
}
function bnNegate() {
	const r = nbi();
	BigInteger.ZERO.subTo(this, r);
	return r;
}
function bnAbs() {
	return this.s < 0 ? this.negate() : this;
}
function bnCompareTo(a) {
	let r = this.s - a.s;
	if (r != 0) return r;
	let i = this.t;
	r = i - a.t;
	if (r != 0) return this.s < 0 ? -r : r;
	while (--i >= 0) if ((r = this[i] - a[i]) != 0) return r;
	return 0;
}
function nbits(x) {
	let r = 1;
	let t;
	if ((t = x >>> 16) !== 0) {
		x = t;
		r += 16;
	}
	if ((t = x >> 8) !== 0) {
		x = t;
		r += 8;
	}
	if ((t = x >> 4) !== 0) {
		x = t;
		r += 4;
	}
	if ((t = x >> 2) !== 0) {
		x = t;
		r += 2;
	}
	if ((t = x >> 1) !== 0) {
		x = t;
		r += 1;
	}
	return r;
}
function bnBitLength() {
	if (this.t <= 0) return 0;
	return this.DB * (this.t - 1) + nbits(this[this.t - 1] ^ this.s & this.DM);
}
function bnpDLShiftTo(n, r) {
	let i;
	for (i = this.t - 1; i >= 0; --i) r[i + n] = this[i];
	for (i = n - 1; i >= 0; --i) r[i] = 0;
	r.t = this.t + n;
	r.s = this.s;
}
function bnpDRShiftTo(n, r) {
	for (let i = n; i < this.t; ++i) r[i - n] = this[i];
	r.t = Math.max(this.t - n, 0);
	r.s = this.s;
}
function bnpLShiftTo(n, r) {
	const bs = n % this.DB;
	const cbs = this.DB - bs;
	const bm = (1 << cbs) - 1;
	const ds = Math.floor(n / this.DB);
	let c = this.s << bs & this.DM;
	let i;
	for (i = this.t - 1; i >= 0; --i) {
		r[i + ds + 1] = this[i] >> cbs | c;
		c = (this[i] & bm) << bs;
	}
	for (i = ds - 1; i >= 0; --i) r[i] = 0;
	r[ds] = c;
	r.t = this.t + ds + 1;
	r.s = this.s;
	r.clamp();
}
function bnpRShiftTo(n, r) {
	r.s = this.s;
	const ds = Math.floor(n / this.DB);
	if (ds >= this.t) {
		r.t = 0;
		return;
	}
	const bs = n % this.DB;
	const cbs = this.DB - bs;
	const bm = (1 << bs) - 1;
	r[0] = this[ds] >> bs;
	for (let i = ds + 1; i < this.t; ++i) {
		r[i - ds - 1] |= (this[i] & bm) << cbs;
		r[i - ds] = this[i] >> bs;
	}
	if (bs > 0) r[this.t - ds - 1] |= (this.s & bm) << cbs;
	r.t = this.t - ds;
	r.clamp();
}
function bnpSubTo(a, r) {
	let i = 0;
	let c = 0;
	const m = Math.min(a.t, this.t);
	while (i < m) {
		c += this[i] - a[i];
		r[i++] = c & this.DM;
		c >>= this.DB;
	}
	if (a.t < this.t) {
		c -= a.s;
		while (i < this.t) {
			c += this[i];
			r[i++] = c & this.DM;
			c >>= this.DB;
		}
		c += this.s;
	} else {
		c += this.s;
		while (i < a.t) {
			c -= a[i];
			r[i++] = c & this.DM;
			c >>= this.DB;
		}
		c -= a.s;
	}
	r.s = c < 0 ? -1 : 0;
	if (c < -1) r[i++] = this.DV + c;
	else if (c > 0) r[i++] = c;
	r.t = i;
	r.clamp();
}
function bnpMultiplyTo(a, r) {
	const x = this.abs();
	const y = a.abs();
	let i = x.t;
	r.t = i + y.t;
	while (--i >= 0) r[i] = 0;
	for (i = 0; i < y.t; ++i) r[i + x.t] = x.am(0, y[i], r, i, 0, x.t);
	r.s = 0;
	r.clamp();
	if (this.s !== a.s) BigInteger.ZERO.subTo(r, r);
}
function bnpSquareTo(r) {
	const x = this.abs();
	let i = r.t = 2 * x.t;
	while (--i >= 0) r[i] = 0;
	for (i = 0; i < x.t - 1; ++i) {
		const c = x.am(i, x[i], r, 2 * i, 0, 1);
		if ((r[i + x.t] += x.am(i + 1, 2 * x[i], r, 2 * i + 1, c, x.t - i - 1)) >= x.DV) {
			r[i + x.t] -= x.DV;
			r[i + x.t + 1] = 1;
		}
	}
	if (r.t > 0) r[r.t - 1] += x.am(i, x[i], r, 2 * i, 0, 1);
	r.s = 0;
	r.clamp();
}
function bnpDivRemTo(m, q, r) {
	const pm = m.abs();
	if (pm.t <= 0) return;
	const pt = this.abs();
	if (pt.t < pm.t) {
		if (q != null) q.fromInt(0);
		if (r != null) this.copyTo(r);
		return;
	}
	if (r === null) r = nbi();
	const y = nbi();
	const ts = this.s;
	const ms = m.s;
	const nsh = this.DB - nbits(pm[pm.t - 1]);
	if (nsh > 0) {
		pm.lShiftTo(nsh, y);
		pt.lShiftTo(nsh, r);
	} else {
		pm.copyTo(y);
		pt.copyTo(r);
	}
	const ys = y.t;
	const y0 = y[ys - 1];
	if (y0 === 0) return;
	const yt = y0 * (1 << this.F1) + (ys > 1 ? y[ys - 2] >> this.F2 : 0);
	const d1 = this.FV / yt;
	const d2 = (1 << this.F1) / yt;
	const e = 1 << this.F2;
	let i = r.t;
	let j = i - ys;
	const t = q === null ? nbi() : q;
	y.dlShiftTo(j, t);
	if (r.compareTo(t) >= 0) {
		r[r.t++] = 1;
		r.subTo(t, r);
	}
	BigInteger.ONE.dlShiftTo(ys, t);
	t.subTo(y, y);
	while (y.t < ys) y[y.t++] = 0;
	while (--j >= 0) {
		let qd = r[--i] === y0 ? this.DM : Math.floor(r[i] * d1 + (r[i - 1] + e) * d2);
		if ((r[i] += y.am(0, qd, r, j, 0, ys)) < qd) {
			y.dlShiftTo(j, t);
			r.subTo(t, r);
			while (r[i] < --qd) r.subTo(t, r);
		}
	}
	if (q !== null) {
		r.drShiftTo(ys, q);
		if (ts !== ms) BigInteger.ZERO.subTo(q, q);
	}
	r.t = ys;
	r.clamp();
	if (nsh > 0) r.rShiftTo(nsh, r);
	if (ts < 0) BigInteger.ZERO.subTo(r, r);
}
function bnMod(a) {
	const r = nbi();
	this.abs().divRemTo(a, null, r);
	if (this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r, r);
	return r;
}
function bnpInvDigit() {
	if (this.t < 1) return 0;
	const x = this[0];
	if ((x & 1) === 0) return 0;
	let y = x & 3;
	y = y * (2 - (x & 15) * y) & 15;
	y = y * (2 - (x & 255) * y) & 255;
	y = y * (2 - ((x & 65535) * y & 65535)) & 65535;
	y = y * (2 - x * y % this.DV) % this.DV;
	return y > 0 ? this.DV - y : -y;
}
function bnEquals(a) {
	return this.compareTo(a) === 0;
}
function bnpAddTo(a, r) {
	let i = 0;
	let c = 0;
	const m = Math.min(a.t, this.t);
	while (i < m) {
		c += this[i] + a[i];
		r[i++] = c & this.DM;
		c >>= this.DB;
	}
	if (a.t < this.t) {
		c += a.s;
		while (i < this.t) {
			c += this[i];
			r[i++] = c & this.DM;
			c >>= this.DB;
		}
		c += this.s;
	} else {
		c += this.s;
		while (i < a.t) {
			c += a[i];
			r[i++] = c & this.DM;
			c >>= this.DB;
		}
		c += a.s;
	}
	r.s = c < 0 ? -1 : 0;
	if (c > 0) r[i++] = c;
	else if (c < -1) r[i++] = this.DV + c;
	r.t = i;
	r.clamp();
}
function bnAdd(a) {
	const r = nbi();
	this.addTo(a, r);
	return r;
}
function bnSubtract(a) {
	const r = nbi();
	this.subTo(a, r);
	return r;
}
function bnMultiply(a) {
	const r = nbi();
	this.multiplyTo(a, r);
	return r;
}
function bnDivide(a) {
	const r = nbi();
	this.divRemTo(a, r, null);
	return r;
}
function Montgomery(m) {
	this.m = m;
	this.mp = m.invDigit();
	this.mpl = this.mp & 32767;
	this.mph = this.mp >> 15;
	this.um = (1 << m.DB - 15) - 1;
	this.mt2 = 2 * m.t;
}
function montConvert(x) {
	const r = nbi();
	x.abs().dlShiftTo(this.m.t, r);
	r.divRemTo(this.m, null, r);
	if (x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r, r);
	return r;
}
function montRevert(x) {
	const r = nbi();
	x.copyTo(r);
	this.reduce(r);
	return r;
}
function montReduce(x) {
	while (x.t <= this.mt2) x[x.t++] = 0;
	for (let i = 0; i < this.m.t; ++i) {
		let j = x[i] & 32767;
		const u0 = j * this.mpl + ((j * this.mph + (x[i] >> 15) * this.mpl & this.um) << 15) & x.DM;
		j = i + this.m.t;
		x[j] += this.m.am(0, u0, x, i, 0, this.m.t);
		while (x[j] >= x.DV) {
			x[j] -= x.DV;
			x[++j]++;
		}
	}
	x.clamp();
	x.drShiftTo(this.m.t, x);
	if (x.compareTo(this.m) >= 0) x.subTo(this.m, x);
}
function montSqrTo(x, r) {
	x.squareTo(r);
	this.reduce(r);
}
function montMulTo(x, y, r) {
	x.multiplyTo(y, r);
	this.reduce(r);
}
Montgomery.prototype.convert = montConvert;
Montgomery.prototype.revert = montRevert;
Montgomery.prototype.reduce = montReduce;
Montgomery.prototype.mulTo = montMulTo;
Montgomery.prototype.sqrTo = montSqrTo;
function bnModPow(e, m, callback) {
	let i = e.bitLength();
	let k;
	let r = nbv(1);
	const z = new Montgomery(m);
	if (i <= 0) return r;
	else if (i < 18) k = 1;
	else if (i < 48) k = 3;
	else if (i < 144) k = 4;
	else if (i < 768) k = 5;
	else k = 6;
	const g = [];
	let n = 3;
	const k1 = k - 1;
	const km = (1 << k) - 1;
	g[1] = z.convert(this);
	if (k > 1) {
		const g2 = nbi();
		z.sqrTo(g[1], g2);
		while (n <= km) {
			g[n] = nbi();
			z.mulTo(g2, g[n - 2], g[n]);
			n += 2;
		}
	}
	let j = e.t - 1;
	let w;
	let is1 = true;
	let r2 = nbi();
	let t;
	i = nbits(e[j]) - 1;
	while (j >= 0) {
		if (i >= k1) w = e[j] >> i - k1 & km;
		else {
			w = (e[j] & (1 << i + 1) - 1) << k1 - i;
			if (j > 0) w |= e[j - 1] >> this.DB + i - k1;
		}
		n = k;
		while ((w & 1) === 0) {
			w >>= 1;
			--n;
		}
		if ((i -= n) < 0) {
			i += this.DB;
			--j;
		}
		if (is1) {
			g[w].copyTo(r);
			is1 = false;
		} else {
			while (n > 1) {
				z.sqrTo(r, r2);
				z.sqrTo(r2, r);
				n -= 2;
			}
			if (n > 0) z.sqrTo(r, r2);
			else {
				t = r;
				r = r2;
				r2 = t;
			}
			z.mulTo(r2, g[w], r);
		}
		while (j >= 0 && (e[j] & 1 << i) === 0) {
			z.sqrTo(r, r2);
			t = r;
			r = r2;
			r2 = t;
			if (--i < 0) {
				i = this.DB - 1;
				--j;
			}
		}
	}
	const result = z.revert(r);
	callback(null, result);
	return result;
}
BigInteger.prototype.copyTo = bnpCopyTo;
BigInteger.prototype.fromInt = bnpFromInt;
BigInteger.prototype.fromString = bnpFromString;
BigInteger.prototype.clamp = bnpClamp;
BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
BigInteger.prototype.drShiftTo = bnpDRShiftTo;
BigInteger.prototype.lShiftTo = bnpLShiftTo;
BigInteger.prototype.rShiftTo = bnpRShiftTo;
BigInteger.prototype.subTo = bnpSubTo;
BigInteger.prototype.multiplyTo = bnpMultiplyTo;
BigInteger.prototype.squareTo = bnpSquareTo;
BigInteger.prototype.divRemTo = bnpDivRemTo;
BigInteger.prototype.invDigit = bnpInvDigit;
BigInteger.prototype.addTo = bnpAddTo;
BigInteger.prototype.toString = bnToString;
BigInteger.prototype.negate = bnNegate;
BigInteger.prototype.abs = bnAbs;
BigInteger.prototype.compareTo = bnCompareTo;
BigInteger.prototype.bitLength = bnBitLength;
BigInteger.prototype.mod = bnMod;
BigInteger.prototype.equals = bnEquals;
BigInteger.prototype.add = bnAdd;
BigInteger.prototype.subtract = bnSubtract;
BigInteger.prototype.multiply = bnMultiply;
BigInteger.prototype.divide = bnDivide;
BigInteger.prototype.modPow = bnModPow;
BigInteger.ZERO = nbv(0);
BigInteger.ONE = nbv(1);
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/calculate/calculateS.mjs
/**
* @internal
*/
var calculateS = async ({ a, g, k, x, B, N, U }) => {
	return new Promise((resolve, reject) => {
		g.modPow(x, N, (outerErr, outerResult) => {
			if (outerErr) {
				reject(outerErr);
				return;
			}
			B.subtract(k.multiply(outerResult)).modPow(a.add(U.multiply(x)), N, (innerErr, innerResult) => {
				if (innerErr) {
					reject(innerErr);
					return;
				}
				resolve(innerResult.mod(N));
			});
		});
	});
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/constants.mjs
var INIT_N = "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF";
var SHORT_TO_HEX = {};
var HEX_TO_SHORT = {};
for (let i = 0; i < 256; i++) {
	let encodedByte = i.toString(16).toLowerCase();
	if (encodedByte.length === 1) encodedByte = `0${encodedByte}`;
	SHORT_TO_HEX[i] = encodedByte;
	HEX_TO_SHORT[encodedByte] = i;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/getBytesFromHex.mjs
/**
* Converts a hexadecimal encoded string to a Uint8Array of bytes.
*
* @param encoded The hexadecimal encoded string
*/
var getBytesFromHex = (encoded) => {
	if (encoded.length % 2 !== 0) throw new Error("Hex encoded strings must have an even number length");
	const out = new Uint8Array(encoded.length / 2);
	for (let i = 0; i < encoded.length; i += 2) {
		const encodedByte = encoded.slice(i, i + 2).toLowerCase();
		if (encodedByte in HEX_TO_SHORT) out[i / 2] = HEX_TO_SHORT[encodedByte];
		else throw new Error(`Cannot decode unrecognized sequence ${encodedByte} as hexadecimal`);
	}
	return out;
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/getHexFromBytes.mjs
/**
* Converts a Uint8Array of binary data to a hexadecimal encoded string.
*
* @param bytes The binary data to encode
*/
var getHexFromBytes = (bytes) => {
	let out = "";
	for (let i = 0; i < bytes.byteLength; i++) out += SHORT_TO_HEX[bytes[i]];
	return out;
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/getHashFromData.mjs
/**
* Calculate a hash from a `SourceData`
* @param {SourceData} data Value to hash.
* @returns {string} Hex-encoded hash.
* @private
*/
var getHashFromData = (data) => {
	const sha256 = new Sha256();
	sha256.update(data);
	const hashHexFromUint8 = getHexFromBytes(sha256.digestSync());
	return new Array(64 - hashHexFromUint8.length).join("0") + hashHexFromUint8;
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/getHashFromHex.mjs
/**
* Calculate a hash from a hex string
* @param {string} hexStr Value to hash.
* @returns {string} Hex-encoded hash.
* @private
*/
var getHashFromHex = (hexStr) => getHashFromData(getBytesFromHex(hexStr));
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/getPaddedHex.mjs
/**
* Tests if a hex string has it most significant bit set (case-insensitive regex)
*/
var HEX_MSB_REGEX = /^[89a-f]/i;
/**
* Returns an unambiguous, even-length hex string of the two's complement encoding of an integer.
*
* It is compatible with the hex encoding of Java's BigInteger's toByteArray(), wich returns a
* byte array containing the two's-complement representation of a BigInteger. The array contains
* the minimum number of bytes required to represent the BigInteger, including at least one sign bit.
*
* Examples showing how ambiguity is avoided by left padding with:
* 	"00" (for positive values where the most-significant-bit is set)
*  "FF" (for negative values where the most-significant-bit is set)
*
* padHex(bigInteger.fromInt(-236))  === "FF14"
* padHex(bigInteger.fromInt(20))    === "14"
*
* padHex(bigInteger.fromInt(-200))  === "FF38"
* padHex(bigInteger.fromInt(56))    === "38"
*
* padHex(bigInteger.fromInt(-20))   === "EC"
* padHex(bigInteger.fromInt(236))   === "00EC"
*
* padHex(bigInteger.fromInt(-56))   === "C8"
* padHex(bigInteger.fromInt(200))   === "00C8"
*
* @param {AuthBigInteger} bigInt Number to encode.
* @returns {String} even-length hex string of the two's complement encoding.
*/
var getPaddedHex = (bigInt) => {
	if (!(bigInt instanceof BigInteger)) throw new Error("Not a BigInteger");
	const isNegative = bigInt.compareTo(BigInteger.ZERO) < 0;
	let hexStr = bigInt.abs().toString(16);
	hexStr = hexStr.length % 2 !== 0 ? `0${hexStr}` : hexStr;
	hexStr = HEX_MSB_REGEX.test(hexStr) ? `00${hexStr}` : hexStr;
	if (isNegative) {
		hexStr = new BigInteger(hexStr.split("").map((x) => {
			const invertedNibble = ~parseInt(x, 16) & 15;
			return "0123456789ABCDEF".charAt(invertedNibble);
		}).join(""), 16).add(BigInteger.ONE).toString(16);
		if (hexStr.toUpperCase().startsWith("FF8")) hexStr = hexStr.substring(2);
	}
	return hexStr;
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/calculate/calculateU.mjs
/**
* @internal
*/
var calculateU = ({ A, B }) => {
	const U = new BigInteger(getHashFromHex(getPaddedHex(A) + getPaddedHex(B)), 16);
	if (U.equals(BigInteger.ZERO)) throw new Error("U cannot be zero.");
	return U;
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/getHkdfKey.mjs
/**
* Standard HKDF algorithm.
*
* @param {Uint8Array} ikm Input key material.
* @param {Uint8Array} salt Salt value.
* @param {Uint8Array} info Context and application specific info.
*
* @returns {Uint8Array} Strong key material.
*
* @internal
*/
var getHkdfKey = (ikm, salt, info) => {
	const awsCryptoHash = new Sha256(salt);
	awsCryptoHash.update(ikm);
	const awsCryptoHashHmac = new Sha256(awsCryptoHash.digestSync());
	awsCryptoHashHmac.update(info);
	return awsCryptoHashHmac.digestSync().slice(0, 16);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/getRandomBytes.mjs
/**
* Returns a Uint8Array with a sequence of random nBytes
*
* @param {number} nBytes
* @returns {Uint8Array} fixed-length sequence of random bytes
*/
var getRandomBytes = (nBytes) => {
	return getBytesFromHex(new WordArray().random(nBytes).toString());
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/getRandomString.mjs
/**
* Helper function to generate a random string
* @returns {string} a random value.
*
* @internal
*/
var getRandomString = () => base64Encoder.convert(getRandomBytes(40));
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/AuthenticationHelper/AuthenticationHelper.mjs
/** @class */
var AuthenticationHelper = class {
	constructor({ userPoolName, a, g, A, N }) {
		this.encoder = textEncoder;
		this.userPoolName = userPoolName;
		this.a = a;
		this.g = g;
		this.A = A;
		this.N = N;
		this.k = new BigInteger(getHashFromHex(`${getPaddedHex(N)}${getPaddedHex(g)}`), 16);
	}
	/**
	* @returns {string} Generated random value included in password hash.
	*/
	getRandomPassword() {
		if (!this.randomPassword) throw new AuthError({
			name: "EmptyBigIntegerRandomPassword",
			message: "random password is empty"
		});
		return this.randomPassword;
	}
	/**
	* @returns {string} Generated random value included in devices hash.
	*/
	getSaltToHashDevices() {
		if (!this.saltToHashDevices) throw new AuthError({
			name: "EmptyBigIntegersaltToHashDevices",
			message: "saltToHashDevices is empty"
		});
		return this.saltToHashDevices;
	}
	/**
	* @returns {string} Value used to verify devices.
	*/
	getVerifierDevices() {
		if (!this.verifierDevices) throw new AuthError({
			name: "EmptyBigIntegerVerifierDevices",
			message: "verifyDevices is empty"
		});
		return this.verifierDevices;
	}
	/**
	* Generate salts and compute verifier.
	*
	* @param {string} deviceGroupKey Devices to generate verifier for.
	* @param {string} username User to generate verifier for.
	*
	* @returns {Promise<void>}
	*/
	async generateHashDevice(deviceGroupKey, username) {
		this.randomPassword = getRandomString();
		const hashedString = getHashFromData(`${deviceGroupKey}${username}:${this.randomPassword}`);
		this.saltToHashDevices = getPaddedHex(new BigInteger(getHexFromBytes(getRandomBytes(16)), 16));
		return new Promise((resolve, reject) => {
			this.g.modPow(new BigInteger(getHashFromHex(this.saltToHashDevices + hashedString), 16), this.N, (err, result) => {
				if (err) {
					reject(err);
					return;
				}
				this.verifierDevices = getPaddedHex(result);
				resolve();
			});
		});
	}
	/**
	* Calculates the final HKDF key based on computed S value, computed U value and the key
	*
	* @param {String} username Username.
	* @param {String} password Password.
	* @param {AuthBigInteger} B Server B value.
	* @param {AuthBigInteger} salt Generated salt.
	*/
	async getPasswordAuthenticationKey({ username, password, serverBValue, salt }) {
		if (serverBValue.mod(this.N).equals(BigInteger.ZERO)) throw new Error("B cannot be zero.");
		const U = calculateU({
			A: this.A,
			B: serverBValue
		});
		const usernamePasswordHash = getHashFromData(`${this.userPoolName}${username}:${password}`);
		const x = new BigInteger(getHashFromHex(getPaddedHex(salt) + usernamePasswordHash), 16);
		const S = await calculateS({
			a: this.a,
			g: this.g,
			k: this.k,
			x,
			B: serverBValue,
			N: this.N,
			U
		});
		const context = this.encoder.convert("Caldera Derived Key");
		const spacer = this.encoder.convert(String.fromCharCode(1));
		const info = new Uint8Array(context.byteLength + spacer.byteLength);
		info.set(context, 0);
		info.set(spacer, context.byteLength);
		return getHkdfKey(getBytesFromHex(getPaddedHex(S)), getBytesFromHex(getPaddedHex(U)), info);
	}
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/calculate/calculateA.mjs
/**
* @internal
*/
var calculateA = async ({ a, g, N }) => {
	return new Promise((resolve, reject) => {
		g.modPow(a, N, (err, A) => {
			if (err) {
				reject(err);
				return;
			}
			if (A.mod(N).equals(BigInteger.ZERO)) {
				reject(/* @__PURE__ */ new Error("Illegal parameter. A mod N cannot be 0."));
				return;
			}
			resolve(A);
		});
	});
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/getAuthenticationHelper.mjs
/**
* Returns a new {@link AuthenticationHelper} instance with randomly generated BigInteger seed
*
* @param userPoolName Cognito user pool name.
* @returns An {@link AuthenticationHelper} instance.
*
* @internal
*/
var getAuthenticationHelper = async (userPoolName) => {
	const N = new BigInteger(INIT_N, 16);
	const g = new BigInteger("2", 16);
	const a = generateRandomBigInteger();
	return new AuthenticationHelper({
		userPoolName,
		a,
		g,
		A: await calculateA({
			a,
			g,
			N
		}),
		N
	});
};
/**
* Generates a random BigInteger.
*
* @returns {BigInteger} a random value.
*/
var generateRandomBigInteger = () => {
	return new BigInteger(getHexFromBytes(getRandomBytes(128)), 16);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/getNewDeviceMetadata.mjs
/**
* This function is used to kick off the device management flow.
*
* If an error is thrown while generating a hash device or calling the `ConfirmDevice`
* client, then this API will ignore the error and return undefined. Otherwise the authentication
* flow will not complete and the user won't be able to be signed in.
*
* @returns DeviceMetadata | undefined
*/
async function getNewDeviceMetadata({ userPoolId, userPoolEndpoint, newDeviceMetadata, accessToken }) {
	if (!newDeviceMetadata) return void 0;
	const authenticationHelper = await getAuthenticationHelper(userPoolId.split("_")[1] || "");
	const deviceKey = newDeviceMetadata?.DeviceKey;
	const deviceGroupKey = newDeviceMetadata?.DeviceGroupKey;
	try {
		await authenticationHelper.generateHashDevice(deviceGroupKey ?? "", deviceKey ?? "");
	} catch (errGenHash) {
		return;
	}
	const deviceSecretVerifierConfig = {
		Salt: base64Encoder.convert(getBytesFromHex(authenticationHelper.getSaltToHashDevices())),
		PasswordVerifier: base64Encoder.convert(getBytesFromHex(authenticationHelper.getVerifierDevices()))
	};
	const randomPassword = authenticationHelper.getRandomPassword();
	try {
		await createConfirmDeviceClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({ region: getRegionFromUserPoolId(userPoolId) }, {
			AccessToken: accessToken,
			DeviceName: await getDeviceName(),
			DeviceKey: newDeviceMetadata?.DeviceKey,
			DeviceSecretVerifierConfig: deviceSecretVerifierConfig
		});
		return {
			deviceKey,
			deviceGroupKey,
			randomPassword
		};
	} catch (error) {
		return;
	}
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/flows/userAuth/handleWebAuthnSignInResult.mjs
async function handleWebAuthnSignInResult(challengeParameters) {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { username, signInSession, signInDetails, challengeName } = signInStore.getState();
	if (challengeName !== "WEB_AUTHN" || !username) throw new AuthError({
		name: AuthErrorCodes.SignInException,
		message: "Unable to proceed due to invalid sign in state."
	});
	const { CREDENTIAL_REQUEST_OPTIONS: credentialRequestOptions } = challengeParameters;
	assertPasskeyError(!!credentialRequestOptions, PasskeyErrorCode.InvalidPasskeyAuthenticationOptions);
	const cred = await getPasskey(JSON.parse(credentialRequestOptions));
	const { ChallengeName: nextChallengeName, ChallengeParameters: nextChallengeParameters, AuthenticationResult: authenticationResult, Session: nextSession } = await createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: authConfig.userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(authConfig.userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignIn)
	}, {
		ChallengeName: "WEB_AUTHN",
		ChallengeResponses: {
			USERNAME: username,
			CREDENTIAL: JSON.stringify(cred)
		},
		ClientId: authConfig.userPoolClientId,
		Session: signInSession
	});
	setActiveSignInState({
		signInSession: nextSession,
		username,
		challengeName: nextChallengeName,
		signInDetails
	});
	if (authenticationResult) {
		await cacheCognitoTokens({
			...authenticationResult,
			username,
			NewDeviceMetadata: await getNewDeviceMetadata({
				userPoolId: authConfig.userPoolId,
				userPoolEndpoint: authConfig.userPoolEndpoint,
				newDeviceMetadata: authenticationResult.NewDeviceMetadata,
				accessToken: authenticationResult.AccessToken
			}),
			signInDetails
		});
		signInStore.dispatch({ type: "RESET_STATE" });
		await dispatchSignedInHubEvent();
		return {
			isSignedIn: true,
			nextStep: { signInStep: "DONE" }
		};
	}
	if (nextChallengeName === "WEB_AUTHN") throw new AuthError({
		name: AuthErrorCodes.SignInException,
		message: "Sequential WEB_AUTHN challenges returned from underlying service cannot be handled."
	});
	return {
		challengeName: nextChallengeName,
		challengeParameters: nextChallengeParameters
	};
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/userContextData.mjs
function getUserContextData({ username, userPoolId, userPoolClientId }) {
	if (typeof window === "undefined") return;
	const amazonCognitoAdvancedSecurityData = window.AmazonCognitoAdvancedSecurityData;
	if (typeof amazonCognitoAdvancedSecurityData === "undefined") return;
	const advancedSecurityData = amazonCognitoAdvancedSecurityData.getData(username, userPoolId, userPoolClientId);
	if (advancedSecurityData) return { EncodedData: advancedSecurityData };
	return {};
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/getNowString.mjs
var MONTH_NAMES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec"
];
var WEEK_NAMES = [
	"Sun",
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat"
];
var getNowString = () => {
	const now = /* @__PURE__ */ new Date();
	const weekDay = WEEK_NAMES[now.getUTCDay()];
	const month = MONTH_NAMES[now.getUTCMonth()];
	const day = now.getUTCDate();
	let hours = now.getUTCHours();
	if (hours < 10) hours = `0${hours}`;
	let minutes = now.getUTCMinutes();
	if (minutes < 10) minutes = `0${minutes}`;
	let seconds = now.getUTCSeconds();
	if (seconds < 10) seconds = `0${seconds}`;
	const year = now.getUTCFullYear();
	return `${weekDay} ${month} ${day} ${hours}:${minutes}:${seconds} UTC ${year}`;
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/srp/getSignatureString.mjs
var getSignatureString = ({ userPoolName, username, challengeParameters, dateNow, hkdf }) => {
	const bufUPIDaToB = textEncoder.convert(userPoolName);
	const bufUNaToB = textEncoder.convert(username);
	const bufSBaToB = urlB64ToUint8Array(challengeParameters.SECRET_BLOCK);
	const bufDNaToB = textEncoder.convert(dateNow);
	const bufConcat = new Uint8Array(bufUPIDaToB.byteLength + bufUNaToB.byteLength + bufSBaToB.byteLength + bufDNaToB.byteLength);
	bufConcat.set(bufUPIDaToB, 0);
	bufConcat.set(bufUNaToB, bufUPIDaToB.byteLength);
	bufConcat.set(bufSBaToB, bufUPIDaToB.byteLength + bufUNaToB.byteLength);
	bufConcat.set(bufDNaToB, bufUPIDaToB.byteLength + bufUNaToB.byteLength + bufSBaToB.byteLength);
	const awsCryptoHash = new Sha256(hkdf);
	awsCryptoHash.update(bufConcat);
	const resultFromAWSCrypto = awsCryptoHash.digestSync();
	return base64Encoder.convert(resultFromAWSCrypto);
};
var urlB64ToUint8Array = (base64String) => {
	const base64 = (base64String + "=".repeat((4 - base64String.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = base64Decoder.convert(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
	return outputArray;
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/handleDeviceSRPAuth.mjs
async function handleDeviceSRPAuth({ username, config, clientMetadata, session, tokenOrchestrator }) {
	const { userPoolId, userPoolEndpoint } = config;
	const clientId = config.userPoolClientId;
	const deviceMetadata = await tokenOrchestrator?.getDeviceMetadata(username);
	assertDeviceMetadata(deviceMetadata);
	const authenticationHelper = await getAuthenticationHelper(deviceMetadata.deviceGroupKey);
	const jsonReqResponseChallenge = {
		ChallengeName: "DEVICE_SRP_AUTH",
		ClientId: clientId,
		ChallengeResponses: {
			USERNAME: username,
			SRP_A: authenticationHelper.A.toString(16),
			DEVICE_KEY: deviceMetadata.deviceKey
		},
		ClientMetadata: clientMetadata,
		Session: session
	};
	const { ChallengeParameters: respondedChallengeParameters, Session } = await createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({ region: getRegionFromUserPoolId(userPoolId) }, jsonReqResponseChallenge);
	return handleDevicePasswordVerifier(username, respondedChallengeParameters, clientMetadata, Session, authenticationHelper, config, tokenOrchestrator);
}
async function handleDevicePasswordVerifier(username, challengeParameters, clientMetadata, session, authenticationHelper, { userPoolId, userPoolClientId, userPoolEndpoint }, tokenOrchestrator) {
	const deviceMetadata = await tokenOrchestrator?.getDeviceMetadata(username);
	assertDeviceMetadata(deviceMetadata);
	const serverBValue = new BigInteger(challengeParameters?.SRP_B, 16);
	const salt = new BigInteger(challengeParameters?.SALT, 16);
	const { deviceKey } = deviceMetadata;
	const { deviceGroupKey } = deviceMetadata;
	const hkdf = await authenticationHelper.getPasswordAuthenticationKey({
		username: deviceMetadata.deviceKey,
		password: deviceMetadata.randomPassword,
		serverBValue,
		salt
	});
	const dateNow = getNowString();
	const jsonReqResponseChallenge = {
		ChallengeName: "DEVICE_PASSWORD_VERIFIER",
		ClientId: userPoolClientId,
		ChallengeResponses: {
			USERNAME: challengeParameters?.USERNAME ?? username,
			PASSWORD_CLAIM_SECRET_BLOCK: challengeParameters?.SECRET_BLOCK,
			TIMESTAMP: dateNow,
			PASSWORD_CLAIM_SIGNATURE: getSignatureString({
				username: deviceKey,
				userPoolName: deviceGroupKey,
				challengeParameters,
				dateNow,
				hkdf
			}),
			DEVICE_KEY: deviceKey
		},
		Session: session,
		ClientMetadata: clientMetadata,
		UserContextData: getUserContextData({
			username,
			userPoolId,
			userPoolClientId
		})
	};
	return createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({ region: getRegionFromUserPoolId(userPoolId) }, jsonReqResponseChallenge);
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/handlePasswordVerifierChallenge.mjs
async function handlePasswordVerifierChallenge(password, challengeParameters, clientMetadata, session, authenticationHelper, config, tokenOrchestrator) {
	const { userPoolId, userPoolClientId, userPoolEndpoint } = config;
	const userPoolName = userPoolId?.split("_")[1] || "";
	const serverBValue = new BigInteger(challengeParameters?.SRP_B, 16);
	const salt = new BigInteger(challengeParameters?.SALT, 16);
	const username = challengeParameters?.USER_ID_FOR_SRP;
	if (!username) throw new AuthError({
		name: "EmptyUserIdForSRPException",
		message: "USER_ID_FOR_SRP was not found in challengeParameters"
	});
	const hkdf = await authenticationHelper.getPasswordAuthenticationKey({
		username,
		password,
		serverBValue,
		salt
	});
	const dateNow = getNowString();
	const challengeResponses = {
		USERNAME: username,
		PASSWORD_CLAIM_SECRET_BLOCK: challengeParameters?.SECRET_BLOCK,
		TIMESTAMP: dateNow,
		PASSWORD_CLAIM_SIGNATURE: getSignatureString({
			username,
			userPoolName,
			challengeParameters,
			dateNow,
			hkdf
		})
	};
	const deviceMetadata = await tokenOrchestrator.getDeviceMetadata(username);
	if (deviceMetadata && deviceMetadata.deviceKey) challengeResponses.DEVICE_KEY = deviceMetadata.deviceKey;
	const jsonReqResponseChallenge = {
		ChallengeName: "PASSWORD_VERIFIER",
		ChallengeResponses: challengeResponses,
		ClientMetadata: clientMetadata,
		Session: session,
		ClientId: userPoolClientId,
		UserContextData: getUserContextData({
			username,
			userPoolId,
			userPoolClientId
		})
	};
	const response = await createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({ region: getRegionFromUserPoolId(userPoolId) }, jsonReqResponseChallenge);
	if (response.ChallengeName === "DEVICE_SRP_AUTH") return handleDeviceSRPAuth({
		username,
		config,
		clientMetadata,
		session: response.Session,
		tokenOrchestrator
	});
	return response;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/retryOnResourceNotFoundException.mjs
/**
* It will retry the function if the error is a `ResourceNotFoundException` and
* will clean the device keys stored in the storage mechanism.
*
*/
async function retryOnResourceNotFoundException(func, args, username, tokenOrchestrator) {
	try {
		return await func(...args);
	} catch (error) {
		if (error instanceof AuthError && error.name === "ResourceNotFoundException" && error.message.includes("Device does not exist.")) {
			await tokenOrchestrator.clearDeviceMetadata(username);
			return func(...args);
		}
		throw error;
	}
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/setActiveSignInUsername.mjs
function setActiveSignInUsername(username) {
	const { dispatch } = signInStore;
	dispatch({
		type: "SET_USERNAME",
		value: username
	});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/flows/shared/handlePasswordSRP.mjs
/**
* Handles the Password SRP (Secure Remote Password) authentication flow.
* This function can be used with both USER_SRP_AUTH and USER_AUTH flows.
*
* @param {Object} params - The parameters for the Password SRP authentication
* @param {string} params.username - The username for authentication
* @param {string} params.password - The user's password
* @param {ClientMetadata} [params.clientMetadata] - Optional metadata to be sent with auth requests
* @param {CognitoUserPoolConfig} params.config - Cognito User Pool configuration
* @param {AuthTokenOrchestrator} params.tokenOrchestrator - Token orchestrator for managing auth tokens
* @param {AuthFlowType} params.authFlow - The type of authentication flow ('USER_SRP_AUTH' or 'USER_AUTH')
* @param {AuthFactorType} [params.preferredChallenge] - Optional preferred challenge type when using USER_AUTH flow
*
* @returns {Promise<RespondToAuthChallengeCommandOutput>} The authentication response
*/
async function handlePasswordSRP({ username, password, clientMetadata, config, tokenOrchestrator, authFlow, preferredChallenge }) {
	const { userPoolId, userPoolClientId, userPoolEndpoint } = config;
	const authenticationHelper = await getAuthenticationHelper(userPoolId?.split("_")[1] || "");
	const authParameters = {
		USERNAME: username,
		SRP_A: authenticationHelper.A.toString(16)
	};
	if (authFlow === "USER_AUTH" && preferredChallenge) authParameters.PREFERRED_CHALLENGE = preferredChallenge;
	const jsonReq = {
		AuthFlow: authFlow,
		AuthParameters: authParameters,
		ClientMetadata: clientMetadata,
		ClientId: userPoolClientId,
		UserContextData: getUserContextData({
			username,
			userPoolId,
			userPoolClientId
		})
	};
	const resp = await createInitiateAuthClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.SignIn)
	}, jsonReq);
	const { ChallengeParameters: challengeParameters, Session: session } = resp;
	const activeUsername = challengeParameters?.USERNAME ?? username;
	setActiveSignInUsername(activeUsername);
	if (resp.ChallengeName === "PASSWORD_VERIFIER") return retryOnResourceNotFoundException(handlePasswordVerifierChallenge, [
		password,
		challengeParameters,
		clientMetadata,
		session,
		authenticationHelper,
		config,
		tokenOrchestrator
	], activeUsername, tokenOrchestrator);
	return resp;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/flows/userAuth/handleSelectChallenge.mjs
/**
* Handles the SELECT_CHALLENGE response for authentication.
* Initiates the selected authentication challenge based on user choice.
*
* @param {Object} params - The parameters for handling the selected challenge
* @param {string} params.username - The username for authentication
* @param {string} params.session - The current authentication session token
* @param {string} params.selectedChallenge - The challenge type selected by the user
* @param {CognitoUserPoolConfig} params.config - Cognito User Pool configuration
* @param {ClientMetadata} [params.clientMetadata] - Optional metadata to be sent with auth requests
*
* @returns {Promise<RespondToAuthChallengeCommandOutput>} The challenge response
*/
async function initiateSelectedChallenge({ username, session, selectedChallenge, config, clientMetadata }) {
	return createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: config.userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(config.userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignIn)
	}, {
		ChallengeName: "SELECT_CHALLENGE",
		ChallengeResponses: {
			USERNAME: username,
			ANSWER: selectedChallenge
		},
		ClientId: config.userPoolClientId,
		Session: session,
		ClientMetadata: clientMetadata
	});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/flows/userAuth/handleSelectChallengeWithPassword.mjs
/**
* Handles the SELECT_CHALLENGE response specifically for Password authentication.
* This function combines the SELECT_CHALLENGE flow with standard password authentication.
*
* @param {string} username - The username for authentication
* @param {string} password - The user's password
* @param {ClientMetadata} [clientMetadata] - Optional metadata to be sent with auth requests
* @param {CognitoUserPoolConfig} config - Cognito User Pool configuration
* @param {string} session - The current authentication session token
*
* @returns {Promise<RespondToAuthChallengeCommandOutput>} The challenge response
*/
async function handleSelectChallengeWithPassword(username, password, clientMetadata, config, session) {
	const { userPoolId, userPoolClientId, userPoolEndpoint } = config;
	const authParameters = {
		ANSWER: "PASSWORD",
		USERNAME: username,
		PASSWORD: password
	};
	const userContextData = getUserContextData({
		username,
		userPoolId,
		userPoolClientId
	});
	const response = await createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignIn)
	}, {
		ChallengeName: "SELECT_CHALLENGE",
		ChallengeResponses: authParameters,
		ClientId: userPoolClientId,
		ClientMetadata: clientMetadata,
		Session: session,
		UserContextData: userContextData
	});
	setActiveSignInUsername(response.ChallengeParameters?.USERNAME ?? username);
	return response;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/flows/userAuth/handleSelectChallengeWithPasswordSRP.mjs
/**
* Handles the SELECT_CHALLENGE response specifically for Password SRP authentication.
* This function combines the SELECT_CHALLENGE flow with Password SRP protocol.
*
* @param {string} username - The username for authentication
* @param {string} password - The user's password
* @param {ClientMetadata} [clientMetadata] - Optional metadata to be sent with auth requests
* @param {CognitoUserPoolConfig} config - Cognito User Pool configuration
* @param {string} session - The current authentication session token
* @param {AuthTokenOrchestrator} tokenOrchestrator - Token orchestrator for managing auth tokens
*
* @returns {Promise<RespondToAuthChallengeCommandOutput>} The challenge response
*/
async function handleSelectChallengeWithPasswordSRP(username, password, clientMetadata, config, session, tokenOrchestrator) {
	const { userPoolId, userPoolClientId, userPoolEndpoint } = config;
	const authenticationHelper = await getAuthenticationHelper(userPoolId.split("_")[1] || "");
	const authParameters = {
		ANSWER: "PASSWORD_SRP",
		USERNAME: username,
		SRP_A: authenticationHelper.A.toString(16)
	};
	const userContextData = getUserContextData({
		username,
		userPoolId,
		userPoolClientId
	});
	const response = await createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignIn)
	}, {
		ChallengeName: "SELECT_CHALLENGE",
		ChallengeResponses: authParameters,
		ClientId: userPoolClientId,
		ClientMetadata: clientMetadata,
		Session: session,
		UserContextData: userContextData
	});
	const activeUsername = response.ChallengeParameters?.USERNAME ?? username;
	setActiveSignInUsername(activeUsername);
	if (response.ChallengeName === "PASSWORD_VERIFIER") return retryOnResourceNotFoundException(handlePasswordVerifierChallenge, [
		password,
		response.ChallengeParameters,
		clientMetadata,
		response.Session,
		authenticationHelper,
		config,
		tokenOrchestrator
	], activeUsername, tokenOrchestrator);
	return response;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/signInHelpers.mjs
var USER_ATTRIBUTES = "userAttributes.";
function isWebAuthnResultAuthSignInOutput(result) {
	return "isSignedIn" in result && "nextStep" in result;
}
async function handleCustomChallenge({ challengeResponse, clientMetadata, session, username, config, tokenOrchestrator }) {
	const { userPoolId, userPoolClientId, userPoolEndpoint } = config;
	const challengeResponses = {
		USERNAME: username,
		ANSWER: challengeResponse
	};
	const deviceMetadata = await tokenOrchestrator?.getDeviceMetadata(username);
	if (deviceMetadata && deviceMetadata.deviceKey) challengeResponses.DEVICE_KEY = deviceMetadata.deviceKey;
	const jsonReq = {
		ChallengeName: "CUSTOM_CHALLENGE",
		ChallengeResponses: challengeResponses,
		Session: session,
		ClientMetadata: clientMetadata,
		ClientId: userPoolClientId,
		UserContextData: getUserContextData({
			username,
			userPoolId,
			userPoolClientId
		})
	};
	const response = await createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignIn)
	}, jsonReq);
	if (response.ChallengeName === "DEVICE_SRP_AUTH") return handleDeviceSRPAuth({
		username,
		config,
		clientMetadata,
		session: response.Session,
		tokenOrchestrator
	});
	return response;
}
async function handleMFASetupChallenge({ challengeResponse, username, clientMetadata, session, deviceName, config }) {
	const { userPoolId, userPoolClientId, userPoolEndpoint } = config;
	if (challengeResponse === "EMAIL") return {
		ChallengeName: "MFA_SETUP",
		Session: session,
		ChallengeParameters: { MFAS_CAN_SETUP: "[\"EMAIL_OTP\"]" },
		$metadata: {}
	};
	if (challengeResponse === "TOTP") return {
		ChallengeName: "MFA_SETUP",
		Session: session,
		ChallengeParameters: { MFAS_CAN_SETUP: "[\"SOFTWARE_TOKEN_MFA\"]" },
		$metadata: {}
	};
	const challengeResponses = { USERNAME: username };
	if (/^\d+$/.test(challengeResponse)) {
		const { Session } = await createVerifySoftwareTokenClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
			region: getRegionFromUserPoolId(userPoolId),
			userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignIn)
		}, {
			UserCode: challengeResponse,
			Session: session,
			FriendlyDeviceName: deviceName
		});
		signInStore.dispatch({
			type: "SET_SIGN_IN_SESSION",
			value: Session
		});
		const jsonReq = {
			ChallengeName: "MFA_SETUP",
			ChallengeResponses: challengeResponses,
			Session,
			ClientMetadata: clientMetadata,
			ClientId: userPoolClientId
		};
		return createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
			region: getRegionFromUserPoolId(userPoolId),
			userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignIn)
		}, jsonReq);
	}
	if (challengeResponse.includes("@")) {
		challengeResponses.EMAIL = challengeResponse;
		const jsonReq = {
			ChallengeName: "MFA_SETUP",
			ChallengeResponses: challengeResponses,
			Session: session,
			ClientMetadata: clientMetadata,
			ClientId: userPoolClientId
		};
		return createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
			region: getRegionFromUserPoolId(userPoolId),
			userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignIn)
		}, jsonReq);
	}
	throw new AuthError({
		name: AuthErrorCodes.SignInException,
		message: `Cannot proceed with MFA setup using challengeResponse: ${challengeResponse}`,
		recoverySuggestion: "Try passing \"EMAIL\", \"TOTP\", a valid email, or OTP code as the challengeResponse."
	});
}
async function handleSelectMFATypeChallenge({ challengeResponse, username, clientMetadata, session, config }) {
	const { userPoolId, userPoolClientId, userPoolEndpoint } = config;
	assertValidationError(challengeResponse === "TOTP" || challengeResponse === "SMS" || challengeResponse === "EMAIL", AuthValidationErrorCode.IncorrectMFAMethod);
	const jsonReq = {
		ChallengeName: "SELECT_MFA_TYPE",
		ChallengeResponses: {
			USERNAME: username,
			ANSWER: mapMfaType(challengeResponse)
		},
		Session: session,
		ClientMetadata: clientMetadata,
		ClientId: userPoolClientId,
		UserContextData: getUserContextData({
			username,
			userPoolId,
			userPoolClientId
		})
	};
	return createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignIn)
	}, jsonReq);
}
async function handleCompleteNewPasswordChallenge({ challengeResponse, clientMetadata, session, username, requiredAttributes, config }) {
	const { userPoolId, userPoolClientId, userPoolEndpoint } = config;
	const jsonReq = {
		ChallengeName: "NEW_PASSWORD_REQUIRED",
		ChallengeResponses: {
			...createAttributes(requiredAttributes),
			NEW_PASSWORD: challengeResponse,
			USERNAME: username
		},
		ClientMetadata: clientMetadata,
		Session: session,
		ClientId: userPoolClientId,
		UserContextData: getUserContextData({
			username,
			userPoolId,
			userPoolClientId
		})
	};
	return createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignIn)
	}, jsonReq);
}
async function handleUserPasswordAuthFlow(username, password, clientMetadata, config, tokenOrchestrator) {
	const { userPoolClientId, userPoolId, userPoolEndpoint } = config;
	const authParameters = {
		USERNAME: username,
		PASSWORD: password
	};
	const deviceMetadata = await tokenOrchestrator.getDeviceMetadata(username);
	if (deviceMetadata && deviceMetadata.deviceKey) authParameters.DEVICE_KEY = deviceMetadata.deviceKey;
	const jsonReq = {
		AuthFlow: "USER_PASSWORD_AUTH",
		AuthParameters: authParameters,
		ClientMetadata: clientMetadata,
		ClientId: userPoolClientId,
		UserContextData: getUserContextData({
			username,
			userPoolId,
			userPoolClientId
		})
	};
	const response = await createInitiateAuthClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.SignIn)
	}, jsonReq);
	const activeUsername = response.ChallengeParameters?.USERNAME ?? response.ChallengeParameters?.USER_ID_FOR_SRP ?? username;
	setActiveSignInUsername(activeUsername);
	if (response.ChallengeName === "DEVICE_SRP_AUTH") return handleDeviceSRPAuth({
		username: activeUsername,
		config,
		clientMetadata,
		session: response.Session,
		tokenOrchestrator
	});
	return response;
}
async function handleUserSRPAuthFlow(username, password, clientMetadata, config, tokenOrchestrator) {
	return handlePasswordSRP({
		username,
		password,
		clientMetadata,
		config,
		tokenOrchestrator,
		authFlow: "USER_SRP_AUTH"
	});
}
async function handleCustomAuthFlowWithoutSRP(username, clientMetadata, config, tokenOrchestrator) {
	const { userPoolClientId, userPoolId, userPoolEndpoint } = config;
	const authParameters = { USERNAME: username };
	const deviceMetadata = await tokenOrchestrator.getDeviceMetadata(username);
	if (deviceMetadata && deviceMetadata.deviceKey) authParameters.DEVICE_KEY = deviceMetadata.deviceKey;
	const jsonReq = {
		AuthFlow: "CUSTOM_AUTH",
		AuthParameters: authParameters,
		ClientMetadata: clientMetadata,
		ClientId: userPoolClientId,
		UserContextData: getUserContextData({
			username,
			userPoolId,
			userPoolClientId
		})
	};
	const response = await createInitiateAuthClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.SignIn)
	}, jsonReq);
	const activeUsername = response.ChallengeParameters?.USERNAME ?? username;
	setActiveSignInUsername(activeUsername);
	if (response.ChallengeName === "DEVICE_SRP_AUTH") return handleDeviceSRPAuth({
		username: activeUsername,
		config,
		clientMetadata,
		session: response.Session,
		tokenOrchestrator
	});
	return response;
}
async function handleCustomSRPAuthFlow(username, password, clientMetadata, config, tokenOrchestrator) {
	assertTokenProviderConfig(config);
	const { userPoolId, userPoolClientId, userPoolEndpoint } = config;
	const authenticationHelper = await getAuthenticationHelper(userPoolId?.split("_")[1] || "");
	const jsonReq = {
		AuthFlow: "CUSTOM_AUTH",
		AuthParameters: {
			USERNAME: username,
			SRP_A: authenticationHelper.A.toString(16),
			CHALLENGE_NAME: "SRP_A"
		},
		ClientMetadata: clientMetadata,
		ClientId: userPoolClientId,
		UserContextData: getUserContextData({
			username,
			userPoolId,
			userPoolClientId
		})
	};
	const { ChallengeParameters: challengeParameters, Session: session } = await createInitiateAuthClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.SignIn)
	}, jsonReq);
	const activeUsername = challengeParameters?.USERNAME ?? username;
	setActiveSignInUsername(activeUsername);
	return retryOnResourceNotFoundException(handlePasswordVerifierChallenge, [
		password,
		challengeParameters,
		clientMetadata,
		session,
		authenticationHelper,
		config,
		tokenOrchestrator
	], activeUsername, tokenOrchestrator);
}
async function getSignInResult(params) {
	const { challengeName, challengeParameters, availableChallenges } = params;
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	switch (challengeName) {
		case "CUSTOM_CHALLENGE": return {
			isSignedIn: false,
			nextStep: {
				signInStep: "CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE",
				additionalInfo: challengeParameters
			}
		};
		case "MFA_SETUP": {
			const { signInSession, username } = signInStore.getState();
			const mfaSetupTypes = getMFATypes(parseMFATypes(challengeParameters.MFAS_CAN_SETUP)) || [];
			const allowedMfaSetupTypes = getAllowedMfaSetupTypes(mfaSetupTypes);
			const isTotpMfaSetupAvailable = allowedMfaSetupTypes.includes("TOTP");
			const isEmailMfaSetupAvailable = allowedMfaSetupTypes.includes("EMAIL");
			if (isTotpMfaSetupAvailable && isEmailMfaSetupAvailable) return {
				isSignedIn: false,
				nextStep: {
					signInStep: "CONTINUE_SIGN_IN_WITH_MFA_SETUP_SELECTION",
					allowedMFATypes: allowedMfaSetupTypes
				}
			};
			if (isEmailMfaSetupAvailable) return {
				isSignedIn: false,
				nextStep: { signInStep: "CONTINUE_SIGN_IN_WITH_EMAIL_SETUP" }
			};
			if (isTotpMfaSetupAvailable) {
				const { Session, SecretCode: secretCode } = await createAssociateSoftwareTokenClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: authConfig.userPoolEndpoint }) })({ region: getRegionFromUserPoolId(authConfig.userPoolId) }, { Session: signInSession });
				signInStore.dispatch({
					type: "SET_SIGN_IN_SESSION",
					value: Session
				});
				return {
					isSignedIn: false,
					nextStep: {
						signInStep: "CONTINUE_SIGN_IN_WITH_TOTP_SETUP",
						totpSetupDetails: getTOTPSetupDetails(secretCode, username)
					}
				};
			}
			throw new AuthError({
				name: AuthErrorCodes.SignInException,
				message: `Cannot initiate MFA setup from available types: ${mfaSetupTypes}`
			});
		}
		case "NEW_PASSWORD_REQUIRED": return {
			isSignedIn: false,
			nextStep: {
				signInStep: "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED",
				missingAttributes: parseAttributes(challengeParameters.requiredAttributes)
			}
		};
		case "SELECT_MFA_TYPE": return {
			isSignedIn: false,
			nextStep: {
				signInStep: "CONTINUE_SIGN_IN_WITH_MFA_SELECTION",
				allowedMFATypes: getMFATypes(parseMFATypes(challengeParameters.MFAS_CAN_CHOOSE))
			}
		};
		case "SMS_OTP":
		case "SMS_MFA": return {
			isSignedIn: false,
			nextStep: {
				signInStep: "CONFIRM_SIGN_IN_WITH_SMS_CODE",
				codeDeliveryDetails: {
					deliveryMedium: challengeParameters.CODE_DELIVERY_DELIVERY_MEDIUM,
					destination: challengeParameters.CODE_DELIVERY_DESTINATION
				}
			}
		};
		case "SOFTWARE_TOKEN_MFA": return {
			isSignedIn: false,
			nextStep: { signInStep: "CONFIRM_SIGN_IN_WITH_TOTP_CODE" }
		};
		case "EMAIL_OTP": return {
			isSignedIn: false,
			nextStep: {
				signInStep: "CONFIRM_SIGN_IN_WITH_EMAIL_CODE",
				codeDeliveryDetails: {
					deliveryMedium: challengeParameters.CODE_DELIVERY_DELIVERY_MEDIUM,
					destination: challengeParameters.CODE_DELIVERY_DESTINATION
				}
			}
		};
		case "WEB_AUTHN": {
			const result = await handleWebAuthnSignInResult(challengeParameters);
			if (isWebAuthnResultAuthSignInOutput(result)) return result;
			return getSignInResult(result);
		}
		case "PASSWORD":
		case "PASSWORD_SRP": return {
			isSignedIn: false,
			nextStep: { signInStep: "CONFIRM_SIGN_IN_WITH_PASSWORD" }
		};
		case "SELECT_CHALLENGE": return {
			isSignedIn: false,
			nextStep: {
				signInStep: "CONTINUE_SIGN_IN_WITH_FIRST_FACTOR_SELECTION",
				availableChallenges
			}
		};
	}
	throw new AuthError({
		name: AuthErrorCodes.SignInException,
		message: `An error occurred during the sign in process. ${challengeName} challengeName returned by the underlying service was not addressed.`
	});
}
function getTOTPSetupDetails(secretCode, username) {
	return {
		sharedSecret: secretCode,
		getSetupUri: (appName, accountName) => {
			return new AmplifyUrl(`otpauth://totp/${appName}:${accountName ?? username}?secret=${secretCode}&issuer=${appName}`);
		}
	};
}
function getSignInResultFromError(errorName) {
	if (errorName === InitiateAuthException.PasswordResetRequiredException) return {
		isSignedIn: false,
		nextStep: { signInStep: "RESET_PASSWORD" }
	};
	else if (errorName === InitiateAuthException.UserNotConfirmedException) return {
		isSignedIn: false,
		nextStep: { signInStep: "CONFIRM_SIGN_UP" }
	};
}
function parseAttributes(attributes) {
	if (!attributes) return [];
	return JSON.parse(attributes).map((att) => att.includes(USER_ATTRIBUTES) ? att.replace(USER_ATTRIBUTES, "") : att);
}
function createAttributes(attributes) {
	if (!attributes) return {};
	const newAttributes = {};
	Object.entries(attributes).forEach(([key, value]) => {
		if (value) newAttributes[`${USER_ATTRIBUTES}${key}`] = value;
	});
	return newAttributes;
}
async function handleChallengeName(username, challengeName, session, challengeResponse, config, tokenOrchestrator, clientMetadata, options) {
	const userAttributes = options?.userAttributes;
	const deviceName = options?.friendlyDeviceName;
	switch (challengeName) {
		case "WEB_AUTHN":
		case "SELECT_CHALLENGE":
			if (challengeResponse === "PASSWORD_SRP" || challengeResponse === "PASSWORD") return {
				ChallengeName: challengeResponse,
				Session: session,
				$metadata: {}
			};
			return initiateSelectedChallenge({
				username,
				session,
				selectedChallenge: challengeResponse,
				config,
				clientMetadata
			});
		case "SELECT_MFA_TYPE": return handleSelectMFATypeChallenge({
			challengeResponse,
			clientMetadata,
			session,
			username,
			config
		});
		case "MFA_SETUP": return handleMFASetupChallenge({
			challengeResponse,
			clientMetadata,
			session,
			username,
			deviceName,
			config
		});
		case "NEW_PASSWORD_REQUIRED": return handleCompleteNewPasswordChallenge({
			challengeResponse,
			clientMetadata,
			session,
			username,
			requiredAttributes: userAttributes,
			config
		});
		case "CUSTOM_CHALLENGE": return retryOnResourceNotFoundException(handleCustomChallenge, [{
			challengeResponse,
			clientMetadata,
			session,
			username,
			config,
			tokenOrchestrator
		}], username, tokenOrchestrator);
		case "SMS_MFA":
		case "SOFTWARE_TOKEN_MFA":
		case "SMS_OTP":
		case "EMAIL_OTP": return handleMFAChallenge({
			challengeName,
			challengeResponse,
			clientMetadata,
			session,
			username,
			config,
			tokenOrchestrator
		});
		case "PASSWORD": return handleSelectChallengeWithPassword(username, challengeResponse, clientMetadata, config, session);
		case "PASSWORD_SRP": return handleSelectChallengeWithPasswordSRP(username, challengeResponse, clientMetadata, config, session, tokenOrchestrator);
	}
	throw new AuthError({
		name: AuthErrorCodes.SignInException,
		message: `An error occurred during the sign in process.
		${challengeName} challengeName returned by the underlying service was not addressed.`
	});
}
function mapMfaType(mfa) {
	let mfaType = "SMS_MFA";
	if (mfa === "TOTP") mfaType = "SOFTWARE_TOKEN_MFA";
	if (mfa === "EMAIL") mfaType = "EMAIL_OTP";
	return mfaType;
}
function getMFAType(type) {
	if (type === "SMS_MFA") return "SMS";
	if (type === "SOFTWARE_TOKEN_MFA") return "TOTP";
	if (type === "EMAIL_OTP") return "EMAIL";
}
function getMFATypes(types) {
	if (!types) return void 0;
	return types.map(getMFAType).filter(Boolean);
}
function parseMFATypes(mfa) {
	if (!mfa) return [];
	return JSON.parse(mfa);
}
function getAllowedMfaSetupTypes(availableMfaSetupTypes) {
	return availableMfaSetupTypes.filter((authMfaType) => authMfaType === "EMAIL" || authMfaType === "TOTP");
}
async function assertUserNotAuthenticated() {
	let authUser;
	try {
		authUser = await getCurrentUser();
	} catch (error) {}
	if (authUser && authUser.userId && authUser.username) throw new AuthError({
		name: USER_ALREADY_AUTHENTICATED_EXCEPTION,
		message: "There is already a signed in user.",
		recoverySuggestion: "Call signOut before calling signIn again."
	});
}
function getActiveSignInUsername(username) {
	return signInStore.getState().username ?? username;
}
async function handleMFAChallenge({ challengeName, challengeResponse, clientMetadata, session, username, config, tokenOrchestrator }) {
	const { userPoolId, userPoolClientId, userPoolEndpoint } = config;
	const challengeResponses = { USERNAME: username };
	if (challengeName === "EMAIL_OTP") challengeResponses.EMAIL_OTP_CODE = challengeResponse;
	if (challengeName === "SMS_MFA") challengeResponses.SMS_MFA_CODE = challengeResponse;
	if (challengeName === "SMS_OTP") challengeResponses.SMS_OTP_CODE = challengeResponse;
	if (challengeName === "SOFTWARE_TOKEN_MFA") challengeResponses.SOFTWARE_TOKEN_MFA_CODE = challengeResponse;
	const deviceMetadata = await tokenOrchestrator?.getDeviceMetadata(username);
	if (deviceMetadata && deviceMetadata.deviceKey) challengeResponses.DEVICE_KEY = deviceMetadata.deviceKey;
	const jsonReq = {
		ChallengeName: challengeName,
		ChallengeResponses: challengeResponses,
		Session: session,
		ClientMetadata: clientMetadata,
		ClientId: userPoolClientId,
		UserContextData: getUserContextData({
			username,
			userPoolId,
			userPoolClientId
		})
	};
	const response = await createRespondToAuthChallengeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignIn)
	}, jsonReq);
	if (response.ChallengeName === "DEVICE_SRP_AUTH") return handleDeviceSRPAuth({
		username,
		config,
		clientMetadata,
		session: response.Session,
		tokenOrchestrator
	});
	return response;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/signInWithCustomAuth.mjs
/**
* Signs a user in using a custom authentication flow without password
*
* @param input -  The SignInWithCustomAuthInput object
* @returns AuthSignInResult
* @throws service: {@link InitiateAuthException } - Cognito service errors thrown during the sign-in process.
* @throws validation: {@link AuthValidationErrorCode  } - Validation errors thrown when either username or password
*  are not defined.
* @throws SignInWithCustomAuthOutput - Thrown when the token provider config is invalid.
*/
async function signInWithCustomAuth(input) {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { username, password, options } = input;
	const signInDetails = {
		loginId: username,
		authFlowType: "CUSTOM_WITHOUT_SRP"
	};
	const metadata = options?.clientMetadata;
	assertValidationError(!!username, AuthValidationErrorCode.EmptySignInUsername);
	assertValidationError(!password, AuthValidationErrorCode.CustomAuthSignInPassword);
	try {
		const { ChallengeName: retriedChallengeName, ChallengeParameters: retiredChallengeParameters, AuthenticationResult, Session } = await retryOnResourceNotFoundException(handleCustomAuthFlowWithoutSRP, [
			username,
			metadata,
			authConfig,
			tokenOrchestrator
		], username, tokenOrchestrator);
		const activeUsername = getActiveSignInUsername(username);
		setActiveSignInState({
			signInSession: Session,
			username: activeUsername,
			challengeName: retriedChallengeName,
			signInDetails
		});
		if (AuthenticationResult) {
			await cacheCognitoTokens({
				username: activeUsername,
				...AuthenticationResult,
				NewDeviceMetadata: await getNewDeviceMetadata({
					userPoolId: authConfig.userPoolId,
					userPoolEndpoint: authConfig.userPoolEndpoint,
					newDeviceMetadata: AuthenticationResult.NewDeviceMetadata,
					accessToken: AuthenticationResult.AccessToken
				}),
				signInDetails
			});
			resetActiveSignInState();
			await dispatchSignedInHubEvent();
			return {
				isSignedIn: true,
				nextStep: { signInStep: "DONE" }
			};
		}
		return getSignInResult({
			challengeName: retriedChallengeName,
			challengeParameters: retiredChallengeParameters
		});
	} catch (error) {
		resetActiveSignInState();
		assertServiceError(error);
		const result = getSignInResultFromError(error.name);
		if (result) return result;
		throw error;
	}
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/signInWithCustomSRPAuth.mjs
/**
* Signs a user in using a custom authentication flow with SRP
*
* @param input -  The SignInWithCustomSRPAuthInput object
* @returns SignInWithCustomSRPAuthOutput
* @throws service: {@link InitiateAuthException }, {@link RespondToAuthChallengeException } - Cognito
* service errors thrown during the sign-in process.
* @throws validation: {@link AuthValidationErrorCode  } - Validation errors thrown when either username or password
*  are not defined.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function signInWithCustomSRPAuth(input) {
	const { username, password, options } = input;
	const signInDetails = {
		loginId: username,
		authFlowType: "CUSTOM_WITH_SRP"
	};
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const metadata = options?.clientMetadata;
	assertValidationError(!!username, AuthValidationErrorCode.EmptySignInUsername);
	assertValidationError(!!password, AuthValidationErrorCode.EmptySignInPassword);
	try {
		const { ChallengeName: handledChallengeName, ChallengeParameters: handledChallengeParameters, AuthenticationResult, Session } = await handleCustomSRPAuthFlow(username, password, metadata, authConfig, tokenOrchestrator);
		const activeUsername = getActiveSignInUsername(username);
		setActiveSignInState({
			signInSession: Session,
			username: activeUsername,
			challengeName: handledChallengeName,
			signInDetails
		});
		if (AuthenticationResult) {
			await cacheCognitoTokens({
				username: activeUsername,
				...AuthenticationResult,
				NewDeviceMetadata: await getNewDeviceMetadata({
					userPoolId: authConfig.userPoolId,
					userPoolEndpoint: authConfig.userPoolEndpoint,
					newDeviceMetadata: AuthenticationResult.NewDeviceMetadata,
					accessToken: AuthenticationResult.AccessToken
				}),
				signInDetails
			});
			resetActiveSignInState();
			await dispatchSignedInHubEvent();
			return {
				isSignedIn: true,
				nextStep: { signInStep: "DONE" }
			};
		}
		return getSignInResult({
			challengeName: handledChallengeName,
			challengeParameters: handledChallengeParameters
		});
	} catch (error) {
		resetActiveSignInState();
		assertServiceError(error);
		const result = getSignInResultFromError(error.name);
		if (result) return result;
		throw error;
	}
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/autoSignIn.mjs
var initialAutoSignIn = async () => {
	throw new AuthError({
		name: AUTO_SIGN_IN_EXCEPTION,
		message: "The autoSignIn flow has not started, or has been cancelled/completed.",
		recoverySuggestion: "Please try to use the signIn API or log out before starting a new autoSignIn flow."
	});
};
/**
* Signs a user in automatically after finishing the sign-up process.
*
* This API will automatically sign a user in if the autoSignIn flow has been completed in the following cases:
* - User confirmed their account with a verification code sent to their phone or email (default option).
* - User confirmed their account with a verification link sent to their phone or email. In order to
* enable this option you need to go to the Amazon Cognito [console](https://aws.amazon.com/pm/cognito),
* look for your userpool, then go to the `Messaging` tab and enable `link` mode inside the `Verification message` option.
* Finally you need to define the `signUpVerificationMethod` in your `Auth` config.
*
* @example
* ```typescript
*  Amplify.configure({
*    Auth: {
*     Cognito: {
*    ...cognitoConfig,
*    signUpVerificationMethod: "link" // the default value is "code"
*   }
*	}});
* ```
*
* @throws AutoSignInException - Thrown when the autoSignIn flow has not started, or has been cancelled/completed.
* @returns The signInOutput.
*
* @example
* ```typescript
*  // handleSignUp.ts
* async function handleSignUp(
*   username:string,
*   password:string
* ){
*   try {
*     const { nextStep } = await signUp({
*       username,
*       password,
*       options: {
*         userAttributes:{ email:'email@email.com'},
*         autoSignIn: true // This enables the auto sign-in flow.
*       },
*     });
*
*     handleSignUpStep(nextStep);
*
*   } catch (error) {
*     console.log(error);
*   }
* }
*
* // handleConfirmSignUp.ts
* async function handleConfirmSignUp(username:string, confirmationCode:string) {
*   try {
*     const { nextStep } = await confirmSignUp({
*       username,
*       confirmationCode,
*     });
*
*     handleSignUpStep(nextStep);
*   } catch (error) {
*     console.log(error);
*   }
* }
*
* // signUpUtils.ts
* async function handleSignUpStep( step: SignUpOutput["nextStep"]) {
* switch (step.signUpStep) {
*   case "CONFIRM_SIGN_UP":
*
*    // Redirect end-user to confirm-sign up screen.
*
*   case "COMPLETE_AUTO_SIGN_IN":
*	   const codeDeliveryDetails = step.codeDeliveryDetails;
*     if (codeDeliveryDetails) {
*      // Redirect user to confirm-sign-up with link screen.
*     }
*     const signInOutput = await autoSignIn();
*   // handle sign-in steps
* }
*
* ```
*/
var autoSignIn = initialAutoSignIn;
/**
* Sets the context of autoSignIn at run time.
* @internal
*/
function setAutoSignIn(callback) {
	autoSignIn = callback;
}
/**
* Resets the context
*
* @internal
*/
function resetAutoSignIn(resetCallback = true) {
	if (resetCallback) autoSignIn = initialAutoSignIn;
	autoSignInStore.dispatch({ type: "RESET" });
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/signInWithSRP.mjs
/**
* Signs a user in
*
* @param input - The SignInWithSRPInput object
* @returns SignInWithSRPOutput
* @throws service: {@link InitiateAuthException }, {@link RespondToAuthChallengeException } - Cognito service errors
* thrown during the sign-in process.
* @throws validation: {@link AuthValidationErrorCode  } - Validation errors thrown when either username or password
*  are not defined.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function signInWithSRP(input) {
	const { username, password } = input;
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	const signInDetails = {
		loginId: username,
		authFlowType: "USER_SRP_AUTH"
	};
	assertTokenProviderConfig(authConfig);
	const clientMetaData = input.options?.clientMetadata;
	assertValidationError(!!username, AuthValidationErrorCode.EmptySignInUsername);
	assertValidationError(!!password, AuthValidationErrorCode.EmptySignInPassword);
	try {
		const { ChallengeName: handledChallengeName, ChallengeParameters: handledChallengeParameters, AuthenticationResult, Session } = await handleUserSRPAuthFlow(username, password, clientMetaData, authConfig, tokenOrchestrator);
		const activeUsername = getActiveSignInUsername(username);
		setActiveSignInState({
			signInSession: Session,
			username: activeUsername,
			challengeName: handledChallengeName,
			signInDetails
		});
		if (AuthenticationResult) {
			await cacheCognitoTokens({
				username: activeUsername,
				...AuthenticationResult,
				NewDeviceMetadata: await getNewDeviceMetadata({
					userPoolId: authConfig.userPoolId,
					userPoolEndpoint: authConfig.userPoolEndpoint,
					newDeviceMetadata: AuthenticationResult.NewDeviceMetadata,
					accessToken: AuthenticationResult.AccessToken
				}),
				signInDetails
			});
			resetActiveSignInState();
			await dispatchSignedInHubEvent();
			resetAutoSignIn();
			return {
				isSignedIn: true,
				nextStep: { signInStep: "DONE" }
			};
		}
		return getSignInResult({
			challengeName: handledChallengeName,
			challengeParameters: handledChallengeParameters
		});
	} catch (error) {
		resetActiveSignInState();
		resetAutoSignIn();
		assertServiceError(error);
		const result = getSignInResultFromError(error.name);
		if (result) return result;
		throw error;
	}
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/signInWithUserPassword.mjs
/**
* Signs a user in using USER_PASSWORD_AUTH AuthFlowType
*
* @param input - The SignInWithUserPasswordInput object
* @returns SignInWithUserPasswordOutput
* @throws service: {@link InitiateAuthException } - Cognito service error thrown during the sign-in process.
* @throws validation: {@link AuthValidationErrorCode  } - Validation errors thrown when either username or password
*  are not defined.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function signInWithUserPassword(input) {
	const { username, password, options } = input;
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	const signInDetails = {
		loginId: username,
		authFlowType: "USER_PASSWORD_AUTH"
	};
	assertTokenProviderConfig(authConfig);
	const metadata = options?.clientMetadata;
	assertValidationError(!!username, AuthValidationErrorCode.EmptySignInUsername);
	assertValidationError(!!password, AuthValidationErrorCode.EmptySignInPassword);
	try {
		const { ChallengeName: retiredChallengeName, ChallengeParameters: retriedChallengeParameters, AuthenticationResult, Session } = await retryOnResourceNotFoundException(handleUserPasswordAuthFlow, [
			username,
			password,
			metadata,
			authConfig,
			tokenOrchestrator
		], username, tokenOrchestrator);
		const activeUsername = getActiveSignInUsername(username);
		setActiveSignInState({
			signInSession: Session,
			username: activeUsername,
			challengeName: retiredChallengeName,
			signInDetails
		});
		if (AuthenticationResult) {
			await cacheCognitoTokens({
				...AuthenticationResult,
				username: activeUsername,
				NewDeviceMetadata: await getNewDeviceMetadata({
					userPoolId: authConfig.userPoolId,
					userPoolEndpoint: authConfig.userPoolEndpoint,
					newDeviceMetadata: AuthenticationResult.NewDeviceMetadata,
					accessToken: AuthenticationResult.AccessToken
				}),
				signInDetails
			});
			resetActiveSignInState();
			await dispatchSignedInHubEvent();
			resetAutoSignIn();
			return {
				isSignedIn: true,
				nextStep: { signInStep: "DONE" }
			};
		}
		return getSignInResult({
			challengeName: retiredChallengeName,
			challengeParameters: retriedChallengeParameters
		});
	} catch (error) {
		resetActiveSignInState();
		resetAutoSignIn();
		assertServiceError(error);
		const result = getSignInResultFromError(error.name);
		if (result) return result;
		throw error;
	}
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/client/flows/userAuth/handleUserAuthFlow.mjs
/**
* Handles user authentication flow with configurable challenge preferences.
* Supports AuthFactorType challenges through the USER_AUTH flow.
*
* @param {HandleUserAuthFlowInput} params - Authentication flow parameters
* @param {string} params.username - The username for authentication
* @param {Record<string, string>} [params.clientMetadata] - Optional metadata to pass to authentication service
* @param {CognitoUserPoolConfig} params.config - Cognito User Pool configuration
* @param {AuthTokenOrchestrator} params.tokenOrchestrator - Manages authentication tokens and device tracking
* @param {AuthFactorType} [params.preferredChallenge] - Optional preferred authentication method
* @param {string} [params.password] - Required when preferredChallenge is 'PASSWORD' or 'PASSWORD_SRP'
*
* @returns {Promise<InitiateAuthCommandOutput>} The authentication response from Cognito
*/
async function handleUserAuthFlow({ username, clientMetadata, config, tokenOrchestrator, preferredChallenge, password, session }) {
	const { userPoolId, userPoolClientId, userPoolEndpoint } = config;
	const UserContextData = getUserContextData({
		username,
		userPoolId,
		userPoolClientId
	});
	const authParameters = { USERNAME: username };
	if (preferredChallenge) {
		if (config.passwordless) {
			if (preferredChallenge === "EMAIL_OTP" && !config.passwordless.emailOtpEnabled || preferredChallenge === "SMS_OTP" && !config.passwordless.smsOtpEnabled || preferredChallenge === "WEB_AUTHN" && !config.passwordless.webAuthn) assertValidationError(false, AuthValidationErrorCode.InvalidPreferredChallenge);
		}
		if (preferredChallenge === "PASSWORD_SRP") {
			assertValidationError(!!password, AuthValidationErrorCode.EmptySignInPassword);
			return handlePasswordSRP({
				username,
				password,
				clientMetadata,
				config,
				tokenOrchestrator,
				authFlow: "USER_AUTH",
				preferredChallenge
			});
		}
		if (preferredChallenge === "PASSWORD") {
			assertValidationError(!!password, AuthValidationErrorCode.EmptySignInPassword);
			authParameters.PASSWORD = password;
		}
		authParameters.PREFERRED_CHALLENGE = preferredChallenge;
	}
	const jsonReq = {
		AuthFlow: "USER_AUTH",
		AuthParameters: authParameters,
		ClientMetadata: clientMetadata,
		ClientId: userPoolClientId,
		UserContextData
	};
	if (session) jsonReq.Session = session;
	const response = await createInitiateAuthClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.SignIn)
	}, jsonReq);
	setActiveSignInUsername(username);
	return response;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/signInWithUserAuth.mjs
/**
* Signs a user in through a registered email or phone number without a password by by receiving and entering an OTP.
*
* @param input - The SignInWithUserAuthInput object
* @returns SignInWithUserAuthOutput
* @throws service: {@link InitiateAuthException }, {@link RespondToAuthChallengeException } - Cognito service errors
* thrown during the sign-in process.
* @throws validation: {@link AuthValidationErrorCode  } - Validation errors thrown when either username or password -- needs to change
*  are not defined.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function signInWithUserAuth(input) {
	const { username, password, options } = input;
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	const signInDetails = {
		loginId: username,
		authFlowType: "USER_AUTH"
	};
	assertTokenProviderConfig(authConfig);
	const clientMetaData = options?.clientMetadata;
	const preferredChallenge = options?.preferredChallenge ?? authConfig?.passwordless?.preferredChallenge;
	assertValidationError(!!username, AuthValidationErrorCode.EmptySignInUsername);
	try {
		const handleUserAuthFlowInput = {
			username,
			config: authConfig,
			tokenOrchestrator,
			clientMetadata: clientMetaData,
			preferredChallenge,
			password
		};
		const autoSignInStoreState = autoSignInStore.getState();
		if (autoSignInStoreState.active && autoSignInStoreState.username === username) handleUserAuthFlowInput.session = autoSignInStoreState.session;
		const response = await handleUserAuthFlow(handleUserAuthFlowInput);
		const activeUsername = getActiveSignInUsername(username);
		setActiveSignInState({
			signInSession: response.Session,
			username: activeUsername,
			challengeName: response.ChallengeName,
			signInDetails
		});
		if (response.AuthenticationResult) {
			await cacheCognitoTokens({
				username: activeUsername,
				...response.AuthenticationResult,
				NewDeviceMetadata: await getNewDeviceMetadata({
					userPoolId: authConfig.userPoolId,
					userPoolEndpoint: authConfig.userPoolEndpoint,
					newDeviceMetadata: response.AuthenticationResult.NewDeviceMetadata,
					accessToken: response.AuthenticationResult.AccessToken
				}),
				signInDetails
			});
			resetActiveSignInState();
			await dispatchSignedInHubEvent();
			resetAutoSignIn();
			return {
				isSignedIn: true,
				nextStep: { signInStep: "DONE" }
			};
		}
		return getSignInResult({
			challengeName: response.ChallengeName,
			challengeParameters: response.ChallengeParameters,
			availableChallenges: "AvailableChallenges" in response ? response.AvailableChallenges : void 0
		});
	} catch (error) {
		resetActiveSignInState();
		resetAutoSignIn();
		assertServiceError(error);
		const result = getSignInResultFromError(error.name);
		if (result) return result;
		throw error;
	}
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/signIn.mjs
/**
* Signs a user in
*
* @param input -  The SignInInput object
* @returns SignInOutput
* @throws service: {@link InitiateAuthException }, {@link RespondToAuthChallengeException }
*  - Cognito service errors thrown during the sign-in process.
* @throws validation: {@link AuthValidationErrorCode  } - Validation errors thrown when either username or password
*  are not defined.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function signIn(input) {
	resetAutoSignIn(false);
	const authFlowType = input.options?.authFlowType;
	await assertUserNotAuthenticated();
	switch (authFlowType) {
		case "USER_SRP_AUTH": return signInWithSRP(input);
		case "USER_PASSWORD_AUTH": return signInWithUserPassword(input);
		case "CUSTOM_WITHOUT_SRP": return signInWithCustomAuth(input);
		case "CUSTOM_WITH_SRP": return signInWithCustomSRPAuth(input);
		case "USER_AUTH": return signInWithUserAuth(input);
		default: return signInWithSRP(input);
	}
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/signUpHelpers.mjs
var MAX_AUTOSIGNIN_POLLING_MS = 180 * 1e3;
function handleCodeAutoSignIn(signInInput) {
	const stopHubListener = HubInternal.listen("auth-internal", async ({ payload }) => {
		switch (payload.event) {
			case "confirmSignUp": if (payload.data?.isSignUpComplete) {
				HubInternal.dispatch("auth-internal", { event: "autoSignIn" });
				setAutoSignIn(autoSignInWithCode(signInInput));
				stopHubListener();
			}
		}
	});
	const timeOutId = setTimeout(() => {
		stopHubListener();
		clearTimeout(timeOutId);
		resetAutoSignIn();
	}, MAX_AUTOSIGNIN_POLLING_MS);
}
function debounce(fun, delay) {
	let timer;
	return (args) => {
		if (!timer) fun(...args);
		clearTimeout(timer);
		timer = setTimeout(() => {
			timer = void 0;
		}, delay);
	};
}
function handleAutoSignInWithLink(signInInput, resolve, reject) {
	const start = Date.now();
	const autoSignInPollingIntervalId = setInterval(async () => {
		if (Date.now() - start > MAX_AUTOSIGNIN_POLLING_MS) {
			clearInterval(autoSignInPollingIntervalId);
			reject(new AuthError({
				name: AUTO_SIGN_IN_EXCEPTION,
				message: "The account was not confirmed on time.",
				recoverySuggestion: "Try to verify your account by clicking the link sent your email or phone and then login manually."
			}));
			resetAutoSignIn();
		} else try {
			const signInOutput = await signIn(signInInput);
			if (signInOutput.nextStep.signInStep !== "CONFIRM_SIGN_UP") {
				resolve(signInOutput);
				clearInterval(autoSignInPollingIntervalId);
				resetAutoSignIn();
			}
		} catch (error) {
			clearInterval(autoSignInPollingIntervalId);
			reject(error);
			resetAutoSignIn();
		}
	}, 5e3);
}
var debouncedAutoSignInWithLink = debounce(handleAutoSignInWithLink, 300);
var debouncedAutoSignWithCodeOrUserConfirmed = debounce(handleAutoSignInWithCodeOrUserConfirmed, 300);
function autoSignInWhenUserIsConfirmedWithLink(signInInput) {
	return async () => {
		return new Promise((resolve, reject) => {
			debouncedAutoSignInWithLink([
				signInInput,
				resolve,
				reject
			]);
		});
	};
}
async function handleAutoSignInWithCodeOrUserConfirmed(signInInput, resolve, reject) {
	try {
		resolve(signInInput?.options?.authFlowType === "USER_AUTH" ? await signInWithUserAuth(signInInput) : await signIn(signInInput));
		resetAutoSignIn();
	} catch (error) {
		reject(error);
		resetAutoSignIn();
	}
}
function autoSignInWithCode(signInInput) {
	return async () => {
		return new Promise((resolve, reject) => {
			debouncedAutoSignWithCodeOrUserConfirmed([
				signInInput,
				resolve,
				reject
			]);
		});
	};
}
var autoSignInUserConfirmed = autoSignInWithCode;
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createSignUpClient.mjs
var createSignUpClientDeserializer = () => async (response) => {
	if (response.statusCode >= 300) {
		const error = await parseJsonError(response);
		assertServiceError(error);
		if (error.name === SignUpException.InvalidParameterException && /'password'/.test(error.message) && /Member must not be null/.test(error.message)) {
			const name = AuthValidationErrorCode.EmptySignUpPassword;
			const { message, recoverySuggestion } = validationErrorMap[name];
			throw new AuthError({
				name,
				message,
				recoverySuggestion
			});
		}
		throw new AuthError({
			name: error.name,
			message: error.message
		});
	}
	return parseJsonBody(response);
};
var createSignUpClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("SignUp"), createSignUpClientDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/signUp.mjs
/**
* Creates a user
*
* @param input - The SignUpInput object
* @returns SignUpOutput
* @throws service: {@link SignUpException } - Cognito service errors thrown during the sign-up process.
* @throws validation: {@link AuthValidationErrorCode } - Validation errors thrown either username or password
*  are not defined.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function signUp(input) {
	const { username, password, options } = input;
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	const signUpVerificationMethod = authConfig?.signUpVerificationMethod ?? "code";
	const { clientMetadata, validationData, autoSignIn } = input.options ?? {};
	assertTokenProviderConfig(authConfig);
	assertValidationError(!!username, AuthValidationErrorCode.EmptySignUpUsername);
	const signInServiceOptions = typeof autoSignIn !== "boolean" ? autoSignIn : void 0;
	const signInInput = {
		username,
		options: signInServiceOptions
	};
	if (signInServiceOptions?.authFlowType !== "CUSTOM_WITHOUT_SRP") signInInput.password = password;
	const { userPoolId, userPoolClientId, userPoolEndpoint } = authConfig;
	const signUpClient = createSignUpClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) });
	const signUpClientInput = {
		Username: username,
		Password: void 0,
		UserAttributes: options?.userAttributes && toAttributeType(options?.userAttributes),
		ClientMetadata: clientMetadata,
		ValidationData: validationData && toAttributeType(validationData),
		ClientId: userPoolClientId,
		UserContextData: getUserContextData({
			username,
			userPoolId,
			userPoolClientId
		})
	};
	if (password) signUpClientInput.Password = password;
	const { UserSub: userId, CodeDeliveryDetails: cdd, UserConfirmed: userConfirmed, Session: session } = await signUpClient({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.SignUp)
	}, signUpClientInput);
	if (signInServiceOptions || autoSignIn === true) {
		autoSignInStore.dispatch({ type: "START" });
		autoSignInStore.dispatch({
			type: "SET_USERNAME",
			value: username
		});
		autoSignInStore.dispatch({
			type: "SET_SESSION",
			value: session
		});
	}
	const codeDeliveryDetails = {
		destination: cdd?.Destination,
		deliveryMedium: cdd?.DeliveryMedium,
		attributeName: cdd?.AttributeName
	};
	const isSignUpComplete = !!userConfirmed;
	const isAutoSignInStarted = autoSignInStore.getState().active;
	if (isSignUpComplete) {
		if (isAutoSignInStarted) {
			setAutoSignIn(autoSignInUserConfirmed(signInInput));
			return {
				isSignUpComplete: true,
				nextStep: { signUpStep: "COMPLETE_AUTO_SIGN_IN" },
				userId
			};
		}
		return {
			isSignUpComplete: true,
			nextStep: { signUpStep: "DONE" },
			userId
		};
	}
	if (isAutoSignInStarted) {
		if (signUpVerificationMethod === "link") {
			setAutoSignIn(autoSignInWhenUserIsConfirmedWithLink(signInInput));
			return {
				isSignUpComplete: false,
				nextStep: {
					signUpStep: "COMPLETE_AUTO_SIGN_IN",
					codeDeliveryDetails
				},
				userId
			};
		}
		handleCodeAutoSignIn(signInInput);
	}
	return {
		isSignUpComplete: false,
		nextStep: {
			signUpStep: "CONFIRM_SIGN_UP",
			codeDeliveryDetails
		},
		userId
	};
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createForgotPasswordClient.mjs
var createForgotPasswordClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("ForgotPassword"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/resetPassword.mjs
/**
* Resets a user's password.
*
* @param input -  The ResetPasswordInput object.
* @returns ResetPasswordOutput
* @throws -{@link ForgotPasswordException }
* Thrown due to an invalid confirmation code or password.
* @throws -{@link AuthValidationErrorCode }
* Thrown due to an empty username.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
**/
async function resetPassword(input) {
	const { username } = input;
	assertValidationError(!!username, AuthValidationErrorCode.EmptyResetPasswordUsername);
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolClientId, userPoolId, userPoolEndpoint } = authConfig;
	const clientMetadata = input.options?.clientMetadata;
	const UserContextData = getUserContextData({
		username,
		userPoolId,
		userPoolClientId
	});
	const codeDeliveryDetails = (await createForgotPasswordClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ResetPassword)
	}, {
		Username: username,
		ClientMetadata: clientMetadata,
		ClientId: userPoolClientId,
		UserContextData
	})).CodeDeliveryDetails;
	return {
		isPasswordReset: false,
		nextStep: {
			resetPasswordStep: "CONFIRM_RESET_PASSWORD_WITH_CODE",
			codeDeliveryDetails: {
				deliveryMedium: codeDeliveryDetails?.DeliveryMedium,
				destination: codeDeliveryDetails?.Destination,
				attributeName: codeDeliveryDetails?.AttributeName
			}
		}
	};
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createConfirmForgotPasswordClient.mjs
var createConfirmForgotPasswordClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("ConfirmForgotPassword"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/confirmResetPassword.mjs
/**
* Confirms the new password and verification code to reset the password.
*
* @param input -  The ConfirmResetPasswordInput object.
* @throws -{@link ConfirmForgotPasswordException }
* Thrown due to an invalid confirmation code or password.
* @throws -{@link AuthValidationErrorCode }
* Thrown due to an empty confirmation code, password or username.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function confirmResetPassword(input) {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolClientId, userPoolId, userPoolEndpoint } = authConfig;
	const { username, newPassword } = input;
	assertValidationError(!!username, AuthValidationErrorCode.EmptyConfirmResetPasswordUsername);
	assertValidationError(!!newPassword, AuthValidationErrorCode.EmptyConfirmResetPasswordNewPassword);
	const code = input.confirmationCode;
	assertValidationError(!!code, AuthValidationErrorCode.EmptyConfirmResetPasswordConfirmationCode);
	const metadata = input.options?.clientMetadata;
	const UserContextData = getUserContextData({
		username,
		userPoolId,
		userPoolClientId
	});
	await createConfirmForgotPasswordClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(authConfig.userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmResetPassword)
	}, {
		Username: username,
		ConfirmationCode: code,
		Password: newPassword,
		ClientMetadata: metadata,
		ClientId: authConfig.userPoolClientId,
		UserContextData
	});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createResendConfirmationCodeClient.mjs
var createResendConfirmationCodeClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("ResendConfirmationCode"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/resendSignUpCode.mjs
/**
* Resend the confirmation code while signing up
*
* @param input -  The ResendSignUpCodeInput object
* @returns ResendSignUpCodeOutput
* @throws service: {@link ResendConfirmationException } - Cognito service errors thrown when resending the code.
* @throws validation: {@link AuthValidationErrorCode } - Validation errors thrown either username are not defined.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function resendSignUpCode(input) {
	const { username } = input;
	assertValidationError(!!username, AuthValidationErrorCode.EmptySignUpUsername);
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolClientId, userPoolId, userPoolEndpoint } = authConfig;
	const clientMetadata = input.options?.clientMetadata;
	const UserContextData = getUserContextData({
		username,
		userPoolId,
		userPoolClientId
	});
	const { CodeDeliveryDetails } = await createResendConfirmationCodeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(authConfig.userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ResendSignUpCode)
	}, {
		Username: username,
		ClientMetadata: clientMetadata,
		ClientId: authConfig.userPoolClientId,
		UserContextData
	});
	const { DeliveryMedium, AttributeName, Destination } = { ...CodeDeliveryDetails };
	return {
		destination: Destination,
		deliveryMedium: DeliveryMedium,
		attributeName: AttributeName ? AttributeName : void 0
	};
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createConfirmSignUpClient.mjs
var createConfirmSignUpClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("ConfirmSignUp"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/confirmSignUp.mjs
/**
* Confirms a new user account.
*
* @param input -  The ConfirmSignUpInput object.
* @returns ConfirmSignUpOutput
* @throws -{@link ConfirmSignUpException }
* Thrown due to an invalid confirmation code.
* @throws -{@link AuthValidationErrorCode }
* Thrown due to an empty confirmation code
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function confirmSignUp(input) {
	const { username, confirmationCode, options } = input;
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolId, userPoolClientId, userPoolEndpoint } = authConfig;
	const clientMetadata = options?.clientMetadata;
	assertValidationError(!!username, AuthValidationErrorCode.EmptyConfirmSignUpUsername);
	assertValidationError(!!confirmationCode, AuthValidationErrorCode.EmptyConfirmSignUpCode);
	const UserContextData = getUserContextData({
		username,
		userPoolId,
		userPoolClientId
	});
	const { Session: session } = await createConfirmSignUpClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(authConfig.userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmSignUp)
	}, {
		Username: username,
		ConfirmationCode: confirmationCode,
		ClientMetadata: clientMetadata,
		ForceAliasCreation: options?.forceAliasCreation,
		ClientId: authConfig.userPoolClientId,
		UserContextData
	});
	return new Promise((resolve, reject) => {
		try {
			const signUpOut = {
				isSignUpComplete: true,
				nextStep: { signUpStep: "DONE" }
			};
			const autoSignInStoreState = autoSignInStore.getState();
			if (!autoSignInStoreState.active || autoSignInStoreState.username !== username) {
				resolve(signUpOut);
				resetAutoSignIn();
				return;
			}
			autoSignInStore.dispatch({
				type: "SET_SESSION",
				value: session
			});
			const stopListener = HubInternal.listen("auth-internal", ({ payload }) => {
				switch (payload.event) {
					case "autoSignIn":
						resolve({
							isSignUpComplete: true,
							nextStep: { signUpStep: "COMPLETE_AUTO_SIGN_IN" }
						});
						stopListener();
				}
			});
			HubInternal.dispatch("auth-internal", {
				event: "confirmSignUp",
				data: signUpOut
			});
		} catch (error) {
			reject(error);
		}
	});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/confirmSignIn.mjs
/**
* Continues or completes the sign in process when required by the initial call to `signIn`.
*
* @param input -  The ConfirmSignInInput object
* @returns ConfirmSignInOutput
* @throws  -{@link VerifySoftwareTokenException }:
* Thrown due to an invalid MFA token.
* @throws  -{@link RespondToAuthChallengeException }:
* Thrown due to an invalid auth challenge response.
* @throws  -{@link AssociateSoftwareTokenException}:
* Thrown due to a service error during the MFA setup process.
* @throws  -{@link AuthValidationErrorCode }:
* Thrown when `challengeResponse` is not defined.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function confirmSignIn(input) {
	const { challengeResponse, options } = input;
	const { username, challengeName, signInSession, signInDetails } = signInStore.getState();
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const clientMetaData = options?.clientMetadata;
	assertValidationError(!!challengeResponse, AuthValidationErrorCode.EmptyChallengeResponse);
	if (!username || !challengeName || !signInSession) throw new AuthError({
		name: AuthErrorCodes.SignInException,
		message: `
			An error occurred during the sign in process.

			This most likely occurred due to:
			1. signIn was not called before confirmSignIn.
			2. signIn threw an exception.
			3. page was refreshed during the sign in flow and session has expired.
			`,
		recoverySuggestion: "Make sure a successful call to signIn is made before calling confirmSignInand that the session has not expired."
	});
	try {
		const { Session, ChallengeName: handledChallengeName, AuthenticationResult, ChallengeParameters: handledChallengeParameters } = await handleChallengeName(username, challengeName, signInSession, challengeResponse, authConfig, tokenOrchestrator, clientMetaData, options);
		setActiveSignInState({
			signInSession: Session,
			username,
			challengeName: handledChallengeName,
			signInDetails
		});
		if (AuthenticationResult) {
			await cacheCognitoTokens({
				username,
				...AuthenticationResult,
				NewDeviceMetadata: await getNewDeviceMetadata({
					userPoolId: authConfig.userPoolId,
					userPoolEndpoint: authConfig.userPoolEndpoint,
					newDeviceMetadata: AuthenticationResult.NewDeviceMetadata,
					accessToken: AuthenticationResult.AccessToken
				}),
				signInDetails
			});
			resetActiveSignInState();
			await dispatchSignedInHubEvent();
			return {
				isSignedIn: true,
				nextStep: { signInStep: "DONE" }
			};
		}
		return getSignInResult({
			challengeName: handledChallengeName,
			challengeParameters: handledChallengeParameters
		});
	} catch (error) {
		assertServiceError(error);
		const result = getSignInResultFromError(error.name);
		if (result) return result;
		throw error;
	}
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createSetUserMFAPreferenceClient.mjs
var createSetUserMFAPreferenceClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("SetUserMFAPreference"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/updateMFAPreference.mjs
/**
* Updates the MFA preference of the user.
*
* @param input - The UpdateMFAPreferenceInput object.
* @throws -{@link SetUserMFAPreferenceException } - Service error thrown when the MFA preference cannot be updated.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function updateMFAPreference(input) {
	const { sms, totp, email } = input;
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { tokens } = await fetchAuthSession({ forceRefresh: false });
	assertAuthTokens(tokens);
	await createSetUserMFAPreferenceClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.UpdateMFAPreference)
	}, {
		AccessToken: tokens.accessToken.toString(),
		SMSMfaSettings: getMFASettings(sms),
		SoftwareTokenMfaSettings: getMFASettings(totp),
		EmailMfaSettings: getMFASettings(email)
	});
}
function getMFASettings(mfaPreference) {
	if (mfaPreference === "DISABLED") return { Enabled: false };
	else if (mfaPreference === "PREFERRED") return {
		Enabled: true,
		PreferredMfa: true
	};
	else if (mfaPreference === "ENABLED") return { Enabled: true };
	else if (mfaPreference === "NOT_PREFERRED") return {
		Enabled: true,
		PreferredMfa: false
	};
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createGetUserClient.mjs
var createGetUserClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("GetUser"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/fetchMFAPreference.mjs
/**
* Fetches the preferred MFA setting and enabled MFA settings for the user.
*
* @returns FetchMFAPreferenceOutput
* @throws  -{@link GetUserException} : error thrown when the service fails to fetch MFA preference
* and settings.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function fetchMFAPreference() {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { tokens } = await fetchAuthSession({ forceRefresh: false });
	assertAuthTokens(tokens);
	const { PreferredMfaSetting, UserMFASettingList } = await createGetUserClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.FetchMFAPreference)
	}, { AccessToken: tokens.accessToken.toString() });
	return {
		preferred: getMFAType(PreferredMfaSetting),
		enabled: getMFATypes(UserMFASettingList)
	};
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/verifyTOTPSetup.mjs
/**
* Verifies an OTP code retrieved from an associated authentication app.
*
* @param input - The VerifyTOTPSetupInput
* @throws  -{@link VerifySoftwareTokenException }:
* Thrown due to an invalid MFA token.
* @throws  -{@link AuthValidationErrorCode }:
* Thrown when `code` is not defined.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function verifyTOTPSetup(input) {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { code, options } = input;
	assertValidationError(!!code, AuthValidationErrorCode.EmptyVerifyTOTPSetupCode);
	const { tokens } = await fetchAuthSession({ forceRefresh: false });
	assertAuthTokens(tokens);
	await createVerifySoftwareTokenClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.VerifyTOTPSetup)
	}, {
		AccessToken: tokens.accessToken.toString(),
		UserCode: code,
		FriendlyDeviceName: options?.friendlyDeviceName
	});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createChangePasswordClient.mjs
var createChangePasswordClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("ChangePassword"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/updatePassword.mjs
/**
* Updates user's password while authenticated.
*
* @param input - The UpdatePasswordInput object.
* @throws - {@link ChangePasswordException} - Cognito service errors thrown when updating a password.
* @throws - {@link AuthValidationErrorCode} - Validation errors thrown when oldPassword or newPassword are empty.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function updatePassword(input) {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { oldPassword, newPassword } = input;
	assertValidationError(!!oldPassword, AuthValidationErrorCode.EmptyUpdatePassword);
	assertValidationError(!!newPassword, AuthValidationErrorCode.EmptyUpdatePassword);
	const { tokens } = await fetchAuthSession({ forceRefresh: false });
	assertAuthTokens(tokens);
	await createChangePasswordClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.UpdatePassword)
	}, {
		AccessToken: tokens.accessToken.toString(),
		PreviousPassword: oldPassword,
		ProposedPassword: newPassword
	});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/setUpTOTP.mjs
/**
* Sets up TOTP for the user.
*
* @returns SetUpTOTPOutput
* @throws -{@link AssociateSoftwareTokenException}
* Thrown if a service occurs while setting up TOTP.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
**/
async function setUpTOTP() {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { tokens } = await fetchAuthSession({ forceRefresh: false });
	assertAuthTokens(tokens);
	const username = tokens.idToken?.payload["cognito:username"] ?? "";
	const { SecretCode } = await createAssociateSoftwareTokenClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.SetUpTOTP)
	}, { AccessToken: tokens.accessToken.toString() });
	if (!SecretCode) throw new AuthError({
		name: SETUP_TOTP_EXCEPTION,
		message: "Failed to set up TOTP."
	});
	return getTOTPSetupDetails(SecretCode, JSON.stringify(username));
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createUpdateUserAttributesClient.mjs
var createUpdateUserAttributesClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("UpdateUserAttributes"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/updateUserAttributes.mjs
/**
* Updates user's attributes while authenticated.
*
* @param input - The UpdateUserAttributesInput object
* @returns UpdateUserAttributesOutput
* @throws - {@link UpdateUserAttributesException}
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
var updateUserAttributes = async (input) => {
	const { userAttributes, options } = input;
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	const clientMetadata = options?.clientMetadata;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { tokens } = await fetchAuthSession({ forceRefresh: false });
	assertAuthTokens(tokens);
	const { CodeDeliveryDetailsList } = await createUpdateUserAttributesClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.UpdateUserAttributes)
	}, {
		AccessToken: tokens.accessToken.toString(),
		ClientMetadata: clientMetadata,
		UserAttributes: toAttributeType(userAttributes)
	});
	return {
		...getConfirmedAttributes(userAttributes),
		...getUnConfirmedAttributes(CodeDeliveryDetailsList)
	};
};
function getConfirmedAttributes(attributes) {
	const confirmedAttributes = {};
	Object.keys(attributes)?.forEach((key) => {
		confirmedAttributes[key] = {
			isUpdated: true,
			nextStep: { updateAttributeStep: "DONE" }
		};
	});
	return confirmedAttributes;
}
function getUnConfirmedAttributes(codeDeliveryDetailsList) {
	const unConfirmedAttributes = {};
	codeDeliveryDetailsList?.forEach((codeDeliveryDetails) => {
		const { AttributeName, DeliveryMedium, Destination } = codeDeliveryDetails;
		if (AttributeName) unConfirmedAttributes[AttributeName] = {
			isUpdated: false,
			nextStep: {
				updateAttributeStep: "CONFIRM_ATTRIBUTE_WITH_CODE",
				codeDeliveryDetails: {
					attributeName: AttributeName,
					deliveryMedium: DeliveryMedium,
					destination: Destination
				}
			}
		};
	});
	return unConfirmedAttributes;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/updateUserAttribute.mjs
/**
* Updates user's attribute while authenticated.
*
* @param input - The UpdateUserAttributeInput object
* @returns UpdateUserAttributeOutput
* @throws - {@link UpdateUserAttributesException}
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
var updateUserAttribute = async (input) => {
	const { userAttribute: { attributeKey, value }, options } = input;
	const output = await updateUserAttributes({
		userAttributes: { [attributeKey]: value },
		options
	});
	return Object.values(output)[0];
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createVerifyUserAttributeClient.mjs
var createVerifyUserAttributeClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("VerifyUserAttribute"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/confirmUserAttribute.mjs
/**
* Confirms a user attribute with the confirmation code.
*
* @param input -  The ConfirmUserAttributeInput object
* @throws  -{@link AuthValidationErrorCode } -
* Thrown when `confirmationCode` is not defined.
* @throws  -{@link VerifyUserAttributeException } - Thrown due to an invalid confirmation code or attribute.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function confirmUserAttribute(input) {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { confirmationCode, userAttributeKey } = input;
	assertValidationError(!!confirmationCode, AuthValidationErrorCode.EmptyConfirmUserAttributeCode);
	const { tokens } = await fetchAuthSession({ forceRefresh: false });
	assertAuthTokens(tokens);
	await createVerifyUserAttributeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ConfirmUserAttribute)
	}, {
		AccessToken: tokens.accessToken.toString(),
		AttributeName: userAttributeKey,
		Code: confirmationCode
	});
}
new ConsoleLogger("AuthError");
var authErrorMessages = {
	oauthSignInError: {
		message: AuthErrorStrings.OAUTH_ERROR,
		log: "Make sure Cognito Hosted UI has been configured correctly"
	},
	noConfig: {
		message: AuthErrorStrings.DEFAULT_MSG,
		log: `
            Error: Amplify has not been configured correctly.
            This error is typically caused by one of the following scenarios:

            1. Make sure you're passing the awsconfig object to Amplify.configure() in your app's entry point
                See https://aws-amplify.github.io/docs/js/authentication#configure-your-app for more information
            
            2. There might be multiple conflicting versions of amplify packages in your node_modules.
				Refer to our docs site for help upgrading Amplify packages (https://docs.amplify.aws/lib/troubleshooting/upgrading/q/platform/js)
        `
	},
	missingAuthConfig: {
		message: AuthErrorStrings.DEFAULT_MSG,
		log: `
            Error: Amplify has not been configured correctly. 
            The configuration object is missing required auth properties.
            This error is typically caused by one of the following scenarios:

            1. Did you run \`amplify push\` after adding auth via \`amplify add auth\`?
                See https://aws-amplify.github.io/docs/js/authentication#amplify-project-setup for more information

            2. This could also be caused by multiple conflicting versions of amplify packages, see (https://docs.amplify.aws/lib/troubleshooting/upgrading/q/platform/js) for help upgrading Amplify packages.
        `
	},
	emptyUsername: { message: AuthErrorStrings.EMPTY_USERNAME },
	invalidUsername: { message: AuthErrorStrings.INVALID_USERNAME },
	emptyPassword: { message: AuthErrorStrings.EMPTY_PASSWORD },
	emptyCode: { message: AuthErrorStrings.EMPTY_CODE },
	signUpError: {
		message: AuthErrorStrings.SIGN_UP_ERROR,
		log: "The first parameter should either be non-null string or object"
	},
	noMFA: { message: AuthErrorStrings.NO_MFA },
	invalidMFA: { message: AuthErrorStrings.INVALID_MFA },
	emptyChallengeResponse: { message: AuthErrorStrings.EMPTY_CHALLENGE },
	noUserSession: { message: AuthErrorStrings.NO_USER_SESSION },
	deviceConfig: { message: AuthErrorStrings.DEVICE_CONFIG },
	networkError: { message: AuthErrorStrings.NETWORK_ERROR },
	autoSignInError: { message: AuthErrorStrings.AUTOSIGNIN_ERROR },
	default: { message: AuthErrorStrings.DEFAULT_MSG }
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/createOAuthError.mjs
var createOAuthError = (message, recoverySuggestion) => new AuthError({
	message: message ?? "An error has occurred during the oauth process.",
	name: AuthErrorCodes.OAuthSignInError,
	recoverySuggestion: recoverySuggestion ?? authErrorMessages.oauthSignInError.log
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/types/Auth.mjs
var AuthErrorTypes;
(function(AuthErrorTypes) {
	AuthErrorTypes["NoConfig"] = "noConfig";
	AuthErrorTypes["MissingAuthConfig"] = "missingAuthConfig";
	AuthErrorTypes["EmptyUsername"] = "emptyUsername";
	AuthErrorTypes["InvalidUsername"] = "invalidUsername";
	AuthErrorTypes["EmptyPassword"] = "emptyPassword";
	AuthErrorTypes["EmptyCode"] = "emptyCode";
	AuthErrorTypes["SignUpError"] = "signUpError";
	AuthErrorTypes["NoMFA"] = "noMFA";
	AuthErrorTypes["InvalidMFA"] = "invalidMFA";
	AuthErrorTypes["EmptyChallengeResponse"] = "emptyChallengeResponse";
	AuthErrorTypes["NoUserSession"] = "noUserSession";
	AuthErrorTypes["Default"] = "default";
	AuthErrorTypes["DeviceConfig"] = "deviceConfig";
	AuthErrorTypes["NetworkError"] = "networkError";
	AuthErrorTypes["AutoSignInError"] = "autoSignInError";
	AuthErrorTypes["OAuthSignInError"] = "oauthSignInError";
})(AuthErrorTypes || (AuthErrorTypes = {}));
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/validateState.mjs
var flowCancelledMessage = "`signInWithRedirect` has been canceled.";
var validationFailedMessage = "An error occurred while validating the state.";
var validationRecoverySuggestion = "Try to initiate an OAuth flow from Amplify";
var validateState = async (state) => {
	const savedState = await oAuthStore.loadOAuthState();
	const validatedState = state === savedState ? savedState : void 0;
	if (!validatedState) throw new AuthError({
		name: AuthErrorTypes.OAuthSignInError,
		message: state === null ? flowCancelledMessage : validationFailedMessage,
		recoverySuggestion: state === null ? void 0 : validationRecoverySuggestion
	});
	return validatedState;
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/completeOAuthFlow.mjs
var completeOAuthFlow = async ({ currentUrl, userAgentValue, clientId, redirectUri, responseType, domain, preferPrivateSession }) => {
	const urlParams = new AmplifyUrl(currentUrl);
	const error = urlParams.searchParams.get("error");
	const errorMessage = urlParams.searchParams.get("error_description");
	if (error) throw createOAuthError(errorMessage ?? error);
	if (responseType === "code") return handleCodeFlow({
		currentUrl,
		userAgentValue,
		clientId,
		redirectUri,
		domain,
		preferPrivateSession
	});
	return handleImplicitFlow({
		currentUrl,
		redirectUri,
		preferPrivateSession
	});
};
var handleCodeFlow = async ({ currentUrl, userAgentValue, clientId, redirectUri, domain, preferPrivateSession }) => {
	const url = new AmplifyUrl(currentUrl);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	if (!code || !state) throw createOAuthError("User cancelled OAuth flow.");
	const validatedState = await validateState(state);
	const oAuthTokenEndpoint = "https://" + domain + "/oauth2/token";
	const codeVerifier = await oAuthStore.loadPKCE();
	const oAuthTokenBody = {
		grant_type: "authorization_code",
		code,
		client_id: clientId,
		redirect_uri: redirectUri,
		...codeVerifier ? { code_verifier: codeVerifier } : {}
	};
	const body = Object.entries(oAuthTokenBody).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
	const { access_token, refresh_token: refreshToken, id_token, error, error_message: errorMessage, token_type, expires_in } = await (await fetch(oAuthTokenEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			[USER_AGENT_HEADER]: userAgentValue
		},
		body
	})).json();
	if (error) throw createOAuthError(errorMessage ?? error);
	await cacheCognitoTokens({
		username: (access_token && decodeJWT(access_token).payload.username) ?? "username",
		AccessToken: access_token,
		IdToken: id_token,
		RefreshToken: refreshToken
	});
	return completeFlow({
		redirectUri,
		state: validatedState,
		preferPrivateSession
	});
};
var handleImplicitFlow = async ({ currentUrl, redirectUri, preferPrivateSession }) => {
	const { id_token, access_token, state, token_type, expires_in, error_description, error } = (new AmplifyUrl(currentUrl).hash ?? "#").substring(1).split("&").map((pairings) => pairings.split("=")).reduce((accum, [k, v]) => ({
		...accum,
		[k]: v
	}), {
		id_token: void 0,
		access_token: void 0,
		state: void 0,
		token_type: void 0,
		expires_in: void 0,
		error_description: void 0,
		error: void 0
	});
	if (error) throw createOAuthError(error_description ?? error);
	if (!access_token) throw createOAuthError("No access token returned from OAuth flow.");
	const validatedState = await validateState(state);
	await cacheCognitoTokens({
		username: (access_token && decodeJWT(access_token).payload.username) ?? "username",
		AccessToken: access_token,
		IdToken: id_token
	});
	return completeFlow({
		redirectUri,
		state: validatedState,
		preferPrivateSession
	});
};
var completeFlow = async ({ redirectUri, state, preferPrivateSession }) => {
	await tokenOrchestrator.setOAuthMetadata({ oauthSignIn: true });
	await oAuthStore.clearOAuthData();
	await oAuthStore.storeOAuthSignIn(true, preferPrivateSession);
	resolveAndClearInflightPromises();
	clearHistory(redirectUri);
	if (isCustomState(state)) Hub.dispatch("auth", {
		event: "customOAuthState",
		data: urlSafeDecode(getCustomState(state))
	}, "Auth", AMPLIFY_SYMBOL);
	Hub.dispatch("auth", { event: "signInWithRedirect" }, "Auth", AMPLIFY_SYMBOL);
	await dispatchSignedInHubEvent();
};
var isCustomState = (state) => {
	return /-/.test(state);
};
var getCustomState = (state) => {
	return state.split("-").splice(1).join("-");
};
var clearHistory = (redirectUri) => {
	if (typeof window !== "undefined" && typeof window.history !== "undefined") window.history.replaceState(window.history.state, "", redirectUri);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/getRedirectUrl.mjs
/** @internal */
function getRedirectUrl(redirects, preferredRedirectUrl) {
	if (preferredRedirectUrl) {
		const redirectUrl = redirects?.find((redirect) => redirect === preferredRedirectUrl);
		if (!redirectUrl) throw invalidPreferredRedirectUrlException;
		return redirectUrl;
	} else {
		const redirectUrlFromTheSameOrigin = redirects?.find(isSameOriginAndPathName) ?? redirects?.find(isTheSameDomain);
		const redirectUrlFromDifferentOrigin = redirects?.find(isHttps) ?? redirects?.find(isHttp);
		if (redirectUrlFromTheSameOrigin) return redirectUrlFromTheSameOrigin;
		else if (redirectUrlFromDifferentOrigin) throw invalidOriginException;
		throw invalidRedirectException;
	}
}
var isSameOriginAndPathName = (redirect) => redirect.startsWith(String(window.location.origin + (window.location.pathname || "/")));
var isTheSameDomain = (redirect) => redirect.includes(String(window.location.hostname));
var isHttp = (redirect) => redirect.startsWith("http://");
var isHttps = (redirect) => redirect.startsWith("https://");
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/handleFailure.mjs
var handleFailure = async (error) => {
	resolveAndClearInflightPromises();
	await oAuthStore.clearOAuthInflightData();
	Hub.dispatch("auth", {
		event: "signInWithRedirect_failure",
		data: { error }
	}, "Auth", AMPLIFY_SYMBOL);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/attemptCompleteOAuthFlow.mjs
var attemptCompleteOAuthFlow = async (authConfig) => {
	try {
		assertTokenProviderConfig(authConfig);
		assertOAuthConfig(authConfig);
		oAuthStore.setAuthConfig(authConfig);
	} catch (_) {
		return;
	}
	if (!await oAuthStore.loadOAuthInFlight()) return;
	try {
		const currentUrl = window.location.href;
		const { loginWith, userPoolClientId } = authConfig;
		const { domain, redirectSignIn, responseType } = loginWith.oauth;
		await completeOAuthFlow({
			currentUrl,
			clientId: userPoolClientId,
			domain,
			redirectUri: getRedirectUrl(redirectSignIn),
			responseType,
			userAgentValue: getAuthUserAgentValue(AuthAction.SignInWithRedirect)
		});
	} catch (err) {
		await handleFailure(err);
	}
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/enableOAuthListener.mjs
isBrowser() && Amplify[ADD_OAUTH_LISTENER](attemptCompleteOAuthFlow);
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/types/models.mjs
var cognitoHostedUIIdentityProviderMap = {
	Google: "Google",
	Facebook: "Facebook",
	Amazon: "LoginWithAmazon",
	Apple: "SignInWithApple"
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/utils/openAuthSession.mjs
var openAuthSession = async (url) => {
	if (!window?.location) return;
	window.location.href = url.replace("http://", "https://");
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/generateCodeVerifier.mjs
var CODE_VERIFIER_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/**
*
* @param length Desired length of the code verifier.
*
* **NOTE:** According to the [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636#section-4.1)
* A code verifier must be with a length >= 43 and <= 128.
*
* @returns An object that contains the generated `codeVerifier` and a method
* `toCodeChallenge` to generate the code challenge from the `codeVerifier`
* following the spec of [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636#section-4.2).
*/
var generateCodeVerifier = (length) => {
	const randomBytes = new Uint8Array(length);
	getCrypto().getRandomValues(randomBytes);
	let value = "";
	let codeChallenge;
	for (const byte of randomBytes) value += CODE_VERIFIER_CHARSET.charAt(byte % 62);
	return {
		value,
		method: "S256",
		toCodeChallenge() {
			if (codeChallenge) return codeChallenge;
			codeChallenge = generateCodeChallenge(value);
			return codeChallenge;
		}
	};
};
function generateCodeChallenge(codeVerifier) {
	const awsCryptoHash = new Sha256();
	awsCryptoHash.update(codeVerifier);
	return removePaddingChar(base64Encoder.convert(awsCryptoHash.digestSync(), { urlSafe: true }));
}
function removePaddingChar(base64Encoded) {
	return base64Encoded.replace(/=/g, "");
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/generateState.mjs
var generateState = () => {
	return generateRandomString(32);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/cancelOAuthFlow.mjs
var listenForOAuthFlowCancellation = (store) => {
	async function handleCancelOAuthFlow(event) {
		if (event.persisted && await store.loadOAuthInFlight()) await handleFailure(createOAuthError("User cancelled OAuth flow."));
		window.removeEventListener("pageshow", handleCancelOAuthFlow);
	}
	window.addEventListener("pageshow", handleCancelOAuthFlow);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/signInWithRedirect.mjs
/**
* Signs in a user with OAuth. Redirects the application to an Identity Provider.
*
* @param input - The SignInWithRedirectInput object, if empty it will redirect to Cognito HostedUI
*
* @throws AuthTokenConfigException - Thrown when the user pool config is invalid.
* @throws OAuthNotConfigureException - Thrown when the oauth config is invalid.
*/
async function signInWithRedirect(input) {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	assertOAuthConfig(authConfig);
	oAuthStore.setAuthConfig(authConfig);
	if (!input?.options?.prompt) await assertUserNotAuthenticated();
	let provider = "COGNITO";
	let idpIdentifier;
	if (typeof input?.provider === "string") provider = cognitoHostedUIIdentityProviderMap[input.provider];
	else if (input?.provider?.custom) provider = input.provider.custom;
	else if (input?.provider?.idpIdentifier) ({idpIdentifier} = input.provider);
	return oauthSignIn({
		oauthConfig: authConfig.loginWith.oauth,
		clientId: authConfig.userPoolClientId,
		provider,
		idpIdentifier,
		customState: input?.customState,
		preferPrivateSession: input?.options?.preferPrivateSession,
		options: {
			loginHint: input?.options?.loginHint,
			lang: input?.options?.lang,
			nonce: input?.options?.nonce,
			prompt: input?.options?.prompt
		},
		authSessionOpener: input?.options?.authSessionOpener
	});
}
var oauthSignIn = async ({ oauthConfig, provider, idpIdentifier, clientId, customState, preferPrivateSession, options, authSessionOpener }) => {
	const { domain, redirectSignIn, responseType, scopes } = oauthConfig;
	const { loginHint, lang, nonce, prompt } = options ?? {};
	const randomState = generateState();
	const openAuthSession$1 = authSessionOpener || openAuthSession;
	const state = customState ? `${randomState}-${urlSafeEncode(customState)}` : randomState;
	const { value, method, toCodeChallenge } = generateCodeVerifier(128);
	const redirectUri = getRedirectUrl(oauthConfig.redirectSignIn);
	if (isBrowser()) oAuthStore.storeOAuthInFlight(true);
	oAuthStore.storeOAuthState(state);
	oAuthStore.storePKCE(value);
	const params = new URLSearchParams();
	params.append("redirect_uri", redirectUri);
	params.append("response_type", responseType);
	params.append("client_id", clientId);
	if (idpIdentifier) params.append("idp_identifier", idpIdentifier);
	else params.append("identity_provider", provider);
	params.append("scope", scopes.join(" "));
	loginHint && params.append("login_hint", loginHint);
	lang && params.append("lang", lang);
	nonce && params.append("nonce", nonce);
	prompt && params.append("prompt", prompt.toLowerCase());
	params.append("state", state);
	if (responseType === "code") {
		params.append("code_challenge", toCodeChallenge());
		params.append("code_challenge_method", method);
	}
	const oAuthUrl = `https://${domain}/oauth2/authorize?${params.toString()}`;
	listenForOAuthFlowCancellation(oAuthStore);
	const { type, error, url } = await openAuthSession$1(oAuthUrl, redirectSignIn, preferPrivateSession) ?? {};
	try {
		if (type === "error") throw createOAuthError(String(error));
		if (type === "canceled") throw createOAuthError(String(type));
		if (type === "success" && url) await completeOAuthFlow({
			currentUrl: url,
			clientId,
			domain,
			redirectUri,
			responseType,
			userAgentValue: getAuthUserAgentValue(AuthAction.SignInWithRedirect),
			preferPrivateSession
		});
	} catch (err) {
		await handleFailure(err);
		throw err;
	}
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/internal/fetchUserAttributes.mjs
var fetchUserAttributes$1 = async (amplify) => {
	const authConfig = amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { tokens } = await fetchAuthSession$1(amplify, { forceRefresh: false });
	assertAuthTokens(tokens);
	const { UserAttributes } = await createGetUserClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.FetchUserAttributes)
	}, { AccessToken: tokens.accessToken.toString() });
	return toAuthUserAttribute(UserAttributes);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/fetchUserAttributes.mjs
/**
* Fetches the current user attributes while authenticated.
*
* @throws - {@link GetUserException} - Cognito service errors thrown when the service is not able to get the user.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
var fetchUserAttributes = () => {
	return fetchUserAttributes$1(Amplify);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/completeOAuthSignOut.mjs
var completeOAuthSignOut = async (store) => {
	await store.clearOAuthData();
	tokenOrchestrator.clearTokens();
	await clearCredentials();
	Hub.dispatch("auth", { event: "signedOut" }, "Auth", AMPLIFY_SYMBOL);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/oAuthSignOutRedirect.mjs
var oAuthSignOutRedirect = async (authConfig, preferPrivateSession = false, redirectUrl) => {
	assertOAuthConfig(authConfig);
	const { loginWith, userPoolClientId } = authConfig;
	const { domain, redirectSignOut } = loginWith.oauth;
	const signoutUri = getRedirectUrl(redirectSignOut, redirectUrl);
	return openAuthSession(`https://${domain}/logout?${Object.entries({
		client_id: userPoolClientId,
		logout_uri: encodeURIComponent(signoutUri)
	}).map(([k, v]) => `${k}=${v}`).join("&")}`);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/utils/oauth/handleOAuthSignOut.mjs
var handleOAuthSignOut = async (cognitoConfig, store, tokenOrchestrator, redirectUrl) => {
	const { isOAuthSignIn } = await store.loadOAuthSignIn();
	const oauthMetadata = await tokenOrchestrator.getOAuthMetadata();
	await completeOAuthSignOut(store);
	if (isOAuthSignIn || oauthMetadata?.oauthSignIn) return oAuthSignOutRedirect(cognitoConfig, false, redirectUrl);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createRevokeTokenClient.mjs
var createRevokeTokenClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("RevokeToken"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createGlobalSignOutClient.mjs
var createGlobalSignOutClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("GlobalSignOut"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/signOut.mjs
var logger$2 = new ConsoleLogger("Auth");
/**
* Signs a user out
*
* @param input - The SignOutInput object
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function signOut(input) {
	const cognitoConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(cognitoConfig);
	if (input?.global) await globalSignOut(cognitoConfig);
	else await clientSignOut(cognitoConfig);
	let hasOAuthConfig;
	try {
		assertOAuthConfig(cognitoConfig);
		hasOAuthConfig = true;
	} catch (err) {
		hasOAuthConfig = false;
	}
	if (hasOAuthConfig) {
		const oAuthStore = new DefaultOAuthStore(defaultStorage);
		oAuthStore.setAuthConfig(cognitoConfig);
		const { type } = await handleOAuthSignOut(cognitoConfig, oAuthStore, tokenOrchestrator, input?.oauth?.redirectUrl) ?? {};
		if (type === "error") throw new AuthError({
			name: OAUTH_SIGNOUT_EXCEPTION,
			message: `An error occurred when attempting to log out from OAuth provider.`
		});
	} else {
		tokenOrchestrator.clearTokens();
		await clearCredentials();
		Hub.dispatch("auth", { event: "signedOut" }, "Auth", AMPLIFY_SYMBOL);
	}
}
async function clientSignOut(cognitoConfig) {
	try {
		const { userPoolEndpoint, userPoolId, userPoolClientId } = cognitoConfig;
		const authTokens = await tokenOrchestrator.getTokenStore().loadTokens();
		assertAuthTokensWithRefreshToken(authTokens);
		if (isSessionRevocable(authTokens.accessToken)) await createRevokeTokenClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
			region: getRegionFromUserPoolId(userPoolId),
			userAgentValue: getAuthUserAgentValue(AuthAction.SignOut)
		}, {
			ClientId: userPoolClientId,
			Token: authTokens.refreshToken
		});
	} catch (err) {
		logger$2.debug("Client signOut error caught but will proceed with token removal");
	}
}
async function globalSignOut(cognitoConfig) {
	try {
		const { userPoolEndpoint, userPoolId } = cognitoConfig;
		const authTokens = await tokenOrchestrator.getTokenStore().loadTokens();
		assertAuthTokens(authTokens);
		await createGlobalSignOutClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
			region: getRegionFromUserPoolId(userPoolId),
			userAgentValue: getAuthUserAgentValue(AuthAction.SignOut)
		}, { AccessToken: authTokens.accessToken.toString() });
	} catch (err) {
		logger$2.debug("Global signOut error caught but will proceed with token removal");
	}
}
var isSessionRevocable = (token) => !!token?.payload?.origin_jti;
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createGetUserAttributeVerificationCodeClient.mjs
var createGetUserAttributeVerificationCodeClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("GetUserAttributeVerificationCode"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/sendUserAttributeVerificationCode.mjs
/**
* Resends user's confirmation code when updating attributes while authenticated.
*
* @param input - The SendUserAttributeVerificationCodeInput object
* @returns SendUserAttributeVerificationCodeOutput
* @throws - {@link GetUserAttributeVerificationException}
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
var sendUserAttributeVerificationCode = async (input) => {
	const { userAttributeKey, options } = input;
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	const clientMetadata = options?.clientMetadata;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { tokens } = await fetchAuthSession({ forceRefresh: false });
	assertAuthTokens(tokens);
	const { CodeDeliveryDetails } = await createGetUserAttributeVerificationCodeClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.SendUserAttributeVerificationCode)
	}, {
		AccessToken: tokens.accessToken.toString(),
		ClientMetadata: clientMetadata,
		AttributeName: userAttributeKey
	});
	const { DeliveryMedium, AttributeName, Destination } = { ...CodeDeliveryDetails };
	return {
		destination: Destination,
		deliveryMedium: DeliveryMedium,
		attributeName: AttributeName
	};
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createDeleteUserAttributesClient.mjs
var createDeleteUserAttributesClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("DeleteUserAttributes"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/deleteUserAttributes.mjs
/**
* Deletes user attributes.
*
* @param input -  The DeleteUserAttributesInput object
* @throws  -{@link DeleteUserAttributesException } - Thrown due to invalid attribute.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function deleteUserAttributes(input) {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userAttributeKeys } = input;
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { tokens } = await fetchAuthSession({ forceRefresh: false });
	assertAuthTokens(tokens);
	await createDeleteUserAttributesClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.DeleteUserAttributes)
	}, {
		AccessToken: tokens.accessToken.toString(),
		UserAttributeNames: userAttributeKeys
	});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/shared/serde/createEmptyResponseDeserializer.mjs
var createEmptyResponseDeserializer = () => async (response) => {
	if (response.statusCode >= 300) {
		const error = await parseJsonError(response);
		assertServiceError(error);
		throw new AuthError({
			name: error.name,
			message: error.message
		});
	} else return;
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createDeleteUserClient.mjs
var createDeleteUserClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("DeleteUser"), createEmptyResponseDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/deleteUser.mjs
/**
* Deletes a user from the user pool while authenticated.
*
* @throws - {@link DeleteUserException}
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function deleteUser() {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { tokens } = await fetchAuthSession();
	assertAuthTokens(tokens);
	await createDeleteUserClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.DeleteUser)
	}, { AccessToken: tokens.accessToken.toString() });
	await tokenOrchestrator.clearDeviceMetadata();
	await signOut();
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createUpdateDeviceStatusClient.mjs
var createUpdateDeviceStatusClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("UpdateDeviceStatus"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/rememberDevice.mjs
/**
* Marks device as remembered while authenticated.
*
* @throws - {@link UpdateDeviceStatusException} - Cognito service errors thrown when
* setting device status to remembered using an invalid device key.
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function rememberDevice() {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { tokens } = await fetchAuthSession();
	assertAuthTokens(tokens);
	const deviceMetadata = await tokenOrchestrator?.getDeviceMetadata();
	assertDeviceMetadata(deviceMetadata);
	await createUpdateDeviceStatusClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.RememberDevice)
	}, {
		AccessToken: tokens.accessToken.toString(),
		DeviceKey: deviceMetadata.deviceKey,
		DeviceRememberedStatus: "remembered"
	});
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createForgetDeviceClient.mjs
var createForgetDeviceClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("ForgetDevice"), createEmptyResponseDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/forgetDevice.mjs
/**
* Forget a remembered device while authenticated.
*
* @param input - The ForgetDeviceInput object.
* @throws - {@link ForgetDeviceException} - Cognito service errors thrown when
* forgetting device with invalid device key
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function forgetDevice(input) {
	const { device: { id: externalDeviceKey } = { id: void 0 } } = input ?? {};
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { tokens } = await fetchAuthSession();
	assertAuthTokens(tokens);
	const deviceMetadata = await tokenOrchestrator.getDeviceMetadata();
	const currentDeviceKey = deviceMetadata?.deviceKey;
	if (!externalDeviceKey) assertDeviceMetadata(deviceMetadata);
	await createForgetDeviceClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.ForgetDevice)
	}, {
		AccessToken: tokens.accessToken.toString(),
		DeviceKey: externalDeviceKey ?? currentDeviceKey
	});
	if (!externalDeviceKey || externalDeviceKey === currentDeviceKey) await tokenOrchestrator.clearDeviceMetadata();
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/foundation/factories/serviceClients/cognitoIdentityProvider/createListDevicesClient.mjs
var createListDevicesClient = (config) => composeServiceApi(cognitoUserPoolTransferHandler, createUserPoolSerializer("ListDevices"), createUserPoolDeserializer(), {
	...DEFAULT_SERVICE_CLIENT_API_CONFIG,
	...config
});
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/apis/fetchDevices.mjs
var MAX_DEVICES = 60;
/**
* Fetches devices that have been remembered using {@link rememberDevice}
* for the currently authenticated user.
*
* @returns FetchDevicesOutput
* @throws {@link ListDevicesException}
* @throws AuthTokenConfigException - Thrown when the token provider config is invalid.
*/
async function fetchDevices() {
	const authConfig = Amplify.getConfig().Auth?.Cognito;
	assertTokenProviderConfig(authConfig);
	const { userPoolEndpoint, userPoolId } = authConfig;
	const { tokens } = await fetchAuthSession();
	assertAuthTokens(tokens);
	return parseDevicesResponse((await createListDevicesClient({ endpointResolver: createCognitoUserPoolEndpointResolver({ endpointOverride: userPoolEndpoint }) })({
		region: getRegionFromUserPoolId(userPoolId),
		userAgentValue: getAuthUserAgentValue(AuthAction.FetchDevices)
	}, {
		AccessToken: tokens.accessToken.toString(),
		Limit: MAX_DEVICES
	})).Devices ?? []);
}
var parseDevicesResponse = async (devices) => {
	return devices.map(({ DeviceKey: id = "", DeviceAttributes = [], DeviceCreateDate, DeviceLastModifiedDate, DeviceLastAuthenticatedDate }) => {
		let deviceName;
		const attributes = DeviceAttributes.reduce((attrs, { Name, Value }) => {
			if (Name && Value) {
				if (Name === "device_name") deviceName = Value;
				attrs[Name] = Value;
			}
			return attrs;
		}, {});
		return {
			id,
			name: deviceName,
			attributes,
			createDate: DeviceCreateDate ? /* @__PURE__ */ new Date(DeviceCreateDate * 1e3) : void 0,
			lastModifiedDate: DeviceLastModifiedDate ? /* @__PURE__ */ new Date(DeviceLastModifiedDate * 1e3) : void 0,
			lastAuthenticatedDate: DeviceLastAuthenticatedDate ? /* @__PURE__ */ new Date(DeviceLastAuthenticatedDate * 1e3) : void 0
		};
	});
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/credentialsProvider/types.mjs
var IdentityIdStorageKeys = { identityId: "identityId" };
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/credentialsProvider/IdentityIdStore.mjs
var logger$1 = new ConsoleLogger("DefaultIdentityIdStore");
var DefaultIdentityIdStore = class {
	setAuthConfig(authConfigParam) {
		assertIdentityPoolIdConfig(authConfigParam.Cognito);
		this.authConfig = authConfigParam;
		this._authKeys = createKeysForAuthStorage("Cognito", authConfigParam.Cognito.identityPoolId);
	}
	constructor(keyValueStorage) {
		this._authKeys = {};
		this._hasGuestIdentityId = false;
		this.keyValueStorage = keyValueStorage;
	}
	async loadIdentityId() {
		assertIdentityPoolIdConfig(this.authConfig?.Cognito);
		try {
			if (this._primaryIdentityId) return {
				id: this._primaryIdentityId,
				type: "primary"
			};
			else {
				const storedIdentityId = await this.keyValueStorage.getItem(this._authKeys.identityId);
				if (storedIdentityId) {
					this._hasGuestIdentityId = true;
					return {
						id: storedIdentityId,
						type: "guest"
					};
				}
				return null;
			}
		} catch (err) {
			logger$1.log("Error getting stored IdentityId.", err);
			return null;
		}
	}
	async storeIdentityId(identity) {
		assertIdentityPoolIdConfig(this.authConfig?.Cognito);
		if (identity.type === "guest") {
			this.keyValueStorage.setItem(this._authKeys.identityId, identity.id);
			this._primaryIdentityId = void 0;
			this._hasGuestIdentityId = true;
		} else {
			this._primaryIdentityId = identity.id;
			if (this._hasGuestIdentityId) {
				this.keyValueStorage.removeItem(this._authKeys.identityId);
				this._hasGuestIdentityId = false;
			}
		}
	}
	async clearIdentityId() {
		this._primaryIdentityId = void 0;
		await this.keyValueStorage.removeItem(this._authKeys.identityId);
	}
};
var createKeysForAuthStorage = (provider, identifier) => {
	return getAuthStorageKeys(IdentityIdStorageKeys)(`com.amplify.${provider}`, identifier);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/factories/createCognitoIdentityPoolEndpointResolver.mjs
var createCognitoIdentityPoolEndpointResolver = ({ endpointOverride }) => (input) => {
	if (endpointOverride) return { url: new AmplifyUrl(endpointOverride) };
	return cognitoIdentityPoolEndpointResolver(input);
};
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/credentialsProvider/utils.mjs
function formLoginsMap(idToken) {
	const issuer = decodeJWT(idToken).payload.iss;
	const res = {};
	if (!issuer) throw new AuthError({
		name: "InvalidIdTokenException",
		message: "Invalid Idtoken."
	});
	const domainName = issuer.replace(/(^\w+:|^)\/\//, "");
	res[domainName] = idToken;
	return res;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/credentialsProvider/IdentityIdProvider.mjs
/**
* Provides a Cognito identityId
*
* @param tokens - The AuthTokens received after SignIn
* @returns string
* @throws configuration exceptions: `InvalidIdentityPoolIdException`
*  - Auth errors that may arise from misconfiguration.
* @throws service exceptions: {@link GetIdException }
*/
async function cognitoIdentityIdProvider({ tokens, authConfig, identityIdStore }) {
	identityIdStore.setAuthConfig({ Cognito: authConfig });
	const identityId = await identityIdStore.loadIdentityId();
	if (identityId) return identityId.id;
	const generatedIdentityId = await generateIdentityId(tokens?.idToken ? formLoginsMap(tokens.idToken.toString()) : {}, authConfig);
	identityIdStore.storeIdentityId({
		id: generatedIdentityId,
		type: tokens ? "primary" : "guest"
	});
	return generatedIdentityId;
}
async function generateIdentityId(logins, authConfig) {
	const identityPoolId = authConfig?.identityPoolId;
	const region = getRegionFromIdentityPoolId(identityPoolId);
	const getId = createGetIdClient({ endpointResolver: createCognitoIdentityPoolEndpointResolver({ endpointOverride: authConfig.identityPoolEndpoint }) });
	let idResult;
	try {
		idResult = (await getId({ region }, {
			IdentityPoolId: identityPoolId,
			Logins: logins
		})).IdentityId;
	} catch (e) {
		assertServiceError(e);
		throw new AuthError(e);
	}
	if (!idResult) throw new AuthError({
		name: "GetIdResponseException",
		message: "Received undefined response from getId operation",
		recoverySuggestion: "Make sure to pass a valid identityPoolId in the configuration."
	});
	return idResult;
}
//#endregion
//#region node_modules/@aws-amplify/auth/dist/esm/providers/cognito/credentialsProvider/credentialsProvider.mjs
var logger = new ConsoleLogger("CognitoCredentialsProvider");
var CREDENTIALS_TTL = 3e3 * 1e3;
var CognitoAWSCredentialsAndIdentityIdProvider = class {
	constructor(identityIdStore) {
		this._nextCredentialsRefresh = 0;
		this._identityIdStore = identityIdStore;
	}
	async clearCredentialsAndIdentityId() {
		logger.debug("Clearing out credentials and identityId");
		this._credentialsAndIdentityId = void 0;
		await this._identityIdStore.clearIdentityId();
	}
	async clearCredentials() {
		logger.debug("Clearing out in-memory credentials");
		this._credentialsAndIdentityId = void 0;
	}
	async getCredentialsAndIdentityId(getCredentialsOptions) {
		const isAuthenticated = getCredentialsOptions.authenticated;
		const { tokens } = getCredentialsOptions;
		const { authConfig } = getCredentialsOptions;
		try {
			assertIdentityPoolIdConfig(authConfig?.Cognito);
		} catch {
			return;
		}
		if (!isAuthenticated && !authConfig.Cognito.allowGuestAccess) return;
		const { forceRefresh } = getCredentialsOptions;
		const tokenHasChanged = this.hasTokenChanged(tokens);
		const identityId = await cognitoIdentityIdProvider({
			tokens,
			authConfig: authConfig.Cognito,
			identityIdStore: this._identityIdStore
		});
		if (forceRefresh || tokenHasChanged) this.clearCredentials();
		if (!isAuthenticated) return this.getGuestCredentials(identityId, authConfig.Cognito);
		else {
			assertIdTokenInAuthTokens(tokens);
			return this.credsForOIDCTokens(authConfig.Cognito, tokens, identityId);
		}
	}
	async getGuestCredentials(identityId, authConfig) {
		if (this._credentialsAndIdentityId && !this.isPastTTL() && this._credentialsAndIdentityId.isAuthenticatedCreds === false) {
			logger.info("returning stored credentials as they neither past TTL nor expired.");
			return this._credentialsAndIdentityId;
		}
		this.clearCredentials();
		const region = getRegionFromIdentityPoolId(authConfig.identityPoolId);
		const getCredentialsForIdentity = createGetCredentialsForIdentityClient({ endpointResolver: createCognitoIdentityPoolEndpointResolver({ endpointOverride: authConfig.identityPoolEndpoint }) });
		let clientResult;
		try {
			clientResult = await getCredentialsForIdentity({ region }, { IdentityId: identityId });
		} catch (e) {
			assertServiceError(e);
			throw new AuthError(e);
		}
		if (clientResult?.Credentials?.AccessKeyId && clientResult?.Credentials?.SecretKey) {
			this._nextCredentialsRefresh = (/* @__PURE__ */ new Date()).getTime() + CREDENTIALS_TTL;
			const res = {
				credentials: {
					accessKeyId: clientResult.Credentials.AccessKeyId,
					secretAccessKey: clientResult.Credentials.SecretKey,
					sessionToken: clientResult.Credentials.SessionToken,
					expiration: clientResult.Credentials.Expiration
				},
				identityId
			};
			if (clientResult.IdentityId) {
				res.identityId = clientResult.IdentityId;
				this._identityIdStore.storeIdentityId({
					id: clientResult.IdentityId,
					type: "guest"
				});
			}
			this._credentialsAndIdentityId = {
				...res,
				isAuthenticatedCreds: false
			};
			return res;
		} else throw new AuthError({
			name: "CredentialsNotFoundException",
			message: `Cognito did not respond with either Credentials, AccessKeyId or SecretKey.`
		});
	}
	async credsForOIDCTokens(authConfig, authTokens, identityId) {
		if (this._credentialsAndIdentityId && !this.isPastTTL() && this._credentialsAndIdentityId.isAuthenticatedCreds === true) {
			logger.debug("returning stored credentials as they neither past TTL nor expired.");
			return this._credentialsAndIdentityId;
		}
		this.clearCredentials();
		const logins = authTokens.idToken ? formLoginsMap(authTokens.idToken.toString()) : {};
		const region = getRegionFromIdentityPoolId(authConfig.identityPoolId);
		const getCredentialsForIdentity = createGetCredentialsForIdentityClient({ endpointResolver: createCognitoIdentityPoolEndpointResolver({ endpointOverride: authConfig.identityPoolEndpoint }) });
		let clientResult;
		try {
			clientResult = await getCredentialsForIdentity({ region }, {
				IdentityId: identityId,
				Logins: logins
			});
		} catch (e) {
			assertServiceError(e);
			throw new AuthError(e);
		}
		if (clientResult?.Credentials?.AccessKeyId && clientResult?.Credentials?.SecretKey) {
			this._nextCredentialsRefresh = (/* @__PURE__ */ new Date()).getTime() + CREDENTIALS_TTL;
			const res = {
				credentials: {
					accessKeyId: clientResult.Credentials.AccessKeyId,
					secretAccessKey: clientResult.Credentials.SecretKey,
					sessionToken: clientResult.Credentials.SessionToken,
					expiration: clientResult.Credentials.Expiration
				},
				identityId
			};
			if (clientResult.IdentityId) {
				res.identityId = clientResult.IdentityId;
				this._identityIdStore.storeIdentityId({
					id: clientResult.IdentityId,
					type: "primary"
				});
			}
			this._credentialsAndIdentityId = {
				...res,
				isAuthenticatedCreds: true,
				associatedIdToken: authTokens.idToken?.toString()
			};
			return res;
		} else throw new AuthError({
			name: "CredentialsException",
			message: `Cognito did not respond with either Credentials, AccessKeyId or SecretKey.`
		});
	}
	isPastTTL() {
		return this._nextCredentialsRefresh === void 0 ? true : this._nextCredentialsRefresh <= Date.now();
	}
	hasTokenChanged(tokens) {
		return !!tokens && !!this._credentialsAndIdentityId?.associatedIdToken && tokens.idToken?.toString() !== this._credentialsAndIdentityId.associatedIdToken;
	}
};
//#endregion
export { deserializeJsonToPkcCreationOptions as A, DEFAULT_SERVICE_CLIENT_API_CONFIG as B, confirmResetPassword as C, autoSignIn as D, signIn as E, PasskeyErrorCode as F, getCurrentUser as G, createUserPoolDeserializer as H, assertPasskeyError as I, AuthError as J, assertAuthTokens as K, passkeyErrorMap as L, getIsPasskeySupported as M, handlePasskeyError as N, assertCredentialIsPkcWithAuthenticatorAttestationResponse as O, PasskeyError as P, cognitoUserPoolsTokenProvider as R, resendSignUpCode as S, signUp as T, createUserPoolSerializer as U, cognitoUserPoolTransferHandler as V, getAuthUserAgentValue as W, verifyTOTPSetup as _, rememberDevice as a, confirmSignIn as b, sendUserAttributeVerificationCode as c, signInWithRedirect as d, confirmUserAttribute as f, updatePassword as g, setUpTOTP as h, forgetDevice as i, serializePkcWithAttestationToJson as j, assertValidCredentialCreationOptions as k, signOut as l, updateUserAttributes as m, DefaultIdentityIdStore as n, deleteUser as o, updateUserAttribute as p, getRegionFromUserPoolId as q, fetchDevices as r, deleteUserAttributes as s, CognitoAWSCredentialsAndIdentityIdProvider as t, fetchUserAttributes as u, fetchMFAPreference as v, resetPassword as w, confirmSignUp as x, updateMFAPreference as y, createCognitoUserPoolEndpointResolver as z };

//# sourceMappingURL=credentialsProvider-DeGU4jtH.js.map