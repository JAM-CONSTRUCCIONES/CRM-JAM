import { n as __exportAll } from "./chunk-BoAXSpZd.js";
import { A as createOperatorSubscriber, C as parseJsonError, D as Amplify, H as isNonRetryableError, I as Category, L as toHex, M as Observable, N as getAmplifyUserAgent, O as Reachability, P as ApiAction, R as Sha256, T as fetchAuthSession, V as retry, X as Hub, Y as AMPLIFY_SYMBOL, _ as getRetryDecider, b as MAX_DELAY_MS$1, et as AmplifyError, f as fetchTransferHandler, g as retryMiddlewareFactory, h as amplifyUuid, j as operate, k as innerFrom, m as userAgentMiddlewareFactory, nt as USER_AGENT_HEADER$2, o as AmplifyUrl, p as composeTransferHandler, s as AmplifyUrlSearchParams, t as base64Encoder, tt as ConsoleLogger, v as jitteredBackoff$1, y as jitteredBackoff } from "./base64Encoder-Cn88duoV.js";
//#region node_modules/rxjs/dist/esm5/internal/operators/map.js
function map(project, thisArg) {
	return operate(function(source, subscriber) {
		var index = 0;
		source.subscribe(createOperatorSubscriber(subscriber, function(value) {
			subscriber.next(project.call(thisArg, value, index++));
		}));
	});
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/operators/filter.js
function filter(predicate, thisArg) {
	return operate(function(source, subscriber) {
		var index = 0;
		source.subscribe(createOperatorSubscriber(subscriber, function(value) {
			return predicate.call(thisArg, value, index++) && subscriber.next(value);
		}));
	});
}
//#endregion
//#region node_modules/rxjs/dist/esm5/internal/operators/catchError.js
function catchError(selector) {
	return operate(function(source, subscriber) {
		var innerSub = null;
		var syncUnsub = false;
		var handledResult;
		innerSub = source.subscribe(createOperatorSubscriber(subscriber, void 0, void 0, function(err) {
			handledResult = innerFrom(selector(err, catchError(selector)(source)));
			if (innerSub) {
				innerSub.unsubscribe();
				innerSub = null;
				handledResult.subscribe(subscriber);
			} else syncUnsub = true;
		}));
		if (syncUnsub) {
			innerSub.unsubscribe();
			innerSub = null;
			handledResult.subscribe(subscriber);
		}
	});
}
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getSignedHeaders.mjs
/**
* Returns signed headers.
*
* @param headers `headers` from the request.
* @returns List of headers included in canonical headers, separated by semicolons (;). This indicates which headers
* are part of the signing process. Header names must use lowercase characters and must appear in alphabetical order.
*
* @internal
*/
var getSignedHeaders = (headers) => Object.keys(headers).map((key) => key.toLowerCase()).sort().join(";");
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/constants.mjs
var AMZ_DATE_QUERY_PARAM = "X-Amz-Date";
var TOKEN_QUERY_PARAM = "X-Amz-Security-Token";
var AUTH_HEADER = "authorization";
var HOST_HEADER = "host";
var AMZ_DATE_HEADER = AMZ_DATE_QUERY_PARAM.toLowerCase();
var TOKEN_HEADER = TOKEN_QUERY_PARAM.toLowerCase();
var KEY_TYPE_IDENTIFIER = "aws4_request";
var SHA256_ALGORITHM_IDENTIFIER = "AWS4-HMAC-SHA256";
var SIGNATURE_IDENTIFIER = "AWS4";
var EMPTY_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
var UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getCredentialScope.mjs
/**
* Returns the credential scope which restricts the resulting signature to the specified region and service.
*
* @param date Current date in the format 'YYYYMMDD'.
* @param region AWS region in which the service resides.
* @param service Service to which the signed request is being sent.
*
* @returns  A string representing the credential scope with format 'YYYYMMDD/region/service/aws4_request'.
*
* @internal
*/
var getCredentialScope = (date, region, service) => `${date}/${region}/${service}/${KEY_TYPE_IDENTIFIER}`;
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getFormattedDates.mjs
/**
* Returns expected date strings to be used in signing.
*
* @param date JavaScript `Date` object.
* @returns `FormattedDates` object containing the following:
* - longDate: A date string in 'YYYYMMDDThhmmssZ' format
* - shortDate: A date string in 'YYYYMMDD' format
*
* @internal
*/
var getFormattedDates = (date) => {
	const longDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
	return {
		longDate,
		shortDate: longDate.slice(0, 8)
	};
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getSigningValues.mjs
/**
* Extracts common values used for signing both requests and urls.
*
* @param options `SignRequestOptions` object containing values used to construct the signature.
* @returns Common `SigningValues` used for signing.
*
* @internal
*/
var getSigningValues = ({ credentials, signingDate = /* @__PURE__ */ new Date(), signingRegion, signingService, uriEscapePath = true }) => {
	const { accessKeyId, secretAccessKey, sessionToken } = credentials;
	const { longDate, shortDate } = getFormattedDates(signingDate);
	return {
		accessKeyId,
		credentialScope: getCredentialScope(shortDate, signingRegion, signingService),
		longDate,
		secretAccessKey,
		sessionToken,
		shortDate,
		signingRegion,
		signingService,
		uriEscapePath
	};
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/dataHashHelpers.mjs
/**
* Returns the hashed data a `Uint8Array`.
*
* @param key `SourceData` to be used as hashing key.
* @param data Hashable `SourceData`.
* @returns `Uint8Array` created from the data as input to a hash function.
*/
var getHashedData = (key, data) => {
	const sha256 = new Sha256(key ?? void 0);
	sha256.update(data);
	return sha256.digestSync();
};
/**
* Returns the hashed data as a hex string.
*
* @param key `SourceData` to be used as hashing key.
* @param data Hashable `SourceData`.
* @returns String using lowercase hexadecimal characters created from the data as input to a hash function.
*
* @internal
*/
var getHashedDataAsHex = (key, data) => {
	return toHex(getHashedData(key, data));
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getCanonicalHeaders.mjs
/**
* Returns canonical headers.
*
* @param headers Headers from the request.
* @returns Request headers that will be signed, and their values, separated by newline characters. Header names must
* use lowercase characters, must appear in alphabetical order, and must be followed by a colon (:). For the values,
* trim any leading or trailing spaces, convert sequential spaces to a single space, and separate the values
* for a multi-value header using commas.
*
* @internal
*/
var getCanonicalHeaders = (headers) => Object.entries(headers).map(([key, value]) => ({
	key: key.toLowerCase(),
	value: value?.trim().replace(/\s+/g, " ") ?? ""
})).sort((a, b) => a.key < b.key ? -1 : 1).map((entry) => `${entry.key}:${entry.value}\n`).join("");
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getCanonicalQueryString.mjs
/**
* Returns a canonical query string.
*
* @param searchParams `searchParams` from the request url.
* @returns URL-encoded query string parameters, separated by ampersands (&). Percent-encode reserved characters,
* including the space character. Encode names and values separately. If there are empty parameters, append the equals
* sign to the parameter name before encoding. After encoding, sort the parameters alphabetically by key name. If there
* is no query string, use an empty string ("").
*
* @internal
*/
var getCanonicalQueryString = (searchParams) => Array.from(searchParams).sort(([keyA, valA], [keyB, valB]) => {
	if (keyA === keyB) return valA < valB ? -1 : 1;
	return keyA < keyB ? -1 : 1;
}).map(([key, val]) => `${escapeUri(key)}=${escapeUri(val)}`).join("&");
var escapeUri = (uri) => encodeURIComponent(uri).replace(/[!'()*]/g, hexEncode);
var hexEncode = (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`;
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getCanonicalUri.mjs
/**
* Returns a canonical uri.
*
* @param pathname `pathname` from request url.
* @param uriEscapePath Whether to uri encode the path as part of canonical uri. It's used for S3 only where the
*   pathname is already uri encoded, and the signing process is not expected to uri encode it again. Defaults to true.
* @returns URI-encoded version of the absolute path component URL (everything between the host and the question mark
* character (?) that starts the query string parameters). If the absolute path is empty, a forward slash character (/).
*
* @internal
*/
var getCanonicalUri = (pathname, uriEscapePath = true) => pathname ? uriEscapePath ? encodeURIComponent(pathname).replace(/%2F/g, "/") : pathname : "/";
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getHashedPayload.mjs
/**
* Returns the hashed payload.
*
* @param body `body` (payload) from the request.
* @returns String created using the payload in the body of the HTTP request as input to a hash function. This string
* uses lowercase hexadecimal characters. If the payload is empty, return precalculated result of an empty hash.
*
* @internal
*/
var getHashedPayload = (body) => {
	if (body == null) return EMPTY_HASH;
	if (isSourceData(body)) return getHashedDataAsHex(null, body);
	return UNSIGNED_PAYLOAD;
};
var isSourceData = (body) => body !== "UNSIGNED-PAYLOAD" && (typeof body === "string" || ArrayBuffer.isView(body) || isArrayBuffer(body));
var isArrayBuffer = (arg) => typeof ArrayBuffer === "function" && arg instanceof ArrayBuffer || Object.prototype.toString.call(arg) === "[object ArrayBuffer]";
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getCanonicalRequest.mjs
/**
* Returns a canonical request.
*
* @param request `HttpRequest` from which to create the canonical request from.
* @param uriEscapePath Whether to uri encode the path as part of canonical uri. It's used for S3 only where the
*   pathname is already uri encoded, and the signing process is not expected to uri encode it again. Defaults to true.
* @returns String created by by concatenating the following strings, separated by newline characters:
* - HTTPMethod
* - CanonicalUri
* - CanonicalQueryString
* - CanonicalHeaders
* - SignedHeaders
* - HashedPayload
*
* @internal
*/
var getCanonicalRequest = ({ body, headers, method, url }, uriEscapePath = true) => [
	method,
	getCanonicalUri(url.pathname, uriEscapePath),
	getCanonicalQueryString(url.searchParams),
	getCanonicalHeaders(headers),
	getSignedHeaders(headers),
	getHashedPayload(body)
].join("\n");
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getSigningKey.mjs
/**
* Returns a signing key to be used for signing requests.
*
* @param secretAccessKey AWS secret access key from credentials.
* @param date Current date in the format 'YYYYMMDD'.
* @param region AWS region in which the service resides.
* @param service Service to which the signed request is being sent.
*
* @returns `Uint8Array` calculated from its composite parts.
*
* @internal
*/
var getSigningKey = (secretAccessKey, date, region, service) => {
	return getHashedData(getHashedData(getHashedData(getHashedData(`${SIGNATURE_IDENTIFIER}${secretAccessKey}`, date), region), service), KEY_TYPE_IDENTIFIER);
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getStringToSign.mjs
/**
* Returns a string to be signed.
*
* @param date Current date in the format 'YYYYMMDDThhmmssZ'.
* @param credentialScope String representing the credential scope with format 'YYYYMMDD/region/service/aws4_request'.
* @param hashedRequest Hashed canonical request.
*
* @returns A string created by by concatenating the following strings, separated by newline characters:
* - Algorithm
* - RequestDateTime
* - CredentialScope
* - HashedCanonicalRequest
*
* @internal
*/
var getStringToSign = (date, credentialScope, hashedRequest) => [
	SHA256_ALGORITHM_IDENTIFIER,
	date,
	credentialScope,
	hashedRequest
].join("\n");
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/utils/getSignature.mjs
/**
* Calculates and returns an AWS API Signature.
* https://docs.aws.amazon.com/IAM/latest/UserGuide/create-signed-request.html
*
* @param request `HttpRequest` to be signed.
* @param signRequestOptions `SignRequestOptions` object containing values used to construct the signature.
* @returns AWS API Signature to sign a request or url with.
*
* @internal
*/
var getSignature = (request, { credentialScope, longDate, secretAccessKey, shortDate, signingRegion, signingService, uriEscapePath }) => {
	const stringToSign = getStringToSign(longDate, credentialScope, getHashedDataAsHex(null, getCanonicalRequest(request, uriEscapePath)));
	return getHashedDataAsHex(getSigningKey(secretAccessKey, shortDate, signingRegion, signingService), stringToSign);
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/signer/signatureV4/signRequest.mjs
/**
* Given a `HttpRequest`, returns a Signature Version 4 signed `HttpRequest`.
*
* @param request `HttpRequest` to be signed.
* @param signRequestOptions `SignRequestOptions` object containing values used to construct the signature.
* @returns A `HttpRequest` with authentication headers which can grant temporary access to AWS resources.
*/
var signRequest = (request, options) => {
	const signingValues = getSigningValues(options);
	const { accessKeyId, credentialScope, longDate, sessionToken } = signingValues;
	const headers = { ...request.headers };
	headers[HOST_HEADER] = request.url.host;
	headers[AMZ_DATE_HEADER] = longDate;
	if (sessionToken) headers[TOKEN_HEADER] = sessionToken;
	const requestToSign = {
		...request,
		headers
	};
	const signature = getSignature(requestToSign, signingValues);
	headers[AUTH_HEADER] = `${SHA256_ALGORITHM_IDENTIFIER} ${`Credential=${accessKeyId}/${credentialScope}`}, ${`SignedHeaders=${getSignedHeaders(headers)}`}, ${`Signature=${signature}`}`;
	return requestToSign;
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/utils/getSkewCorrectedDate.mjs
/**
* Returns a `Date` that is corrected for clock skew.
*
* @param systemClockOffset The offset of the system clock in milliseconds.
*
* @returns `Date` representing the current time adjusted by the system clock offset.
*
* @internal
*/
var getSkewCorrectedDate = (systemClockOffset) => new Date(Date.now() + systemClockOffset);
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/utils/isClockSkewed.mjs
var SKEW_WINDOW = 300 * 1e3;
/**
* Checks if the provided date is within the skew window of 5 minutes.
*
* @param clockTimeInMilliseconds Time to check for skew in milliseconds.
* @param clockOffsetInMilliseconds Offset to check clock against in milliseconds.
*
* @returns True if skewed. False otherwise.
*
* @internal
*/
var isClockSkewed = (clockTimeInMilliseconds, clockOffsetInMilliseconds) => Math.abs(getSkewCorrectedDate(clockOffsetInMilliseconds).getTime() - clockTimeInMilliseconds) >= SKEW_WINDOW;
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/utils/getUpdatedSystemClockOffset.mjs
/**
* Returns the difference between clock time and the current system time if clock is skewed.
*
* @param clockTimeInMilliseconds Clock time in milliseconds.
* @param currentSystemClockOffset Current system clock offset in milliseconds.
*
* @internal
*/
var getUpdatedSystemClockOffset = (clockTimeInMilliseconds, currentSystemClockOffset) => {
	if (isClockSkewed(clockTimeInMilliseconds, currentSystemClockOffset)) return clockTimeInMilliseconds - Date.now();
	return currentSystemClockOffset;
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/clients/middleware/signing/middleware.mjs
/**
* Middleware that SigV4 signs request with AWS credentials, and correct system clock offset.
* This middleware is expected to be placed after retry middleware.
*/
var signingMiddlewareFactory = ({ credentials, region, service, uriEscapePath = true }) => {
	let currentSystemClockOffset;
	return (next, context) => async function signingMiddleware(request) {
		currentSystemClockOffset = currentSystemClockOffset ?? 0;
		const response = await next(await signRequest(request, {
			credentials: typeof credentials === "function" ? await credentials({ forceRefresh: !!context?.isCredentialsExpired }) : credentials,
			signingDate: getSkewCorrectedDate(currentSystemClockOffset),
			signingRegion: region,
			signingService: service,
			uriEscapePath
		}));
		const dateString = getDateHeader(response);
		if (dateString) currentSystemClockOffset = getUpdatedSystemClockOffset(Date.parse(dateString), currentSystemClockOffset);
		return response;
	};
};
var getDateHeader = ({ headers } = {}) => headers?.date ?? headers?.Date ?? headers?.["x-amz-date"];
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/retry/NonRetryableError.mjs
var NonRetryableError = class extends Error {
	constructor() {
		super(...arguments);
		this.nonRetryable = true;
	}
};
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/utils/retry/jitteredExponentialRetry.mjs
/**
* @private
* Internal use of Amplify only
*/
var jitteredExponentialRetry = (functionToRetry, args, maxDelayMs = MAX_DELAY_MS$1, onTerminate) => retry(functionToRetry, args, jitteredBackoff(maxDelayMs), onTerminate);
//#endregion
//#region node_modules/@aws-amplify/core/dist/esm/errors/APIError.mjs
/**
* Error class for errors that associated with unsuccessful HTTP responses.
* It's throw by API category REST API handlers and GraphQL query handlers for now.
*/
var ApiError = class ApiError extends AmplifyError {
	/**
	* The unwrapped HTTP response causing the given API error.
	*/
	get response() {
		return this._response ? replicateApiErrorResponse(this._response) : void 0;
	}
	constructor(params) {
		super(params);
		this.constructor = ApiError;
		Object.setPrototypeOf(this, ApiError.prototype);
		if (params.response) this._response = params.response;
	}
};
var replicateApiErrorResponse = (response) => ({
	...response,
	headers: { ...response.headers }
});
//#endregion
//#region node_modules/graphql/jsutils/isObjectLike.mjs
function _typeof$3(obj) {
	"@babel/helpers - typeof";
	if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") _typeof$3 = function _typeof(obj) {
		return typeof obj;
	};
	else _typeof$3 = function _typeof(obj) {
		return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	};
	return _typeof$3(obj);
}
/**
* Return true if `value` is object-like. A value is object-like if it's not
* `null` and has a `typeof` result of "object".
*/
function isObjectLike(value) {
	return _typeof$3(value) == "object" && value !== null;
}
//#endregion
//#region node_modules/graphql/polyfills/symbols.mjs
var SYMBOL_TO_STRING_TAG = typeof Symbol === "function" && Symbol.toStringTag != null ? Symbol.toStringTag : "@@toStringTag";
//#endregion
//#region node_modules/graphql/language/location.mjs
/**
* Represents a location in a Source.
*/
/**
* Takes a Source and a UTF-8 character offset, and returns the corresponding
* line and column as a SourceLocation.
*/
function getLocation(source, position) {
	var lineRegexp = /\r\n|[\n\r]/g;
	var line = 1;
	var column = position + 1;
	var match;
	while ((match = lineRegexp.exec(source.body)) && match.index < position) {
		line += 1;
		column = position + 1 - (match.index + match[0].length);
	}
	return {
		line,
		column
	};
}
//#endregion
//#region node_modules/graphql/language/printLocation.mjs
/**
* Render a helpful description of the location in the GraphQL Source document.
*/
function printLocation(location) {
	return printSourceLocation(location.source, getLocation(location.source, location.start));
}
/**
* Render a helpful description of the location in the GraphQL Source document.
*/
function printSourceLocation(source, sourceLocation) {
	var firstLineColumnOffset = source.locationOffset.column - 1;
	var body = whitespace(firstLineColumnOffset) + source.body;
	var lineIndex = sourceLocation.line - 1;
	var lineOffset = source.locationOffset.line - 1;
	var lineNum = sourceLocation.line + lineOffset;
	var columnOffset = sourceLocation.line === 1 ? firstLineColumnOffset : 0;
	var columnNum = sourceLocation.column + columnOffset;
	var locationStr = "".concat(source.name, ":").concat(lineNum, ":").concat(columnNum, "\n");
	var lines = body.split(/\r\n|[\n\r]/g);
	var locationLine = lines[lineIndex];
	if (locationLine.length > 120) {
		var subLineIndex = Math.floor(columnNum / 80);
		var subLineColumnNum = columnNum % 80;
		var subLines = [];
		for (var i = 0; i < locationLine.length; i += 80) subLines.push(locationLine.slice(i, i + 80));
		return locationStr + printPrefixedLines([["".concat(lineNum), subLines[0]]].concat(subLines.slice(1, subLineIndex + 1).map(function(subLine) {
			return ["", subLine];
		}), [[" ", whitespace(subLineColumnNum - 1) + "^"], ["", subLines[subLineIndex + 1]]]));
	}
	return locationStr + printPrefixedLines([
		["".concat(lineNum - 1), lines[lineIndex - 1]],
		["".concat(lineNum), locationLine],
		["", whitespace(columnNum - 1) + "^"],
		["".concat(lineNum + 1), lines[lineIndex + 1]]
	]);
}
function printPrefixedLines(lines) {
	var existingLines = lines.filter(function(_ref) {
		_ref[0];
		return _ref[1] !== void 0;
	});
	var padLen = Math.max.apply(Math, existingLines.map(function(_ref2) {
		return _ref2[0].length;
	}));
	return existingLines.map(function(_ref3) {
		var prefix = _ref3[0], line = _ref3[1];
		return leftPad(padLen, prefix) + (line ? " | " + line : " |");
	}).join("\n");
}
function whitespace(len) {
	return Array(len + 1).join(" ");
}
function leftPad(len, str) {
	return whitespace(len - str.length) + str;
}
//#endregion
//#region node_modules/graphql/error/GraphQLError.mjs
function _typeof$2(obj) {
	"@babel/helpers - typeof";
	if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") _typeof$2 = function _typeof(obj) {
		return typeof obj;
	};
	else _typeof$2 = function _typeof(obj) {
		return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	};
	return _typeof$2(obj);
}
function ownKeys(object, enumerableOnly) {
	var keys = Object.keys(object);
	if (Object.getOwnPropertySymbols) {
		var symbols = Object.getOwnPropertySymbols(object);
		if (enumerableOnly) symbols = symbols.filter(function(sym) {
			return Object.getOwnPropertyDescriptor(object, sym).enumerable;
		});
		keys.push.apply(keys, symbols);
	}
	return keys;
}
function _objectSpread(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i] != null ? arguments[i] : {};
		if (i % 2) ownKeys(Object(source), true).forEach(function(key) {
			_defineProperty(target, key, source[key]);
		});
		else if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
		else ownKeys(Object(source)).forEach(function(key) {
			Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
		});
	}
	return target;
}
function _defineProperty(obj, key, value) {
	if (key in obj) Object.defineProperty(obj, key, {
		value,
		enumerable: true,
		configurable: true,
		writable: true
	});
	else obj[key] = value;
	return obj;
}
function _classCallCheck(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _defineProperties$1(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, descriptor.key, descriptor);
	}
}
function _createClass$1(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties$1(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties$1(Constructor, staticProps);
	return Constructor;
}
function _inherits(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	if (superClass) _setPrototypeOf(subClass, superClass);
}
function _createSuper(Derived) {
	var hasNativeReflectConstruct = _isNativeReflectConstruct();
	return function _createSuperInternal() {
		var Super = _getPrototypeOf(Derived), result;
		if (hasNativeReflectConstruct) {
			var NewTarget = _getPrototypeOf(this).constructor;
			result = Reflect.construct(Super, arguments, NewTarget);
		} else result = Super.apply(this, arguments);
		return _possibleConstructorReturn(this, result);
	};
}
function _possibleConstructorReturn(self, call) {
	if (call && (_typeof$2(call) === "object" || typeof call === "function")) return call;
	return _assertThisInitialized(self);
}
function _assertThisInitialized(self) {
	if (self === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return self;
}
function _wrapNativeSuper(Class) {
	var _cache = typeof Map === "function" ? /* @__PURE__ */ new Map() : void 0;
	_wrapNativeSuper = function _wrapNativeSuper(Class) {
		if (Class === null || !_isNativeFunction(Class)) return Class;
		if (typeof Class !== "function") throw new TypeError("Super expression must either be null or a function");
		if (typeof _cache !== "undefined") {
			if (_cache.has(Class)) return _cache.get(Class);
			_cache.set(Class, Wrapper);
		}
		function Wrapper() {
			return _construct(Class, arguments, _getPrototypeOf(this).constructor);
		}
		Wrapper.prototype = Object.create(Class.prototype, { constructor: {
			value: Wrapper,
			enumerable: false,
			writable: true,
			configurable: true
		} });
		return _setPrototypeOf(Wrapper, Class);
	};
	return _wrapNativeSuper(Class);
}
function _construct(Parent, args, Class) {
	if (_isNativeReflectConstruct()) _construct = Reflect.construct;
	else _construct = function _construct(Parent, args, Class) {
		var a = [null];
		a.push.apply(a, args);
		var instance = new (Function.bind.apply(Parent, a))();
		if (Class) _setPrototypeOf(instance, Class.prototype);
		return instance;
	};
	return _construct.apply(null, arguments);
}
function _isNativeReflectConstruct() {
	if (typeof Reflect === "undefined" || !Reflect.construct) return false;
	if (Reflect.construct.sham) return false;
	if (typeof Proxy === "function") return true;
	try {
		Date.prototype.toString.call(Reflect.construct(Date, [], function() {}));
		return true;
	} catch (e) {
		return false;
	}
}
function _isNativeFunction(fn) {
	return Function.toString.call(fn).indexOf("[native code]") !== -1;
}
function _setPrototypeOf(o, p) {
	_setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _setPrototypeOf(o, p);
}
function _getPrototypeOf(o) {
	_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
		return o.__proto__ || Object.getPrototypeOf(o);
	};
	return _getPrototypeOf(o);
}
/**
* A GraphQLError describes an Error found during the parse, validate, or
* execute phases of performing a GraphQL operation. In addition to a message
* and stack trace, it also includes information about the locations in a
* GraphQL document and/or execution result that correspond to the Error.
*/
var GraphQLError = /* @__PURE__ */ function(_Error) {
	_inherits(GraphQLError, _Error);
	var _super = _createSuper(GraphQLError);
	/**
	* An array of { line, column } locations within the source GraphQL document
	* which correspond to this error.
	*
	* Errors during validation often contain multiple locations, for example to
	* point out two things with the same name. Errors during execution include a
	* single location, the field which produced the error.
	*
	* Enumerable, and appears in the result of JSON.stringify().
	*/
	/**
	* An array describing the JSON-path into the execution response which
	* corresponds to this error. Only included for errors during execution.
	*
	* Enumerable, and appears in the result of JSON.stringify().
	*/
	/**
	* An array of GraphQL AST Nodes corresponding to this error.
	*/
	/**
	* The source GraphQL document for the first location of this error.
	*
	* Note that if this Error represents more than one node, the source may not
	* represent nodes after the first node.
	*/
	/**
	* An array of character offsets within the source GraphQL document
	* which correspond to this error.
	*/
	/**
	* The original error thrown from a field resolver during execution.
	*/
	/**
	* Extension fields to add to the formatted error.
	*/
	function GraphQLError(message, nodes, source, positions, path, originalError, extensions) {
		var _nodeLocations, _nodeLocations2, _nodeLocations3;
		var _this;
		_classCallCheck(this, GraphQLError);
		_this = _super.call(this, message);
		_this.name = "GraphQLError";
		_this.originalError = originalError !== null && originalError !== void 0 ? originalError : void 0;
		_this.nodes = undefinedIfEmpty(Array.isArray(nodes) ? nodes : nodes ? [nodes] : void 0);
		var nodeLocations = [];
		for (var _i2 = 0, _ref3 = (_this$nodes = _this.nodes) !== null && _this$nodes !== void 0 ? _this$nodes : []; _i2 < _ref3.length; _i2++) {
			var _this$nodes;
			var loc = _ref3[_i2].loc;
			if (loc != null) nodeLocations.push(loc);
		}
		nodeLocations = undefinedIfEmpty(nodeLocations);
		_this.source = source !== null && source !== void 0 ? source : (_nodeLocations = nodeLocations) === null || _nodeLocations === void 0 ? void 0 : _nodeLocations[0].source;
		_this.positions = positions !== null && positions !== void 0 ? positions : (_nodeLocations2 = nodeLocations) === null || _nodeLocations2 === void 0 ? void 0 : _nodeLocations2.map(function(loc) {
			return loc.start;
		});
		_this.locations = positions && source ? positions.map(function(pos) {
			return getLocation(source, pos);
		}) : (_nodeLocations3 = nodeLocations) === null || _nodeLocations3 === void 0 ? void 0 : _nodeLocations3.map(function(loc) {
			return getLocation(loc.source, loc.start);
		});
		_this.path = path !== null && path !== void 0 ? path : void 0;
		var originalExtensions = originalError === null || originalError === void 0 ? void 0 : originalError.extensions;
		if (extensions == null && isObjectLike(originalExtensions)) _this.extensions = _objectSpread({}, originalExtensions);
		else _this.extensions = extensions !== null && extensions !== void 0 ? extensions : {};
		Object.defineProperties(_assertThisInitialized(_this), {
			message: { enumerable: true },
			locations: { enumerable: _this.locations != null },
			path: { enumerable: _this.path != null },
			extensions: { enumerable: _this.extensions != null && Object.keys(_this.extensions).length > 0 },
			name: { enumerable: false },
			nodes: { enumerable: false },
			source: { enumerable: false },
			positions: { enumerable: false },
			originalError: { enumerable: false }
		});
		if (originalError !== null && originalError !== void 0 && originalError.stack) {
			Object.defineProperty(_assertThisInitialized(_this), "stack", {
				value: originalError.stack,
				writable: true,
				configurable: true
			});
			return _possibleConstructorReturn(_this);
		}
		if (Error.captureStackTrace) Error.captureStackTrace(_assertThisInitialized(_this), GraphQLError);
		else Object.defineProperty(_assertThisInitialized(_this), "stack", {
			value: Error().stack,
			writable: true,
			configurable: true
		});
		return _this;
	}
	_createClass$1(GraphQLError, [{
		key: "toString",
		value: function toString() {
			return printError(this);
		}
	}, {
		key: SYMBOL_TO_STRING_TAG,
		get: function get() {
			return "Object";
		}
	}]);
	return GraphQLError;
}(/* @__PURE__ */ _wrapNativeSuper(Error));
function undefinedIfEmpty(array) {
	return array === void 0 || array.length === 0 ? void 0 : array;
}
/**
* Prints a GraphQLError to a string, representing useful location information
* about the error's position in the source.
*/
function printError(error) {
	var output = error.message;
	if (error.nodes) for (var _i4 = 0, _error$nodes2 = error.nodes; _i4 < _error$nodes2.length; _i4++) {
		var node = _error$nodes2[_i4];
		if (node.loc) output += "\n\n" + printLocation(node.loc);
	}
	else if (error.source && error.locations) for (var _i6 = 0, _error$locations2 = error.locations; _i6 < _error$locations2.length; _i6++) {
		var location = _error$locations2[_i6];
		output += "\n\n" + printSourceLocation(error.source, location);
	}
	return output;
}
//#endregion
//#region node_modules/graphql/error/syntaxError.mjs
/**
* Produces a GraphQLError representing a syntax error, containing useful
* descriptive information about the syntax error's position in the source.
*/
function syntaxError(source, position, description) {
	return new GraphQLError("Syntax Error: ".concat(description), void 0, source, [position]);
}
//#endregion
//#region node_modules/graphql/language/kinds.mjs
/**
* The set of allowed kind values for AST nodes.
*/
var Kind = Object.freeze({
	NAME: "Name",
	DOCUMENT: "Document",
	OPERATION_DEFINITION: "OperationDefinition",
	VARIABLE_DEFINITION: "VariableDefinition",
	SELECTION_SET: "SelectionSet",
	FIELD: "Field",
	ARGUMENT: "Argument",
	FRAGMENT_SPREAD: "FragmentSpread",
	INLINE_FRAGMENT: "InlineFragment",
	FRAGMENT_DEFINITION: "FragmentDefinition",
	VARIABLE: "Variable",
	INT: "IntValue",
	FLOAT: "FloatValue",
	STRING: "StringValue",
	BOOLEAN: "BooleanValue",
	NULL: "NullValue",
	ENUM: "EnumValue",
	LIST: "ListValue",
	OBJECT: "ObjectValue",
	OBJECT_FIELD: "ObjectField",
	DIRECTIVE: "Directive",
	NAMED_TYPE: "NamedType",
	LIST_TYPE: "ListType",
	NON_NULL_TYPE: "NonNullType",
	SCHEMA_DEFINITION: "SchemaDefinition",
	OPERATION_TYPE_DEFINITION: "OperationTypeDefinition",
	SCALAR_TYPE_DEFINITION: "ScalarTypeDefinition",
	OBJECT_TYPE_DEFINITION: "ObjectTypeDefinition",
	FIELD_DEFINITION: "FieldDefinition",
	INPUT_VALUE_DEFINITION: "InputValueDefinition",
	INTERFACE_TYPE_DEFINITION: "InterfaceTypeDefinition",
	UNION_TYPE_DEFINITION: "UnionTypeDefinition",
	ENUM_TYPE_DEFINITION: "EnumTypeDefinition",
	ENUM_VALUE_DEFINITION: "EnumValueDefinition",
	INPUT_OBJECT_TYPE_DEFINITION: "InputObjectTypeDefinition",
	DIRECTIVE_DEFINITION: "DirectiveDefinition",
	SCHEMA_EXTENSION: "SchemaExtension",
	SCALAR_TYPE_EXTENSION: "ScalarTypeExtension",
	OBJECT_TYPE_EXTENSION: "ObjectTypeExtension",
	INTERFACE_TYPE_EXTENSION: "InterfaceTypeExtension",
	UNION_TYPE_EXTENSION: "UnionTypeExtension",
	ENUM_TYPE_EXTENSION: "EnumTypeExtension",
	INPUT_OBJECT_TYPE_EXTENSION: "InputObjectTypeExtension"
});
/**
* The enum type representing the possible kind values of AST nodes.
*/
//#endregion
//#region node_modules/graphql/jsutils/invariant.mjs
function invariant(condition, message) {
	if (!Boolean(condition)) throw new Error(message != null ? message : "Unexpected invariant triggered.");
}
//#endregion
//#region node_modules/graphql/jsutils/nodejsCustomInspectSymbol.mjs
// istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2317')
var nodejsCustomInspectSymbol = typeof Symbol === "function" && typeof Symbol.for === "function" ? Symbol.for("nodejs.util.inspect.custom") : void 0;
//#endregion
//#region node_modules/graphql/jsutils/defineInspect.mjs
/**
* The `defineInspect()` function defines `inspect()` prototype method as alias of `toJSON`
*/
function defineInspect(classObject) {
	var fn = classObject.prototype.toJSON;
	typeof fn === "function" || invariant(0);
	classObject.prototype.inspect = fn;
	if (nodejsCustomInspectSymbol) classObject.prototype[nodejsCustomInspectSymbol] = fn;
}
//#endregion
//#region node_modules/graphql/language/ast.mjs
/**
* Contains a range of UTF-8 character offsets and token references that
* identify the region of the source from which the AST derived.
*/
var Location = /* @__PURE__ */ function() {
	/**
	* The character offset at which this Node begins.
	*/
	/**
	* The character offset at which this Node ends.
	*/
	/**
	* The Token at which this Node begins.
	*/
	/**
	* The Token at which this Node ends.
	*/
	/**
	* The Source document the AST represents.
	*/
	function Location(startToken, endToken, source) {
		this.start = startToken.start;
		this.end = endToken.end;
		this.startToken = startToken;
		this.endToken = endToken;
		this.source = source;
	}
	var _proto = Location.prototype;
	_proto.toJSON = function toJSON() {
		return {
			start: this.start,
			end: this.end
		};
	};
	return Location;
}();
defineInspect(Location);
/**
* Represents a range of characters represented by a lexical token
* within a Source.
*/
var Token = /* @__PURE__ */ function() {
	/**
	* The kind of Token.
	*/
	/**
	* The character offset at which this Node begins.
	*/
	/**
	* The character offset at which this Node ends.
	*/
	/**
	* The 1-indexed line number on which this Token appears.
	*/
	/**
	* The 1-indexed column number at which this Token begins.
	*/
	/**
	* For non-punctuation tokens, represents the interpreted value of the token.
	*/
	/**
	* Tokens exist as nodes in a double-linked-list amongst all tokens
	* including ignored tokens. <SOF> is always the first node and <EOF>
	* the last.
	*/
	function Token(kind, start, end, line, column, prev, value) {
		this.kind = kind;
		this.start = start;
		this.end = end;
		this.line = line;
		this.column = column;
		this.value = value;
		this.prev = prev;
		this.next = null;
	}
	var _proto2 = Token.prototype;
	_proto2.toJSON = function toJSON() {
		return {
			kind: this.kind,
			value: this.value,
			line: this.line,
			column: this.column
		};
	};
	return Token;
}();
defineInspect(Token);
/**
* @internal
*/
function isNode(maybeNode) {
	return maybeNode != null && typeof maybeNode.kind === "string";
}
/**
* The list of all possible AST node types.
*/
//#endregion
//#region node_modules/graphql/language/tokenKind.mjs
/**
* An exported enum describing the different kinds of tokens that the
* lexer emits.
*/
var TokenKind = Object.freeze({
	SOF: "<SOF>",
	EOF: "<EOF>",
	BANG: "!",
	DOLLAR: "$",
	AMP: "&",
	PAREN_L: "(",
	PAREN_R: ")",
	SPREAD: "...",
	COLON: ":",
	EQUALS: "=",
	AT: "@",
	BRACKET_L: "[",
	BRACKET_R: "]",
	BRACE_L: "{",
	PIPE: "|",
	BRACE_R: "}",
	NAME: "Name",
	INT: "Int",
	FLOAT: "Float",
	STRING: "String",
	BLOCK_STRING: "BlockString",
	COMMENT: "Comment"
});
/**
* The enum type representing the token kinds values.
*/
//#endregion
//#region node_modules/graphql/jsutils/inspect.mjs
function _typeof$1(obj) {
	"@babel/helpers - typeof";
	if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") _typeof$1 = function _typeof(obj) {
		return typeof obj;
	};
	else _typeof$1 = function _typeof(obj) {
		return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	};
	return _typeof$1(obj);
}
var MAX_ARRAY_LENGTH = 10;
var MAX_RECURSIVE_DEPTH = 2;
/**
* Used to print values in error messages.
*/
function inspect(value) {
	return formatValue(value, []);
}
function formatValue(value, seenValues) {
	switch (_typeof$1(value)) {
		case "string": return JSON.stringify(value);
		case "function": return value.name ? "[function ".concat(value.name, "]") : "[function]";
		case "object":
			if (value === null) return "null";
			return formatObjectValue(value, seenValues);
		default: return String(value);
	}
}
function formatObjectValue(value, previouslySeenValues) {
	if (previouslySeenValues.indexOf(value) !== -1) return "[Circular]";
	var seenValues = [].concat(previouslySeenValues, [value]);
	var customInspectFn = getCustomFn(value);
	if (customInspectFn !== void 0) {
		var customValue = customInspectFn.call(value);
		if (customValue !== value) return typeof customValue === "string" ? customValue : formatValue(customValue, seenValues);
	} else if (Array.isArray(value)) return formatArray(value, seenValues);
	return formatObject(value, seenValues);
}
function formatObject(object, seenValues) {
	var keys = Object.keys(object);
	if (keys.length === 0) return "{}";
	if (seenValues.length > MAX_RECURSIVE_DEPTH) return "[" + getObjectTag(object) + "]";
	return "{ " + keys.map(function(key) {
		var value = formatValue(object[key], seenValues);
		return key + ": " + value;
	}).join(", ") + " }";
}
function formatArray(array, seenValues) {
	if (array.length === 0) return "[]";
	if (seenValues.length > MAX_RECURSIVE_DEPTH) return "[Array]";
	var len = Math.min(MAX_ARRAY_LENGTH, array.length);
	var remaining = array.length - len;
	var items = [];
	for (var i = 0; i < len; ++i) items.push(formatValue(array[i], seenValues));
	if (remaining === 1) items.push("... 1 more item");
	else if (remaining > 1) items.push("... ".concat(remaining, " more items"));
	return "[" + items.join(", ") + "]";
}
function getCustomFn(object) {
	var customInspectFn = object[String(nodejsCustomInspectSymbol)];
	if (typeof customInspectFn === "function") return customInspectFn;
	if (typeof object.inspect === "function") return object.inspect;
}
function getObjectTag(object) {
	var tag = Object.prototype.toString.call(object).replace(/^\[object /, "").replace(/]$/, "");
	if (tag === "Object" && typeof object.constructor === "function") {
		var name = object.constructor.name;
		if (typeof name === "string" && name !== "") return name;
	}
	return tag;
}
//#endregion
//#region node_modules/graphql/jsutils/devAssert.mjs
function devAssert(condition, message) {
	if (!Boolean(condition)) throw new Error(message);
}
//#endregion
//#region node_modules/graphql/jsutils/instanceOf.mjs
function _typeof(obj) {
	"@babel/helpers - typeof";
	if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") _typeof = function _typeof(obj) {
		return typeof obj;
	};
	else _typeof = function _typeof(obj) {
		return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	};
	return _typeof(obj);
}
/**
* A replacement for instanceof which includes an error warning when multi-realm
* constructors are detected.
*/
var instanceOf_default = function instanceOf(value, constructor) {
	if (value instanceof constructor) return true;
	if (_typeof(value) === "object" && value !== null) {
		var _value$constructor;
		var className = constructor.prototype[Symbol.toStringTag];
		if (className === (Symbol.toStringTag in value ? value[Symbol.toStringTag] : (_value$constructor = value.constructor) === null || _value$constructor === void 0 ? void 0 : _value$constructor.name)) {
			var stringifiedValue = inspect(value);
			throw new Error("Cannot use ".concat(className, " \"").concat(stringifiedValue, "\" from another module or realm.\n\nEnsure that there is only one instance of \"graphql\" in the node_modules\ndirectory. If different versions of \"graphql\" are the dependencies of other\nrelied on modules, use \"resolutions\" to ensure only one version is installed.\n\nhttps://yarnpkg.com/en/docs/selective-version-resolutions\n\nDuplicate \"graphql\" modules cannot be used at the same time since different\nversions may have different capabilities and behavior. The data from one\nversion used in the function from another could produce confusing and\nspurious results."));
		}
	}
	return false;
};
//#endregion
//#region node_modules/graphql/language/source.mjs
function _defineProperties(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, descriptor.key, descriptor);
	}
}
function _createClass(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties(Constructor, staticProps);
	return Constructor;
}
/**
* A representation of source input to GraphQL. The `name` and `locationOffset` parameters are
* optional, but they are useful for clients who store GraphQL documents in source files.
* For example, if the GraphQL input starts at line 40 in a file named `Foo.graphql`, it might
* be useful for `name` to be `"Foo.graphql"` and location to be `{ line: 40, column: 1 }`.
* The `line` and `column` properties in `locationOffset` are 1-indexed.
*/
var Source = /* @__PURE__ */ function() {
	function Source(body) {
		var name = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "GraphQL request";
		var locationOffset = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {
			line: 1,
			column: 1
		};
		typeof body === "string" || devAssert(0, "Body must be a string. Received: ".concat(inspect(body), "."));
		this.body = body;
		this.name = name;
		this.locationOffset = locationOffset;
		this.locationOffset.line > 0 || devAssert(0, "line in locationOffset is 1-indexed and must be positive.");
		this.locationOffset.column > 0 || devAssert(0, "column in locationOffset is 1-indexed and must be positive.");
	}
	_createClass(Source, [{
		key: SYMBOL_TO_STRING_TAG,
		get: function get() {
			return "Source";
		}
	}]);
	return Source;
}();
/**
* Test if the given value is a Source object.
*
* @internal
*/
function isSource(source) {
	return instanceOf_default(source, Source);
}
//#endregion
//#region node_modules/graphql/language/directiveLocation.mjs
/**
* The set of allowed directive location values.
*/
var DirectiveLocation = Object.freeze({
	QUERY: "QUERY",
	MUTATION: "MUTATION",
	SUBSCRIPTION: "SUBSCRIPTION",
	FIELD: "FIELD",
	FRAGMENT_DEFINITION: "FRAGMENT_DEFINITION",
	FRAGMENT_SPREAD: "FRAGMENT_SPREAD",
	INLINE_FRAGMENT: "INLINE_FRAGMENT",
	VARIABLE_DEFINITION: "VARIABLE_DEFINITION",
	SCHEMA: "SCHEMA",
	SCALAR: "SCALAR",
	OBJECT: "OBJECT",
	FIELD_DEFINITION: "FIELD_DEFINITION",
	ARGUMENT_DEFINITION: "ARGUMENT_DEFINITION",
	INTERFACE: "INTERFACE",
	UNION: "UNION",
	ENUM: "ENUM",
	ENUM_VALUE: "ENUM_VALUE",
	INPUT_OBJECT: "INPUT_OBJECT",
	INPUT_FIELD_DEFINITION: "INPUT_FIELD_DEFINITION"
});
/**
* The enum type representing the directive location values.
*/
//#endregion
//#region node_modules/graphql/language/blockString.mjs
/**
* Produces the value of a block string from its parsed raw value, similar to
* CoffeeScript's block string, Python's docstring trim or Ruby's strip_heredoc.
*
* This implements the GraphQL spec's BlockStringValue() static algorithm.
*
* @internal
*/
function dedentBlockStringValue(rawString) {
	var lines = rawString.split(/\r\n|[\n\r]/g);
	var commonIndent = getBlockStringIndentation(rawString);
	if (commonIndent !== 0) for (var i = 1; i < lines.length; i++) lines[i] = lines[i].slice(commonIndent);
	var startLine = 0;
	while (startLine < lines.length && isBlank(lines[startLine])) ++startLine;
	var endLine = lines.length;
	while (endLine > startLine && isBlank(lines[endLine - 1])) --endLine;
	return lines.slice(startLine, endLine).join("\n");
}
function isBlank(str) {
	for (var i = 0; i < str.length; ++i) if (str[i] !== " " && str[i] !== "	") return false;
	return true;
}
/**
* @internal
*/
function getBlockStringIndentation(value) {
	var _commonIndent;
	var isFirstLine = true;
	var isEmptyLine = true;
	var indent = 0;
	var commonIndent = null;
	for (var i = 0; i < value.length; ++i) switch (value.charCodeAt(i)) {
		case 13: if (value.charCodeAt(i + 1) === 10) ++i;
		case 10:
			isFirstLine = false;
			isEmptyLine = true;
			indent = 0;
			break;
		case 9:
		case 32:
			++indent;
			break;
		default:
			if (isEmptyLine && !isFirstLine && (commonIndent === null || indent < commonIndent)) commonIndent = indent;
			isEmptyLine = false;
	}
	return (_commonIndent = commonIndent) !== null && _commonIndent !== void 0 ? _commonIndent : 0;
}
/**
* Print a block string in the indented block form by adding a leading and
* trailing blank line. However, if a block string starts with whitespace and is
* a single-line, adding a leading blank line would strip that whitespace.
*
* @internal
*/
function printBlockString(value) {
	var indentation = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "";
	var preferMultipleLines = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
	var isSingleLine = value.indexOf("\n") === -1;
	var hasLeadingSpace = value[0] === " " || value[0] === "	";
	var hasTrailingQuote = value[value.length - 1] === "\"";
	var hasTrailingSlash = value[value.length - 1] === "\\";
	var printAsMultipleLines = !isSingleLine || hasTrailingQuote || hasTrailingSlash || preferMultipleLines;
	var result = "";
	if (printAsMultipleLines && !(isSingleLine && hasLeadingSpace)) result += "\n" + indentation;
	result += indentation ? value.replace(/\n/g, "\n" + indentation) : value;
	if (printAsMultipleLines) result += "\n";
	return "\"\"\"" + result.replace(/"""/g, "\\\"\"\"") + "\"\"\"";
}
//#endregion
//#region node_modules/graphql/language/lexer.mjs
/**
* Given a Source object, creates a Lexer for that source.
* A Lexer is a stateful stream generator in that every time
* it is advanced, it returns the next token in the Source. Assuming the
* source lexes, the final Token emitted by the lexer will be of kind
* EOF, after which the lexer will repeatedly return the same EOF token
* whenever called.
*/
var Lexer = /* @__PURE__ */ function() {
	/**
	* The previously focused non-ignored token.
	*/
	/**
	* The currently focused non-ignored token.
	*/
	/**
	* The (1-indexed) line containing the current token.
	*/
	/**
	* The character offset at which the current line begins.
	*/
	function Lexer(source) {
		var startOfFileToken = new Token(TokenKind.SOF, 0, 0, 0, 0, null);
		this.source = source;
		this.lastToken = startOfFileToken;
		this.token = startOfFileToken;
		this.line = 1;
		this.lineStart = 0;
	}
	/**
	* Advances the token stream to the next non-ignored token.
	*/
	var _proto = Lexer.prototype;
	_proto.advance = function advance() {
		this.lastToken = this.token;
		return this.token = this.lookahead();
	};
	_proto.lookahead = function lookahead() {
		var token = this.token;
		if (token.kind !== TokenKind.EOF) do {
			var _token$next;
			token = (_token$next = token.next) !== null && _token$next !== void 0 ? _token$next : token.next = readToken(this, token);
		} while (token.kind === TokenKind.COMMENT);
		return token;
	};
	return Lexer;
}();
/**
* @internal
*/
function isPunctuatorTokenKind(kind) {
	return kind === TokenKind.BANG || kind === TokenKind.DOLLAR || kind === TokenKind.AMP || kind === TokenKind.PAREN_L || kind === TokenKind.PAREN_R || kind === TokenKind.SPREAD || kind === TokenKind.COLON || kind === TokenKind.EQUALS || kind === TokenKind.AT || kind === TokenKind.BRACKET_L || kind === TokenKind.BRACKET_R || kind === TokenKind.BRACE_L || kind === TokenKind.PIPE || kind === TokenKind.BRACE_R;
}
function printCharCode(code) {
	return isNaN(code) ? TokenKind.EOF : code < 127 ? JSON.stringify(String.fromCharCode(code)) : "\"\\u".concat(("00" + code.toString(16).toUpperCase()).slice(-4), "\"");
}
/**
* Gets the next token from the source starting at the given position.
*
* This skips over whitespace until it finds the next lexable token, then lexes
* punctuators immediately or calls the appropriate helper function for more
* complicated tokens.
*/
function readToken(lexer, prev) {
	var source = lexer.source;
	var body = source.body;
	var bodyLength = body.length;
	var pos = prev.end;
	while (pos < bodyLength) {
		var code = body.charCodeAt(pos);
		var _line = lexer.line;
		var _col = 1 + pos - lexer.lineStart;
		switch (code) {
			case 65279:
			case 9:
			case 32:
			case 44:
				++pos;
				continue;
			case 10:
				++pos;
				++lexer.line;
				lexer.lineStart = pos;
				continue;
			case 13:
				if (body.charCodeAt(pos + 1) === 10) pos += 2;
				else ++pos;
				++lexer.line;
				lexer.lineStart = pos;
				continue;
			case 33: return new Token(TokenKind.BANG, pos, pos + 1, _line, _col, prev);
			case 35: return readComment(source, pos, _line, _col, prev);
			case 36: return new Token(TokenKind.DOLLAR, pos, pos + 1, _line, _col, prev);
			case 38: return new Token(TokenKind.AMP, pos, pos + 1, _line, _col, prev);
			case 40: return new Token(TokenKind.PAREN_L, pos, pos + 1, _line, _col, prev);
			case 41: return new Token(TokenKind.PAREN_R, pos, pos + 1, _line, _col, prev);
			case 46:
				if (body.charCodeAt(pos + 1) === 46 && body.charCodeAt(pos + 2) === 46) return new Token(TokenKind.SPREAD, pos, pos + 3, _line, _col, prev);
				break;
			case 58: return new Token(TokenKind.COLON, pos, pos + 1, _line, _col, prev);
			case 61: return new Token(TokenKind.EQUALS, pos, pos + 1, _line, _col, prev);
			case 64: return new Token(TokenKind.AT, pos, pos + 1, _line, _col, prev);
			case 91: return new Token(TokenKind.BRACKET_L, pos, pos + 1, _line, _col, prev);
			case 93: return new Token(TokenKind.BRACKET_R, pos, pos + 1, _line, _col, prev);
			case 123: return new Token(TokenKind.BRACE_L, pos, pos + 1, _line, _col, prev);
			case 124: return new Token(TokenKind.PIPE, pos, pos + 1, _line, _col, prev);
			case 125: return new Token(TokenKind.BRACE_R, pos, pos + 1, _line, _col, prev);
			case 34:
				if (body.charCodeAt(pos + 1) === 34 && body.charCodeAt(pos + 2) === 34) return readBlockString(source, pos, _line, _col, prev, lexer);
				return readString(source, pos, _line, _col, prev);
			case 45:
			case 48:
			case 49:
			case 50:
			case 51:
			case 52:
			case 53:
			case 54:
			case 55:
			case 56:
			case 57: return readNumber(source, pos, code, _line, _col, prev);
			case 65:
			case 66:
			case 67:
			case 68:
			case 69:
			case 70:
			case 71:
			case 72:
			case 73:
			case 74:
			case 75:
			case 76:
			case 77:
			case 78:
			case 79:
			case 80:
			case 81:
			case 82:
			case 83:
			case 84:
			case 85:
			case 86:
			case 87:
			case 88:
			case 89:
			case 90:
			case 95:
			case 97:
			case 98:
			case 99:
			case 100:
			case 101:
			case 102:
			case 103:
			case 104:
			case 105:
			case 106:
			case 107:
			case 108:
			case 109:
			case 110:
			case 111:
			case 112:
			case 113:
			case 114:
			case 115:
			case 116:
			case 117:
			case 118:
			case 119:
			case 120:
			case 121:
			case 122: return readName(source, pos, _line, _col, prev);
		}
		throw syntaxError(source, pos, unexpectedCharacterMessage(code));
	}
	var line = lexer.line;
	var col = 1 + pos - lexer.lineStart;
	return new Token(TokenKind.EOF, bodyLength, bodyLength, line, col, prev);
}
/**
* Report a message that an unexpected character was encountered.
*/
function unexpectedCharacterMessage(code) {
	if (code < 32 && code !== 9 && code !== 10 && code !== 13) return "Cannot contain the invalid character ".concat(printCharCode(code), ".");
	if (code === 39) return "Unexpected single quote character ('), did you mean to use a double quote (\")?";
	return "Cannot parse the unexpected character ".concat(printCharCode(code), ".");
}
/**
* Reads a comment token from the source file.
*
* #[\u0009\u0020-\uFFFF]*
*/
function readComment(source, start, line, col, prev) {
	var body = source.body;
	var code;
	var position = start;
	do
		code = body.charCodeAt(++position);
	while (!isNaN(code) && (code > 31 || code === 9));
	return new Token(TokenKind.COMMENT, start, position, line, col, prev, body.slice(start + 1, position));
}
/**
* Reads a number token from the source file, either a float
* or an int depending on whether a decimal point appears.
*
* Int:   -?(0|[1-9][0-9]*)
* Float: -?(0|[1-9][0-9]*)(\.[0-9]+)?((E|e)(+|-)?[0-9]+)?
*/
function readNumber(source, start, firstCode, line, col, prev) {
	var body = source.body;
	var code = firstCode;
	var position = start;
	var isFloat = false;
	if (code === 45) code = body.charCodeAt(++position);
	if (code === 48) {
		code = body.charCodeAt(++position);
		if (code >= 48 && code <= 57) throw syntaxError(source, position, "Invalid number, unexpected digit after 0: ".concat(printCharCode(code), "."));
	} else {
		position = readDigits(source, position, code);
		code = body.charCodeAt(position);
	}
	if (code === 46) {
		isFloat = true;
		code = body.charCodeAt(++position);
		position = readDigits(source, position, code);
		code = body.charCodeAt(position);
	}
	if (code === 69 || code === 101) {
		isFloat = true;
		code = body.charCodeAt(++position);
		if (code === 43 || code === 45) code = body.charCodeAt(++position);
		position = readDigits(source, position, code);
		code = body.charCodeAt(position);
	}
	if (code === 46 || isNameStart(code)) throw syntaxError(source, position, "Invalid number, expected digit but got: ".concat(printCharCode(code), "."));
	return new Token(isFloat ? TokenKind.FLOAT : TokenKind.INT, start, position, line, col, prev, body.slice(start, position));
}
/**
* Returns the new position in the source after reading digits.
*/
function readDigits(source, start, firstCode) {
	var body = source.body;
	var position = start;
	var code = firstCode;
	if (code >= 48 && code <= 57) {
		do
			code = body.charCodeAt(++position);
		while (code >= 48 && code <= 57);
		return position;
	}
	throw syntaxError(source, position, "Invalid number, expected digit but got: ".concat(printCharCode(code), "."));
}
/**
* Reads a string token from the source file.
*
* "([^"\\\u000A\u000D]|(\\(u[0-9a-fA-F]{4}|["\\/bfnrt])))*"
*/
function readString(source, start, line, col, prev) {
	var body = source.body;
	var position = start + 1;
	var chunkStart = position;
	var code = 0;
	var value = "";
	while (position < body.length && !isNaN(code = body.charCodeAt(position)) && code !== 10 && code !== 13) {
		if (code === 34) {
			value += body.slice(chunkStart, position);
			return new Token(TokenKind.STRING, start, position + 1, line, col, prev, value);
		}
		if (code < 32 && code !== 9) throw syntaxError(source, position, "Invalid character within String: ".concat(printCharCode(code), "."));
		++position;
		if (code === 92) {
			value += body.slice(chunkStart, position - 1);
			code = body.charCodeAt(position);
			switch (code) {
				case 34:
					value += "\"";
					break;
				case 47:
					value += "/";
					break;
				case 92:
					value += "\\";
					break;
				case 98:
					value += "\b";
					break;
				case 102:
					value += "\f";
					break;
				case 110:
					value += "\n";
					break;
				case 114:
					value += "\r";
					break;
				case 116:
					value += "	";
					break;
				case 117:
					var charCode = uniCharCode(body.charCodeAt(position + 1), body.charCodeAt(position + 2), body.charCodeAt(position + 3), body.charCodeAt(position + 4));
					if (charCode < 0) {
						var invalidSequence = body.slice(position + 1, position + 5);
						throw syntaxError(source, position, "Invalid character escape sequence: \\u".concat(invalidSequence, "."));
					}
					value += String.fromCharCode(charCode);
					position += 4;
					break;
				default: throw syntaxError(source, position, "Invalid character escape sequence: \\".concat(String.fromCharCode(code), "."));
			}
			++position;
			chunkStart = position;
		}
	}
	throw syntaxError(source, position, "Unterminated string.");
}
/**
* Reads a block string token from the source file.
*
* """("?"?(\\"""|\\(?!=""")|[^"\\]))*"""
*/
function readBlockString(source, start, line, col, prev, lexer) {
	var body = source.body;
	var position = start + 3;
	var chunkStart = position;
	var code = 0;
	var rawValue = "";
	while (position < body.length && !isNaN(code = body.charCodeAt(position))) {
		if (code === 34 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34) {
			rawValue += body.slice(chunkStart, position);
			return new Token(TokenKind.BLOCK_STRING, start, position + 3, line, col, prev, dedentBlockStringValue(rawValue));
		}
		if (code < 32 && code !== 9 && code !== 10 && code !== 13) throw syntaxError(source, position, "Invalid character within String: ".concat(printCharCode(code), "."));
		if (code === 10) {
			++position;
			++lexer.line;
			lexer.lineStart = position;
		} else if (code === 13) {
			if (body.charCodeAt(position + 1) === 10) position += 2;
			else ++position;
			++lexer.line;
			lexer.lineStart = position;
		} else if (code === 92 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34 && body.charCodeAt(position + 3) === 34) {
			rawValue += body.slice(chunkStart, position) + "\"\"\"";
			position += 4;
			chunkStart = position;
		} else ++position;
	}
	throw syntaxError(source, position, "Unterminated string.");
}
/**
* Converts four hexadecimal chars to the integer that the
* string represents. For example, uniCharCode('0','0','0','f')
* will return 15, and uniCharCode('0','0','f','f') returns 255.
*
* Returns a negative number on error, if a char was invalid.
*
* This is implemented by noting that char2hex() returns -1 on error,
* which means the result of ORing the char2hex() will also be negative.
*/
function uniCharCode(a, b, c, d) {
	return char2hex(a) << 12 | char2hex(b) << 8 | char2hex(c) << 4 | char2hex(d);
}
/**
* Converts a hex character to its integer value.
* '0' becomes 0, '9' becomes 9
* 'A' becomes 10, 'F' becomes 15
* 'a' becomes 10, 'f' becomes 15
*
* Returns -1 on error.
*/
function char2hex(a) {
	return a >= 48 && a <= 57 ? a - 48 : a >= 65 && a <= 70 ? a - 55 : a >= 97 && a <= 102 ? a - 87 : -1;
}
/**
* Reads an alphanumeric + underscore name from the source.
*
* [_A-Za-z][_0-9A-Za-z]*
*/
function readName(source, start, line, col, prev) {
	var body = source.body;
	var bodyLength = body.length;
	var position = start + 1;
	var code = 0;
	while (position !== bodyLength && !isNaN(code = body.charCodeAt(position)) && (code === 95 || code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122)) ++position;
	return new Token(TokenKind.NAME, start, position, line, col, prev, body.slice(start, position));
}
function isNameStart(code) {
	return code === 95 || code >= 65 && code <= 90 || code >= 97 && code <= 122;
}
//#endregion
//#region node_modules/graphql/language/parser.mjs
/**
* Configuration options to control parser behavior
*/
/**
* Given a GraphQL source, parses it into a Document.
* Throws GraphQLError if a syntax error is encountered.
*/
function parse(source, options) {
	return new Parser(source, options).parseDocument();
}
/**
* This class is exported only to assist people in implementing their own parsers
* without duplicating too much code and should be used only as last resort for cases
* such as experimental syntax or if certain features could not be contributed upstream.
*
* It is still part of the internal API and is versioned, so any changes to it are never
* considered breaking changes. If you still need to support multiple versions of the
* library, please use the `versionInfo` variable for version detection.
*
* @internal
*/
var Parser = /* @__PURE__ */ function() {
	function Parser(source, options) {
		this._lexer = new Lexer(isSource(source) ? source : new Source(source));
		this._options = options;
	}
	/**
	* Converts a name lex token into a name parse node.
	*/
	var _proto = Parser.prototype;
	_proto.parseName = function parseName() {
		var token = this.expectToken(TokenKind.NAME);
		return {
			kind: Kind.NAME,
			value: token.value,
			loc: this.loc(token)
		};
	};
	_proto.parseDocument = function parseDocument() {
		var start = this._lexer.token;
		return {
			kind: Kind.DOCUMENT,
			definitions: this.many(TokenKind.SOF, this.parseDefinition, TokenKind.EOF),
			loc: this.loc(start)
		};
	};
	_proto.parseDefinition = function parseDefinition() {
		if (this.peek(TokenKind.NAME)) switch (this._lexer.token.value) {
			case "query":
			case "mutation":
			case "subscription": return this.parseOperationDefinition();
			case "fragment": return this.parseFragmentDefinition();
			case "schema":
			case "scalar":
			case "type":
			case "interface":
			case "union":
			case "enum":
			case "input":
			case "directive": return this.parseTypeSystemDefinition();
			case "extend": return this.parseTypeSystemExtension();
		}
		else if (this.peek(TokenKind.BRACE_L)) return this.parseOperationDefinition();
		else if (this.peekDescription()) return this.parseTypeSystemDefinition();
		throw this.unexpected();
	};
	_proto.parseOperationDefinition = function parseOperationDefinition() {
		var start = this._lexer.token;
		if (this.peek(TokenKind.BRACE_L)) return {
			kind: Kind.OPERATION_DEFINITION,
			operation: "query",
			name: void 0,
			variableDefinitions: [],
			directives: [],
			selectionSet: this.parseSelectionSet(),
			loc: this.loc(start)
		};
		var operation = this.parseOperationType();
		var name;
		if (this.peek(TokenKind.NAME)) name = this.parseName();
		return {
			kind: Kind.OPERATION_DEFINITION,
			operation,
			name,
			variableDefinitions: this.parseVariableDefinitions(),
			directives: this.parseDirectives(false),
			selectionSet: this.parseSelectionSet(),
			loc: this.loc(start)
		};
	};
	_proto.parseOperationType = function parseOperationType() {
		var operationToken = this.expectToken(TokenKind.NAME);
		switch (operationToken.value) {
			case "query": return "query";
			case "mutation": return "mutation";
			case "subscription": return "subscription";
		}
		throw this.unexpected(operationToken);
	};
	_proto.parseVariableDefinitions = function parseVariableDefinitions() {
		return this.optionalMany(TokenKind.PAREN_L, this.parseVariableDefinition, TokenKind.PAREN_R);
	};
	_proto.parseVariableDefinition = function parseVariableDefinition() {
		var start = this._lexer.token;
		return {
			kind: Kind.VARIABLE_DEFINITION,
			variable: this.parseVariable(),
			type: (this.expectToken(TokenKind.COLON), this.parseTypeReference()),
			defaultValue: this.expectOptionalToken(TokenKind.EQUALS) ? this.parseValueLiteral(true) : void 0,
			directives: this.parseDirectives(true),
			loc: this.loc(start)
		};
	};
	_proto.parseVariable = function parseVariable() {
		var start = this._lexer.token;
		this.expectToken(TokenKind.DOLLAR);
		return {
			kind: Kind.VARIABLE,
			name: this.parseName(),
			loc: this.loc(start)
		};
	};
	_proto.parseSelectionSet = function parseSelectionSet() {
		var start = this._lexer.token;
		return {
			kind: Kind.SELECTION_SET,
			selections: this.many(TokenKind.BRACE_L, this.parseSelection, TokenKind.BRACE_R),
			loc: this.loc(start)
		};
	};
	_proto.parseSelection = function parseSelection() {
		return this.peek(TokenKind.SPREAD) ? this.parseFragment() : this.parseField();
	};
	_proto.parseField = function parseField() {
		var start = this._lexer.token;
		var nameOrAlias = this.parseName();
		var alias;
		var name;
		if (this.expectOptionalToken(TokenKind.COLON)) {
			alias = nameOrAlias;
			name = this.parseName();
		} else name = nameOrAlias;
		return {
			kind: Kind.FIELD,
			alias,
			name,
			arguments: this.parseArguments(false),
			directives: this.parseDirectives(false),
			selectionSet: this.peek(TokenKind.BRACE_L) ? this.parseSelectionSet() : void 0,
			loc: this.loc(start)
		};
	};
	_proto.parseArguments = function parseArguments(isConst) {
		var item = isConst ? this.parseConstArgument : this.parseArgument;
		return this.optionalMany(TokenKind.PAREN_L, item, TokenKind.PAREN_R);
	};
	_proto.parseArgument = function parseArgument() {
		var start = this._lexer.token;
		var name = this.parseName();
		this.expectToken(TokenKind.COLON);
		return {
			kind: Kind.ARGUMENT,
			name,
			value: this.parseValueLiteral(false),
			loc: this.loc(start)
		};
	};
	_proto.parseConstArgument = function parseConstArgument() {
		var start = this._lexer.token;
		return {
			kind: Kind.ARGUMENT,
			name: this.parseName(),
			value: (this.expectToken(TokenKind.COLON), this.parseValueLiteral(true)),
			loc: this.loc(start)
		};
	};
	_proto.parseFragment = function parseFragment() {
		var start = this._lexer.token;
		this.expectToken(TokenKind.SPREAD);
		var hasTypeCondition = this.expectOptionalKeyword("on");
		if (!hasTypeCondition && this.peek(TokenKind.NAME)) return {
			kind: Kind.FRAGMENT_SPREAD,
			name: this.parseFragmentName(),
			directives: this.parseDirectives(false),
			loc: this.loc(start)
		};
		return {
			kind: Kind.INLINE_FRAGMENT,
			typeCondition: hasTypeCondition ? this.parseNamedType() : void 0,
			directives: this.parseDirectives(false),
			selectionSet: this.parseSelectionSet(),
			loc: this.loc(start)
		};
	};
	_proto.parseFragmentDefinition = function parseFragmentDefinition() {
		var _this$_options;
		var start = this._lexer.token;
		this.expectKeyword("fragment");
		if (((_this$_options = this._options) === null || _this$_options === void 0 ? void 0 : _this$_options.experimentalFragmentVariables) === true) return {
			kind: Kind.FRAGMENT_DEFINITION,
			name: this.parseFragmentName(),
			variableDefinitions: this.parseVariableDefinitions(),
			typeCondition: (this.expectKeyword("on"), this.parseNamedType()),
			directives: this.parseDirectives(false),
			selectionSet: this.parseSelectionSet(),
			loc: this.loc(start)
		};
		return {
			kind: Kind.FRAGMENT_DEFINITION,
			name: this.parseFragmentName(),
			typeCondition: (this.expectKeyword("on"), this.parseNamedType()),
			directives: this.parseDirectives(false),
			selectionSet: this.parseSelectionSet(),
			loc: this.loc(start)
		};
	};
	_proto.parseFragmentName = function parseFragmentName() {
		if (this._lexer.token.value === "on") throw this.unexpected();
		return this.parseName();
	};
	_proto.parseValueLiteral = function parseValueLiteral(isConst) {
		var token = this._lexer.token;
		switch (token.kind) {
			case TokenKind.BRACKET_L: return this.parseList(isConst);
			case TokenKind.BRACE_L: return this.parseObject(isConst);
			case TokenKind.INT:
				this._lexer.advance();
				return {
					kind: Kind.INT,
					value: token.value,
					loc: this.loc(token)
				};
			case TokenKind.FLOAT:
				this._lexer.advance();
				return {
					kind: Kind.FLOAT,
					value: token.value,
					loc: this.loc(token)
				};
			case TokenKind.STRING:
			case TokenKind.BLOCK_STRING: return this.parseStringLiteral();
			case TokenKind.NAME:
				this._lexer.advance();
				switch (token.value) {
					case "true": return {
						kind: Kind.BOOLEAN,
						value: true,
						loc: this.loc(token)
					};
					case "false": return {
						kind: Kind.BOOLEAN,
						value: false,
						loc: this.loc(token)
					};
					case "null": return {
						kind: Kind.NULL,
						loc: this.loc(token)
					};
					default: return {
						kind: Kind.ENUM,
						value: token.value,
						loc: this.loc(token)
					};
				}
			case TokenKind.DOLLAR:
				if (!isConst) return this.parseVariable();
				break;
		}
		throw this.unexpected();
	};
	_proto.parseStringLiteral = function parseStringLiteral() {
		var token = this._lexer.token;
		this._lexer.advance();
		return {
			kind: Kind.STRING,
			value: token.value,
			block: token.kind === TokenKind.BLOCK_STRING,
			loc: this.loc(token)
		};
	};
	_proto.parseList = function parseList(isConst) {
		var _this = this;
		var start = this._lexer.token;
		return {
			kind: Kind.LIST,
			values: this.any(TokenKind.BRACKET_L, function item() {
				return _this.parseValueLiteral(isConst);
			}, TokenKind.BRACKET_R),
			loc: this.loc(start)
		};
	};
	_proto.parseObject = function parseObject(isConst) {
		var _this2 = this;
		var start = this._lexer.token;
		return {
			kind: Kind.OBJECT,
			fields: this.any(TokenKind.BRACE_L, function item() {
				return _this2.parseObjectField(isConst);
			}, TokenKind.BRACE_R),
			loc: this.loc(start)
		};
	};
	_proto.parseObjectField = function parseObjectField(isConst) {
		var start = this._lexer.token;
		var name = this.parseName();
		this.expectToken(TokenKind.COLON);
		return {
			kind: Kind.OBJECT_FIELD,
			name,
			value: this.parseValueLiteral(isConst),
			loc: this.loc(start)
		};
	};
	_proto.parseDirectives = function parseDirectives(isConst) {
		var directives = [];
		while (this.peek(TokenKind.AT)) directives.push(this.parseDirective(isConst));
		return directives;
	};
	_proto.parseDirective = function parseDirective(isConst) {
		var start = this._lexer.token;
		this.expectToken(TokenKind.AT);
		return {
			kind: Kind.DIRECTIVE,
			name: this.parseName(),
			arguments: this.parseArguments(isConst),
			loc: this.loc(start)
		};
	};
	_proto.parseTypeReference = function parseTypeReference() {
		var start = this._lexer.token;
		var type;
		if (this.expectOptionalToken(TokenKind.BRACKET_L)) {
			type = this.parseTypeReference();
			this.expectToken(TokenKind.BRACKET_R);
			type = {
				kind: Kind.LIST_TYPE,
				type,
				loc: this.loc(start)
			};
		} else type = this.parseNamedType();
		if (this.expectOptionalToken(TokenKind.BANG)) return {
			kind: Kind.NON_NULL_TYPE,
			type,
			loc: this.loc(start)
		};
		return type;
	};
	_proto.parseNamedType = function parseNamedType() {
		var start = this._lexer.token;
		return {
			kind: Kind.NAMED_TYPE,
			name: this.parseName(),
			loc: this.loc(start)
		};
	};
	_proto.parseTypeSystemDefinition = function parseTypeSystemDefinition() {
		var keywordToken = this.peekDescription() ? this._lexer.lookahead() : this._lexer.token;
		if (keywordToken.kind === TokenKind.NAME) switch (keywordToken.value) {
			case "schema": return this.parseSchemaDefinition();
			case "scalar": return this.parseScalarTypeDefinition();
			case "type": return this.parseObjectTypeDefinition();
			case "interface": return this.parseInterfaceTypeDefinition();
			case "union": return this.parseUnionTypeDefinition();
			case "enum": return this.parseEnumTypeDefinition();
			case "input": return this.parseInputObjectTypeDefinition();
			case "directive": return this.parseDirectiveDefinition();
		}
		throw this.unexpected(keywordToken);
	};
	_proto.peekDescription = function peekDescription() {
		return this.peek(TokenKind.STRING) || this.peek(TokenKind.BLOCK_STRING);
	};
	_proto.parseDescription = function parseDescription() {
		if (this.peekDescription()) return this.parseStringLiteral();
	};
	_proto.parseSchemaDefinition = function parseSchemaDefinition() {
		var start = this._lexer.token;
		var description = this.parseDescription();
		this.expectKeyword("schema");
		var directives = this.parseDirectives(true);
		var operationTypes = this.many(TokenKind.BRACE_L, this.parseOperationTypeDefinition, TokenKind.BRACE_R);
		return {
			kind: Kind.SCHEMA_DEFINITION,
			description,
			directives,
			operationTypes,
			loc: this.loc(start)
		};
	};
	_proto.parseOperationTypeDefinition = function parseOperationTypeDefinition() {
		var start = this._lexer.token;
		var operation = this.parseOperationType();
		this.expectToken(TokenKind.COLON);
		var type = this.parseNamedType();
		return {
			kind: Kind.OPERATION_TYPE_DEFINITION,
			operation,
			type,
			loc: this.loc(start)
		};
	};
	_proto.parseScalarTypeDefinition = function parseScalarTypeDefinition() {
		var start = this._lexer.token;
		var description = this.parseDescription();
		this.expectKeyword("scalar");
		var name = this.parseName();
		var directives = this.parseDirectives(true);
		return {
			kind: Kind.SCALAR_TYPE_DEFINITION,
			description,
			name,
			directives,
			loc: this.loc(start)
		};
	};
	_proto.parseObjectTypeDefinition = function parseObjectTypeDefinition() {
		var start = this._lexer.token;
		var description = this.parseDescription();
		this.expectKeyword("type");
		var name = this.parseName();
		var interfaces = this.parseImplementsInterfaces();
		var directives = this.parseDirectives(true);
		var fields = this.parseFieldsDefinition();
		return {
			kind: Kind.OBJECT_TYPE_DEFINITION,
			description,
			name,
			interfaces,
			directives,
			fields,
			loc: this.loc(start)
		};
	};
	_proto.parseImplementsInterfaces = function parseImplementsInterfaces() {
		var _this$_options2;
		if (!this.expectOptionalKeyword("implements")) return [];
		if (((_this$_options2 = this._options) === null || _this$_options2 === void 0 ? void 0 : _this$_options2.allowLegacySDLImplementsInterfaces) === true) {
			var types = [];
			this.expectOptionalToken(TokenKind.AMP);
			do
				types.push(this.parseNamedType());
			while (this.expectOptionalToken(TokenKind.AMP) || this.peek(TokenKind.NAME));
			return types;
		}
		return this.delimitedMany(TokenKind.AMP, this.parseNamedType);
	};
	_proto.parseFieldsDefinition = function parseFieldsDefinition() {
		var _this$_options3;
		if (((_this$_options3 = this._options) === null || _this$_options3 === void 0 ? void 0 : _this$_options3.allowLegacySDLEmptyFields) === true && this.peek(TokenKind.BRACE_L) && this._lexer.lookahead().kind === TokenKind.BRACE_R) {
			this._lexer.advance();
			this._lexer.advance();
			return [];
		}
		return this.optionalMany(TokenKind.BRACE_L, this.parseFieldDefinition, TokenKind.BRACE_R);
	};
	_proto.parseFieldDefinition = function parseFieldDefinition() {
		var start = this._lexer.token;
		var description = this.parseDescription();
		var name = this.parseName();
		var args = this.parseArgumentDefs();
		this.expectToken(TokenKind.COLON);
		var type = this.parseTypeReference();
		var directives = this.parseDirectives(true);
		return {
			kind: Kind.FIELD_DEFINITION,
			description,
			name,
			arguments: args,
			type,
			directives,
			loc: this.loc(start)
		};
	};
	_proto.parseArgumentDefs = function parseArgumentDefs() {
		return this.optionalMany(TokenKind.PAREN_L, this.parseInputValueDef, TokenKind.PAREN_R);
	};
	_proto.parseInputValueDef = function parseInputValueDef() {
		var start = this._lexer.token;
		var description = this.parseDescription();
		var name = this.parseName();
		this.expectToken(TokenKind.COLON);
		var type = this.parseTypeReference();
		var defaultValue;
		if (this.expectOptionalToken(TokenKind.EQUALS)) defaultValue = this.parseValueLiteral(true);
		var directives = this.parseDirectives(true);
		return {
			kind: Kind.INPUT_VALUE_DEFINITION,
			description,
			name,
			type,
			defaultValue,
			directives,
			loc: this.loc(start)
		};
	};
	_proto.parseInterfaceTypeDefinition = function parseInterfaceTypeDefinition() {
		var start = this._lexer.token;
		var description = this.parseDescription();
		this.expectKeyword("interface");
		var name = this.parseName();
		var interfaces = this.parseImplementsInterfaces();
		var directives = this.parseDirectives(true);
		var fields = this.parseFieldsDefinition();
		return {
			kind: Kind.INTERFACE_TYPE_DEFINITION,
			description,
			name,
			interfaces,
			directives,
			fields,
			loc: this.loc(start)
		};
	};
	_proto.parseUnionTypeDefinition = function parseUnionTypeDefinition() {
		var start = this._lexer.token;
		var description = this.parseDescription();
		this.expectKeyword("union");
		var name = this.parseName();
		var directives = this.parseDirectives(true);
		var types = this.parseUnionMemberTypes();
		return {
			kind: Kind.UNION_TYPE_DEFINITION,
			description,
			name,
			directives,
			types,
			loc: this.loc(start)
		};
	};
	_proto.parseUnionMemberTypes = function parseUnionMemberTypes() {
		return this.expectOptionalToken(TokenKind.EQUALS) ? this.delimitedMany(TokenKind.PIPE, this.parseNamedType) : [];
	};
	_proto.parseEnumTypeDefinition = function parseEnumTypeDefinition() {
		var start = this._lexer.token;
		var description = this.parseDescription();
		this.expectKeyword("enum");
		var name = this.parseName();
		var directives = this.parseDirectives(true);
		var values = this.parseEnumValuesDefinition();
		return {
			kind: Kind.ENUM_TYPE_DEFINITION,
			description,
			name,
			directives,
			values,
			loc: this.loc(start)
		};
	};
	_proto.parseEnumValuesDefinition = function parseEnumValuesDefinition() {
		return this.optionalMany(TokenKind.BRACE_L, this.parseEnumValueDefinition, TokenKind.BRACE_R);
	};
	_proto.parseEnumValueDefinition = function parseEnumValueDefinition() {
		var start = this._lexer.token;
		var description = this.parseDescription();
		var name = this.parseName();
		var directives = this.parseDirectives(true);
		return {
			kind: Kind.ENUM_VALUE_DEFINITION,
			description,
			name,
			directives,
			loc: this.loc(start)
		};
	};
	_proto.parseInputObjectTypeDefinition = function parseInputObjectTypeDefinition() {
		var start = this._lexer.token;
		var description = this.parseDescription();
		this.expectKeyword("input");
		var name = this.parseName();
		var directives = this.parseDirectives(true);
		var fields = this.parseInputFieldsDefinition();
		return {
			kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
			description,
			name,
			directives,
			fields,
			loc: this.loc(start)
		};
	};
	_proto.parseInputFieldsDefinition = function parseInputFieldsDefinition() {
		return this.optionalMany(TokenKind.BRACE_L, this.parseInputValueDef, TokenKind.BRACE_R);
	};
	_proto.parseTypeSystemExtension = function parseTypeSystemExtension() {
		var keywordToken = this._lexer.lookahead();
		if (keywordToken.kind === TokenKind.NAME) switch (keywordToken.value) {
			case "schema": return this.parseSchemaExtension();
			case "scalar": return this.parseScalarTypeExtension();
			case "type": return this.parseObjectTypeExtension();
			case "interface": return this.parseInterfaceTypeExtension();
			case "union": return this.parseUnionTypeExtension();
			case "enum": return this.parseEnumTypeExtension();
			case "input": return this.parseInputObjectTypeExtension();
		}
		throw this.unexpected(keywordToken);
	};
	_proto.parseSchemaExtension = function parseSchemaExtension() {
		var start = this._lexer.token;
		this.expectKeyword("extend");
		this.expectKeyword("schema");
		var directives = this.parseDirectives(true);
		var operationTypes = this.optionalMany(TokenKind.BRACE_L, this.parseOperationTypeDefinition, TokenKind.BRACE_R);
		if (directives.length === 0 && operationTypes.length === 0) throw this.unexpected();
		return {
			kind: Kind.SCHEMA_EXTENSION,
			directives,
			operationTypes,
			loc: this.loc(start)
		};
	};
	_proto.parseScalarTypeExtension = function parseScalarTypeExtension() {
		var start = this._lexer.token;
		this.expectKeyword("extend");
		this.expectKeyword("scalar");
		var name = this.parseName();
		var directives = this.parseDirectives(true);
		if (directives.length === 0) throw this.unexpected();
		return {
			kind: Kind.SCALAR_TYPE_EXTENSION,
			name,
			directives,
			loc: this.loc(start)
		};
	};
	_proto.parseObjectTypeExtension = function parseObjectTypeExtension() {
		var start = this._lexer.token;
		this.expectKeyword("extend");
		this.expectKeyword("type");
		var name = this.parseName();
		var interfaces = this.parseImplementsInterfaces();
		var directives = this.parseDirectives(true);
		var fields = this.parseFieldsDefinition();
		if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) throw this.unexpected();
		return {
			kind: Kind.OBJECT_TYPE_EXTENSION,
			name,
			interfaces,
			directives,
			fields,
			loc: this.loc(start)
		};
	};
	_proto.parseInterfaceTypeExtension = function parseInterfaceTypeExtension() {
		var start = this._lexer.token;
		this.expectKeyword("extend");
		this.expectKeyword("interface");
		var name = this.parseName();
		var interfaces = this.parseImplementsInterfaces();
		var directives = this.parseDirectives(true);
		var fields = this.parseFieldsDefinition();
		if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) throw this.unexpected();
		return {
			kind: Kind.INTERFACE_TYPE_EXTENSION,
			name,
			interfaces,
			directives,
			fields,
			loc: this.loc(start)
		};
	};
	_proto.parseUnionTypeExtension = function parseUnionTypeExtension() {
		var start = this._lexer.token;
		this.expectKeyword("extend");
		this.expectKeyword("union");
		var name = this.parseName();
		var directives = this.parseDirectives(true);
		var types = this.parseUnionMemberTypes();
		if (directives.length === 0 && types.length === 0) throw this.unexpected();
		return {
			kind: Kind.UNION_TYPE_EXTENSION,
			name,
			directives,
			types,
			loc: this.loc(start)
		};
	};
	_proto.parseEnumTypeExtension = function parseEnumTypeExtension() {
		var start = this._lexer.token;
		this.expectKeyword("extend");
		this.expectKeyword("enum");
		var name = this.parseName();
		var directives = this.parseDirectives(true);
		var values = this.parseEnumValuesDefinition();
		if (directives.length === 0 && values.length === 0) throw this.unexpected();
		return {
			kind: Kind.ENUM_TYPE_EXTENSION,
			name,
			directives,
			values,
			loc: this.loc(start)
		};
	};
	_proto.parseInputObjectTypeExtension = function parseInputObjectTypeExtension() {
		var start = this._lexer.token;
		this.expectKeyword("extend");
		this.expectKeyword("input");
		var name = this.parseName();
		var directives = this.parseDirectives(true);
		var fields = this.parseInputFieldsDefinition();
		if (directives.length === 0 && fields.length === 0) throw this.unexpected();
		return {
			kind: Kind.INPUT_OBJECT_TYPE_EXTENSION,
			name,
			directives,
			fields,
			loc: this.loc(start)
		};
	};
	_proto.parseDirectiveDefinition = function parseDirectiveDefinition() {
		var start = this._lexer.token;
		var description = this.parseDescription();
		this.expectKeyword("directive");
		this.expectToken(TokenKind.AT);
		var name = this.parseName();
		var args = this.parseArgumentDefs();
		var repeatable = this.expectOptionalKeyword("repeatable");
		this.expectKeyword("on");
		var locations = this.parseDirectiveLocations();
		return {
			kind: Kind.DIRECTIVE_DEFINITION,
			description,
			name,
			arguments: args,
			repeatable,
			locations,
			loc: this.loc(start)
		};
	};
	_proto.parseDirectiveLocations = function parseDirectiveLocations() {
		return this.delimitedMany(TokenKind.PIPE, this.parseDirectiveLocation);
	};
	_proto.parseDirectiveLocation = function parseDirectiveLocation() {
		var start = this._lexer.token;
		var name = this.parseName();
		if (DirectiveLocation[name.value] !== void 0) return name;
		throw this.unexpected(start);
	};
	_proto.loc = function loc(startToken) {
		var _this$_options4;
		if (((_this$_options4 = this._options) === null || _this$_options4 === void 0 ? void 0 : _this$_options4.noLocation) !== true) return new Location(startToken, this._lexer.lastToken, this._lexer.source);
	};
	_proto.peek = function peek(kind) {
		return this._lexer.token.kind === kind;
	};
	_proto.expectToken = function expectToken(kind) {
		var token = this._lexer.token;
		if (token.kind === kind) {
			this._lexer.advance();
			return token;
		}
		throw syntaxError(this._lexer.source, token.start, "Expected ".concat(getTokenKindDesc(kind), ", found ").concat(getTokenDesc(token), "."));
	};
	_proto.expectOptionalToken = function expectOptionalToken(kind) {
		var token = this._lexer.token;
		if (token.kind === kind) {
			this._lexer.advance();
			return token;
		}
	};
	_proto.expectKeyword = function expectKeyword(value) {
		var token = this._lexer.token;
		if (token.kind === TokenKind.NAME && token.value === value) this._lexer.advance();
		else throw syntaxError(this._lexer.source, token.start, "Expected \"".concat(value, "\", found ").concat(getTokenDesc(token), "."));
	};
	_proto.expectOptionalKeyword = function expectOptionalKeyword(value) {
		var token = this._lexer.token;
		if (token.kind === TokenKind.NAME && token.value === value) {
			this._lexer.advance();
			return true;
		}
		return false;
	};
	_proto.unexpected = function unexpected(atToken) {
		var token = atToken !== null && atToken !== void 0 ? atToken : this._lexer.token;
		return syntaxError(this._lexer.source, token.start, "Unexpected ".concat(getTokenDesc(token), "."));
	};
	_proto.any = function any(openKind, parseFn, closeKind) {
		this.expectToken(openKind);
		var nodes = [];
		while (!this.expectOptionalToken(closeKind)) nodes.push(parseFn.call(this));
		return nodes;
	};
	_proto.optionalMany = function optionalMany(openKind, parseFn, closeKind) {
		if (this.expectOptionalToken(openKind)) {
			var nodes = [];
			do
				nodes.push(parseFn.call(this));
			while (!this.expectOptionalToken(closeKind));
			return nodes;
		}
		return [];
	};
	_proto.many = function many(openKind, parseFn, closeKind) {
		this.expectToken(openKind);
		var nodes = [];
		do
			nodes.push(parseFn.call(this));
		while (!this.expectOptionalToken(closeKind));
		return nodes;
	};
	_proto.delimitedMany = function delimitedMany(delimiterKind, parseFn) {
		this.expectOptionalToken(delimiterKind);
		var nodes = [];
		do
			nodes.push(parseFn.call(this));
		while (this.expectOptionalToken(delimiterKind));
		return nodes;
	};
	return Parser;
}();
/**
* A helper function to describe a token as a string for debugging.
*/
function getTokenDesc(token) {
	var value = token.value;
	return getTokenKindDesc(token.kind) + (value != null ? " \"".concat(value, "\"") : "");
}
/**
* A helper function to describe a token kind as a string for debugging.
*/
function getTokenKindDesc(kind) {
	return isPunctuatorTokenKind(kind) ? "\"".concat(kind, "\"") : kind;
}
//#endregion
//#region node_modules/graphql/language/visitor.mjs
/**
* A visitor is provided to visit, it contains the collection of
* relevant functions to be called during the visitor's traversal.
*/
var QueryDocumentKeys = {
	Name: [],
	Document: ["definitions"],
	OperationDefinition: [
		"name",
		"variableDefinitions",
		"directives",
		"selectionSet"
	],
	VariableDefinition: [
		"variable",
		"type",
		"defaultValue",
		"directives"
	],
	Variable: ["name"],
	SelectionSet: ["selections"],
	Field: [
		"alias",
		"name",
		"arguments",
		"directives",
		"selectionSet"
	],
	Argument: ["name", "value"],
	FragmentSpread: ["name", "directives"],
	InlineFragment: [
		"typeCondition",
		"directives",
		"selectionSet"
	],
	FragmentDefinition: [
		"name",
		"variableDefinitions",
		"typeCondition",
		"directives",
		"selectionSet"
	],
	IntValue: [],
	FloatValue: [],
	StringValue: [],
	BooleanValue: [],
	NullValue: [],
	EnumValue: [],
	ListValue: ["values"],
	ObjectValue: ["fields"],
	ObjectField: ["name", "value"],
	Directive: ["name", "arguments"],
	NamedType: ["name"],
	ListType: ["type"],
	NonNullType: ["type"],
	SchemaDefinition: [
		"description",
		"directives",
		"operationTypes"
	],
	OperationTypeDefinition: ["type"],
	ScalarTypeDefinition: [
		"description",
		"name",
		"directives"
	],
	ObjectTypeDefinition: [
		"description",
		"name",
		"interfaces",
		"directives",
		"fields"
	],
	FieldDefinition: [
		"description",
		"name",
		"arguments",
		"type",
		"directives"
	],
	InputValueDefinition: [
		"description",
		"name",
		"type",
		"defaultValue",
		"directives"
	],
	InterfaceTypeDefinition: [
		"description",
		"name",
		"interfaces",
		"directives",
		"fields"
	],
	UnionTypeDefinition: [
		"description",
		"name",
		"directives",
		"types"
	],
	EnumTypeDefinition: [
		"description",
		"name",
		"directives",
		"values"
	],
	EnumValueDefinition: [
		"description",
		"name",
		"directives"
	],
	InputObjectTypeDefinition: [
		"description",
		"name",
		"directives",
		"fields"
	],
	DirectiveDefinition: [
		"description",
		"name",
		"arguments",
		"locations"
	],
	SchemaExtension: ["directives", "operationTypes"],
	ScalarTypeExtension: ["name", "directives"],
	ObjectTypeExtension: [
		"name",
		"interfaces",
		"directives",
		"fields"
	],
	InterfaceTypeExtension: [
		"name",
		"interfaces",
		"directives",
		"fields"
	],
	UnionTypeExtension: [
		"name",
		"directives",
		"types"
	],
	EnumTypeExtension: [
		"name",
		"directives",
		"values"
	],
	InputObjectTypeExtension: [
		"name",
		"directives",
		"fields"
	]
};
var BREAK = Object.freeze({});
/**
* visit() will walk through an AST using a depth-first traversal, calling
* the visitor's enter function at each node in the traversal, and calling the
* leave function after visiting that node and all of its child nodes.
*
* By returning different values from the enter and leave functions, the
* behavior of the visitor can be altered, including skipping over a sub-tree of
* the AST (by returning false), editing the AST by returning a value or null
* to remove the value, or to stop the whole traversal by returning BREAK.
*
* When using visit() to edit an AST, the original AST will not be modified, and
* a new version of the AST with the changes applied will be returned from the
* visit function.
*
*     const editedAST = visit(ast, {
*       enter(node, key, parent, path, ancestors) {
*         // @return
*         //   undefined: no action
*         //   false: skip visiting this node
*         //   visitor.BREAK: stop visiting altogether
*         //   null: delete this node
*         //   any value: replace this node with the returned value
*       },
*       leave(node, key, parent, path, ancestors) {
*         // @return
*         //   undefined: no action
*         //   false: no action
*         //   visitor.BREAK: stop visiting altogether
*         //   null: delete this node
*         //   any value: replace this node with the returned value
*       }
*     });
*
* Alternatively to providing enter() and leave() functions, a visitor can
* instead provide functions named the same as the kinds of AST nodes, or
* enter/leave visitors at a named key, leading to four permutations of the
* visitor API:
*
* 1) Named visitors triggered when entering a node of a specific kind.
*
*     visit(ast, {
*       Kind(node) {
*         // enter the "Kind" node
*       }
*     })
*
* 2) Named visitors that trigger upon entering and leaving a node of
*    a specific kind.
*
*     visit(ast, {
*       Kind: {
*         enter(node) {
*           // enter the "Kind" node
*         }
*         leave(node) {
*           // leave the "Kind" node
*         }
*       }
*     })
*
* 3) Generic visitors that trigger upon entering and leaving any node.
*
*     visit(ast, {
*       enter(node) {
*         // enter any node
*       },
*       leave(node) {
*         // leave any node
*       }
*     })
*
* 4) Parallel visitors for entering and leaving nodes of a specific kind.
*
*     visit(ast, {
*       enter: {
*         Kind(node) {
*           // enter the "Kind" node
*         }
*       },
*       leave: {
*         Kind(node) {
*           // leave the "Kind" node
*         }
*       }
*     })
*/
function visit(root, visitor) {
	var visitorKeys = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : QueryDocumentKeys;
	var stack = void 0;
	var inArray = Array.isArray(root);
	var keys = [root];
	var index = -1;
	var edits = [];
	var node = void 0;
	var key = void 0;
	var parent = void 0;
	var path = [];
	var ancestors = [];
	var newRoot = root;
	do {
		index++;
		var isLeaving = index === keys.length;
		var isEdited = isLeaving && edits.length !== 0;
		if (isLeaving) {
			key = ancestors.length === 0 ? void 0 : path[path.length - 1];
			node = parent;
			parent = ancestors.pop();
			if (isEdited) {
				if (inArray) node = node.slice();
				else {
					var clone = {};
					for (var _i2 = 0, _Object$keys2 = Object.keys(node); _i2 < _Object$keys2.length; _i2++) {
						var k = _Object$keys2[_i2];
						clone[k] = node[k];
					}
					node = clone;
				}
				var editOffset = 0;
				for (var ii = 0; ii < edits.length; ii++) {
					var editKey = edits[ii][0];
					var editValue = edits[ii][1];
					if (inArray) editKey -= editOffset;
					if (inArray && editValue === null) {
						node.splice(editKey, 1);
						editOffset++;
					} else node[editKey] = editValue;
				}
			}
			index = stack.index;
			keys = stack.keys;
			edits = stack.edits;
			inArray = stack.inArray;
			stack = stack.prev;
		} else {
			key = parent ? inArray ? index : keys[index] : void 0;
			node = parent ? parent[key] : newRoot;
			if (node === null || node === void 0) continue;
			if (parent) path.push(key);
		}
		var result = void 0;
		if (!Array.isArray(node)) {
			if (!isNode(node)) throw new Error("Invalid AST Node: ".concat(inspect(node), "."));
			var visitFn = getVisitFn(visitor, node.kind, isLeaving);
			if (visitFn) {
				result = visitFn.call(visitor, node, key, parent, path, ancestors);
				if (result === BREAK) break;
				if (result === false) {
					if (!isLeaving) {
						path.pop();
						continue;
					}
				} else if (result !== void 0) {
					edits.push([key, result]);
					if (!isLeaving) if (isNode(result)) node = result;
					else {
						path.pop();
						continue;
					}
				}
			}
		}
		if (result === void 0 && isEdited) edits.push([key, node]);
		if (isLeaving) path.pop();
		else {
			var _visitorKeys$node$kin;
			stack = {
				inArray,
				index,
				keys,
				edits,
				prev: stack
			};
			inArray = Array.isArray(node);
			keys = inArray ? node : (_visitorKeys$node$kin = visitorKeys[node.kind]) !== null && _visitorKeys$node$kin !== void 0 ? _visitorKeys$node$kin : [];
			index = -1;
			edits = [];
			if (parent) ancestors.push(parent);
			parent = node;
		}
	} while (stack !== void 0);
	if (edits.length !== 0) newRoot = edits[edits.length - 1][1];
	return newRoot;
}
/**
* Given a visitor instance, if it is leaving or not, and a node kind, return
* the function the visitor runtime should call.
*/
function getVisitFn(visitor, kind, isLeaving) {
	var kindVisitor = visitor[kind];
	if (kindVisitor) {
		if (!isLeaving && typeof kindVisitor === "function") return kindVisitor;
		var kindSpecificVisitor = isLeaving ? kindVisitor.leave : kindVisitor.enter;
		if (typeof kindSpecificVisitor === "function") return kindSpecificVisitor;
	} else {
		var specificVisitor = isLeaving ? visitor.leave : visitor.enter;
		if (specificVisitor) {
			if (typeof specificVisitor === "function") return specificVisitor;
			var specificKindVisitor = specificVisitor[kind];
			if (typeof specificKindVisitor === "function") return specificKindVisitor;
		}
	}
}
//#endregion
//#region node_modules/graphql/language/printer.mjs
/**
* Converts an AST into a string, using one set of reasonable
* formatting rules.
*/
function print(ast) {
	return visit(ast, { leave: printDocASTReducer });
}
var MAX_LINE_LENGTH = 80;
var printDocASTReducer = {
	Name: function Name(node) {
		return node.value;
	},
	Variable: function Variable(node) {
		return "$" + node.name;
	},
	Document: function Document(node) {
		return join(node.definitions, "\n\n") + "\n";
	},
	OperationDefinition: function OperationDefinition(node) {
		var op = node.operation;
		var name = node.name;
		var varDefs = wrap("(", join(node.variableDefinitions, ", "), ")");
		var directives = join(node.directives, " ");
		var selectionSet = node.selectionSet;
		return !name && !directives && !varDefs && op === "query" ? selectionSet : join([
			op,
			join([name, varDefs]),
			directives,
			selectionSet
		], " ");
	},
	VariableDefinition: function VariableDefinition(_ref) {
		var variable = _ref.variable, type = _ref.type, defaultValue = _ref.defaultValue, directives = _ref.directives;
		return variable + ": " + type + wrap(" = ", defaultValue) + wrap(" ", join(directives, " "));
	},
	SelectionSet: function SelectionSet(_ref2) {
		var selections = _ref2.selections;
		return block(selections);
	},
	Field: function Field(_ref3) {
		var alias = _ref3.alias, name = _ref3.name, args = _ref3.arguments, directives = _ref3.directives, selectionSet = _ref3.selectionSet;
		var prefix = wrap("", alias, ": ") + name;
		var argsLine = prefix + wrap("(", join(args, ", "), ")");
		if (argsLine.length > MAX_LINE_LENGTH) argsLine = prefix + wrap("(\n", indent(join(args, "\n")), "\n)");
		return join([
			argsLine,
			join(directives, " "),
			selectionSet
		], " ");
	},
	Argument: function Argument(_ref4) {
		var name = _ref4.name, value = _ref4.value;
		return name + ": " + value;
	},
	FragmentSpread: function FragmentSpread(_ref5) {
		var name = _ref5.name, directives = _ref5.directives;
		return "..." + name + wrap(" ", join(directives, " "));
	},
	InlineFragment: function InlineFragment(_ref6) {
		var typeCondition = _ref6.typeCondition, directives = _ref6.directives, selectionSet = _ref6.selectionSet;
		return join([
			"...",
			wrap("on ", typeCondition),
			join(directives, " "),
			selectionSet
		], " ");
	},
	FragmentDefinition: function FragmentDefinition(_ref7) {
		var name = _ref7.name, typeCondition = _ref7.typeCondition, variableDefinitions = _ref7.variableDefinitions, directives = _ref7.directives, selectionSet = _ref7.selectionSet;
		return "fragment ".concat(name).concat(wrap("(", join(variableDefinitions, ", "), ")"), " ") + "on ".concat(typeCondition, " ").concat(wrap("", join(directives, " "), " ")) + selectionSet;
	},
	IntValue: function IntValue(_ref8) {
		return _ref8.value;
	},
	FloatValue: function FloatValue(_ref9) {
		return _ref9.value;
	},
	StringValue: function StringValue(_ref10, key) {
		var value = _ref10.value;
		return _ref10.block ? printBlockString(value, key === "description" ? "" : "  ") : JSON.stringify(value);
	},
	BooleanValue: function BooleanValue(_ref11) {
		return _ref11.value ? "true" : "false";
	},
	NullValue: function NullValue() {
		return "null";
	},
	EnumValue: function EnumValue(_ref12) {
		return _ref12.value;
	},
	ListValue: function ListValue(_ref13) {
		var values = _ref13.values;
		return "[" + join(values, ", ") + "]";
	},
	ObjectValue: function ObjectValue(_ref14) {
		var fields = _ref14.fields;
		return "{" + join(fields, ", ") + "}";
	},
	ObjectField: function ObjectField(_ref15) {
		var name = _ref15.name, value = _ref15.value;
		return name + ": " + value;
	},
	Directive: function Directive(_ref16) {
		var name = _ref16.name, args = _ref16.arguments;
		return "@" + name + wrap("(", join(args, ", "), ")");
	},
	NamedType: function NamedType(_ref17) {
		return _ref17.name;
	},
	ListType: function ListType(_ref18) {
		return "[" + _ref18.type + "]";
	},
	NonNullType: function NonNullType(_ref19) {
		return _ref19.type + "!";
	},
	SchemaDefinition: addDescription(function(_ref20) {
		var directives = _ref20.directives, operationTypes = _ref20.operationTypes;
		return join([
			"schema",
			join(directives, " "),
			block(operationTypes)
		], " ");
	}),
	OperationTypeDefinition: function OperationTypeDefinition(_ref21) {
		var operation = _ref21.operation, type = _ref21.type;
		return operation + ": " + type;
	},
	ScalarTypeDefinition: addDescription(function(_ref22) {
		var name = _ref22.name, directives = _ref22.directives;
		return join([
			"scalar",
			name,
			join(directives, " ")
		], " ");
	}),
	ObjectTypeDefinition: addDescription(function(_ref23) {
		var name = _ref23.name, interfaces = _ref23.interfaces, directives = _ref23.directives, fields = _ref23.fields;
		return join([
			"type",
			name,
			wrap("implements ", join(interfaces, " & ")),
			join(directives, " "),
			block(fields)
		], " ");
	}),
	FieldDefinition: addDescription(function(_ref24) {
		var name = _ref24.name, args = _ref24.arguments, type = _ref24.type, directives = _ref24.directives;
		return name + (hasMultilineItems(args) ? wrap("(\n", indent(join(args, "\n")), "\n)") : wrap("(", join(args, ", "), ")")) + ": " + type + wrap(" ", join(directives, " "));
	}),
	InputValueDefinition: addDescription(function(_ref25) {
		var name = _ref25.name, type = _ref25.type, defaultValue = _ref25.defaultValue, directives = _ref25.directives;
		return join([
			name + ": " + type,
			wrap("= ", defaultValue),
			join(directives, " ")
		], " ");
	}),
	InterfaceTypeDefinition: addDescription(function(_ref26) {
		var name = _ref26.name, interfaces = _ref26.interfaces, directives = _ref26.directives, fields = _ref26.fields;
		return join([
			"interface",
			name,
			wrap("implements ", join(interfaces, " & ")),
			join(directives, " "),
			block(fields)
		], " ");
	}),
	UnionTypeDefinition: addDescription(function(_ref27) {
		var name = _ref27.name, directives = _ref27.directives, types = _ref27.types;
		return join([
			"union",
			name,
			join(directives, " "),
			types && types.length !== 0 ? "= " + join(types, " | ") : ""
		], " ");
	}),
	EnumTypeDefinition: addDescription(function(_ref28) {
		var name = _ref28.name, directives = _ref28.directives, values = _ref28.values;
		return join([
			"enum",
			name,
			join(directives, " "),
			block(values)
		], " ");
	}),
	EnumValueDefinition: addDescription(function(_ref29) {
		var name = _ref29.name, directives = _ref29.directives;
		return join([name, join(directives, " ")], " ");
	}),
	InputObjectTypeDefinition: addDescription(function(_ref30) {
		var name = _ref30.name, directives = _ref30.directives, fields = _ref30.fields;
		return join([
			"input",
			name,
			join(directives, " "),
			block(fields)
		], " ");
	}),
	DirectiveDefinition: addDescription(function(_ref31) {
		var name = _ref31.name, args = _ref31.arguments, repeatable = _ref31.repeatable, locations = _ref31.locations;
		return "directive @" + name + (hasMultilineItems(args) ? wrap("(\n", indent(join(args, "\n")), "\n)") : wrap("(", join(args, ", "), ")")) + (repeatable ? " repeatable" : "") + " on " + join(locations, " | ");
	}),
	SchemaExtension: function SchemaExtension(_ref32) {
		var directives = _ref32.directives, operationTypes = _ref32.operationTypes;
		return join([
			"extend schema",
			join(directives, " "),
			block(operationTypes)
		], " ");
	},
	ScalarTypeExtension: function ScalarTypeExtension(_ref33) {
		var name = _ref33.name, directives = _ref33.directives;
		return join([
			"extend scalar",
			name,
			join(directives, " ")
		], " ");
	},
	ObjectTypeExtension: function ObjectTypeExtension(_ref34) {
		var name = _ref34.name, interfaces = _ref34.interfaces, directives = _ref34.directives, fields = _ref34.fields;
		return join([
			"extend type",
			name,
			wrap("implements ", join(interfaces, " & ")),
			join(directives, " "),
			block(fields)
		], " ");
	},
	InterfaceTypeExtension: function InterfaceTypeExtension(_ref35) {
		var name = _ref35.name, interfaces = _ref35.interfaces, directives = _ref35.directives, fields = _ref35.fields;
		return join([
			"extend interface",
			name,
			wrap("implements ", join(interfaces, " & ")),
			join(directives, " "),
			block(fields)
		], " ");
	},
	UnionTypeExtension: function UnionTypeExtension(_ref36) {
		var name = _ref36.name, directives = _ref36.directives, types = _ref36.types;
		return join([
			"extend union",
			name,
			join(directives, " "),
			types && types.length !== 0 ? "= " + join(types, " | ") : ""
		], " ");
	},
	EnumTypeExtension: function EnumTypeExtension(_ref37) {
		var name = _ref37.name, directives = _ref37.directives, values = _ref37.values;
		return join([
			"extend enum",
			name,
			join(directives, " "),
			block(values)
		], " ");
	},
	InputObjectTypeExtension: function InputObjectTypeExtension(_ref38) {
		var name = _ref38.name, directives = _ref38.directives, fields = _ref38.fields;
		return join([
			"extend input",
			name,
			join(directives, " "),
			block(fields)
		], " ");
	}
};
function addDescription(cb) {
	return function(node) {
		return join([node.description, cb(node)], "\n");
	};
}
/**
* Given maybeArray, print an empty string if it is null or empty, otherwise
* print all items together separated by separator if provided
*/
function join(maybeArray) {
	var _maybeArray$filter$jo;
	var separator = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "";
	return (_maybeArray$filter$jo = maybeArray === null || maybeArray === void 0 ? void 0 : maybeArray.filter(function(x) {
		return x;
	}).join(separator)) !== null && _maybeArray$filter$jo !== void 0 ? _maybeArray$filter$jo : "";
}
/**
* Given array, print each item on its own line, wrapped in an
* indented "{ }" block.
*/
function block(array) {
	return wrap("{\n", indent(join(array, "\n")), "\n}");
}
/**
* If maybeString is not null or empty, then wrap with start and end, otherwise print an empty string.
*/
function wrap(start, maybeString) {
	var end = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "";
	return maybeString != null && maybeString !== "" ? start + maybeString + end : "";
}
function indent(str) {
	return wrap("  ", str.replace(/\n/g, "\n  "));
}
function isMultiline(str) {
	return str.indexOf("\n") !== -1;
}
function hasMultilineItems(maybeArray) {
	return maybeArray != null && maybeArray.some(isMultiline);
}
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/errors/RestApiError.mjs
var RestApiError = class RestApiError extends ApiError {
	constructor(params) {
		super(params);
		this.constructor = RestApiError;
		Object.setPrototypeOf(this, RestApiError.prototype);
	}
};
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/errors/CanceledError.mjs
/**
* Internal-only class for CanceledError.
*
* @internal
*/
var CanceledError = class CanceledError extends RestApiError {
	constructor(params = {}) {
		super({
			name: "CanceledError",
			message: "Request is canceled by user",
			...params
		});
		this.constructor = CanceledError;
		Object.setPrototypeOf(this, CanceledError.prototype);
	}
};
/**
* Check if an error is caused by user calling `cancel()` in REST API.
*
* @note This function works **ONLY** for errors thrown by REST API. For GraphQL APIs, use `client.isCancelError(error)`
*   instead. `client` is generated from  `generateClient()` API from `aws-amplify/api`.
*
* @param {unknown} error The unknown exception to be checked.
* @returns - A boolean indicating if the error was from an upload cancellation
*/
var isCancelError = (error) => !!error && error instanceof CanceledError;
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/errors/validation.mjs
var RestApiValidationErrorCode;
(function(RestApiValidationErrorCode) {
	RestApiValidationErrorCode["InvalidApiName"] = "InvalidApiName";
})(RestApiValidationErrorCode || (RestApiValidationErrorCode = {}));
var validationErrorMap$1 = { [RestApiValidationErrorCode.InvalidApiName]: {
	message: "API name is invalid.",
	recoverySuggestion: "Check if the API name matches the one in your configuration or `aws-exports.js`"
} };
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/utils/serviceError.mjs
/**
* Parses both AWS and non-AWS error responses coming from the users' backend code.
* * AWS errors generated by the AWS services(e.g. API Gateway, Bedrock). They can be Signature errors,
*   ClockSkew errors, etc. These responses will be parsed to errors with proper name and message from the AWS
*   services.
* * non-AWS errors thrown by the user code. They can contain any headers or body. Users need to access the
*   error.response to get the headers and body and parse them accordingly. The JS error name and message will
*   be `UnknownError` and `Unknown error` respectively.
*/
var parseRestApiServiceError = async (response) => {
	if (!response) return;
	const parsedAwsError = await parseJsonError(stubErrorResponse(response));
	if (!parsedAwsError);
	else {
		const bodyText = await response.body?.text();
		return buildRestApiError(parsedAwsError, {
			statusCode: response.statusCode,
			headers: response.headers,
			body: bodyText
		});
	}
};
/**
* The response object needs to be stub here because the parseAwsJsonError assumes the response body to be valid JSON.
* Although this is true for AWS services, it is not true for responses from user's code. Once the response body is
* unwrapped as JSON(and fail), it cannot be read as text again. Therefore, we need to stub the response body here to
* make sure we can read the error response body as a JSON, and may fall back to read as text if it is not a valid JSON.
*/
var stubErrorResponse = (response) => {
	let bodyTextPromise;
	const bodyProxy = new Proxy(response.body, { get(target, prop, receiver) {
		if (prop === "json") return async () => {
			if (!bodyTextPromise) bodyTextPromise = target.text();
			try {
				return JSON.parse(await bodyTextPromise);
			} catch (error) {
				return {};
			}
		};
		else if (prop === "text") return async () => {
			if (!bodyTextPromise) bodyTextPromise = target.text();
			return bodyTextPromise;
		};
		else return Reflect.get(target, prop, receiver);
	} });
	return new Proxy(response, { get(target, prop, receiver) {
		if (prop === "body") return bodyProxy;
		else return Reflect.get(target, prop, receiver);
	} });
};
/**
* Utility to create a new RestApiError from a service error.
*/
var buildRestApiError = (error, response) => {
	const restApiError = new RestApiError({
		name: error?.name,
		message: error.message,
		underlyingError: error,
		response
	});
	return Object.assign(restApiError, { $metadata: error.$metadata });
};
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/utils/logger.mjs
var logger$2 = new ConsoleLogger("RestApis");
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/utils/createCancellableOperation.mjs
/**
* @internal
*/
function createCancellableOperation(handler, abortController, operationType, timeout) {
	const abortSignal = abortController.signal;
	let abortReason;
	if (timeout != null) {
		if (timeout < 0) throw new Error("Timeout must be a non-negative number");
		setTimeout(() => {
			abortReason = "TimeoutError";
			abortController.abort(abortReason);
		}, timeout);
	}
	const job = async () => {
		try {
			const response = await handler();
			if (response.statusCode >= 300) throw await parseRestApiServiceError(response);
			return response;
		} catch (error) {
			if (error.name === "AbortError" || abortSignal?.aborted === true) if (abortReason && abortReason === "TimeoutError") {
				const timeoutError = /* @__PURE__ */ new Error(`Request timeout after ${timeout}ms`);
				timeoutError.name = "TimeoutError";
				logger$2.debug(timeoutError);
				throw timeoutError;
			} else {
				const message = abortReason ?? abortSignal.reason;
				const canceledError = new CanceledError({
					...message && { message },
					underlyingError: error,
					recoverySuggestion: "The API request was explicitly canceled. If this is not intended, validate if you called the `cancel()` function on the API request erroneously."
				});
				logger$2.debug(canceledError);
				throw canceledError;
			}
			logger$2.debug(error);
			throw error;
		}
	};
	if (operationType === "internal") return job();
	else {
		const cancel = (abortMessage) => {
			if (abortSignal.aborted === true) return;
			abortController.abort(abortMessage);
			if (abortMessage && abortSignal.reason !== abortMessage) abortReason = abortMessage;
		};
		return {
			response: job(),
			cancel
		};
	}
}
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/utils/constants.mjs
var DEFAULT_REST_IAM_SIGNING_SERVICE = "execute-api";
var DEFAULT_IAM_SIGNING_REGION = "us-east-1";
/**
* The REST endpoints generated by API Gateway
* @see {@link https://docs.aws.amazon.com/general/latest/gr/apigateway.html#apigateway_region_data_plane}
*/
var APIG_HOSTNAME_PATTERN = /^.+\.([a-z0-9-]+)\.([a-z0-9-]+)\.amazonaws\.com/;
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/utils/parseSigningInfo.mjs
/**
* Infer the signing service and region from the given URL, and for REST API only, from the Amplify configuration.
* It supports raw API Gateway endpoint and AppSync endpoint.
*
* @internal
*/
var parseSigningInfo = (url, restApiOptions) => {
	const { service: signingService = DEFAULT_REST_IAM_SIGNING_SERVICE, region: signingRegion = DEFAULT_IAM_SIGNING_REGION } = restApiOptions?.amplify.getConfig()?.API?.REST?.[restApiOptions?.apiName] ?? {};
	const { hostname } = url;
	const [, service, region] = APIG_HOSTNAME_PATTERN.exec(hostname) ?? [];
	if (service === "execute-api") return {
		service,
		region: region ?? signingRegion
	};
	else if (service === "appsync-api") return {
		service: "appsync",
		region: region ?? signingRegion
	};
	else return {
		service: signingService,
		region: signingRegion
	};
};
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/errors/assertValidatonError.mjs
/**
* @internal
*/
function assertValidationError$1(assertion, name) {
	const { message, recoverySuggestion } = validationErrorMap$1[name];
	if (!assertion) throw new RestApiError({
		name,
		message,
		recoverySuggestion
	});
}
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/utils/resolveApiUrl.mjs
/**
* Resolve the REST API request URL by:
* 1. Loading the REST API endpoint from the Amplify configuration with corresponding API name.
* 2. Appending the path to the endpoint.
* 3. Merge the query parameters from path and the queryParameter argument which is taken from the public REST API
*   options.
* 4. Validating the resulting URL string.
*
* @internal
*/
var resolveApiUrl = (amplify, apiName, path, queryParams) => {
	const urlStr = amplify.getConfig()?.API?.REST?.[apiName]?.endpoint;
	assertValidationError$1(!!urlStr, RestApiValidationErrorCode.InvalidApiName);
	try {
		let url;
		if (AmplifyUrl.canParse(urlStr + path)) url = new AmplifyUrl(urlStr + path);
		else url = new AmplifyUrl(urlStr + path, location?.origin);
		if (queryParams) {
			const mergedQueryParams = new AmplifyUrlSearchParams(url.searchParams);
			Object.entries(queryParams).forEach(([key, value]) => {
				mergedQueryParams.set(key, value);
			});
			url.search = new AmplifyUrlSearchParams(mergedQueryParams).toString();
		}
		return url;
	} catch (error) {
		throw new RestApiError({
			name: RestApiValidationErrorCode.InvalidApiName,
			...validationErrorMap$1[RestApiValidationErrorCode.InvalidApiName],
			recoverySuggestion: `Please make sure the REST endpoint URL is a valid URL string. Got ${urlStr}`
		});
	}
};
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/utils/isIamAuthApplicable.mjs
/**
* Determines if IAM authentication should be applied for a GraphQL request.
*
* This function checks the `headers` of the HTTP request to determine if IAM authentication
* is applicable. IAM authentication is considered applicable if there is no `authorization`
* header, no `x-api-key` header, and `signingServiceInfo` is provided.
*
* @param request - The HTTP request object containing headers.
* @param signingServiceInfo - Optional signing service information,
* including service and region.
* @returns A boolean `true` if IAM authentication should be applied.
*
* @internal
*/
var isIamAuthApplicableForGraphQL = ({ headers }, signingServiceInfo) => !headers.authorization && !headers["x-api-key"] && !!signingServiceInfo;
/**
* Determines if IAM authentication should be applied for a REST request.
*
* This function checks the `headers` of the HTTP request to determine if IAM authentication
* is applicable. IAM authentication is considered applicable if there is no `authorization`
* header and `signingServiceInfo` is provided.
*
* @param request - The HTTP request object containing headers.
* @param signingServiceInfo - Optional signing service information,
* including service and region.
* @returns A boolean `true` if IAM authentication should be applied.
*
* @internal
*/
var isIamAuthApplicableForRest = ({ headers }, signingServiceInfo) => !headers.authorization && !!signingServiceInfo;
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/utils/resolveLibraryOptions.mjs
/**
* @internal
*/
var resolveLibraryOptions$1 = (amplify) => {
	return {
		retryStrategy: amplify.libraryOptions?.API?.REST?.retryStrategy,
		defaultAuthMode: amplify.libraryOptions?.API?.REST?.defaultAuthMode
	};
};
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/utils/resolveHeaders.mjs
var resolveHeaders = (headers, body) => {
	const normalizedHeaders = {};
	for (const key in headers) normalizedHeaders[key.toLowerCase()] = headers[key];
	if (body) {
		const contentType = normalizedHeaders["content-type"];
		if (!(contentType && (contentType.startsWith("application/json") || contentType.startsWith("application/") && contentType.includes("+json")))) normalizedHeaders["content-type"] = "application/json; charset=UTF-8";
		if (body instanceof FormData)
 /**
		* If body is a FormData we should not allow setting content-type.
		* It's because runtime HTTP handlers(xhr, fetch, undici, node-fetch,
		* etc.) will modify the content-type value when setting multipart
		* boundary.
		*/
		delete normalizedHeaders["content-type"];
	}
	return normalizedHeaders;
};
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/apis/common/baseHandlers/authenticatedHandler.mjs
/**
* @internal
*/
var authenticatedHandler = composeTransferHandler(fetchTransferHandler, [
	userAgentMiddlewareFactory,
	retryMiddlewareFactory,
	signingMiddlewareFactory
]);
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/apis/common/baseHandlers/unauthenticatedHandler.mjs
/**
* @internal
*/
var unauthenticatedHandler = composeTransferHandler(fetchTransferHandler, [userAgentMiddlewareFactory, retryMiddlewareFactory]);
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/apis/common/transferHandler.mjs
/**
* Make REST API call with best-effort IAM auth.
* @param amplify Amplify instance to to resolve credentials and tokens. Should use different instance in client-side
*   and SSR
* @param options Options accepted from public API options when calling the handlers.
* @param signingServiceInfo Internal-only options enable IAM auth as well as to to overwrite the IAM signing service
*   and region. If specified, and NONE of API Key header or Auth header is present, IAM auth will be used.
* @param iamAuthApplicable Callback function that is used to determine if IAM Auth should be used or not.
*
* @internal
*/
var transferHandler = async (amplify, options, iamAuthApplicable, signingServiceInfo) => {
	const { url, method, headers, body, withCredentials, abortSignal, retryStrategy } = options;
	const resolvedBody = body ? body instanceof FormData ? body : JSON.stringify(body ?? "") : void 0;
	const request = {
		url,
		headers: resolveHeaders(headers, body),
		method,
		body: resolvedBody
	};
	const { retryStrategy: libraryRetryStrategy, defaultAuthMode: libraryDefaultAuthMode } = resolveLibraryOptions$1(amplify);
	const baseOptions = {
		retryDecider: getRetryDeciderFromStrategy(retryStrategy ?? libraryRetryStrategy),
		computeDelay: jitteredBackoff$1,
		withCrossDomainCredentials: withCredentials,
		abortSignal
	};
	const defaultAuthMode = options.defaultAuthMode ?? libraryDefaultAuthMode;
	let credentials = null;
	if (defaultAuthMode !== "none") credentials = await resolveCredentials(amplify);
	let response;
	if (iamAuthApplicable(request, signingServiceInfo) && credentials) {
		const signingInfoFromUrl = parseSigningInfo(url);
		const signingService = signingServiceInfo?.service ?? signingInfoFromUrl.service;
		const signingRegion = signingServiceInfo?.region ?? signingInfoFromUrl.region;
		response = await authenticatedHandler(request, {
			...baseOptions,
			credentials,
			region: signingRegion,
			service: signingService
		});
	} else response = await unauthenticatedHandler(request, { ...baseOptions });
	return {
		statusCode: response.statusCode,
		headers: response.headers,
		body: response.body
	};
};
var getRetryDeciderFromStrategy = (retryStrategy) => {
	if (retryStrategy?.strategy === "no-retry") return () => Promise.resolve({ retryable: false });
	return getRetryDecider(parseRestApiServiceError);
};
var resolveCredentials = async (amplify) => {
	try {
		const { credentials } = await amplify.Auth.fetchAuthSession();
		if (credentials) return credentials;
	} catch (e) {
		logger$2.debug("No credentials available, the request will be unsigned.");
	}
	return null;
};
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/apis/common/publicApis.mjs
var publicHandler = (amplify, options, method) => {
	const { apiName, options: apiOptions = {}, path: apiPath } = options;
	const libraryConfigTimeout = amplify.libraryOptions?.API?.REST?.timeout?.({
		apiName,
		method
	});
	const timeout = apiOptions?.timeout || libraryConfigTimeout || void 0;
	const publicApisAbortController = new AbortController();
	const abortSignal = publicApisAbortController.signal;
	return createCancellableOperation(async () => {
		const url = resolveApiUrl(amplify, apiName, apiPath, apiOptions?.queryParams);
		const libraryConfigHeaders = await amplify.libraryOptions?.API?.REST?.headers?.({ apiName });
		const { headers: invocationHeaders = {} } = apiOptions;
		const headers = {
			...libraryConfigHeaders,
			...invocationHeaders
		};
		const signingServiceInfo = parseSigningInfo(url, {
			amplify,
			apiName
		});
		logger$2.debug(method, url, headers, `IAM signing options: ${JSON.stringify(signingServiceInfo)}`);
		return transferHandler(amplify, {
			...apiOptions,
			url,
			method,
			headers,
			abortSignal
		}, isIamAuthApplicableForRest, signingServiceInfo);
	}, publicApisAbortController, "public", timeout);
};
var get$1 = (amplify, input) => publicHandler(amplify, input, "GET");
var post$3 = (amplify, input) => publicHandler(amplify, input, "POST");
var put$1 = (amplify, input) => publicHandler(amplify, input, "PUT");
var del$1 = (amplify, input) => publicHandler(amplify, input, "DELETE");
var head$1 = (amplify, input) => publicHandler(amplify, input, "HEAD");
var patch$1 = (amplify, input) => publicHandler(amplify, input, "PATCH");
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/apis/index.mjs
/**
* GET HTTP request
* @param {GetInput} input - Input for GET operation
* @returns {GetOperation} Operation for GET request
* @throws - {@link RestApiError}
* @example
* Send a GET request
* ```js
* import { get, isCancelError } from '@aws-amplify/api';
*
* const { body } = await get({
*   apiName,
*   path,
*   options: {
*     headers, // Optional, A map of custom header key/values
*     body, // Optional, JSON object or FormData
*     queryParams, // Optional, A map of query strings
*   }
* }).response;
* const data = await body.json();
* ```
* @example
* Cancel a GET request
*
* ```js
* import { get, isCancelError } from '@aws-amplify/api';
*
* const { response, cancel } = get({apiName, path, options});
* cancel(message);
* try {
*   await response;
* } catch (e) {
*   if (isCancelError(e)) {
*    // handle request cancellation
*   }
*   //...
* }
* ```
*/
var get = (input) => get$1(Amplify, input);
/**
* POST HTTP request
* @param {PostInput} input - Input for POST operation
* @returns {PostOperation} Operation for POST request
* @throws - {@link RestApiError}
* @example
* Send a POST request
* ```js
* import { post, isCancelError } from '@aws-amplify/api';
*
* const { body } = await post({
*   apiName,
*   path,
*   options: {
*     headers, // Optional, A map of custom header key/values
*     body, // Optional, JSON object or FormData
*     queryParams, // Optional, A map of query strings
*   }
* }).response;
* const data = await body.json();
* ```
* @example
* Cancel a POST request
*
* ```js
* import { post, isCancelError } from '@aws-amplify/api';
*
* const { response, cancel } = post({apiName, path, options});
* cancel(message);
* try {
*   await response;
* } catch (e) {
*   if (isCancelError(e)) {
*    // handle request cancellation
*   }
*   //...
* }
* ```
*/
var post = (input) => post$3(Amplify, input);
/**
* PUT HTTP request
* @param {PutInput} input - Input for PUT operation
* @returns {PutOperation} Operation for PUT request
* @throws - {@link RestApiError}
* @example
* Send a PUT request
* ```js
* import { put, isCancelError } from '@aws-amplify/api';
*
* const { body } = await put({
*   apiName,
*   path,
*   options: {
*     headers, // Optional, A map of custom header key/values
*     body, // Optional, JSON object or FormData
*     queryParams, // Optional, A map of query strings
*   }
* }).response;
* const data = await body.json();
* ```
* @example
* Cancel a PUT request
* ```js
* import { put, isCancelError } from '@aws-amplify/api';
*
* const { response, cancel } = put({apiName, path, options});
* cancel(message);
* try {
*  await response;
* } catch (e) {
*   if (isCancelError(e)) {
*     // handle request cancellation
*   }
* //...
* }
* ```
*/
var put = (input) => put$1(Amplify, input);
/**
* DELETE HTTP request
* @param {DeleteInput} input - Input for DELETE operation
* @returns {DeleteOperation} Operation for DELETE request
* @throws - {@link RestApiError}
* @example
* Send a DELETE request
* ```js
* import { del } from '@aws-amplify/api';
*
* const { statusCode } = await del({
*   apiName,
*   path,
*   options: {
*     headers, // Optional, A map of custom header key/values
*     queryParams, // Optional, A map of query strings
*   }
* }).response;
* ```
*/
var del = (input) => del$1(Amplify, input);
/**
* HEAD HTTP request
* @param {HeadInput} input - Input for HEAD operation
* @returns {HeadOperation} Operation for HEAD request
* @throws - {@link RestApiError}
* @example
* Send a HEAD request
* ```js
* import { head, isCancelError } from '@aws-amplify/api';
*
* const { headers, statusCode } = await head({
*   apiName,
*   path,
*   options: {
*     headers, // Optional, A map of custom header key/values
*     queryParams, // Optional, A map of query strings
*   }
* }),response;
* ```
*
*/
var head = (input) => head$1(Amplify, input);
/**
* PATCH HTTP request
* @param {PatchInput} input - Input for PATCH operation
* @returns {PatchOperation} Operation for PATCH request
* @throws - {@link RestApiError}
* @example
* Send a PATCH request
* ```js
* import { patch } from '@aws-amplify/api';
*
* const { body } = await patch({
*   apiName,
*   path,
*   options: {
*     headers, // Optional, A map of custom header key/values
*     body, // Optional, JSON object or FormData
*     queryParams, // Optional, A map of query strings
*   }
* }).response;
* const data = await body.json();
* ```
*
* @example
* Cancel a PATCH request
* ```js
* import { patch, isCancelError } from '@aws-amplify/api';
*
* const { response, cancel } = patch({apiName, path, options});
* cancel(message);
* try {
*  await response;
* } catch (e) {
*  if (isCancelError(e)) {
*   // handle request cancellation
*  }
* //...
* }
* ```
*/
var patch = (input) => patch$1(Amplify, input);
//#endregion
//#region node_modules/@aws-amplify/api-rest/dist/esm/apis/common/internalPost.mjs
/**
* This weak map provides functionality to cancel a request given the promise containing the `post` request.
*
* 1. For every GraphQL POST request, an abort controller is created and supplied to the request.
* 2. The promise fulfilled by GraphGL POST request is then mapped to that abort controller.
* 3. The promise is returned to the external caller.
* 4. The caller can either wait for the promise to fulfill or call `cancel(promise)` to cancel the request.
* 5. If `cancel(promise)` is called, then the corresponding abort controller is retrieved from the map below.
* 6. GraphQL POST request will be rejected with the error message provided during cancel.
* 7. Caller can check if the error is because of cancelling by calling `isCancelError(error)`.
*/
var cancelTokenMap = /* @__PURE__ */ new WeakMap();
/**
* @internal
*
* REST POST handler to send GraphQL request to given endpoint. By default, it will use IAM to authorize
* the request. In some auth modes, the IAM auth has to be disabled. Here's how to set up the request auth correctly:
* * If auth mode is 'iam', you MUST NOT set 'authorization' header and 'x-api-key' header, since it would disable IAM
*   auth. You MUST also set 'input.options.signingServiceInfo' option.
*   * The including 'input.options.signingServiceInfo.service' and 'input.options.signingServiceInfo.region' are
*     optional. If omitted, the signing service and region will be inferred from url.
* * If auth mode is 'none', you MUST NOT set 'options.signingServiceInfo' option.
* * If auth mode is 'apiKey', you MUST set 'x-api-key' custom header.
* * If auth mode is 'oidc' or 'lambda' or 'userPool', you MUST set 'authorization' header.
*
* To make the internal post cancellable, you must also call `updateRequestToBeCancellable()` with the promise from
* internal post call and the abort controller supplied to the internal post call.
*
* @param amplify the AmplifyClassV6 instance - it may be the singleton used on Web, or an instance created within
* a context created by `runWithAmplifyServerContext`
* @param postInput an object of {@link InternalPostInput}
* @param postInput.url The URL that the POST request sends to
* @param postInput.options Options of the POST request
* @param postInput.abortController The abort controller used to cancel the POST request
* @returns a {@link RestApiResponse}
*
* @throws an {@link AmplifyError} with `Network Error` as the `message` when the external resource is unreachable due to one
* of the following reasons:
*   1. no network connection
*   2. CORS error
* @throws a {@link CanceledError} when the ongoing POST request get cancelled
*/
var post$2 = (amplify, { url, options, abortController }) => {
	const controller = abortController ?? new AbortController();
	const responseWithCleanUp = createCancellableOperation(async () => {
		return transferHandler(amplify, {
			url,
			method: "POST",
			...options,
			abortSignal: controller.signal,
			retryStrategy: { strategy: "jittered-exponential-backoff" }
		}, isIamAuthApplicableForGraphQL, options?.signingServiceInfo);
	}, controller, "internal").finally(() => {
		cancelTokenMap.delete(responseWithCleanUp);
	});
	return responseWithCleanUp;
};
/**
* Cancels a request given the promise returned by `post`.
* If the request is already completed, this function does nothing.
* It MUST be used after `updateRequestToBeCancellable` is called.
*/
var cancel$1 = (promise, message) => {
	const controller = cancelTokenMap.get(promise);
	if (controller) {
		controller.abort(message);
		if (message && controller.signal.reason !== message) controller.signal.reason = message;
		return true;
	}
	return false;
};
/**
* MUST be used to make a promise including internal `post` API call cancellable.
*/
var updateRequestToBeCancellable = (promise, controller) => {
	cancelTokenMap.set(promise, controller);
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/Providers/constants.mjs
var MAX_DELAY_MS = 5e3;
var NON_RETRYABLE_CODES = [
	400,
	401,
	403
];
var NON_RETRYABLE_ERROR_TYPES = ["BadRequestException", "UnauthorizedException"];
var CONNECTION_STATE_CHANGE = "ConnectionStateChange";
var MESSAGE_TYPES;
(function(MESSAGE_TYPES) {
	/**
	* Client -> Server message.
	* This message type is the first message after handshake and this will initialize AWS AppSync RealTime communication
	*/
	MESSAGE_TYPES["GQL_CONNECTION_INIT"] = "connection_init";
	/**
	* Server -> Client message
	* This message type is in case there is an issue with AWS AppSync RealTime when establishing connection
	*/
	MESSAGE_TYPES["GQL_CONNECTION_ERROR"] = "connection_error";
	/**
	* Server -> Client message.
	* This message type is for the ack response from AWS AppSync RealTime for GQL_CONNECTION_INIT message
	*/
	MESSAGE_TYPES["GQL_CONNECTION_ACK"] = "connection_ack";
	/**
	* Client -> Server message.
	* This message type is for register subscriptions with AWS AppSync RealTime
	*/
	MESSAGE_TYPES["GQL_START"] = "start";
	/**
	* Server -> Client message.
	* This message type is for the ack response from AWS AppSync RealTime for GQL_START message
	*/
	MESSAGE_TYPES["GQL_START_ACK"] = "start_ack";
	/**
	* Server -> Client message.
	* This message type is for subscription message from AWS AppSync RealTime or Events
	*/
	MESSAGE_TYPES["DATA"] = "data";
	/**
	* Server -> Client message.
	* This message type helps the client to know is still receiving messages from AWS AppSync RealTime
	*/
	MESSAGE_TYPES["GQL_CONNECTION_KEEP_ALIVE"] = "ka";
	/**
	* Client -> Server message.
	* This message type is for unregister subscriptions with AWS AppSync RealTime
	*/
	MESSAGE_TYPES["GQL_STOP"] = "stop";
	/**
	* Server -> Client message.
	* This message type is for the ack response from AWS AppSync RealTime for GQL_STOP message
	*/
	MESSAGE_TYPES["GQL_COMPLETE"] = "complete";
	/**
	* Server -> Client message.
	* This message type is for sending error messages from AWS AppSync RealTime to the client
	*/
	MESSAGE_TYPES["GQL_ERROR"] = "error";
	/**
	* Client -> Server message.
	* This message type is for registering subscriptions with Events
	*/
	MESSAGE_TYPES["EVENT_SUBSCRIBE"] = "subscribe";
	/**
	* Client -> Server message.
	* This message type is for publishing a message with Events
	*/
	MESSAGE_TYPES["EVENT_PUBLISH"] = "publish";
	/**
	* Server -> Client message.
	* Server acknowledges successful subscription
	*/
	MESSAGE_TYPES["EVENT_SUBSCRIBE_ACK"] = "subscribe_success";
	/**
	* Server -> Client message.
	* Server acknowledges successful publish
	*/
	MESSAGE_TYPES["EVENT_PUBLISH_ACK"] = "publish_success";
	/**
	* Client -> Server message.
	* This message type is for unregister subscriptions with AWS AppSync RealTime
	*/
	MESSAGE_TYPES["EVENT_STOP"] = "unsubscribe";
	/**
	* Server -> Client message.
	* This is the ack response from AWS AppSync Events to EVENT_STOP message
	*/
	MESSAGE_TYPES["EVENT_COMPLETE"] = "unsubscribe_success";
	/**
	* Server -> Client message.
	* This message type is for sending error messages from AWS AppSync Events to the client
	*/
	MESSAGE_TYPES["EVENT_SUBSCRIBE_ERROR"] = "subscribe_error";
})(MESSAGE_TYPES || (MESSAGE_TYPES = {}));
var SUBSCRIPTION_STATUS;
(function(SUBSCRIPTION_STATUS) {
	SUBSCRIPTION_STATUS[SUBSCRIPTION_STATUS["PENDING"] = 0] = "PENDING";
	SUBSCRIPTION_STATUS[SUBSCRIPTION_STATUS["CONNECTED"] = 1] = "CONNECTED";
	SUBSCRIPTION_STATUS[SUBSCRIPTION_STATUS["FAILED"] = 2] = "FAILED";
})(SUBSCRIPTION_STATUS || (SUBSCRIPTION_STATUS = {}));
var SOCKET_STATUS;
(function(SOCKET_STATUS) {
	SOCKET_STATUS[SOCKET_STATUS["CLOSED"] = 0] = "CLOSED";
	SOCKET_STATUS[SOCKET_STATUS["READY"] = 1] = "READY";
	SOCKET_STATUS[SOCKET_STATUS["CONNECTING"] = 2] = "CONNECTING";
})(SOCKET_STATUS || (SOCKET_STATUS = {}));
var AWS_APPSYNC_REALTIME_HEADERS = {
	accept: "application/json, text/javascript",
	"content-encoding": "amz-1.0",
	"content-type": "application/json; charset=UTF-8"
};
/**
* Time in milleseconds to wait for GQL_CONNECTION_INIT message
*/
var CONNECTION_INIT_TIMEOUT = 15e3;
/**
* Time in milleseconds to wait for GQL_START_ACK message
*/
var START_ACK_TIMEOUT = 15e3;
/**
* Default Time in milleseconds to wait for GQL_CONNECTION_KEEP_ALIVE message
*/
var DEFAULT_KEEP_ALIVE_TIMEOUT = 300 * 1e3;
/**
* Default Time in milleseconds between monitoring checks of keep alive status
*/
var DEFAULT_KEEP_ALIVE_HEARTBEAT_TIMEOUT = 5 * 1e3;
/**
* Default delay time in milleseconds between when reconnect is triggered vs when it is attempted
*/
var RECONNECT_DELAY = 5 * 1e3;
/**
* Default interval time in milleseconds between when reconnect is re-attempted
*/
var RECONNECT_INTERVAL = 60 * 1e3;
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/types/PubSub.mjs
var CONTROL_MSG;
(function(CONTROL_MSG) {
	CONTROL_MSG["CONNECTION_CLOSED"] = "Connection closed";
	CONTROL_MSG["CONNECTION_FAILED"] = "Connection failed";
	CONTROL_MSG["REALTIME_SUBSCRIPTION_INIT_ERROR"] = "AppSync Realtime subscription init error";
	CONTROL_MSG["SUBSCRIPTION_ACK"] = "Subscription ack";
	CONTROL_MSG["TIMEOUT_DISCONNECT"] = "Timeout disconnect";
})(CONTROL_MSG || (CONTROL_MSG = {}));
/** @enum {string} */
var ConnectionState;
(function(ConnectionState) {
	ConnectionState["Connected"] = "Connected";
	ConnectionState["ConnectedPendingNetwork"] = "ConnectedPendingNetwork";
	ConnectionState["ConnectionDisrupted"] = "ConnectionDisrupted";
	ConnectionState["ConnectionDisruptedPendingNetwork"] = "ConnectionDisruptedPendingNetwork";
	ConnectionState["Connecting"] = "Connecting";
	ConnectionState["ConnectedPendingDisconnect"] = "ConnectedPendingDisconnect";
	ConnectionState["Disconnected"] = "Disconnected";
	ConnectionState["ConnectedPendingKeepAlive"] = "ConnectedPendingKeepAlive";
})(ConnectionState || (ConnectionState = {}));
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/utils/ReachabilityMonitor/index.mjs
var ReachabilityMonitor = () => new Reachability().networkMonitor();
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/utils/ConnectionStateMonitor.mjs
var CONNECTION_CHANGE = {
	KEEP_ALIVE_MISSED: { keepAliveState: "unhealthy" },
	KEEP_ALIVE: { keepAliveState: "healthy" },
	CONNECTION_ESTABLISHED: { connectionState: "connected" },
	CONNECTION_FAILED: {
		intendedConnectionState: "disconnected",
		connectionState: "disconnected"
	},
	CLOSING_CONNECTION: { intendedConnectionState: "disconnected" },
	OPENING_CONNECTION: {
		intendedConnectionState: "connected",
		connectionState: "connecting"
	},
	CLOSED: { connectionState: "disconnected" },
	ONLINE: { networkState: "connected" },
	OFFLINE: { networkState: "disconnected" }
};
var ConnectionStateMonitor = class {
	constructor() {
		this._networkMonitoringSubscription = void 0;
		this._linkedConnectionState = {
			networkState: "connected",
			connectionState: "disconnected",
			intendedConnectionState: "disconnected",
			keepAliveState: "healthy"
		};
		this._initialNetworkStateSubscription = ReachabilityMonitor().subscribe(({ online }) => {
			this.record(online ? CONNECTION_CHANGE.ONLINE : CONNECTION_CHANGE.OFFLINE);
			this._initialNetworkStateSubscription?.unsubscribe();
		});
		this._linkedConnectionStateObservable = new Observable((connectionStateObserver) => {
			connectionStateObserver.next(this._linkedConnectionState);
			this._linkedConnectionStateObserver = connectionStateObserver;
		});
	}
	/**
	* Turn network state monitoring on if it isn't on already
	*/
	enableNetworkMonitoring() {
		this._initialNetworkStateSubscription?.unsubscribe();
		if (this._networkMonitoringSubscription === void 0) this._networkMonitoringSubscription = ReachabilityMonitor().subscribe(({ online }) => {
			this.record(online ? CONNECTION_CHANGE.ONLINE : CONNECTION_CHANGE.OFFLINE);
		});
	}
	/**
	* Turn network state monitoring off if it isn't off already
	*/
	disableNetworkMonitoring() {
		this._networkMonitoringSubscription?.unsubscribe();
		this._networkMonitoringSubscription = void 0;
	}
	/**
	* Get the observable that allows us to monitor the connection state
	*
	* @returns {Observable<ConnectionState>} - The observable that emits ConnectionState updates
	*/
	get connectionStateObservable() {
		let previous;
		return this._linkedConnectionStateObservable.pipe(map((value) => {
			return this.connectionStatesTranslator(value);
		})).pipe(filter((current) => {
			const toInclude = current !== previous;
			previous = current;
			return toInclude;
		}));
	}
	record(statusUpdates) {
		if (statusUpdates.intendedConnectionState === "connected") this.enableNetworkMonitoring();
		else if (statusUpdates.intendedConnectionState === "disconnected") this.disableNetworkMonitoring();
		this._linkedConnectionState = {
			...this._linkedConnectionState,
			...statusUpdates
		};
		this._linkedConnectionStateObserver?.next(this._linkedConnectionState);
	}
	connectionStatesTranslator({ connectionState, networkState, intendedConnectionState, keepAliveState }) {
		if (connectionState === "connected" && networkState === "disconnected") return ConnectionState.ConnectedPendingNetwork;
		if (connectionState === "connected" && intendedConnectionState === "disconnected") return ConnectionState.ConnectedPendingDisconnect;
		if (connectionState === "disconnected" && intendedConnectionState === "connected" && networkState === "disconnected") return ConnectionState.ConnectionDisruptedPendingNetwork;
		if (connectionState === "disconnected" && intendedConnectionState === "connected") return ConnectionState.ConnectionDisrupted;
		if (connectionState === "connected" && keepAliveState === "unhealthy") return ConnectionState.ConnectedPendingKeepAlive;
		if (connectionState === "connecting") return ConnectionState.Connecting;
		if (connectionState === "disconnected") return ConnectionState.Disconnected;
		return ConnectionState.Connected;
	}
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/utils/ReconnectionMonitor.mjs
var ReconnectEvent;
(function(ReconnectEvent) {
	ReconnectEvent["START_RECONNECT"] = "START_RECONNECT";
	ReconnectEvent["HALT_RECONNECT"] = "HALT_RECONNECT";
})(ReconnectEvent || (ReconnectEvent = {}));
/**
* Captures the reconnect event logic used to determine when to reconnect to PubSub providers.
*   Reconnect attempts are delayed by 5 seconds to let the interface settle.
*   Attempting to reconnect only once creates unrecoverable states when the network state isn't
*   supported by the browser, so this keeps retrying every minute until halted.
*/
var ReconnectionMonitor = class {
	constructor() {
		this.reconnectObservers = [];
	}
	/**
	* Add reconnect observer to the list of observers to alert on reconnect
	*/
	addObserver(reconnectObserver) {
		this.reconnectObservers.push(reconnectObserver);
	}
	/**
	* Given a reconnect event, start the appropriate behavior
	*/
	record(event) {
		if (event === ReconnectEvent.START_RECONNECT) {
			if (this.reconnectSetTimeoutId === void 0 && this.reconnectIntervalId === void 0) this.reconnectSetTimeoutId = setTimeout(() => {
				this._triggerReconnect();
				this.reconnectIntervalId = setInterval(() => {
					this._triggerReconnect();
				}, RECONNECT_INTERVAL);
			}, RECONNECT_DELAY);
		}
		if (event === ReconnectEvent.HALT_RECONNECT) {
			if (this.reconnectIntervalId) {
				clearInterval(this.reconnectIntervalId);
				this.reconnectIntervalId = void 0;
			}
			if (this.reconnectSetTimeoutId) {
				clearTimeout(this.reconnectSetTimeoutId);
				this.reconnectSetTimeoutId = void 0;
			}
		}
	}
	/**
	* Complete all reconnect observers
	*/
	close() {
		this.reconnectObservers.forEach((reconnectObserver) => {
			reconnectObserver.complete?.();
		});
	}
	_triggerReconnect() {
		this.reconnectObservers.forEach((reconnectObserver) => {
			reconnectObserver.next?.();
		});
	}
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/Providers/AWSWebSocketProvider/appsyncUrl.mjs
var protocol = "wss://";
var standardDomainPattern = /^https:\/\/\w{26}\.appsync-api\.\w{2}(?:(?:-\w{2,})+)-\d\.amazonaws.com(?:\.cn)?\/graphql$/i;
var eventDomainPattern = /^https:\/\/\w{26}\.\w+-api\.\w{2}(?:(?:-\w{2,})+)-\d\.amazonaws.com(?:\.cn)?\/event$/i;
var customDomainPath = "/realtime";
var isCustomDomain = (url) => {
	return url.match(standardDomainPattern) === null;
};
var isEventDomain = (url) => url.match(eventDomainPattern) !== null;
var getRealtimeEndpointUrl = (appSyncGraphqlEndpoint) => {
	let realtimeEndpoint = appSyncGraphqlEndpoint ?? "";
	if (isEventDomain(realtimeEndpoint)) realtimeEndpoint = realtimeEndpoint.concat(customDomainPath).replace("ddpg-api", "grt-gamma").replace("appsync-api", "appsync-realtime-api");
	else if (isCustomDomain(realtimeEndpoint)) realtimeEndpoint = realtimeEndpoint.concat(customDomainPath);
	else realtimeEndpoint = realtimeEndpoint.replace("appsync-api", "appsync-realtime-api").replace("gogi-beta", "grt-beta").replace("ddpg-api", "grt-gamma");
	realtimeEndpoint = realtimeEndpoint.replace("https://", protocol).replace("http://", protocol);
	return new AmplifyUrl(realtimeEndpoint);
};
/**
* Strips out `Authorization` header if present
*/
var extractNonAuthHeaders = (headers) => {
	if (!headers) return {};
	if ("Authorization" in headers) {
		const { Authorization: _, ...nonAuthHeaders } = headers;
		return nonAuthHeaders;
	}
	return headers;
};
/**
*
* @param headers - http headers
* @returns uri-encoded query parameters derived from custom headers
*/
var queryParamsFromCustomHeaders = (headers) => {
	const nonAuthHeaders = extractNonAuthHeaders(headers);
	const params = new AmplifyUrlSearchParams();
	Object.entries(nonAuthHeaders).forEach(([k, v]) => {
		params.append(k, v);
	});
	return params;
};
/**
* Normalizes AppSync realtime endpoint URL
*
* @param appSyncGraphqlEndpoint - AppSync endpointUri from config
* @param urlParams - URLSearchParams
* @returns fully resolved string realtime endpoint URL
*/
var realtimeUrlWithQueryString = (appSyncGraphqlEndpoint, urlParams) => {
	const realtimeEndpointUrl = getRealtimeEndpointUrl(appSyncGraphqlEndpoint);
	const existingParams = new AmplifyUrlSearchParams(realtimeEndpointUrl.search);
	for (const [k, v] of urlParams.entries()) existingParams.append(k, v);
	realtimeEndpointUrl.search = existingParams.toString();
	return realtimeEndpointUrl.toString();
};
var additionalHeadersFromOptions = async (options) => {
	const { appSyncGraphqlEndpoint, query, libraryConfigHeaders = () => ({}), additionalHeaders = {}, authToken } = options;
	let additionalCustomHeaders = {};
	const _libraryConfigHeaders = await libraryConfigHeaders();
	if (typeof additionalHeaders === "function") additionalCustomHeaders = await additionalHeaders({
		url: appSyncGraphqlEndpoint || "",
		queryString: query || ""
	});
	else additionalCustomHeaders = additionalHeaders;
	if (authToken) additionalCustomHeaders = {
		...additionalCustomHeaders,
		Authorization: authToken
	};
	return {
		additionalCustomHeaders,
		libraryConfigHeaders: _libraryConfigHeaders
	};
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/Providers/AWSWebSocketProvider/authHeaders.mjs
var logger$1 = new ConsoleLogger("AWSAppSyncRealTimeProvider Auth");
var awsAuthTokenHeader = async ({ host }) => {
	return {
		Authorization: (await fetchAuthSession())?.tokens?.accessToken?.toString(),
		host
	};
};
var awsRealTimeApiKeyHeader = async ({ apiKey, host }) => {
	const dtStr = (/* @__PURE__ */ new Date()).toISOString().replace(/[:-]|\.\d{3}/g, "");
	return {
		host,
		"x-amz-date": dtStr,
		"x-api-key": apiKey
	};
};
var awsRealTimeIAMHeader = async ({ payload, canonicalUri, appSyncGraphqlEndpoint, region }) => {
	const endpointInfo = {
		region,
		service: "appsync"
	};
	const creds = (await fetchAuthSession()).credentials;
	const request = {
		url: `${appSyncGraphqlEndpoint}${canonicalUri}`,
		data: payload,
		method: "POST",
		headers: { ...AWS_APPSYNC_REALTIME_HEADERS }
	};
	return signRequest({
		headers: request.headers,
		method: request.method,
		url: new AmplifyUrl(request.url),
		body: request.data
	}, {
		credentials: creds,
		signingRegion: endpointInfo.region,
		signingService: endpointInfo.service
	}).headers;
};
var customAuthHeader = async ({ host, additionalCustomHeaders }) => {
	/**
	* If `additionalHeaders` was provided to the subscription as a function,
	* the headers that are returned by that function will already have been
	* provided before this function is called.
	*/
	if (!additionalCustomHeaders?.Authorization) throw new Error("No auth token specified");
	return {
		Authorization: additionalCustomHeaders.Authorization,
		host
	};
};
var awsRealTimeHeaderBasedAuth = async ({ apiKey, authenticationType, canonicalUri, appSyncGraphqlEndpoint, region, additionalCustomHeaders, payload }) => {
	const headerHandler = {
		apiKey: awsRealTimeApiKeyHeader,
		iam: awsRealTimeIAMHeader,
		oidc: awsAuthTokenHeader,
		userPool: awsAuthTokenHeader,
		lambda: customAuthHeader,
		none: customAuthHeader
	};
	if (!authenticationType || !headerHandler[authenticationType]) {
		logger$1.debug(`Authentication type ${authenticationType} not supported`);
		return;
	} else {
		const handler = headerHandler[authenticationType];
		const host = appSyncGraphqlEndpoint ? new AmplifyUrl(appSyncGraphqlEndpoint).host : void 0;
		const resolvedApiKey = authenticationType === "apiKey" ? apiKey : void 0;
		logger$1.debug(`Authenticating with ${JSON.stringify(authenticationType)}`);
		return await handler({
			payload,
			canonicalUri,
			appSyncGraphqlEndpoint,
			apiKey: resolvedApiKey,
			region,
			host,
			additionalCustomHeaders
		});
	}
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/Providers/AWSWebSocketProvider/index.mjs
var dispatchApiEvent = (payload) => {
	Hub.dispatch("api", payload, "PubSub", AMPLIFY_SYMBOL);
};
var AWSWebSocketProvider = class {
	constructor(args) {
		this.subscriptionObserverMap = /* @__PURE__ */ new Map();
		this.allowNoSubscriptions = false;
		this.socketStatus = SOCKET_STATUS.CLOSED;
		this.keepAliveTimestamp = Date.now();
		this.promiseArray = [];
		this.connectionStateMonitor = new ConnectionStateMonitor();
		this.reconnectionMonitor = new ReconnectionMonitor();
		/**
		* Open WebSocket connection & perform handshake
		* Ref: https://docs.aws.amazon.com/appsync/latest/devguide/real-time-websocket-client.html#appsynclong-real-time-websocket-client-implementation-guide-for-graphql-subscriptions
		*
		* @param subprotocol -
		*/
		this._establishConnection = async (awsRealTimeUrl, subprotocol) => {
			this.logger.debug(`Establishing WebSocket connection to ${awsRealTimeUrl}`);
			try {
				await this._openConnection(awsRealTimeUrl, subprotocol);
				await this._initiateHandshake();
			} catch (err) {
				const { errorType, errorCode } = err;
				if (NON_RETRYABLE_CODES.includes(errorCode) || NON_RETRYABLE_ERROR_TYPES.includes(errorType)) throw new NonRetryableError(errorType);
				else if (errorType) throw new Error(errorType);
				else throw err;
			}
		};
		this.logger = new ConsoleLogger(args.providerName);
		this.wsProtocolName = args.wsProtocolName;
		this.wsConnectUri = args.connectUri;
		this.connectionStateMonitorSubscription = this._startConnectionStateMonitoring();
	}
	/**
	* Mark the socket closed and release all active listeners
	*/
	close() {
		this.socketStatus = SOCKET_STATUS.CLOSED;
		this.connectionStateMonitor.record(CONNECTION_CHANGE.CONNECTION_FAILED);
		this.connectionStateMonitorSubscription.unsubscribe();
		this.reconnectionMonitor.close();
		return new Promise((resolve, reject) => {
			if (this.awsRealTimeSocket) {
				this.awsRealTimeSocket.onclose = (_) => {
					this._closeSocket();
					this.subscriptionObserverMap = /* @__PURE__ */ new Map();
					this.awsRealTimeSocket = void 0;
					resolve();
				};
				this.awsRealTimeSocket.onerror = (err) => {
					reject(err);
				};
				this.awsRealTimeSocket.close();
			} else resolve();
		});
	}
	subscribe(options, customUserAgentDetails) {
		return new Observable((observer) => {
			if (!options?.appSyncGraphqlEndpoint) {
				observer.error({ errors: [{ ...new GraphQLError(`Subscribe only available for AWS AppSync endpoint`) }] });
				observer.complete();
				return;
			}
			let subscriptionStartInProgress = false;
			const subscriptionId = amplifyUuid();
			const startSubscription = () => {
				if (!subscriptionStartInProgress) {
					subscriptionStartInProgress = true;
					this._startSubscriptionWithAWSAppSyncRealTime({
						options,
						observer,
						subscriptionId,
						customUserAgentDetails
					}).catch((err) => {
						this.logger.debug(`${CONTROL_MSG.REALTIME_SUBSCRIPTION_INIT_ERROR}: ${err}`);
						this._closeSocket();
					}).finally(() => {
						subscriptionStartInProgress = false;
					});
				}
			};
			const reconnectSubscription = new Observable((reconnectSubscriptionObserver) => {
				this.reconnectionMonitor.addObserver(reconnectSubscriptionObserver);
			}).subscribe(() => {
				startSubscription();
			});
			startSubscription();
			return async () => {
				await this._cleanupSubscription(subscriptionId, reconnectSubscription);
			};
		});
	}
	async connect(options) {
		if (this.socketStatus === SOCKET_STATUS.READY) return;
		await this._connectWebSocket(options);
	}
	async publish(options, customUserAgentDetails) {
		if (this.socketStatus !== SOCKET_STATUS.READY) throw new Error("Subscription has not been initialized");
		return this._publishMessage(options, customUserAgentDetails);
	}
	async _connectWebSocket(options) {
		const { apiKey, appSyncGraphqlEndpoint, authenticationType, region } = options;
		const { additionalCustomHeaders } = await additionalHeadersFromOptions(options);
		this.connectionStateMonitor.record(CONNECTION_CHANGE.OPENING_CONNECTION);
		await this._initializeWebSocketConnection({
			apiKey,
			appSyncGraphqlEndpoint,
			authenticationType,
			region,
			additionalCustomHeaders
		});
	}
	async _publishMessage(options, customUserAgentDetails) {
		const subscriptionId = amplifyUuid();
		const { additionalCustomHeaders, libraryConfigHeaders } = await additionalHeadersFromOptions(options);
		const serializedSubscriptionMessage = await this._prepareSubscriptionPayload({
			options,
			subscriptionId,
			customUserAgentDetails,
			additionalCustomHeaders,
			libraryConfigHeaders,
			publish: true
		});
		return new Promise((resolve, reject) => {
			if (this.awsRealTimeSocket) {
				const publishListener = (event) => {
					const data = JSON.parse(event.data);
					if (data.id === subscriptionId && data.type === "publish_success") {
						this.awsRealTimeSocket && this.awsRealTimeSocket.removeEventListener("message", publishListener);
						cleanup();
						resolve();
					}
					if (data.errors && data.errors.length > 0) {
						const errorTypes = data.errors.map((error) => error.errorType);
						cleanup();
						reject(/* @__PURE__ */ new Error(`Publish errors: ${errorTypes.join(", ")}`));
					}
				};
				const errorListener = (error) => {
					cleanup();
					reject(/* @__PURE__ */ new Error(`WebSocket error: ${error}`));
				};
				const closeListener = () => {
					cleanup();
					reject(/* @__PURE__ */ new Error("WebSocket is closed"));
				};
				const cleanup = () => {
					this.awsRealTimeSocket?.removeEventListener("message", publishListener);
					this.awsRealTimeSocket?.removeEventListener("error", errorListener);
					this.awsRealTimeSocket?.removeEventListener("close", closeListener);
				};
				this.awsRealTimeSocket.addEventListener("message", publishListener);
				this.awsRealTimeSocket.addEventListener("error", errorListener);
				this.awsRealTimeSocket.addEventListener("close", closeListener);
				this.awsRealTimeSocket.send(serializedSubscriptionMessage);
			} else reject(/* @__PURE__ */ new Error("WebSocket is not connected"));
		});
	}
	async _cleanupSubscription(subscriptionId, reconnectSubscription) {
		reconnectSubscription?.unsubscribe();
		try {
			await this._waitForSubscriptionToBeConnected(subscriptionId);
			const { subscriptionState } = this.subscriptionObserverMap.get(subscriptionId) || {};
			if (!subscriptionState) return;
			if (subscriptionState === SUBSCRIPTION_STATUS.CONNECTED) this._sendUnsubscriptionMessage(subscriptionId);
			else throw new Error("Subscription never connected");
		} catch (err) {
			this.logger.debug(`Error while unsubscribing ${err}`);
		} finally {
			this._removeSubscriptionObserver(subscriptionId);
		}
	}
	_startConnectionStateMonitoring() {
		return this.connectionStateMonitor.connectionStateObservable.subscribe((connectionState) => {
			dispatchApiEvent({
				event: CONNECTION_STATE_CHANGE,
				data: {
					provider: this,
					connectionState
				},
				message: `Connection state is ${connectionState}`
			});
			this.connectionState = connectionState;
			if (connectionState === ConnectionState.ConnectionDisrupted) this.reconnectionMonitor.record(ReconnectEvent.START_RECONNECT);
			if ([
				ConnectionState.Connected,
				ConnectionState.ConnectedPendingDisconnect,
				ConnectionState.ConnectedPendingKeepAlive,
				ConnectionState.ConnectedPendingNetwork,
				ConnectionState.ConnectionDisruptedPendingNetwork,
				ConnectionState.Disconnected
			].includes(connectionState)) this.reconnectionMonitor.record(ReconnectEvent.HALT_RECONNECT);
		});
	}
	async _startSubscriptionWithAWSAppSyncRealTime({ options, observer, subscriptionId, customUserAgentDetails }) {
		const { query, variables } = options;
		this.subscriptionObserverMap.set(subscriptionId, {
			observer,
			query: query ?? "",
			variables: variables ?? {},
			subscriptionState: SUBSCRIPTION_STATUS.PENDING,
			startAckTimeoutId: void 0
		});
		const { additionalCustomHeaders, libraryConfigHeaders } = await additionalHeadersFromOptions(options);
		const serializedSubscriptionMessage = await this._prepareSubscriptionPayload({
			options,
			subscriptionId,
			customUserAgentDetails,
			additionalCustomHeaders,
			libraryConfigHeaders
		});
		try {
			await this._connectWebSocket(options);
		} catch (err) {
			this._logStartSubscriptionError(subscriptionId, observer, err);
			return;
		}
		const { subscriptionFailedCallback, subscriptionReadyCallback } = this.subscriptionObserverMap.get(subscriptionId) ?? {};
		this.subscriptionObserverMap.set(subscriptionId, {
			observer,
			subscriptionState: SUBSCRIPTION_STATUS.PENDING,
			query: query ?? "",
			variables: variables ?? {},
			subscriptionReadyCallback,
			subscriptionFailedCallback,
			startAckTimeoutId: setTimeout(() => {
				this._timeoutStartSubscriptionAck(subscriptionId);
			}, START_ACK_TIMEOUT)
		});
		if (this.awsRealTimeSocket) this.awsRealTimeSocket.send(serializedSubscriptionMessage);
	}
	_logStartSubscriptionError(subscriptionId, observer, err) {
		this.logger.debug({ err });
		const message = String(err.message ?? "");
		this._closeSocket();
		if (this.connectionState !== ConnectionState.ConnectionDisruptedPendingNetwork) {
			if (isNonRetryableError(err)) observer.error({ errors: [{ ...new GraphQLError(`${CONTROL_MSG.CONNECTION_FAILED}: ${message}`) }] });
			else this.logger.debug(`${CONTROL_MSG.CONNECTION_FAILED}: ${message}`);
			const { subscriptionFailedCallback } = this.subscriptionObserverMap.get(subscriptionId) || {};
			if (typeof subscriptionFailedCallback === "function") subscriptionFailedCallback();
		}
	}
	async _waitForSubscriptionToBeConnected(subscriptionId) {
		const subscriptionObserver = this.subscriptionObserverMap.get(subscriptionId);
		if (subscriptionObserver) {
			const { subscriptionState } = subscriptionObserver;
			if (subscriptionState === SUBSCRIPTION_STATUS.PENDING) return new Promise((resolve, reject) => {
				const { observer, subscriptionState: observedSubscriptionState, variables, query } = subscriptionObserver;
				this.subscriptionObserverMap.set(subscriptionId, {
					observer,
					subscriptionState: observedSubscriptionState,
					variables,
					query,
					subscriptionReadyCallback: resolve,
					subscriptionFailedCallback: reject
				});
			});
		}
	}
	_sendUnsubscriptionMessage(subscriptionId) {
		try {
			if (this.awsRealTimeSocket && this.awsRealTimeSocket.readyState === WebSocket.OPEN && this.socketStatus === SOCKET_STATUS.READY) {
				const unsubscribeMessage = this._unsubscribeMessage(subscriptionId);
				const stringToAWSRealTime = JSON.stringify(unsubscribeMessage);
				this.awsRealTimeSocket.send(stringToAWSRealTime);
			}
		} catch (err) {
			this.logger.debug({ err });
		}
	}
	_removeSubscriptionObserver(subscriptionId) {
		this.subscriptionObserverMap.delete(subscriptionId);
		if (!this.allowNoSubscriptions) setTimeout(this._closeSocketIfRequired.bind(this), 1e3);
	}
	_closeSocketIfRequired() {
		if (this.subscriptionObserverMap.size > 0) return;
		if (!this.awsRealTimeSocket) {
			this.socketStatus = SOCKET_STATUS.CLOSED;
			return;
		}
		this.connectionStateMonitor.record(CONNECTION_CHANGE.CLOSING_CONNECTION);
		if (this.awsRealTimeSocket.bufferedAmount > 0) setTimeout(this._closeSocketIfRequired.bind(this), 1e3);
		else {
			this.logger.debug("closing WebSocket...");
			const tempSocket = this.awsRealTimeSocket;
			tempSocket.onclose = null;
			tempSocket.onerror = null;
			tempSocket.close(1e3);
			this.awsRealTimeSocket = void 0;
			this.socketStatus = SOCKET_STATUS.CLOSED;
			this._closeSocket();
		}
	}
	maintainKeepAlive() {
		this.keepAliveTimestamp = Date.now();
	}
	keepAliveHeartbeat(connectionTimeoutMs) {
		const currentTime = Date.now();
		if (currentTime - this.keepAliveTimestamp > 65e3) this.connectionStateMonitor.record(CONNECTION_CHANGE.KEEP_ALIVE_MISSED);
		else this.connectionStateMonitor.record(CONNECTION_CHANGE.KEEP_ALIVE);
		if (currentTime - this.keepAliveTimestamp > connectionTimeoutMs) this._errorDisconnect(CONTROL_MSG.TIMEOUT_DISCONNECT);
	}
	_handleIncomingSubscriptionMessage(message) {
		if (typeof message.data !== "string") return;
		const [isData, data] = this._handleSubscriptionData(message);
		if (isData) {
			this.maintainKeepAlive();
			return;
		}
		const { type, id, payload } = data;
		const { observer = null, query = "", variables = {}, startAckTimeoutId, subscriptionReadyCallback, subscriptionFailedCallback } = this.subscriptionObserverMap.get(id) || {};
		if (type === MESSAGE_TYPES.GQL_START_ACK || type === MESSAGE_TYPES.EVENT_SUBSCRIBE_ACK) {
			this.logger.debug(`subscription ready for ${JSON.stringify({
				query,
				variables
			})}`);
			if (typeof subscriptionReadyCallback === "function") subscriptionReadyCallback();
			if (startAckTimeoutId) clearTimeout(startAckTimeoutId);
			dispatchApiEvent({
				event: CONTROL_MSG.SUBSCRIPTION_ACK,
				data: {
					query,
					variables
				},
				message: "Connection established for subscription"
			});
			const subscriptionState = SUBSCRIPTION_STATUS.CONNECTED;
			if (observer) this.subscriptionObserverMap.set(id, {
				observer,
				query,
				variables,
				startAckTimeoutId: void 0,
				subscriptionState,
				subscriptionReadyCallback,
				subscriptionFailedCallback
			});
			this.connectionStateMonitor.record(CONNECTION_CHANGE.CONNECTION_ESTABLISHED);
			return;
		}
		if (type === MESSAGE_TYPES.GQL_CONNECTION_KEEP_ALIVE) {
			this.maintainKeepAlive();
			return;
		}
		if (type === MESSAGE_TYPES.GQL_ERROR || type === MESSAGE_TYPES.EVENT_SUBSCRIBE_ERROR) {
			const subscriptionState = SUBSCRIPTION_STATUS.FAILED;
			if (observer) {
				this.subscriptionObserverMap.set(id, {
					observer,
					query,
					variables,
					startAckTimeoutId,
					subscriptionReadyCallback,
					subscriptionFailedCallback,
					subscriptionState
				});
				let errorMessage = JSON.stringify(payload ?? data);
				if (type === MESSAGE_TYPES.EVENT_SUBSCRIBE_ERROR) {
					const { errors } = JSON.parse(String(message.data));
					if (Array.isArray(errors) && errors.length > 0) {
						const error = errors[0];
						errorMessage = `${error.errorType}: ${error.message}`;
					}
				}
				this.logger.debug(`${CONTROL_MSG.CONNECTION_FAILED}: ${errorMessage}`);
				observer.error({ errors: [{ ...new GraphQLError(`${CONTROL_MSG.CONNECTION_FAILED}: ${errorMessage}`) }] });
				if (startAckTimeoutId) clearTimeout(startAckTimeoutId);
				if (typeof subscriptionFailedCallback === "function") subscriptionFailedCallback();
			}
		}
	}
	_errorDisconnect(msg) {
		this.logger.debug(`Disconnect error: ${msg}`);
		if (this.awsRealTimeSocket) {
			this._closeSocket();
			this.awsRealTimeSocket.close();
		}
		this.socketStatus = SOCKET_STATUS.CLOSED;
	}
	_closeSocket() {
		if (this.keepAliveHeartbeatIntervalId) {
			clearInterval(this.keepAliveHeartbeatIntervalId);
			this.keepAliveHeartbeatIntervalId = void 0;
		}
		this.connectionStateMonitor.record(CONNECTION_CHANGE.CLOSED);
	}
	_timeoutStartSubscriptionAck(subscriptionId) {
		const subscriptionObserver = this.subscriptionObserverMap.get(subscriptionId);
		if (subscriptionObserver) {
			const { observer, query, variables } = subscriptionObserver;
			if (!observer) return;
			this.subscriptionObserverMap.set(subscriptionId, {
				observer,
				query,
				variables,
				subscriptionState: SUBSCRIPTION_STATUS.FAILED
			});
			this._closeSocket();
			this.logger.debug("timeoutStartSubscription", JSON.stringify({
				query,
				variables
			}));
		}
	}
	_initializeWebSocketConnection({ appSyncGraphqlEndpoint, authenticationType, apiKey, region, additionalCustomHeaders }) {
		if (this.socketStatus === SOCKET_STATUS.READY) return;
		return new Promise(async (resolve, reject) => {
			this.promiseArray.push({
				res: resolve,
				rej: reject
			});
			if (this.socketStatus === SOCKET_STATUS.CLOSED) try {
				this.socketStatus = SOCKET_STATUS.CONNECTING;
				const authHeader = await awsRealTimeHeaderBasedAuth({
					authenticationType,
					payload: "{}",
					canonicalUri: this.wsConnectUri,
					apiKey,
					appSyncGraphqlEndpoint,
					region,
					additionalCustomHeaders
				});
				const headerString = authHeader ? JSON.stringify(authHeader) : "";
				const authTokenSubprotocol = `header-${base64Encoder.convert(headerString, {
					urlSafe: true,
					skipPadding: true
				})}`;
				const awsRealTimeUrl = realtimeUrlWithQueryString(appSyncGraphqlEndpoint, queryParamsFromCustomHeaders(additionalCustomHeaders));
				await this._establishRetryableConnection(awsRealTimeUrl, authTokenSubprotocol);
				this.promiseArray.forEach(({ res }) => {
					this.logger.debug("Notifying connection successful");
					res();
				});
				this.socketStatus = SOCKET_STATUS.READY;
				this.promiseArray = [];
			} catch (err) {
				this.logger.debug("Connection exited with", err);
				this.promiseArray.forEach(({ rej }) => {
					rej(err);
				});
				this.promiseArray = [];
				if (this.awsRealTimeSocket && this.awsRealTimeSocket.readyState === WebSocket.OPEN) this.awsRealTimeSocket.close(3001);
				this.awsRealTimeSocket = void 0;
				this.socketStatus = SOCKET_STATUS.CLOSED;
			}
		});
	}
	async _establishRetryableConnection(awsRealTimeUrl, subprotocol) {
		this.logger.debug(`Establishing retryable connection`);
		await jitteredExponentialRetry(this._establishConnection.bind(this), [awsRealTimeUrl, subprotocol], MAX_DELAY_MS);
	}
	async _openConnection(awsRealTimeUrl, subprotocol) {
		return new Promise((resolve, reject) => {
			const newSocket = this._getNewWebSocket(awsRealTimeUrl, [this.wsProtocolName, subprotocol]);
			newSocket.onerror = () => {
				this.logger.debug(`WebSocket connection error`);
			};
			newSocket.onclose = () => {
				this._closeSocket();
				reject(/* @__PURE__ */ new Error("Connection handshake error"));
			};
			newSocket.onopen = () => {
				this.awsRealTimeSocket = newSocket;
				resolve();
			};
		});
	}
	_getNewWebSocket(url, protocol) {
		return new WebSocket(url, protocol);
	}
	async _initiateHandshake() {
		return new Promise((resolve, reject) => {
			if (!this.awsRealTimeSocket) {
				reject(/* @__PURE__ */ new Error("awsRealTimeSocket undefined"));
				return;
			}
			let ackOk = false;
			this.awsRealTimeSocket.onerror = (error) => {
				this.logger.debug(`WebSocket error ${JSON.stringify(error)}`);
			};
			this.awsRealTimeSocket.onclose = (event) => {
				this.logger.debug(`WebSocket closed ${event.reason}`);
				this._closeSocket();
				reject(new Error(JSON.stringify(event)));
			};
			this.awsRealTimeSocket.onmessage = (message) => {
				if (typeof message.data !== "string") return;
				this.logger.debug(`subscription message from AWS AppSyncRealTime: ${message.data} `);
				const data = JSON.parse(message.data);
				const { type } = data;
				const connectionTimeoutMs = this._extractConnectionTimeout(data);
				if (type === MESSAGE_TYPES.GQL_CONNECTION_ACK) {
					ackOk = true;
					this._registerWebsocketHandlers(connectionTimeoutMs);
					resolve("Connected to AWS AppSyncRealTime");
					return;
				}
				if (type === MESSAGE_TYPES.GQL_CONNECTION_ERROR) {
					const { errorType, errorCode } = this._extractErrorCodeAndType(data);
					reject({
						errorType,
						errorCode
					});
				}
			};
			const gqlInit = { type: MESSAGE_TYPES.GQL_CONNECTION_INIT };
			this.awsRealTimeSocket.send(JSON.stringify(gqlInit));
			const checkAckOk = (targetAckOk) => {
				if (!targetAckOk) {
					this.connectionStateMonitor.record(CONNECTION_CHANGE.CONNECTION_FAILED);
					reject(/* @__PURE__ */ new Error(`Connection timeout: ack from AWSAppSyncRealTime was not received after ${CONNECTION_INIT_TIMEOUT} ms`));
				}
			};
			setTimeout(() => {
				checkAckOk(ackOk);
			}, CONNECTION_INIT_TIMEOUT);
		});
	}
	_registerWebsocketHandlers(connectionTimeoutMs) {
		if (!this.awsRealTimeSocket) return;
		this.keepAliveHeartbeatIntervalId = setInterval(() => {
			this.keepAliveHeartbeat(connectionTimeoutMs);
		}, DEFAULT_KEEP_ALIVE_HEARTBEAT_TIMEOUT);
		this.awsRealTimeSocket.onmessage = this._handleIncomingSubscriptionMessage.bind(this);
		this.awsRealTimeSocket.onerror = (err) => {
			this.logger.debug(err);
			this._errorDisconnect(CONTROL_MSG.CONNECTION_CLOSED);
		};
		this.awsRealTimeSocket.onclose = (event) => {
			this.logger.debug(`WebSocket closed ${event.reason}`);
			this._closeSocket();
			this._errorDisconnect(CONTROL_MSG.CONNECTION_CLOSED);
		};
	}
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/Providers/AWSAppSyncRealTimeProvider/index.mjs
var PROVIDER_NAME$1 = "AWSAppSyncRealTimeProvider";
var WS_PROTOCOL_NAME$1 = "graphql-ws";
var CONNECT_URI$1 = "/connect";
var AWSAppSyncRealTimeProvider = class extends AWSWebSocketProvider {
	constructor() {
		super({
			providerName: PROVIDER_NAME$1,
			wsProtocolName: WS_PROTOCOL_NAME$1,
			connectUri: CONNECT_URI$1
		});
	}
	getProviderName() {
		return PROVIDER_NAME$1;
	}
	subscribe(options, customUserAgentDetails) {
		return super.subscribe(options, customUserAgentDetails);
	}
	async _prepareSubscriptionPayload({ options, subscriptionId, customUserAgentDetails, additionalCustomHeaders, libraryConfigHeaders }) {
		const { appSyncGraphqlEndpoint, authenticationType, query, variables, apiKey, region } = options;
		const serializedData = JSON.stringify({
			query,
			variables
		});
		const subscriptionMessage = {
			id: subscriptionId,
			payload: {
				data: serializedData,
				extensions: { authorization: {
					...await awsRealTimeHeaderBasedAuth({
						apiKey,
						appSyncGraphqlEndpoint,
						authenticationType,
						payload: serializedData,
						canonicalUri: "",
						region,
						additionalCustomHeaders
					}),
					...libraryConfigHeaders,
					...additionalCustomHeaders,
					[USER_AGENT_HEADER$2]: getAmplifyUserAgent(customUserAgentDetails)
				} }
			},
			type: MESSAGE_TYPES.GQL_START
		};
		return JSON.stringify(subscriptionMessage);
	}
	_handleSubscriptionData(message) {
		this.logger.debug(`subscription message from AWS AppSync RealTime: ${message.data}`);
		const { id = "", payload, type } = JSON.parse(String(message.data));
		const { observer = null, query = "", variables = {} } = this.subscriptionObserverMap.get(id) || {};
		this.logger.debug({
			id,
			observer,
			query,
			variables
		});
		if (type === MESSAGE_TYPES.DATA && payload && payload.data) {
			if (observer) observer.next(payload);
			else this.logger.debug(`observer not found for id: ${id}`);
			return [true, {
				id,
				type,
				payload
			}];
		}
		return [false, {
			id,
			type,
			payload
		}];
	}
	_unsubscribeMessage(subscriptionId) {
		return {
			id: subscriptionId,
			type: MESSAGE_TYPES.GQL_STOP
		};
	}
	_extractConnectionTimeout(data) {
		const { payload: { connectionTimeoutMs = DEFAULT_KEEP_ALIVE_TIMEOUT } = {} } = data;
		return connectionTimeoutMs;
	}
	_extractErrorCodeAndType(data) {
		const { payload: { errors: [{ errorType = "", errorCode = 0 } = {}] = [] } = {} } = data;
		return {
			errorCode,
			errorType
		};
	}
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/utils/errors/GraphQLApiError.mjs
/**
* @internal
*/
var GraphQLApiError = class GraphQLApiError extends AmplifyError {
	constructor(params) {
		super(params);
		this.constructor = GraphQLApiError;
		Object.setPrototypeOf(this, GraphQLApiError.prototype);
	}
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/utils/errors/validation.mjs
var APIValidationErrorCode;
(function(APIValidationErrorCode) {
	APIValidationErrorCode["NoAuthSession"] = "NoAuthSession";
	APIValidationErrorCode["NoRegion"] = "NoRegion";
	APIValidationErrorCode["NoCustomEndpoint"] = "NoCustomEndpoint";
})(APIValidationErrorCode || (APIValidationErrorCode = {}));
var validationErrorMap = {
	[APIValidationErrorCode.NoAuthSession]: { message: "Auth session should not be empty." },
	[APIValidationErrorCode.NoRegion]: { message: "Missing region." },
	[APIValidationErrorCode.NoCustomEndpoint]: { message: "Custom endpoint region is present without custom endpoint." }
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/utils/errors/assertValidationError.mjs
/**
* @internal
*/
function assertValidationError(assertion, name) {
	const { message, recoverySuggestion } = validationErrorMap[name];
	if (!assertion) throw new GraphQLApiError({
		name,
		message,
		recoverySuggestion
	});
}
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/utils/resolveConfig.mjs
var logger = new ConsoleLogger("GraphQLAPI resolveConfig");
/**
* @internal
*/
var resolveConfig = (amplify) => {
	const config = amplify.getConfig();
	if (!config.API?.GraphQL) logger.warn("The API configuration is missing. This is likely due to Amplify.configure() not being called prior to generateClient().");
	const { apiKey, customEndpoint, customEndpointRegion, defaultAuthMode, endpoint, region } = config.API?.GraphQL ?? {};
	assertValidationError(!(!customEndpoint && customEndpointRegion), APIValidationErrorCode.NoCustomEndpoint);
	return {
		apiKey,
		customEndpoint,
		customEndpointRegion,
		defaultAuthMode,
		endpoint,
		region
	};
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/utils/resolveLibraryOptions.mjs
/**
* @internal
*/
var resolveLibraryOptions = (amplify) => {
	return {
		headers: amplify.libraryOptions?.API?.GraphQL?.headers,
		withCredentials: amplify.libraryOptions?.API?.GraphQL?.withCredentials
	};
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/utils/errors/repackageAuthError.mjs
/**
* Checks to see if the given response or subscription message contains an
* Unauthorized error. If it does, it changes the error message to include instructions
* for the app developer.
*/
function repackageUnauthorizedError(content) {
	if (content.errors && Array.isArray(content.errors)) content.errors.forEach((e) => {
		if (isUnauthorizedError(e)) {
			e.message = "Unauthorized";
			e.recoverySuggestion = "If you're calling an Amplify-generated API, make sure to set the \"authMode\" in generateClient({ authMode: '...' }) to the backend authorization rule's auth provider ('apiKey', 'userPool', 'iam', 'oidc', 'lambda')";
		}
	});
	return content;
}
function isUnauthorizedError(error) {
	if (error?.originalError?.name?.startsWith("UnauthorizedException")) return true;
	if (error.message?.startsWith("Connection failed:") && error.message?.includes("Permission denied")) return true;
	return false;
}
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/types/index.mjs
var GraphQLAuthError;
(function(GraphQLAuthError) {
	GraphQLAuthError["NO_API_KEY"] = "No api-key configured";
	GraphQLAuthError["NO_CURRENT_USER"] = "No current user";
	GraphQLAuthError["NO_CREDENTIALS"] = "No credentials";
	GraphQLAuthError["NO_FEDERATED_JWT"] = "No federated jwt";
	GraphQLAuthError["NO_AUTH_TOKEN"] = "No auth token specified";
})(GraphQLAuthError || (GraphQLAuthError = {}));
var __amplify = Symbol("amplify");
var __authMode = Symbol("authMode");
var __authToken = Symbol("authToken");
var __apiKey = Symbol("apiKey");
var __headers = Symbol("headers");
var __endpoint = Symbol("endpoint");
function getInternals(client) {
	const c = client;
	return {
		amplify: c[__amplify],
		apiKey: c[__apiKey],
		authMode: c[__authMode],
		authToken: c[__authToken],
		endpoint: c[__endpoint],
		headers: c[__headers]
	};
}
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/utils/errors/constants.mjs
var NO_API_KEY = {
	name: "NoApiKey",
	message: GraphQLAuthError.NO_API_KEY,
	recoverySuggestion: "The API request was made with `authMode: \"apiKey\"` but no API Key was passed into `Amplify.configure()`. Review if your API key is passed into the `Amplify.configure()` function."
};
var NO_VALID_CREDENTIALS = {
	name: "NoCredentials",
	message: GraphQLAuthError.NO_CREDENTIALS,
	recoverySuggestion: `The API request was made with \`authMode: "iam"\` but no authentication credentials are available.

If you intended to make a request using an authenticated role, review if your user is signed in before making the request.

If you intend to make a request using an unauthenticated role or also known as "guest access", verify if "Auth.Cognito.allowGuestAccess" is set to "true" in the \`Amplify.configure()\` function.`
};
var NO_VALID_AUTH_TOKEN = {
	name: "NoValidAuthTokens",
	message: GraphQLAuthError.NO_FEDERATED_JWT,
	recoverySuggestion: "If you intended to make an authenticated API request, review if the current user is signed in."
};
var NO_SIGNED_IN_USER = {
	name: "NoSignedUser",
	message: GraphQLAuthError.NO_CURRENT_USER,
	recoverySuggestion: "Review the underlying exception field for more details. If you intended to make an authenticated API request, review if the current user is signed in."
};
var NO_AUTH_TOKEN_HEADER = {
	name: "NoAuthorizationHeader",
	message: GraphQLAuthError.NO_AUTH_TOKEN,
	recoverySuggestion: "The API request was made with `authMode: \"lambda\"` but no `authToken` is set. Review if a valid authToken is passed into the request options or in the `Amplify.configure()` function."
};
var NO_ENDPOINT = {
	name: "NoEndpoint",
	message: "No GraphQL endpoint configured in `Amplify.configure()`.",
	recoverySuggestion: "Review if the GraphQL API endpoint is set in the `Amplify.configure()` function."
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/utils/errors/createGraphQLResultWithError.mjs
var createGraphQLResultWithError = (error) => {
	return {
		data: {},
		errors: [new GraphQLError(error.message, null, null, null, null, error)]
	};
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/internals/utils/runtimeTypeGuards/isGraphQLResponseWithErrors.mjs
function isGraphQLResponseWithErrors(response) {
	if (!response) return false;
	const r = response;
	return Array.isArray(r.errors) && r.errors.length > 0;
}
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/internals/graphqlAuth.mjs
async function headerBasedAuth(amplify, authMode, apiKey, additionalHeaders = {}) {
	let headers = {};
	switch (authMode) {
		case "apiKey":
			if (!apiKey) throw new GraphQLApiError(NO_API_KEY);
			headers = { "X-Api-Key": apiKey };
			break;
		case "iam":
			if ((await amplify.Auth.fetchAuthSession()).credentials === void 0) throw new GraphQLApiError(NO_VALID_CREDENTIALS);
			break;
		case "oidc":
		case "userPool": {
			let token;
			try {
				token = (await amplify.Auth.fetchAuthSession()).tokens?.accessToken.toString();
			} catch (e) {
				throw new GraphQLApiError({
					...NO_SIGNED_IN_USER,
					underlyingError: e
				});
			}
			if (!token) throw new GraphQLApiError(NO_VALID_AUTH_TOKEN);
			headers = { Authorization: token };
			break;
		}
		case "lambda":
			if (typeof additionalHeaders === "object" && !additionalHeaders.Authorization) throw new GraphQLApiError(NO_AUTH_TOKEN_HEADER);
			headers = { Authorization: additionalHeaders.Authorization };
			break;
	}
	return headers;
}
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/internals/InternalGraphQLAPI.mjs
var USER_AGENT_HEADER$1 = "x-amz-user-agent";
var isAmplifyInstance = (amplify) => {
	return typeof amplify !== "function";
};
/**
* Export Cloud Logic APIs
*/
var InternalGraphQLAPIClass = class {
	constructor() {
		/**
		* @private
		*/
		this.appSyncRealTime = /* @__PURE__ */ new Map();
		this._api = {
			post: post$2,
			cancelREST: cancel$1,
			isCancelErrorREST: isCancelError,
			updateRequestToBeCancellable
		};
	}
	getModuleName() {
		return "InternalGraphQLAPI";
	}
	/**
	* to get the operation type
	* @param operation
	*/
	getGraphqlOperationType(operation) {
		const [{ operation: operationType }] = parse(operation).definitions;
		return operationType;
	}
	/**
	* Executes a GraphQL operation
	*
	* @param options - GraphQL Options
	* @param [additionalHeaders] - headers to merge in after any `libraryConfigHeaders` set in the config
	* @returns An Observable if the query is a subscription query, else a promise of the graphql result.
	*/
	graphql(amplify, { query: paramQuery, variables = {}, authMode, authToken, endpoint, apiKey }, additionalHeaders, customUserAgentDetails) {
		const query = typeof paramQuery === "string" ? parse(paramQuery) : parse(print(paramQuery));
		const [operationDef = {}] = query.definitions.filter((def) => def.kind === "OperationDefinition");
		const { operation: operationType } = operationDef;
		const headers = additionalHeaders || {};
		switch (operationType) {
			case "query":
			case "mutation": {
				const abortController = new AbortController();
				let responsePromise;
				if (isAmplifyInstance(amplify)) responsePromise = this._graphql(amplify, {
					query,
					variables,
					authMode,
					apiKey,
					endpoint
				}, headers, abortController, customUserAgentDetails, authToken);
				else {
					const wrapper = async (amplifyInstance) => {
						return await this._graphql(amplifyInstance, {
							query,
							variables,
							authMode,
							apiKey,
							endpoint
						}, headers, abortController, customUserAgentDetails, authToken);
					};
					responsePromise = amplify(wrapper);
				}
				this._api.updateRequestToBeCancellable(responsePromise, abortController);
				return responsePromise;
			}
			case "subscription": return this._graphqlSubscribe(amplify, {
				query,
				variables,
				authMode,
				apiKey,
				endpoint
			}, headers, customUserAgentDetails, authToken);
			default: throw new Error(`invalid operation type: ${operationType}`);
		}
	}
	async _graphql(amplify, { query, variables, authMode: authModeOverride, endpoint: endpointOverride, apiKey: apiKeyOverride }, additionalHeaders = {}, abortController, customUserAgentDetails, authToken) {
		const { apiKey, region, endpoint: appSyncGraphqlEndpoint, customEndpoint, customEndpointRegion, defaultAuthMode } = resolveConfig(amplify);
		const initialAuthMode = authModeOverride || defaultAuthMode || "iam";
		const authMode = initialAuthMode === "identityPool" ? "iam" : initialAuthMode;
		/**
		* Retrieve library options from Amplify configuration.
		* `customHeaders` here are from the Amplify configuration options,
		* and are for non-AppSync endpoints only. These are *not* the same as
		* `additionalHeaders`, which are custom headers that are either 1)
		* included when configuring the API client or 2) passed along with
		* individual requests.
		*/
		const { headers: customHeaders, withCredentials } = resolveLibraryOptions(amplify);
		/**
		* Client or request-specific custom headers that may or may not be
		* returned by a function:
		*/
		let additionalCustomHeaders;
		if (typeof additionalHeaders === "function") additionalCustomHeaders = await additionalHeaders({
			method: "POST",
			url: new AmplifyUrl(endpointOverride || customEndpoint || appSyncGraphqlEndpoint || "").toString(),
			queryString: print(query)
		});
		else additionalCustomHeaders = additionalHeaders;
		if (authToken) additionalCustomHeaders = {
			...additionalCustomHeaders,
			Authorization: authToken
		};
		const authHeaders = await headerBasedAuth(amplify, authMode, apiKeyOverride ?? apiKey, additionalCustomHeaders);
		const headers = {
			...!customEndpoint && authHeaders,
			...customEndpoint && (customEndpointRegion ? authHeaders : {}) || {},
			...customHeaders && await customHeaders({
				query: print(query),
				variables
			}),
			...additionalCustomHeaders,
			...!customEndpoint && { [USER_AGENT_HEADER$1]: getAmplifyUserAgent(customUserAgentDetails) }
		};
		const body = {
			query: print(query),
			variables: variables || null
		};
		let signingServiceInfo;
		/**
		* We do not send the signing service info to the REST API under the
		* following conditions (i.e. it will not sign the request):
		*   - there is a custom endpoint but no region
		*   - the auth mode is `none`, or `apiKey`
		*   - the auth mode is a type other than the types listed below
		*/
		if (customEndpoint && !customEndpointRegion || authMode !== "oidc" && authMode !== "userPool" && authMode !== "iam" && authMode !== "lambda") signingServiceInfo = void 0;
		else signingServiceInfo = {
			service: !customEndpointRegion ? "appsync" : "execute-api",
			region: !customEndpointRegion ? region : customEndpointRegion
		};
		const endpoint = endpointOverride || customEndpoint || appSyncGraphqlEndpoint;
		if (!endpoint) throw createGraphQLResultWithError(new GraphQLApiError(NO_ENDPOINT));
		let response;
		try {
			const { body: responseBody } = await this._api.post(amplify, {
				url: new AmplifyUrl(endpoint),
				options: {
					headers,
					body,
					signingServiceInfo,
					withCredentials
				},
				abortController
			});
			response = await responseBody.json();
		} catch (error) {
			if (this.isCancelError(error)) throw error;
			response = createGraphQLResultWithError(error);
		}
		if (isGraphQLResponseWithErrors(response)) throw repackageUnauthorizedError(response);
		return response;
	}
	/**
	* Checks to see if an error thrown is from an api request cancellation
	* @param {any} error - Any error
	* @return {boolean} - A boolean indicating if the error was from an api request cancellation
	*/
	isCancelError(error) {
		return this._api.isCancelErrorREST(error);
	}
	/**
	* Cancels an inflight request. Only applicable for graphql queries and mutations
	* @param {any} request - request to cancel
	* @returns - A boolean indicating if the request was cancelled
	*/
	cancel(request, message) {
		return this._api.cancelREST(request, message);
	}
	_graphqlSubscribe(amplify, { query, variables, authMode: authModeOverride, apiKey: apiKeyOverride, endpoint }, additionalHeaders = {}, customUserAgentDetails, authToken) {
		const config = resolveConfig(amplify);
		const initialAuthMode = authModeOverride || config?.defaultAuthMode || "iam";
		const authMode = initialAuthMode === "identityPool" ? "iam" : initialAuthMode;
		/**
		* Retrieve library options from Amplify configuration.
		* `libraryConfigHeaders` are from the Amplify configuration options,
		* and will not be overwritten by other custom headers. These are *not*
		* the same as `additionalHeaders`, which are custom headers that are
		* either 1)included when configuring the API client or 2) passed along
		* with individual requests.
		*/
		const { headers: libraryConfigHeaders } = resolveLibraryOptions(amplify);
		const appSyncGraphqlEndpoint = endpoint ?? config?.endpoint;
		const memoKey = appSyncGraphqlEndpoint ?? "none";
		const realtimeProvider = this.appSyncRealTime.get(memoKey) ?? new AWSAppSyncRealTimeProvider();
		this.appSyncRealTime.set(memoKey, realtimeProvider);
		return realtimeProvider.subscribe({
			query: print(query),
			variables,
			appSyncGraphqlEndpoint,
			region: config?.region,
			authenticationType: authMode,
			apiKey: apiKeyOverride ?? config?.apiKey,
			additionalHeaders,
			authToken,
			libraryConfigHeaders
		}, customUserAgentDetails).pipe(catchError((e) => {
			if (e.errors) throw repackageUnauthorizedError(e);
			throw e;
		}));
	}
};
new InternalGraphQLAPIClass();
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/utils/resolveOwnerFields.mjs
/**
* Given an introspection schema model, returns all owner fields.
*
* @param model Model from an introspection schema
* @returns List of owner field names
*/
function resolveOwnerFields(model) {
	const ownerFields = /* @__PURE__ */ new Set();
	for (const attr of model.attributes || []) if (isAuthAttribute(attr)) {
		for (const rule of attr.properties.rules) if (rule.allow === "owner") ownerFields.add(rule.ownerField || "owner");
		else if (rule.allow === "groups" && rule.groupsField !== void 0) ownerFields.add(rule.groupsField);
	}
	return Array.from(ownerFields);
}
/**
* Type guard that identifies an auth attribute with an attached rules list that
* specifies an `allow` attribute at a minimum.
*
* @param attribute Any object. Ideally a model introspection schema model attribute
* @returns True if given object is an auth attribute
*/
function isAuthAttribute(attribute) {
	if (attribute?.type === "auth") {
		if (typeof attribute?.properties === "object") {
			if (Array.isArray(attribute?.properties?.rules)) return (attribute?.properties?.rules).every((rule) => !!rule.allow);
		}
	}
	return false;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/utils/stringTransformation.mjs
/**
* @param s string to capitalize
* @returns capitalized string
*/
function capitalize(s) {
	return `${s[0].toUpperCase()}${s.slice(1)}`;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/utils/selfAwareAsync.mjs
/**
* Executes an `async` resolver function, providing the `Promise`-to-be-returned as the
* first argument to the resolver so that the resolver can refer to the `Promise` that
* external callers will see.
*
* ```ts
* const outer = selfAwareAsync(async inner => {
*  console.log(outer === inner); // true
* });
* ```
*
* This utility exists to reduce boilerplate in cases where promise resolving code needs
* to track or register its "own" `Promise` *as seen by the caller* in some way. E.g.,
* when mapping `Promise` chains for `client.cancel()`.
*
* @param resolver
* @returns
*/
function selfAwareAsync(resolver) {
	let resolve;
	let reject;
	const resultPromise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	resolver(resultPromise).then((result) => {
		resolve(result);
	}).catch((error) => {
		reject(error);
	});
	return resultPromise;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/cancellation.mjs
/**
* A map of cancellable promise "extensions".
*
* Each entry value must either be a directly `cancel()`-able promise, or must
* refer to another entry.
*
* When cancellation of a promise is requested, cancel
* will check to see if the promise exists in the map. If it does, it pulls
* the value and repeats the check. If not, it will perform the underlying
* cancel operation.
*/
var promiseMap = /* @__PURE__ */ new WeakMap();
function extendCancellability(existingCancellablePromise, newPromiseToRegister) {
	promiseMap.set(newPromiseToRegister, existingCancellablePromise);
	return existingCancellablePromise.finally(() => {
		promiseMap.delete(newPromiseToRegister);
	});
}
/**
* Wraps the existing `cancel()` method with logic to iteratively search for
* the corresponding base level promise, if needed, that the core graphql client
* knows how to cancel.
*
* @param client
*/
function upgradeClientCancellation(client) {
	const innerCancel = client.cancel.bind(client);
	client.cancel = function(promise, message) {
		const visited = /* @__PURE__ */ new Set();
		let targetPromise = promise;
		while (targetPromise && promiseMap.has(targetPromise)) {
			if (visited.has(targetPromise)) throw new Error("A cycle was detected in the modeled graphql cancellation chain. This is a bug. Please report it!");
			visited.add(targetPromise);
			targetPromise = promiseMap.get(targetPromise);
		}
		return innerCancel(targetPromise, message);
	};
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/APIClient.mjs
var connectionType = {
	HAS_ONE: "HAS_ONE",
	HAS_MANY: "HAS_MANY",
	BELONGS_TO: "BELONGS_TO"
};
var skGraphQlFieldTypeMap = {
	ID: "ID",
	String: "String",
	AWSDate: "String",
	AWSTime: "String",
	AWSDateTime: "String",
	AWSTimestamp: "Int",
	AWSEmail: "String",
	AWSPhone: "String",
	AWSURL: "String",
	AWSIPAddress: "String",
	AWSJSON: "String",
	Boolean: "Boolean",
	Int: "Int",
	Float: "Float"
};
var resolvedSkName = (sk) => {
	if (sk.length === 1) return sk[0];
	else return sk.reduce((acc, curr, idx) => {
		if (idx === 0) return curr;
		else return acc + capitalize(curr);
	}, "");
};
/**
* Crawls a model tree, starting with a given **individual** model instance record, looking
* for related hasMany children to extract from their `items` containers.
*
* E.g., if we have a record like this:
*
* ```js
* {
*   id: 'some-id',
*   children: {
*     items: [
*       { name: 'a' }
*       { name: 'b' }
*       { name: 'c' }
*     ]
*   }
* }
* ```
*
* And if `children` refers to *an array of another model* (as opposed to a custom type),
* the `items` will be extracted. We do this because `items` is just the mechanism for nesting
* child records -- we don't want customers to have to dig the items out in application code.
* Ultimately, we return this "flattened" structure:
*
* ```js
* {
*   id: 'some-id',
*   children: [
*     { name: 'a' }
*     { name: 'b' }
*     { name: 'c' }
*   ]
* }
* ```
*
* Notably, an identical record could be the result of a nested custom type that contains an
* `items` property. This will *not* be flattened, because in that case the `items` property is
* actually part of the customer's schema. Similarly if a model contains an explicit `items` field.
*
* @param modelIntrospection Top-level model introspection schema.
* @param modelName The name of the model. Can be `undefined`. E.g., for customOperation return types.
* @param modelRecord The individual "model instance record" to normalize.
*/
var flattenItems = (modelIntrospection, modelName, modelRecord) => {
	if (!modelRecord) return null;
	const mapped = {};
	for (const [fieldName, value] of Object.entries(modelRecord)) {
		const fieldDef = modelName ? modelIntrospection.models[modelName]?.fields[fieldName] : void 0;
		const dvPair = {
			fieldDef,
			value
		};
		if (isRelatedModelItemsArrayPair(dvPair)) mapped[fieldName] = dvPair.value.items.map((itemValue) => flattenItems(modelIntrospection, dvPair.fieldDef.type.model, itemValue));
		else if (isRelatedModelProperty(fieldDef)) mapped[fieldName] = flattenItems(modelIntrospection, fieldDef.type.model, value);
		else mapped[fieldName] = value;
	}
	return mapped;
};
/**
* Determines whether the given field definition and associated result value
* represent a related model array from a HasMany-type relationship.
*
* @param dv Pair of field definition and associated result value
* @returns
*/
function isRelatedModelItemsArrayPair(dv) {
	return typeof dv.fieldDef?.type === "object" && "model" in dv.fieldDef.type && typeof dv.fieldDef.type.model === "string" && dv.fieldDef.isArray && Array.isArray(dv.value?.items);
}
/**
* Determines whether the given field definition represents a relationship
* to another model.
*
* @param fieldDef
* @returns
*/
function isRelatedModelProperty(fieldDef) {
	return typeof fieldDef?.type === "object" && "model" in fieldDef.type && typeof fieldDef.type.model === "string";
}
function initializeModel(client, modelName, result, modelIntrospection, authMode, authToken, context = false) {
	const introModel = modelIntrospection.models[modelName];
	const introModelFields = introModel.fields;
	const modelFields = Object.entries(introModelFields).filter(([_, field]) => field?.type?.model !== void 0).map(([fieldName]) => fieldName);
	return result.map((record) => {
		if (record === null || record === void 0) return record;
		const initializedRelationshipFields = {};
		for (const fieldName of modelFields) {
			const modelField = introModelFields[fieldName];
			const relatedModelName = (modelField?.type).model;
			const relatedModel = modelIntrospection.models[relatedModelName];
			const relatedModelPKFieldName = relatedModel.primaryKeyInfo.primaryKeyFieldName;
			const relatedModelSKFieldNames = relatedModel.primaryKeyInfo.sortKeyFieldNames;
			const relationType = modelField.association?.connectionType;
			let connectionFields = [];
			if (modelField.association && "associatedWith" in modelField.association) connectionFields = modelField.association.associatedWith;
			const targetNames = [];
			if (modelField.association && "targetNames" in modelField.association) targetNames.push(...modelField.association.targetNames);
			switch (relationType) {
				case connectionType.BELONGS_TO: {
					const sortKeyValues = relatedModelSKFieldNames.reduce((acc, curVal) => {
						if (record[curVal]) acc[curVal] = record[curVal];
						return acc;
					}, {});
					if (client.models[relatedModelName]?.get === void 0) break;
					if (context) initializedRelationshipFields[fieldName] = (contextSpec, options) => {
						if (record[targetNames[0]]) return client.models[relatedModelName].get(contextSpec, {
							[relatedModelPKFieldName]: record[targetNames[0]],
							...sortKeyValues
						}, {
							authMode: options?.authMode || authMode,
							authToken: options?.authToken || authToken
						});
						return { data: null };
					};
					else initializedRelationshipFields[fieldName] = (options) => {
						if (record[targetNames[0]]) return client.models[relatedModelName].get({
							[relatedModelPKFieldName]: record[targetNames[0]],
							...sortKeyValues
						}, {
							authMode: options?.authMode || authMode,
							authToken: options?.authToken || authToken
						});
						return { data: null };
					};
					break;
				}
				case connectionType.HAS_ONE:
				case connectionType.HAS_MANY: {
					/**
					* If the loader is a HAS_ONE, we just need to attempt to grab the first item
					* from the result.
					*/
					const mapResult = relationType === connectionType.HAS_ONE ? (result) => {
						return {
							data: result?.data.shift() || null,
							errors: result.errors,
							extensions: result.extensions
						};
					} : (result) => result;
					const parentPk = introModel.primaryKeyInfo.primaryKeyFieldName;
					const parentSK = introModel.primaryKeyInfo.sortKeyFieldNames;
					const relatedModelField = relatedModel.fields[connectionFields[0]];
					if (relatedModelField.type.model) {
						let relatedTargetNames = [];
						if (relatedModelField.association && "targetNames" in relatedModelField.association) relatedTargetNames = relatedModelField.association?.targetNames;
						const hasManyFilter = relatedTargetNames.map((field, idx) => {
							if (idx === 0) return { [field]: { eq: record[parentPk] } };
							return { [field]: { eq: record[parentSK[idx - 1]] } };
						});
						if (client.models[relatedModelName]?.list === void 0) break;
						if (context) initializedRelationshipFields[fieldName] = (contextSpec, options) => {
							if (record[parentPk]) return selfAwareAsync(async (resultPromise) => {
								return mapResult(await extendCancellability(client.models[relatedModelName].list(contextSpec, {
									filter: { and: hasManyFilter },
									limit: options?.limit,
									nextToken: options?.nextToken,
									authMode: options?.authMode || authMode,
									authToken: options?.authToken || authToken
								}), resultPromise));
							});
							return [];
						};
						else initializedRelationshipFields[fieldName] = (options) => {
							if (record[parentPk]) return selfAwareAsync(async (resultPromise) => {
								return mapResult(await extendCancellability(client.models[relatedModelName].list({
									filter: { and: hasManyFilter },
									limit: options?.limit,
									nextToken: options?.nextToken,
									authMode: options?.authMode || authMode,
									authToken: options?.authToken || authToken
								}), resultPromise));
							});
							return [];
						};
						break;
					}
					const hasManyFilter = connectionFields.map((field, idx) => {
						if (idx === 0) return { [field]: { eq: record[parentPk] } };
						return { [field]: { eq: record[parentSK[idx - 1]] } };
					});
					if (client.models[relatedModelName]?.list === void 0) break;
					if (context) initializedRelationshipFields[fieldName] = (contextSpec, options) => {
						if (record[parentPk]) return selfAwareAsync(async (resultPromise) => {
							return mapResult(await extendCancellability(client.models[relatedModelName].list(contextSpec, {
								filter: { and: hasManyFilter },
								limit: options?.limit,
								nextToken: options?.nextToken,
								authMode: options?.authMode || authMode,
								authToken: options?.authToken || authToken
							}), resultPromise));
						});
						return [];
					};
					else initializedRelationshipFields[fieldName] = (options) => {
						if (record[parentPk]) return selfAwareAsync(async (resultPromise) => {
							return mapResult(await extendCancellability(client.models[relatedModelName].list({
								filter: { and: hasManyFilter },
								limit: options?.limit,
								nextToken: options?.nextToken,
								authMode: options?.authMode || authMode,
								authToken: options?.authToken || authToken
							}), resultPromise));
						});
						return [];
					};
					break;
				}
			}
		}
		return {
			...record,
			...initializedRelationshipFields
		};
	});
}
var graphQLOperationsInfo = {
	CREATE: {
		operationPrefix: "create",
		usePlural: false
	},
	GET: {
		operationPrefix: "get",
		usePlural: false
	},
	UPDATE: {
		operationPrefix: "update",
		usePlural: false
	},
	DELETE: {
		operationPrefix: "delete",
		usePlural: false
	},
	LIST: {
		operationPrefix: "list",
		usePlural: true
	},
	INDEX_QUERY: {
		operationPrefix: "",
		usePlural: false
	},
	ONCREATE: {
		operationPrefix: "onCreate",
		usePlural: false
	},
	ONUPDATE: {
		operationPrefix: "onUpdate",
		usePlural: false
	},
	ONDELETE: {
		operationPrefix: "onDelete",
		usePlural: false
	},
	OBSERVEQUERY: {
		operationPrefix: "observeQuery",
		usePlural: false
	}
};
var SELECTION_SET_WILDCARD = "*";
var getDefaultSelectionSetForNonModelWithIR = (nonModelDefinition, modelIntrospection) => {
	const { fields } = nonModelDefinition;
	const mappedFields = Object.values(fields).map(({ type, name }) => {
		if (typeof type.enum === "string") return [name, FIELD_IR];
		if (typeof type.nonModel === "string") return [name, getDefaultSelectionSetForNonModelWithIR(modelIntrospection.nonModels[type.nonModel], modelIntrospection)];
		if (typeof type === "string") return [name, FIELD_IR];
	}).filter((pair) => pair !== void 0);
	return Object.fromEntries(mappedFields);
};
var getDefaultSelectionSetForModelWithIR = (modelDefinition, modelIntrospection) => {
	const { fields } = modelDefinition;
	const mappedFields = Object.values(fields).map(({ type, name }) => {
		if (typeof type.enum === "string" || typeof type === "string") return [name, FIELD_IR];
		if (typeof type.nonModel === "string") return [name, getDefaultSelectionSetForNonModelWithIR(modelIntrospection.nonModels[type.nonModel], modelIntrospection)];
	}).filter((pair) => pair !== void 0);
	const ownerFields = resolveOwnerFields(modelDefinition).map((field) => [field, FIELD_IR]);
	return Object.fromEntries(mappedFields.concat(ownerFields));
};
function defaultSelectionSetForModel(modelDefinition) {
	const { fields } = modelDefinition;
	const explicitFields = Object.values(fields).map(({ type, name }) => {
		if (typeof type === "string") return name;
		if (typeof type === "object") {
			if (typeof type?.enum === "string") return name;
			else if (typeof type?.nonModel === "string") return `${name}.${SELECTION_SET_WILDCARD}`;
		}
	}).filter(Boolean);
	const ownerFields = resolveOwnerFields(modelDefinition);
	return Array.from(new Set(explicitFields.concat(ownerFields)));
}
var FIELD_IR = "";
/**
* Generates nested Custom Selection Set IR from path
*
* @param modelDefinitions
* @param modelName
* @param selectionSet - array of object paths
* @example
* ### Given
* `selectionSet = ['id', 'comments.post.id']`
* ### Returns
* ```ts
* {
*   id: '',
*   comments: {
*     items: { post: { id: '' } }
*   }
* }
* ```
*/
function customSelectionSetToIR(modelIntrospection, modelName, selectionSet) {
	const dotNotationToObject = (path, modelOrNonModelName) => {
		const [fieldName, ...rest] = path.split(".");
		const nested = rest[0];
		const modelOrNonModelDefinition = modelIntrospection.models[modelOrNonModelName] ?? modelIntrospection.nonModels[modelOrNonModelName];
		const modelOrNonModelFields = modelOrNonModelDefinition?.fields;
		const relatedModel = modelOrNonModelFields?.[fieldName]?.type?.model;
		const relatedModelDefinition = modelIntrospection.models[relatedModel];
		const relatedNonModel = modelOrNonModelFields?.[fieldName]?.type?.nonModel;
		const relatedNonModelDefinition = modelIntrospection.nonModels[relatedNonModel];
		const isModelOrNonModelOrFieldType = relatedModelDefinition ? "model" : relatedNonModelDefinition ? "nonModel" : "field";
		if (isModelOrNonModelOrFieldType === "nonModel") {
			let result = {};
			if (!nested) throw Error(`${fieldName} must declare a wildcard (*) or a field of custom type ${relatedNonModel}`);
			if (nested === SELECTION_SET_WILDCARD) result = { [fieldName]: getDefaultSelectionSetForNonModelWithIR(relatedNonModelDefinition, modelIntrospection) };
			else result = { [fieldName]: dotNotationToObject(rest.join("."), relatedNonModel) };
			return result;
		} else if (isModelOrNonModelOrFieldType === "model") {
			let result = {};
			if (!nested) throw Error(`${fieldName} must declare a wildcard (*) or a field of model ${relatedModel}`);
			if (nested === SELECTION_SET_WILDCARD) {
				const nestedRelatedModelDefinition = modelIntrospection.models[relatedModel];
				result = { [fieldName]: getDefaultSelectionSetForModelWithIR(nestedRelatedModelDefinition, modelIntrospection) };
			} else result = { [fieldName]: dotNotationToObject(rest.join("."), relatedModel) };
			if (modelOrNonModelFields[fieldName]?.isArray) result = { [fieldName]: { items: result[fieldName] } };
			return result;
		} else {
			const modelField = modelOrNonModelFields?.[fieldName];
			const nonModelDefinition = modelIntrospection.nonModels[modelOrNonModelName];
			const nonModelField = nonModelDefinition?.fields?.[fieldName];
			if (!nonModelDefinition) {
				const isOwnerField = resolveOwnerFields(modelOrNonModelDefinition).includes(fieldName);
				if (!modelField && !isOwnerField) throw Error(`${fieldName} is not a field of model ${modelOrNonModelName}`);
			} else if (!nonModelField) throw Error(`${fieldName} is not a field of custom type ${modelOrNonModelName}`);
			return { [fieldName]: FIELD_IR };
		}
	};
	return selectionSet.reduce((resultObj, path) => deepMergeSelectionSetObjects(dotNotationToObject(path, modelName), resultObj), {});
}
/**
* Stringifies selection set IR
* * @example
* ### Given
* ```ts
* {
*   id: '',
*   comments: {
*     items: { post: { id: '' } }
*   }
* }
* ```
* ### Returns
* `'id comments { items { post { id } } }'`
*/
function selectionSetIRToString(obj) {
	const res = [];
	Object.entries(obj).forEach(([fieldName, value]) => {
		if (value === FIELD_IR) res.push(fieldName);
		else if (typeof value === "object" && value !== null) if (value?.items) res.push(fieldName, "{", "items", "{", selectionSetIRToString(value.items), "}", "}");
		else res.push(fieldName, "{", selectionSetIRToString(value), "}");
	});
	return res.join(" ");
}
/**
* Recursively merges selection set objects from `source` onto `target`.
*
* `target` will be updated. `source` will be left alone.
*
* @param source The object to merge into target.
* @param target The object to be mutated.
*/
function deepMergeSelectionSetObjects(source, target) {
	const isObject = (obj) => obj && typeof obj === "object";
	for (const key in source) {
		if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
		if (Object.prototype.hasOwnProperty.call(target, key) && isObject(target[key])) deepMergeSelectionSetObjects(source[key], target[key]);
		else target[key] = source[key];
	}
	return target;
}
function generateSelectionSet(modelIntrospection, modelName, selectionSet) {
	const modelDefinition = modelIntrospection.models[modelName];
	return selectionSetIRToString(customSelectionSetToIR(modelIntrospection, modelName, selectionSet ?? defaultSelectionSetForModel(modelDefinition)));
}
function generateGraphQLDocument(modelIntrospection, modelDefinition, modelOperation, listArgs, indexMeta) {
	const { name, pluralName, fields, primaryKeyInfo: { isCustomPrimaryKey, primaryKeyFieldName, sortKeyFieldNames }, attributes } = modelDefinition;
	const namePascalCase = name.charAt(0).toUpperCase() + name.slice(1);
	const pluralNamePascalCase = pluralName.charAt(0).toUpperCase() + pluralName.slice(1);
	const { operationPrefix, usePlural } = graphQLOperationsInfo[modelOperation];
	const { selectionSet } = listArgs || {};
	let graphQLFieldName;
	let indexQueryArgs;
	if (operationPrefix) graphQLFieldName = `${operationPrefix}${usePlural ? pluralNamePascalCase : namePascalCase}`;
	else if (indexMeta) {
		const { queryField, pk, sk = [] } = indexMeta;
		graphQLFieldName = queryField;
		/**
		* **a. Single field SK** -> single arg where name is the field name and the type is `Model${gqlFieldType}KeyConditionInput` (nullable)
		*  Note: string-like data types e.g.,  AWSDateTime, AWSEmail, AWSPhone, etc. should map to String. See `skGraphQlFieldTypeMap` above
		* @example
		* ```
		* sk1: ModelStringKeyConditionInput
		* ```
		*
		* **b. Composite SK** -> single arg where the name is camelCase concatenation of all the field names that comprise the SK
		*  and the type is `Model${modelName}${keyAttributeName}CompositeKeyConditionInput` (nullable)
		* @example
		* ```
		* sk1Sk2: ModelMyModelMyModelByPkAndSk1AndSk2CompositeKeyConditionInput
		*/
		let skQueryArgs = {};
		if (sk.length === 1) {
			const [skField] = sk;
			const normalizedType = skGraphQlFieldTypeMap[typeof fields[skField].type === "string" ? fields[skField].type : "String"];
			skQueryArgs = { [skField]: `Model${normalizedType}KeyConditionInput` };
		} else if (sk.length > 1) {
			const compositeSkArgName = resolvedSkName(sk);
			const keyName = attributes?.find((attr) => attr?.properties?.queryField === queryField)?.properties?.name;
			skQueryArgs = { [compositeSkArgName]: `Model${capitalize(name)}${capitalize(keyName)}CompositeKeyConditionInput` };
		}
		indexQueryArgs = {
			[pk]: `${Object.prototype.hasOwnProperty.call(fields[pk].type, "enum") ? fields[pk].type.enum : fields[pk].type}!`,
			...skQueryArgs
		};
	} else throw new Error("Error generating GraphQL Document - invalid operation name");
	let graphQLOperationType;
	let graphQLSelectionSet;
	let graphQLArguments;
	const selectionSetFields = generateSelectionSet(modelIntrospection, name, selectionSet);
	const getPkArgs = { [primaryKeyFieldName]: `${fields[primaryKeyFieldName].type}!` };
	const listPkArgs = {};
	/**
	* Generate query field args for the SK if it's defined
	*
	* **1. Get queries** require each SK field to be present as a separate arg where the type is the field's GraphQL scalar type (non-nullable)
	* @example
	* ```
	* sk1: String!, sk2: Int!
	* ```
	*
	* **2. List queries**
	*
	* **a. Single field SK** -> single arg where name is the field name and the type is `Model${gqlFieldType}KeyConditionInput` (nullable)
	*      Note: string-like data types e.g.,  AWSDateTime, AWSEmail, AWSPhone, etc. should map to String. See `skGraphQlFieldTypeMap` above
	* @example
	* ```
	* sk1: ModelStringKeyConditionInput
	* ```
	*
	* **b. Composite SK** -> single arg where the name is camelCase concatenation of all the field names that comprise the SK
	*  and the type is `Model${modelName}PrimaryCompositeKeyConditionInput` (nullable)
	* @example
	* ```
	* sk1Sk2: ModelMyModelPrimaryCompositeKeyConditionInput
	* ```
	*/
	const generateSkArgs = (op) => {
		if (sortKeyFieldNames.length === 0) return {};
		if (op === "get") return sortKeyFieldNames.reduce((acc, fieldName) => {
			const fieldType = fields[fieldName].type;
			if (op === "get") acc[fieldName] = `${fieldType}!`;
			return acc;
		}, {});
		else if (sortKeyFieldNames.length === 1) {
			const [sk] = sortKeyFieldNames;
			const normalizedType = skGraphQlFieldTypeMap[typeof fields[sk].type === "string" ? fields[sk].type : "String"];
			return { [sk]: `Model${normalizedType}KeyConditionInput` };
		} else return { [resolvedSkName(sortKeyFieldNames)]: `Model${capitalize(name)}PrimaryCompositeKeyConditionInput` };
	};
	if (isCustomPrimaryKey) {
		Object.assign(getPkArgs, generateSkArgs("get"));
		Object.assign(listPkArgs, {
			[primaryKeyFieldName]: `${fields[primaryKeyFieldName].type}`,
			sortDirection: "ModelSortDirection"
		}, generateSkArgs("list"));
	}
	switch (modelOperation) {
		case "CREATE":
		case "UPDATE":
		case "DELETE":
			graphQLArguments ?? (graphQLArguments = { input: `${operationPrefix.charAt(0).toLocaleUpperCase() + operationPrefix.slice(1)}${namePascalCase}Input!` });
			graphQLOperationType ?? (graphQLOperationType = "mutation");
		case "GET":
			graphQLArguments ?? (graphQLArguments = getPkArgs);
			graphQLSelectionSet ?? (graphQLSelectionSet = selectionSetFields);
		case "LIST":
			graphQLArguments ?? (graphQLArguments = {
				...listPkArgs,
				filter: `Model${namePascalCase}FilterInput`,
				limit: "Int",
				nextToken: "String"
			});
			graphQLOperationType ?? (graphQLOperationType = "query");
			graphQLSelectionSet ?? (graphQLSelectionSet = `items { ${selectionSetFields} } nextToken __typename`);
		case "INDEX_QUERY":
			graphQLArguments ?? (graphQLArguments = {
				...indexQueryArgs,
				filter: `Model${namePascalCase}FilterInput`,
				sortDirection: "ModelSortDirection",
				limit: "Int",
				nextToken: "String"
			});
			graphQLOperationType ?? (graphQLOperationType = "query");
			graphQLSelectionSet ?? (graphQLSelectionSet = `items { ${selectionSetFields} } nextToken __typename`);
		case "ONCREATE":
		case "ONUPDATE":
		case "ONDELETE":
			graphQLArguments ?? (graphQLArguments = { filter: `ModelSubscription${namePascalCase}FilterInput` });
			graphQLOperationType ?? (graphQLOperationType = "subscription");
			graphQLSelectionSet ?? (graphQLSelectionSet = selectionSetFields);
			break;
		default: throw new Error("Internal error: Attempted to generate graphql document for observeQuery. Please report this error.");
	}
	return `${graphQLOperationType}${graphQLArguments ? `(${Object.entries(graphQLArguments).map(([fieldName, type]) => `$${fieldName}: ${type}`)})` : ""} { ${graphQLFieldName}${graphQLArguments ? `(${Object.keys(graphQLArguments).map((fieldName) => `${fieldName}: $${fieldName}`)})` : ""} { ${graphQLSelectionSet} } }`;
}
function buildGraphQLVariables(modelDefinition, operation, arg, modelIntrospection, indexMeta) {
	const { fields, primaryKeyInfo: { isCustomPrimaryKey, primaryKeyFieldName, sortKeyFieldNames } } = modelDefinition;
	const skName = sortKeyFieldNames?.length && resolvedSkName(sortKeyFieldNames);
	let variables = {};
	switch (operation) {
		case "CREATE":
			variables = { input: arg ? normalizeMutationInput(arg, modelDefinition, modelIntrospection) : {} };
			break;
		case "UPDATE":
			variables = { input: arg ? Object.fromEntries(Object.entries(normalizeMutationInput(arg, modelDefinition, modelIntrospection)).filter(([fieldName]) => {
				return fields[fieldName] ? !fields[fieldName].isReadOnly : !resolveOwnerFields(modelDefinition).includes(fieldName);
			})) : {} };
			break;
		case "GET":
		case "DELETE":
			if (arg) variables = isCustomPrimaryKey ? [primaryKeyFieldName, ...sortKeyFieldNames].reduce((acc, fieldName) => {
				acc[fieldName] = arg[fieldName];
				return acc;
			}, {}) : { [primaryKeyFieldName]: arg[primaryKeyFieldName] };
			if (operation === "DELETE") variables = { input: variables };
			break;
		case "LIST":
			if (arg?.filter) variables.filter = arg.filter;
			if (arg?.sortDirection) variables.sortDirection = arg.sortDirection;
			if (arg && arg[primaryKeyFieldName]) variables[primaryKeyFieldName] = arg[primaryKeyFieldName];
			if (skName && arg && arg[skName]) variables[skName] = arg[skName];
			if (arg?.nextToken) variables.nextToken = arg.nextToken;
			if (arg?.limit) variables.limit = arg.limit;
			break;
		case "INDEX_QUERY": {
			const { pk, sk = [] } = indexMeta;
			const indexQuerySkName = sk?.length && resolvedSkName(sk);
			variables[pk] = arg[pk];
			if (indexQuerySkName && arg && arg[indexQuerySkName]) variables[indexQuerySkName] = arg[indexQuerySkName];
			if (arg?.filter) variables.filter = arg.filter;
			if (arg?.sortDirection) variables.sortDirection = arg.sortDirection;
			if (arg?.nextToken) variables.nextToken = arg.nextToken;
			if (arg?.limit) variables.limit = arg.limit;
			break;
		}
		case "ONCREATE":
		case "ONUPDATE":
		case "ONDELETE":
			if (arg?.filter) variables = { filter: arg.filter };
			break;
		case "OBSERVEQUERY": throw new Error("Internal error: Attempted to build variables for observeQuery. Please report this error.");
		default: throw new Error(`Unhandled operation case: ${operation}`);
	}
	return variables;
}
/**
* Iterates over mutation input values and resolves any model inputs to their corresponding join fields/values
*
* @example
* ### Usage
* ```ts
* const result = normalizeMutationInput({ post: post }, model, modelDefinition);
* ```
* ### Result
* ```ts
* { postId: "abc123" }
* ```
*
*/
function normalizeMutationInput(mutationInput, model, modelIntrospection) {
	const { fields } = model;
	const normalized = {};
	Object.entries(mutationInput).forEach(([inputFieldName, inputValue]) => {
		const relatedModelName = (fields[inputFieldName]?.type)?.model;
		if (relatedModelName) {
			const association = fields[inputFieldName]?.association;
			const relatedModelPkInfo = modelIntrospection.models[relatedModelName].primaryKeyInfo;
			if (association?.connectionType === connectionType.HAS_ONE) {
				const associationHasOne = association;
				associationHasOne.targetNames.forEach((targetName, idx) => {
					normalized[targetName] = inputValue[associationHasOne.associatedWith[idx]];
				});
			}
			if (association?.connectionType === connectionType.BELONGS_TO) association.targetNames.forEach((targetName, idx) => {
				if (idx === 0) normalized[targetName] = inputValue[relatedModelPkInfo.primaryKeyFieldName];
				else normalized[targetName] = inputValue[relatedModelPkInfo.sortKeyFieldNames[idx - 1]];
			});
		} else normalized[inputFieldName] = inputValue;
	});
	return normalized;
}
/**
* Produces a parameter object that can contains auth mode/token overrides
* only if present in either `options` (first) or configured on the `client`
* as a fallback.
*
* @param client Configured client from `generateClient`
* @param options Args/Options object from call site.
* @returns
*/
function authModeParams(client, getInternals, options = {}) {
	const internals = getInternals(client);
	return {
		authMode: options.authMode || internals.authMode,
		authToken: options.authToken || internals.authToken
	};
}
/**
* Retrieves custom headers from either the client or request options.
* @param client V6Client | V6ClientSSRRequest | V6ClientSSRCookies - for extracting client headers
* @param requestHeaders {@link CustomHeaders} - request headers
* @returns custom headers as {@link CustomHeaders}
*/
function getCustomHeaders(client, getInternals, requestHeaders) {
	let headers = getInternals(client).headers || {};
	if (requestHeaders) headers = requestHeaders;
	return headers;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/operations/utils.mjs
/**
* Handle errors for list return types (list and index query operations)
*/
function handleListGraphQlError(error) {
	if (error?.errors) return {
		...error,
		data: []
	};
	else throw error;
}
/**
* Handle errors for singular return types (create, get, update, delete operations)
*/
function handleSingularGraphQlError(error) {
	if (error.errors) return {
		...error,
		data: null
	};
	else throw error;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/getCustomUserAgentDetails.mjs
/**
* Symbol used for internal user agent overrides.
*
* @internal
* This symbol is intended for internal use within the Amplify library.
* It may change or be removed in future versions without notice.
* External usage of this symbol is discouraged and may lead to unexpected behavior.
*/
var INTERNAL_USER_AGENT_OVERRIDE = Symbol("INTERNAL_USER_AGENT_OVERRIDE");
var AiAction;
(function(AiAction) {
	AiAction["CreateConversation"] = "1";
	AiAction["GetConversation"] = "2";
	AiAction["ListConversations"] = "3";
	AiAction["DeleteConversation"] = "4";
	AiAction["SendMessage"] = "5";
	AiAction["ListMessages"] = "6";
	AiAction["OnStreamEvent"] = "7";
	AiAction["Generation"] = "8";
	AiAction["UpdateConversation"] = "9";
})(AiAction || (AiAction = {}));
var getCustomUserAgentDetails = (action) => ({
	category: "ai",
	action
});
/**
* Creates a user agent override object based on custom details.
*
* @internal
* This function is intended for internal use within the Amplify library.
* It may change or be removed in future versions without notice.
*
* @param customUserAgentDetails - Optional custom user agent details
* @returns An object with INTERNAL_USER_AGENT_OVERRIDE symbol as key and customUserAgentDetails as value, or undefined if no details provided
*/
function createUserAgentOverride(customUserAgentDetails) {
	return customUserAgentDetails ? { [INTERNAL_USER_AGENT_OVERRIDE]: customUserAgentDetails } : void 0;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/operations/custom.mjs
/**
* Type guard for checking whether a Custom Operation argument is a contextSpec object
*/
var argIsContextSpec = (arg) => {
	return typeof arg?.token?.value === "symbol";
};
/**
* Builds an operation function, embedded with all client and context data, that
* can be attached to a client as a custom query or mutation.
*
* If we have this source schema:
*
* ```typescript
* a.schema({
*   echo: a.query()
*     .arguments({input: a.string().required()})
*     .returns(a.string())
* })
* ```
*
* Our model intro schema will contain an entry like this:
*
* ```ts
* {
*   queries: {
*     echo: {
*       name: "echo",
*       isArray: false,
*       type: 'String',
*       isRequired: false,
*       arguments: {
*         input: {
*           name: 'input',
*           isArray: false,
*           type: String,
*           isRequired: true
*         }
*       }
*     }
*   }
* }
* ```
*
* The `echo` object is used to build the `echo' method that goes here:
*
* ```typescript
* const client = generateClent()
* const { data } = await client.queries.echo({input: 'a string'});
* //                                    ^
* //                                    |
* //                                    +-- This one right here.
* //
* ```
*
*
* @param client The client to run graphql queries through.
* @param modelIntrospection The model introspection schema the op comes from.
* @param operationType The broad category of graphql operation.
* @param operation The operation definition from the introspection schema.
* @param useContext Whether the function needs to accept an SSR context.
* @returns The operation function to attach to query, mutations, etc.
*/
function customOpFactory(client, modelIntrospection, operationType, operation, useContext, getInternals, customUserAgentDetails) {
	const argsDefined = operation.arguments !== void 0;
	const op = (...args) => {
		const options = args[args.length - 1];
		let contextSpec;
		let arg;
		if (useContext) if (argIsContextSpec(args[0])) contextSpec = args[0];
		else throw new Error(`Invalid first argument passed to ${operation.name}. Expected contextSpec`);
		if (argsDefined) if (useContext) arg = args[1];
		else arg = args[0];
		if (operationType === "subscription") return _opSubscription(client, modelIntrospection, operation, getInternals, arg, options, customUserAgentDetails);
		return _op(client, modelIntrospection, operationType, operation, getInternals, arg, options, contextSpec, customUserAgentDetails);
	};
	return op;
}
/**
* Runtime test and type guard to check whether `o[field]` is a `String`.
*
* ```typescript
* if (hasStringField(o, 'prop')) {
*   const s = o.prop;
*   //    ^? const s: string
* }
* ```
*
* @param o Object to inspect
* @param field Field to look for
* @returns Boolean: `true` if the `o[field]` is a `string`
*/
function hasStringField(o, field) {
	return typeof o[field] === "string";
}
function isEnumType(type) {
	return type instanceof Object && "enum" in type;
}
function isInputType(type) {
	return type instanceof Object && "input" in type;
}
/**
* @param argDef A single argument definition from a custom operation
* @returns A string naming the base type including the `!` if the arg is required.
*/
function argumentBaseTypeString({ type, isRequired }) {
	const requiredFlag = isRequired ? "!" : "";
	if (isEnumType(type)) return `${type.enum}${requiredFlag}`;
	if (isInputType(type)) return `${type.input}${requiredFlag}`;
	return `${type}${requiredFlag}`;
}
/**
* Generates "outer" arguments string for a custom operation. For example,
* in this operation:
*
* ```graphql
* query MyQuery(InputString: String!) {
*   echoString(InputString: $InputString)
* }
* ```
*
* This function returns the top/outer level arguments as a string:
*
* ```json
* "InputString: String!"
* ```
*
* @param operation Operation object from model introspection schema.
* @returns "outer" arguments string
*/
function outerArguments(operation) {
	if (operation.arguments === void 0) return "";
	const args = Object.entries(operation.arguments).map(([k, argument]) => {
		const baseType = argumentBaseTypeString(argument);
		return `$${k}: ${argument.isArray ? `[${baseType}]${argument.isArrayNullable ? "" : "!"}` : baseType}`;
	}).join(", ");
	return args.length > 0 ? `(${args})` : "";
}
/**
* Generates "inner" arguments string for a custom operation. For example,
* in this operation:
*
* ```graphql
* query MyQuery(InputString: String!) {
*   echoString(InputString: $InputString)
* }
* ```
*
* This function returns the inner arguments as a string:
*
* ```json
* "InputString: $InputString"
* ```
*
* @param operation Operation object from model introspection schema.
* @returns "outer" arguments string
*/
function innerArguments(operation) {
	if (operation.arguments === void 0) return "";
	const args = Object.keys(operation.arguments).map((k) => `${k}: $${k}`).join(", ");
	return args.length > 0 ? `(${args})` : "";
}
/**
* Generates the selection set string for a custom operation. This is slightly
* different than the selection set generation for models. If the custom op returns
* a primitive or enum types, it doesn't require a selection set at all.
*
* E.g., the graphql might look like this:
*
* ```graphql
* query MyQuery {
*   echoString(inputString: "whatever")
* }
* #                                     ^
* #                                     |
* #                                     +-- no selection set
* ```
*
* Non-primitive return type selection set generation will be similar to other
* model operations.
*
* @param modelIntrospection The full code-generated introspection schema.
* @param operation The operation object from the schema.
* @returns The selection set as a string.
*/
function operationSelectionSet(modelIntrospection, operation) {
	if (hasStringField(operation, "type") || hasStringField(operation.type, "enum")) return "";
	else if (hasStringField(operation.type, "nonModel")) {
		const nonModel = modelIntrospection.nonModels[operation.type.nonModel];
		return `{${selectionSetIRToString(getDefaultSelectionSetForNonModelWithIR(nonModel, modelIntrospection))}}`;
	} else if (hasStringField(operation.type, "model")) return `{${generateSelectionSet(modelIntrospection, operation.type.model)}}`;
	else return "";
}
/**
* Maps an arguments objec to graphql variables, removing superfluous args and
* screaming loudly when required args are missing.
*
* @param operation The operation to construct graphql request variables for.
* @param args The arguments to map variables from.
* @returns The graphql variables object.
*/
function operationVariables(operation, args = {}) {
	const variables = {};
	if (operation.arguments === void 0) return variables;
	for (const argDef of Object.values(operation.arguments)) if (typeof args[argDef.name] !== "undefined") variables[argDef.name] = args[argDef.name];
	else if (argDef.isRequired) throw new Error(`${operation.name} requires arguments '${argDef.name}'`);
	return variables;
}
/**
* Executes an operation from the given model intro schema against a client, returning
* a fully instantiated model when relevant.
*
* @param client The client to operate `graphql()` calls through.
* @param modelIntrospection The model intro schema to construct requests from.
* @param operationType The high level graphql operation type.
* @param operation The specific operation name, args, return type details.
* @param args The arguments to provide to the operation as variables.
* @param options Request options like headers, etc.
* @param context SSR context if relevant.
* @returns Result from the graphql request, model-instantiated when relevant.
*/
function _op(client, modelIntrospection, operationType, operation, getInternals, args, options, context, customUserAgentDetails) {
	return selfAwareAsync(async (resultPromise) => {
		const { name: operationName } = operation;
		const auth = authModeParams(client, getInternals, options);
		const headers = getCustomHeaders(client, getInternals, options?.headers);
		const outerArgsString = outerArguments(operation);
		const innerArgsString = innerArguments(operation);
		const selectionSet = operationSelectionSet(modelIntrospection, operation);
		const returnTypeModelName = hasStringField(operation.type, "model") ? operation.type.model : void 0;
		const query = `
    ${operationType.toLocaleLowerCase()}${outerArgsString} {
      ${operationName}${innerArgsString} ${selectionSet}
    }
  `;
		const variables = operationVariables(operation, args);
		const userAgentOverride = createUserAgentOverride(customUserAgentDetails);
		try {
			const { data, extensions } = await extendCancellability(context ? client.graphql(context, {
				...auth,
				query,
				variables
			}, headers) : client.graphql({
				...auth,
				query,
				variables,
				...userAgentOverride
			}, headers), resultPromise);
			if (data) {
				const [key] = Object.keys(data);
				const isArrayResult = Array.isArray(data[key]);
				const flattenedResult = isArrayResult ? data[key].filter((x) => x) : data[key];
				const initialized = returnTypeModelName ? initializeModel(client, returnTypeModelName, isArrayResult ? flattenedResult : [flattenedResult], modelIntrospection, auth.authMode, auth.authToken, !!context) : flattenedResult;
				return {
					data: !isArrayResult && Array.isArray(initialized) ? initialized.shift() : initialized,
					extensions
				};
			} else return {
				data: null,
				extensions
			};
		} catch (error) {
			/**
			* The `data` type returned by `error` here could be:
			* 1) `null`
			* 2) an empty object
			* 3) "populated" but with a `null` value `{ getPost: null }`
			* 4) an actual record `{ getPost: { id: '1', title: 'Hello, World!' } }`
			*/
			const { data, errors } = error;
			/**
			* `data` is not `null`, and is not an empty object:
			*/
			if (data && Object.keys(data).length !== 0 && errors) {
				const [key] = Object.keys(data);
				const isArrayResult = Array.isArray(data[key]);
				const flattenedResult = isArrayResult ? data[key].filter((x) => x) : data[key];
				/**
				* `flattenedResult` could be `null` here (e.g. `data: { getPost: null }`)
				* if `flattenedResult`, result is an actual record:
				*/
				if (flattenedResult) {
					const initialized = returnTypeModelName ? initializeModel(client, returnTypeModelName, isArrayResult ? flattenedResult : [flattenedResult], modelIntrospection, auth.authMode, auth.authToken, !!context) : flattenedResult;
					return {
						data: !isArrayResult && Array.isArray(initialized) ? initialized.shift() : initialized,
						errors
					};
				} else return handleSingularGraphQlError(error);
			} else return handleSingularGraphQlError(error);
		}
	});
}
/**
* Executes an operation from the given model intro schema against a client, returning
* a fully instantiated model when relevant.
*
* @param client The client to operate `graphql()` calls through.
* @param modelIntrospection The model intro schema to construct requests from.
* @param operation The specific operation name, args, return type details.
* @param args The arguments to provide to the operation as variables.
* @param options Request options like headers, etc.
* @returns Result from the graphql request, model-instantiated when relevant.
*/
function _opSubscription(client, modelIntrospection, operation, getInternals, args, options, customUserAgentDetails) {
	const operationType = "subscription";
	const { name: operationName } = operation;
	const auth = authModeParams(client, getInternals, options);
	const headers = getCustomHeaders(client, getInternals, options?.headers);
	const outerArgsString = outerArguments(operation);
	const innerArgsString = innerArguments(operation);
	const selectionSet = operationSelectionSet(modelIntrospection, operation);
	const returnTypeModelName = hasStringField(operation.type, "model") ? operation.type.model : void 0;
	const query = `
    ${operationType.toLocaleLowerCase()}${outerArgsString} {
      ${operationName}${innerArgsString} ${selectionSet}
    }
  `;
	const variables = operationVariables(operation, args);
	const userAgentOverride = createUserAgentOverride(customUserAgentDetails);
	return client.graphql({
		...auth,
		query,
		variables,
		...userAgentOverride
	}, headers).pipe(map((value) => {
		const [key] = Object.keys(value.data);
		const data = value.data[key];
		const [initialized] = returnTypeModelName ? initializeModel(client, returnTypeModelName, [data], modelIntrospection, auth.authMode, auth.authToken) : [data];
		return initialized;
	}));
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/generateCustomOperationsProperty.mjs
var operationTypeMap = {
	queries: "query",
	mutations: "mutation",
	subscriptions: "subscription"
};
function generateCustomOperationsProperty(client, config, operationsType, getInternals) {
	if (!config) return {};
	const modelIntrospection = config.modelIntrospection;
	if (!modelIntrospection) return {};
	const operations = modelIntrospection[operationsType];
	if (!operations) return {};
	const ops = {};
	const useContext = getInternals(client).amplify === null;
	for (const operation of Object.values(operations)) ops[operation.name] = customOpFactory(client, modelIntrospection, operationTypeMap[operationsType], operation, useContext, getInternals);
	return ops;
}
function generateCustomMutationsProperty(client, config, getInternals) {
	return generateCustomOperationsProperty(client, config, "mutations", getInternals);
}
function generateCustomQueriesProperty(client, config, getInternals) {
	return generateCustomOperationsProperty(client, config, "queries", getInternals);
}
function generateCustomSubscriptionsProperty(client, config, getInternals) {
	return generateCustomOperationsProperty(client, config, "subscriptions", getInternals);
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/operations/get.mjs
function getFactory(client, modelIntrospection, model, operation, getInternals, useContext = false, customUserAgentDetails) {
	const getWithContext = (contextSpec, arg, options) => {
		return _get(client, modelIntrospection, model, arg, options, operation, getInternals, contextSpec, customUserAgentDetails);
	};
	const get = (arg, options) => {
		return _get(client, modelIntrospection, model, arg, options, operation, getInternals, void 0, customUserAgentDetails);
	};
	return useContext ? getWithContext : get;
}
function _get(client, modelIntrospection, model, arg, options, operation, getInternals, context, customUserAgentDetails) {
	return selfAwareAsync(async (resultPromise) => {
		const { name } = model;
		const query = generateGraphQLDocument(modelIntrospection, model, operation, options);
		const variables = buildGraphQLVariables(model, operation, arg, modelIntrospection);
		const auth = authModeParams(client, getInternals, options);
		const headers = getCustomHeaders(client, getInternals, options?.headers);
		const userAgentOverride = createUserAgentOverride(customUserAgentDetails);
		try {
			const { data, extensions } = await extendCancellability(context ? client.graphql(context, {
				...auth,
				query,
				variables
			}, headers) : client.graphql({
				...auth,
				query,
				variables,
				...userAgentOverride
			}, headers), resultPromise);
			if (data) {
				const [key] = Object.keys(data);
				const flattenedResult = flattenItems(modelIntrospection, name, data[key]);
				if (flattenedResult === null) return {
					data: null,
					extensions
				};
				else if (options?.selectionSet) return {
					data: flattenedResult,
					extensions
				};
				else {
					const [initialized] = initializeModel(client, name, [flattenedResult], modelIntrospection, auth.authMode, auth.authToken, !!context);
					return {
						data: initialized,
						extensions
					};
				}
			} else return {
				data: null,
				extensions
			};
		} catch (error) {
			/**
			* The `data` type returned by `error` here could be:
			* 1) `null`
			* 2) an empty object
			* 3) "populated" but with a `null` value `{ getPost: null }`
			* 4) an actual record `{ getPost: { id: '1', title: 'Hello, World!' } }`
			*/
			const { data, errors } = error;
			/**
			* `data` is not `null`, and is not an empty object:
			*/
			if (data && Object.keys(data).length !== 0 && errors) {
				const [key] = Object.keys(data);
				const flattenedResult = flattenItems(modelIntrospection, name, data[key]);
				/**
				* `flattenedResult` could be `null` here (e.g. `data: { getPost: null }`)
				* if `flattenedResult`, result is an actual record:
				*/
				if (flattenedResult) if (options?.selectionSet) return {
					data: flattenedResult,
					errors
				};
				else {
					const [initialized] = initializeModel(client, name, [flattenedResult], modelIntrospection, auth.authMode, auth.authToken, !!context);
					return {
						data: initialized,
						errors
					};
				}
				else return handleSingularGraphQlError(error);
			} else return handleSingularGraphQlError(error);
		}
	});
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/operations/list.mjs
function listFactory(client, modelIntrospection, model, getInternals, context = false, customUserAgentDetails) {
	const listWithContext = (contextSpec, args) => {
		return _list(client, modelIntrospection, model, getInternals, args, contextSpec, customUserAgentDetails);
	};
	const list = (args) => {
		return _list(client, modelIntrospection, model, getInternals, args, void 0, customUserAgentDetails);
	};
	return context ? listWithContext : list;
}
function _list(client, modelIntrospection, model, getInternals, args, contextSpec, customUserAgentDetails) {
	return selfAwareAsync(async (resultPromise) => {
		const { name } = model;
		const query = generateGraphQLDocument(modelIntrospection, model, "LIST", args);
		const variables = buildGraphQLVariables(model, "LIST", args, modelIntrospection);
		const auth = authModeParams(client, getInternals, args);
		const headers = getCustomHeaders(client, getInternals, args?.headers);
		const userAgentOverride = createUserAgentOverride(customUserAgentDetails);
		try {
			const { data, extensions } = await extendCancellability(contextSpec ? client.graphql(contextSpec, {
				...auth,
				query,
				variables
			}, headers) : client.graphql({
				...auth,
				query,
				variables,
				...userAgentOverride
			}, headers), resultPromise);
			if (data !== void 0) {
				const [key] = Object.keys(data);
				if (data[key].items) {
					const flattenedResult = data[key].items.map((value) => flattenItems(modelIntrospection, name, value));
					if (args?.selectionSet) return {
						data: flattenedResult,
						nextToken: data[key].nextToken,
						extensions
					};
					else return {
						data: initializeModel(client, name, flattenedResult, modelIntrospection, auth.authMode, auth.authToken, !!contextSpec),
						nextToken: data[key].nextToken,
						extensions
					};
				}
				return {
					data: data[key],
					nextToken: data[key].nextToken,
					extensions
				};
			}
		} catch (error) {
			/**
			* The `data` type returned by `error` here could be:
			* 1) `null`
			* 2) an empty object
			* 3) "populated" but with a `null` value `data: { listPosts: null }`
			* 4) actual records `data: { listPosts: items: [{ id: '1', ...etc }] }`
			*/
			const { data, errors } = error;
			if (data !== void 0 && data !== null && Object.keys(data).length !== 0 && errors) {
				const [key] = Object.keys(data);
				if (data[key]?.items) {
					const flattenedResult = data[key].items.map((value) => flattenItems(modelIntrospection, name, value));
					/**
					* Check exists since `flattenedResult` could be `null`.
					* if `flattenedResult` exists, result is an actual record.
					*/
					if (flattenedResult) if (args?.selectionSet) return {
						data: flattenedResult,
						nextToken: data[key]?.nextToken,
						errors
					};
					else return {
						data: initializeModel(client, name, flattenedResult, modelIntrospection, auth.authMode, auth.authToken, !!contextSpec),
						nextToken: data[key]?.nextToken,
						errors
					};
					return {
						data: data[key],
						nextToken: data[key]?.nextToken,
						errors
					};
				} else return handleListGraphQlError(error);
			} else return handleListGraphQlError(error);
		}
	});
}
//#endregion
//#region node_modules/@smithy/util-base64/dist-es/constants.browser.js
var alphabetByEncoding = {};
var alphabetByValue = new Array(64);
for (let i = 0, start = "A".charCodeAt(0), limit = "Z".charCodeAt(0); i + start <= limit; i++) {
	const char = String.fromCharCode(i + start);
	alphabetByEncoding[char] = i;
	alphabetByValue[i] = char;
}
for (let i = 0, start = "a".charCodeAt(0), limit = "z".charCodeAt(0); i + start <= limit; i++) {
	const char = String.fromCharCode(i + start);
	const index = i + 26;
	alphabetByEncoding[char] = index;
	alphabetByValue[index] = char;
}
for (let i = 0; i < 10; i++) {
	alphabetByEncoding[i.toString(10)] = i + 52;
	const char = i.toString(10);
	const index = i + 52;
	alphabetByEncoding[char] = index;
	alphabetByValue[index] = char;
}
alphabetByEncoding["+"] = 62;
alphabetByValue[62] = "+";
alphabetByEncoding["/"] = 63;
alphabetByValue[63] = "/";
//#endregion
//#region node_modules/@smithy/util-base64/dist-es/fromBase64.browser.js
var fromBase64 = (input) => {
	let totalByteLength = input.length / 4 * 3;
	if (input.slice(-2) === "==") totalByteLength -= 2;
	else if (input.slice(-1) === "=") totalByteLength--;
	const out = new ArrayBuffer(totalByteLength);
	const dataView = new DataView(out);
	for (let i = 0; i < input.length; i += 4) {
		let bits = 0;
		let bitLength = 0;
		for (let j = i, limit = i + 3; j <= limit; j++) if (input[j] !== "=") {
			if (!(input[j] in alphabetByEncoding)) throw new TypeError(`Invalid character ${input[j]} in base64 string.`);
			bits |= alphabetByEncoding[input[j]] << (limit - j) * 6;
			bitLength += 6;
		} else bits >>= 6;
		const chunkOffset = i / 4 * 3;
		bits >>= bitLength % 8;
		const byteLength = Math.floor(bitLength / 8);
		for (let k = 0; k < byteLength; k++) {
			const offset = (byteLength - k - 1) * 8;
			dataView.setUint8(chunkOffset + k, (bits & 255 << offset) >> offset);
		}
	}
	return new Uint8Array(out);
};
//#endregion
//#region node_modules/@smithy/util-base64/node_modules/@smithy/util-utf8/dist-es/fromUtf8.browser.js
var fromUtf8 = (input) => new TextEncoder().encode(input);
//#endregion
//#region node_modules/@smithy/util-base64/dist-es/toBase64.browser.js
function toBase64(_input) {
	let input;
	if (typeof _input === "string") input = fromUtf8(_input);
	else input = _input;
	const isArrayLike = typeof input === "object" && typeof input.length === "number";
	const isUint8Array = typeof input === "object" && typeof input.byteOffset === "number" && typeof input.byteLength === "number";
	if (!isArrayLike && !isUint8Array) throw new Error("@smithy/util-base64: toBase64 encoder function only accepts string | Uint8Array.");
	let str = "";
	for (let i = 0; i < input.length; i += 3) {
		let bits = 0;
		let bitLength = 0;
		for (let j = i, limit = Math.min(i + 3, input.length); j < limit; j++) {
			bits |= input[j] << (limit - j - 1) * 8;
			bitLength += 8;
		}
		const bitClusterCount = Math.ceil(bitLength / 6);
		bits <<= bitClusterCount * 6 - bitLength;
		for (let k = 1; k <= bitClusterCount; k++) {
			const offset = (bitClusterCount - k) * 6;
			str += alphabetByValue[(bits & 63 << offset) >> offset];
		}
		str += "==".slice(0, 4 - bitClusterCount);
	}
	return str;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/conversationMessageDeserializers.mjs
var deserializeContent = (content) => content.map((block) => {
	if (block.image) return deserializeImageBlock(block);
	if (block.document) return deserializeDocumentBlock(block);
	if (block.toolUse) return deserializeToolUseBlock$1(block);
	if (block.toolResult) return deserializeToolResultBlock(block);
	return removeNullsFromBlock(block);
});
var deserializeImageBlock = ({ image }) => ({ image: {
	...image,
	source: {
		...image.source,
		bytes: fromBase64(image.source.bytes)
	}
} });
var deserializeDocumentBlock = ({ document }) => ({ document: {
	...document,
	source: {
		...document.source,
		bytes: fromBase64(document.source.bytes)
	}
} });
var deserializeJsonBlock = ({ json }) => ({ json: JSON.parse(json) });
var deserializeToolUseBlock$1 = ({ toolUse }) => ({ toolUse: {
	...toolUse,
	input: JSON.parse(toolUse.input)
} });
var deserializeToolResultBlock = ({ toolResult }) => ({ toolResult: {
	toolUseId: toolResult.toolUseId,
	content: toolResult.content.map((toolResultBlock) => {
		if (toolResultBlock.image) return deserializeImageBlock(toolResultBlock);
		if (toolResultBlock.json) return deserializeJsonBlock(toolResultBlock);
		return removeNullsFromBlock(toolResultBlock);
	})
} });
var removeNullsFromBlock = (block) => Object.fromEntries(Object.entries(block).filter(([_, v]) => v !== null));
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/convertItemToConversationMessage.mjs
var convertItemToConversationMessage = ({ content, createdAt, id, conversationId, role }) => ({
	content: deserializeContent(content ?? []),
	conversationId,
	createdAt,
	id,
	role
});
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/createListMessagesFunction.mjs
var createListMessagesFunction = (client, modelIntrospection, conversationId, conversationMessageModel, getInternals) => async (input) => {
	const { data, nextToken, errors } = await listFactory(client, modelIntrospection, conversationMessageModel, getInternals, false, getCustomUserAgentDetails(AiAction.ListMessages))({
		...input,
		filter: { conversationId: { eq: conversationId } }
	});
	return {
		data: data.map((item) => convertItemToConversationMessage(item)),
		nextToken,
		errors
	};
};
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/conversationStreamEventDeserializers.mjs
var convertItemToConversationStreamEvent = ({ id, conversationId, associatedUserMessageId, contentBlockIndex, contentBlockDoneAtIndex, contentBlockDeltaIndex, contentBlockText, contentBlockToolUse, stopReason, errors }) => {
	if (errors) return { error: {
		id,
		conversationId,
		associatedUserMessageId,
		errors
	} };
	return { next: removeNullsFromConversationStreamEvent({
		id,
		conversationId,
		associatedUserMessageId,
		contentBlockIndex,
		contentBlockDoneAtIndex,
		contentBlockDeltaIndex,
		text: contentBlockText,
		toolUse: deserializeToolUseBlock(contentBlockToolUse),
		stopReason
	}) };
};
var deserializeToolUseBlock = (contentBlockToolUse) => {
	if (contentBlockToolUse) return {
		...contentBlockToolUse,
		input: JSON.parse(contentBlockToolUse.input)
	};
};
var removeNullsFromConversationStreamEvent = (block) => Object.fromEntries(Object.entries(block).filter(([_, v]) => v !== null));
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/createOnStreamEventFunction.mjs
var createOnStreamEventFunction = (client, modelIntrospection, conversationId, conversationRouteName, getInternals) => (handler) => {
	const { conversations } = modelIntrospection;
	if (!conversations) return {};
	const subscribeSchema = conversations[conversationRouteName].message.subscribe;
	return customOpFactory(client, modelIntrospection, "subscription", subscribeSchema, false, getInternals, getCustomUserAgentDetails(AiAction.OnStreamEvent))({ conversationId }).subscribe((data) => {
		const { next, error } = convertItemToConversationStreamEvent(data);
		if (error) handler.error(error);
		if (next) handler.next(next);
	});
};
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/conversationMessageSerializers.mjs
var serializeAiContext = (aiContext) => JSON.stringify(aiContext);
var serializeContent = (content) => content.map((block) => {
	if (block.image) return serializeImageBlock(block);
	if (block.document) return serializeDocumentBlock(block);
	if (block.toolResult) return serializeToolResultBlock(block);
	return block;
});
var serializeToolConfiguration = ({ tools }) => ({ tools: Object.entries(tools).map(([name, tool]) => ({ toolSpec: {
	name,
	description: tool.description,
	inputSchema: { json: JSON.stringify(tool.inputSchema.json) }
} })) });
var serializeImageBlock = ({ image }) => ({ image: {
	...image,
	source: {
		...image.source,
		bytes: toBase64(image.source.bytes)
	}
} });
var serializeDocumentBlock = ({ document }) => ({ document: {
	...document,
	source: {
		...document.source,
		bytes: toBase64(document.source.bytes)
	}
} });
var serializeJsonBlock = ({ json }) => ({ json: JSON.stringify(json) });
var serializeToolResultBlock = ({ toolResult }) => ({ toolResult: {
	...toolResult,
	content: toolResult.content.map((toolResultBlock) => {
		if (toolResultBlock.image) return serializeImageBlock(toolResultBlock);
		if (toolResultBlock.json) return serializeJsonBlock(toolResultBlock);
		return toolResultBlock;
	})
} });
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/createSendMessageFunction.mjs
var createSendMessageFunction = (client, modelIntrospection, conversationId, conversationRouteName, getInternals) => async (input) => {
	const { conversations } = modelIntrospection;
	if (!conversations) return {};
	const { content, aiContext, toolConfiguration } = typeof input === "string" ? { content: [{ text: input }] } : input;
	const sendSchema = conversations[conversationRouteName].message.send;
	const { data, errors } = await customOpFactory(client, modelIntrospection, "mutation", sendSchema, false, getInternals, getCustomUserAgentDetails(AiAction.SendMessage))({
		conversationId,
		content: serializeContent(content),
		...aiContext && { aiContext: serializeAiContext(aiContext) },
		...toolConfiguration && { toolConfiguration: serializeToolConfiguration(toolConfiguration) }
	});
	return {
		data: data ? convertItemToConversationMessage(data) : data,
		errors
	};
};
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/convertItemToConversation.mjs
var convertItemToConversation = (client, modelIntrospection, conversationId, conversationCreatedAt, conversationUpdatedAt, conversationRouteName, conversationMessageModel, getInternals, conversationMetadata, conversationName) => {
	if (!conversationId) throw new Error(`An error occurred converting a ${conversationRouteName} conversation: Missing ID`);
	return {
		id: conversationId,
		createdAt: conversationCreatedAt,
		updatedAt: conversationUpdatedAt,
		metadata: conversationMetadata,
		name: conversationName,
		onStreamEvent: createOnStreamEventFunction(client, modelIntrospection, conversationId, conversationRouteName, getInternals),
		sendMessage: createSendMessageFunction(client, modelIntrospection, conversationId, conversationRouteName, getInternals),
		listMessages: createListMessagesFunction(client, modelIntrospection, conversationId, conversationMessageModel, getInternals)
	};
};
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/createCreateConversationFunction.mjs
var createCreateConversationFunction = (client, modelIntrospection, conversationRouteName, conversationModel, conversationMessageModel, getInternals) => async (input) => {
	const { name, metadata: metadataObject } = input ?? {};
	const metadata = JSON.stringify(metadataObject);
	const { data, errors } = await getFactory(client, modelIntrospection, conversationModel, "CREATE", getInternals, false, getCustomUserAgentDetails(AiAction.CreateConversation))({
		name,
		metadata
	});
	return {
		data: convertItemToConversation(client, modelIntrospection, data?.id, data?.createdAt, data?.updatedAt, conversationRouteName, conversationMessageModel, getInternals, data?.metadata, data?.name),
		errors
	};
};
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/createGetConversationFunction.mjs
var createGetConversationFunction = (client, modelIntrospection, conversationRouteName, conversationModel, conversationMessageModel, getInternals) => async ({ id }) => {
	const { data, errors } = await getFactory(client, modelIntrospection, conversationModel, "GET", getInternals, false, getCustomUserAgentDetails(AiAction.GetConversation))({ id });
	return {
		data: data ? convertItemToConversation(client, modelIntrospection, data.id, data.createdAt, data.updatedAt, conversationRouteName, conversationMessageModel, getInternals, data?.metadata, data?.name) : data,
		errors
	};
};
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/createListConversationsFunction.mjs
var createListConversationsFunction = (client, modelIntrospection, conversationRouteName, conversationModel, conversationMessageModel, getInternals) => async (input) => {
	const { data, nextToken, errors } = await listFactory(client, modelIntrospection, conversationModel, getInternals, false, getCustomUserAgentDetails(AiAction.ListConversations))(input);
	return {
		data: data.map((datum) => {
			return convertItemToConversation(client, modelIntrospection, datum.id, datum.createdAt, datum.updatedAt, conversationRouteName, conversationMessageModel, getInternals, datum?.metadata, datum?.name);
		}),
		nextToken,
		errors
	};
};
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/createDeleteConversationFunction.mjs
var createDeleteConversationFunction = (client, modelIntrospection, conversationRouteName, conversationModel, conversationMessageModel, getInternals) => async ({ id }) => {
	const { data, errors } = await getFactory(client, modelIntrospection, conversationModel, "DELETE", getInternals, false, getCustomUserAgentDetails(AiAction.DeleteConversation))({ id });
	return {
		data: data ? convertItemToConversation(client, modelIntrospection, data?.id, data?.createdAt, data?.updatedAt, conversationRouteName, conversationMessageModel, getInternals, data?.metadata, data?.name) : data,
		errors
	};
};
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/ai/createUpdateConversationFunction.mjs
var createUpdateConversationFunction = (client, modelIntrospection, conversationRouteName, conversationModel, conversationMessageModel, getInternals) => async ({ id, metadata: metadataObject, name }) => {
	const metadata = JSON.stringify(metadataObject);
	const { data, errors } = await getFactory(client, modelIntrospection, conversationModel, "UPDATE", getInternals, false, getCustomUserAgentDetails(AiAction.UpdateConversation))({
		id,
		metadata,
		name
	});
	return {
		data: data ? convertItemToConversation(client, modelIntrospection, data?.id, data?.createdAt, data?.updatedAt, conversationRouteName, conversationMessageModel, getInternals, data?.metadata, data?.name) : data,
		errors
	};
};
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/utils/clientProperties/generateConversationsProperty.mjs
function generateConversationsProperty(client, apiGraphQLConfig, getInternals) {
	const modelIntrospection = apiGraphQLConfig?.modelIntrospection;
	if (!modelIntrospection?.conversations) return {};
	const conversations = {};
	for (const { name, conversation, message, models, nonModels, enums } of Object.values(modelIntrospection.conversations)) {
		const conversationModel = models[conversation.modelName];
		const conversationMessageModel = models[message.modelName];
		if (!conversationModel || !conversationMessageModel) return {};
		const conversationModelIntrospection = {
			...modelIntrospection,
			models: {
				...modelIntrospection.models,
				...models
			},
			nonModels: {
				...modelIntrospection.nonModels,
				...nonModels
			},
			enums: {
				...modelIntrospection.enums,
				...enums
			}
		};
		conversations[name] = {
			update: createUpdateConversationFunction(client, conversationModelIntrospection, name, conversationModel, conversationMessageModel, getInternals),
			create: createCreateConversationFunction(client, conversationModelIntrospection, name, conversationModel, conversationMessageModel, getInternals),
			get: createGetConversationFunction(client, conversationModelIntrospection, name, conversationModel, conversationMessageModel, getInternals),
			delete: createDeleteConversationFunction(client, conversationModelIntrospection, name, conversationModel, conversationMessageModel, getInternals),
			list: createListConversationsFunction(client, conversationModelIntrospection, name, conversationModel, conversationMessageModel, getInternals)
		};
	}
	return conversations;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/utils/clientProperties/generateGenerationsProperty.mjs
function generateGenerationsProperty(client, apiGraphQLConfig, getInternals) {
	const modelIntrospection = apiGraphQLConfig?.modelIntrospection;
	if (!modelIntrospection?.generations) return {};
	const generations = {};
	for (const generation of Object.values(modelIntrospection.generations)) generations[generation.name] = customOpFactory(client, modelIntrospection, "query", generation, false, getInternals, getCustomUserAgentDetails(AiAction.Generation));
	return generations;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/utils/clientProperties/generateEnumsProperty.mjs
var generateEnumsProperty = (graphqlConfig) => {
	const modelIntrospection = graphqlConfig.modelIntrospection;
	if (!modelIntrospection) return {};
	const enums = {};
	for (const [_, enumData] of Object.entries(modelIntrospection.enums)) enums[enumData.name] = { values: () => enumData.values };
	return enums;
};
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/operations/indexQuery.mjs
function indexQueryFactory(client, modelIntrospection, model, indexMeta, getInternals, context = false) {
	const indexQueryWithContext = (contextSpec, args, options) => {
		return _indexQuery(client, modelIntrospection, model, indexMeta, getInternals, {
			...args,
			...options
		}, contextSpec);
	};
	const indexQuery = (args, options) => {
		return _indexQuery(client, modelIntrospection, model, indexMeta, getInternals, {
			...args,
			...options
		});
	};
	return context ? indexQueryWithContext : indexQuery;
}
function processGraphQlResponse(modelIntroSchema, modelName, result, selectionSet, modelInitializer) {
	const { data, extensions } = result;
	const [key] = Object.keys(data);
	if (data[key].items) {
		const flattenedResult = data[key].items.map((value) => flattenItems(modelIntroSchema, modelName, value));
		return {
			data: selectionSet ? flattenedResult : modelInitializer(flattenedResult),
			nextToken: data[key].nextToken,
			extensions
		};
	}
	return {
		data: data[key],
		nextToken: data[key].nextToken,
		extensions
	};
}
function _indexQuery(client, modelIntrospection, model, indexMeta, getInternals, args, contextSpec) {
	return selfAwareAsync(async (resultPromise) => {
		const { name } = model;
		const query = generateGraphQLDocument(modelIntrospection, model, "INDEX_QUERY", args, indexMeta);
		const variables = buildGraphQLVariables(model, "INDEX_QUERY", args, modelIntrospection, indexMeta);
		const auth = authModeParams(client, getInternals, args);
		const modelInitializer = (flattenedResult) => initializeModel(client, name, flattenedResult, modelIntrospection, auth.authMode, auth.authToken, !!contextSpec);
		try {
			const headers = getCustomHeaders(client, getInternals, args?.headers);
			const requestArgs = [{
				...auth,
				query,
				variables
			}, headers];
			if (contextSpec !== void 0) requestArgs.unshift(contextSpec);
			const response = await extendCancellability(client.graphql(...requestArgs), resultPromise);
			if (response.data !== void 0) return processGraphQlResponse(modelIntrospection, name, response, args?.selectionSet, modelInitializer);
		} catch (error) {
			/**
			* The `data` type returned by `error` here could be:
			* 1) `null`
			* 2) an empty object
			* 3) "populated" but with a `null` value:
			*   `data: { listByExampleId: null }`
			* 4) an actual record:
			*   `data: { listByExampleId: items: [{ id: '1', ...etc } }]`
			*/
			const { data, errors } = error;
			if (data !== void 0 && data !== null && Object.keys(data).length !== 0 && errors) {
				const [key] = Object.keys(data);
				if (data[key]?.items) {
					const flattenedResult = data[key]?.items.map((value) => flattenItems(modelIntrospection, name, value));
					/**
					* Check exists since `flattenedResult` could be `null`.
					* if `flattenedResult` exists, result is an actual record.
					*/
					if (flattenedResult) return {
						data: args?.selectionSet ? flattenedResult : modelInitializer(flattenedResult),
						nextToken: data[key]?.nextToken,
						errors
					};
				}
				return {
					data: data[key],
					nextToken: data[key]?.nextToken,
					errors
				};
			} else return handleListGraphQlError(error);
		}
	});
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/operations/subscription.mjs
function subscriptionFactory(client, modelIntrospection, model, operation, getInternals) {
	const { name } = model;
	const subscription = (args) => {
		const query = generateGraphQLDocument(modelIntrospection, model, operation, args);
		const variables = buildGraphQLVariables(model, operation, args, modelIntrospection);
		const auth = authModeParams(client, getInternals, args);
		const headers = getCustomHeaders(client, getInternals, args?.headers);
		return client.graphql({
			...auth,
			query,
			variables
		}, headers).pipe(map((value) => {
			const [key] = Object.keys(value.data);
			const data = value.data[key];
			const flattenedResult = flattenItems(modelIntrospection, name, data);
			if (flattenedResult === null) return null;
			else if (args?.selectionSet) return flattenedResult;
			else {
				const [initialized] = initializeModel(client, name, [flattenedResult], modelIntrospection, auth.authMode, auth.authToken);
				return initialized;
			}
		}));
	};
	return subscription;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/utils/resolvePKFields.mjs
/**
* Given a SchemaModel from a ModelIntrospectionSchema, returns the primary key
* as an array of field names.
*
* @param model The model object
* @returns Array of field names
*/
function resolvePKFields(model) {
	const { primaryKeyFieldName, sortKeyFieldNames } = model.primaryKeyInfo;
	return [primaryKeyFieldName, ...sortKeyFieldNames];
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/utils/findIndexByFields.mjs
/**
* Iterates through a collection to find a matching item and returns the index.
*
* @param needle The item to search for
* @param haystack The collection to search
* @param keyFields The fields used to indicate a match
* @returns Index of `needle` in `haystack`, otherwise -1 if not found.
*/
function findIndexByFields(needle, haystack, keyFields) {
	const searchObject = Object.fromEntries(keyFields.map((fieldName) => [fieldName, needle[fieldName]]));
	for (let i = 0; i < haystack.length; i++) if (Object.keys(searchObject).every((k) => searchObject[k] === haystack[i][k])) return i;
	return -1;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/operations/observeQuery.mjs
function observeQueryFactory(models, model) {
	const { name } = model;
	const observeQuery = (arg) => new Observable((subscriber) => {
		const items = [];
		const messageQueue = [];
		let receiveMessages = (...messages) => {
			return messageQueue.push(...messages);
		};
		const onCreateSub = models[name].onCreate(arg).subscribe({
			next(item) {
				receiveMessages({
					item,
					type: "create"
				});
			},
			error(error) {
				subscriber.error({
					type: "onCreate",
					error
				});
			}
		});
		const onUpdateSub = models[name].onUpdate(arg).subscribe({
			next(item) {
				receiveMessages({
					item,
					type: "update"
				});
			},
			error(error) {
				subscriber.error({
					type: "onUpdate",
					error
				});
			}
		});
		const onDeleteSub = models[name].onDelete(arg).subscribe({
			next(item) {
				receiveMessages({
					item,
					type: "delete"
				});
			},
			error(error) {
				subscriber.error({
					type: "onDelete",
					error
				});
			}
		});
		function ingestMessages(messages) {
			for (const message of messages) {
				const idx = findIndexByFields(message.item, items, pkFields);
				switch (message.type) {
					case "create":
						if (idx < 0) items.push(message.item);
						break;
					case "update":
						if (idx >= 0) items[idx] = message.item;
						break;
					case "delete":
						if (idx >= 0) items.splice(idx, 1);
						break;
					default: console.error("Unrecognized message in observeQuery.", message);
				}
			}
			subscriber.next({
				items,
				isSynced: true
			});
		}
		const pkFields = resolvePKFields(model);
		(async () => {
			let firstPage = true;
			let nextToken = null;
			while (!subscriber.closed && (firstPage || nextToken)) {
				firstPage = false;
				const { data: page, errors, nextToken: _nextToken } = await models[name].list({
					...arg,
					nextToken
				});
				nextToken = _nextToken;
				items.push(...page);
				const isSynced = messageQueue.length === 0 && (nextToken === null || nextToken === void 0);
				subscriber.next({
					items,
					isSynced
				});
				if (Array.isArray(errors)) for (const error of errors) subscriber.error(error);
			}
			if (messageQueue.length > 0) ingestMessages(messageQueue);
			receiveMessages = (...messages) => {
				ingestMessages(messages);
				return items.length;
			};
		})();
		return () => {
			onCreateSub.unsubscribe();
			onUpdateSub.unsubscribe();
			onDeleteSub.unsubscribe();
		};
	});
	return observeQuery;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/clientUtils.mjs
var attributeIsSecondaryIndex = (attr) => {
	return attr.type === "key" && attr.properties?.name && attr.properties?.queryField && attr.properties?.fields.length > 0;
};
var getSecondaryIndexesFromSchemaModel = (model) => {
	return model.attributes?.filter(attributeIsSecondaryIndex).map((attr) => {
		const queryField = attr.properties.queryField;
		const [pk, ...sk] = attr.properties.fields;
		return {
			queryField,
			pk,
			sk
		};
	}) || [];
};
/**
* returns graphQLOperationsInfo, but filters out operations that were disabled via model().disableOperations([...])
*/
var excludeDisabledOps = (mis, modelName) => {
	const modelAttrs = mis.models[modelName].attributes?.find((attr) => attr.type === "model");
	const coarseToFineDict = {
		queries: [
			"list",
			"get",
			"observeQuery"
		],
		mutations: [
			"create",
			"update",
			"delete"
		],
		subscriptions: [
			"onCreate",
			"onUpdate",
			"onDelete"
		]
	};
	const disabledOps = [];
	if (!modelAttrs) return graphQLOperationsInfo;
	if (modelAttrs.properties) for (const [key, value] of Object.entries(modelAttrs.properties)) {
		if (!(key in coarseToFineDict)) continue;
		if (value === null) disabledOps.push(...coarseToFineDict[key]);
		else if (value instanceof Object) disabledOps.push(...Object.keys(value));
	}
	if (disabledOps.includes("list")) disabledOps.push("observeQuery");
	const disabledOpsUpper = disabledOps.map((op) => op.toUpperCase());
	return Object.fromEntries(Object.entries(graphQLOperationsInfo).filter(([key]) => !disabledOpsUpper.includes(key)));
};
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/internals/utils/clientProperties/generateModelsProperty.mjs
function generateModelsProperty(client, apiGraphQLConfig, getInternals) {
	const models = {};
	const modelIntrospection = apiGraphQLConfig.modelIntrospection;
	if (!modelIntrospection) return {};
	const SUBSCRIPTION_OPS = [
		"ONCREATE",
		"ONUPDATE",
		"ONDELETE"
	];
	for (const model of Object.values(modelIntrospection.models)) {
		const { name } = model;
		models[name] = {};
		const enabledModelOps = excludeDisabledOps(modelIntrospection, name);
		Object.entries(enabledModelOps).forEach(([key, { operationPrefix }]) => {
			const operation = key;
			if (operation === "LIST") models[name][operationPrefix] = listFactory(client, modelIntrospection, model, getInternals);
			else if (SUBSCRIPTION_OPS.includes(operation)) models[name][operationPrefix] = subscriptionFactory(client, modelIntrospection, model, operation, getInternals);
			else if (operation === "OBSERVEQUERY") models[name][operationPrefix] = observeQueryFactory(models, model);
			else models[name][operationPrefix] = getFactory(client, modelIntrospection, model, operation, getInternals);
		});
		const secondaryIdxs = getSecondaryIndexesFromSchemaModel(model);
		for (const idx of secondaryIdxs) models[name][idx.queryField] = indexQueryFactory(client, modelIntrospection, model, idx, getInternals);
	}
	return models;
}
//#endregion
//#region node_modules/@aws-amplify/data-schema/dist/esm/runtime/addSchemaToClient.mjs
function addSchemaToClient(client, apiGraphqlConfig, getInternals) {
	upgradeClientCancellation(client);
	client.models = generateModelsProperty(client, apiGraphqlConfig, getInternals);
	client.enums = generateEnumsProperty(apiGraphqlConfig);
	client.queries = generateCustomQueriesProperty(client, apiGraphqlConfig, getInternals);
	client.mutations = generateCustomMutationsProperty(client, apiGraphqlConfig, getInternals);
	client.subscriptions = generateCustomSubscriptionsProperty(client, apiGraphqlConfig, getInternals);
	client.conversations = generateConversationsProperty(client, apiGraphqlConfig, getInternals);
	client.generations = generateGenerationsProperty(client, apiGraphqlConfig, getInternals);
	return client;
}
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/GraphQLAPI.mjs
function isGraphQLOptionsWithOverride(options) {
	return INTERNAL_USER_AGENT_OVERRIDE in options;
}
/**
* Export Cloud Logic APIs
*/
var GraphQLAPIClass = class extends InternalGraphQLAPIClass {
	getModuleName() {
		return "GraphQLAPI";
	}
	/**
	* Executes a GraphQL operation
	*
	* @param options - GraphQL Options
	* @param [additionalHeaders] - headers to merge in after any `libraryConfigHeaders` set in the config
	* @returns An Observable if the query is a subscription query, else a promise of the graphql result.
	*/
	graphql(amplify, options, additionalHeaders) {
		const userAgentDetails = {
			category: Category.API,
			action: ApiAction.GraphQl
		};
		if (isGraphQLOptionsWithOverride(options)) {
			const { [INTERNAL_USER_AGENT_OVERRIDE]: internalUserAgentOverride, ...cleanOptions } = options;
			return super.graphql(amplify, cleanOptions, additionalHeaders, {
				...userAgentDetails,
				...internalUserAgentOverride
			});
		}
		return super.graphql(amplify, options, additionalHeaders, { ...userAgentDetails });
	}
	/**
	* Checks to see if an error thrown is from an api request cancellation
	* @param error - Any error
	* @returns A boolean indicating if the error was from an api request cancellation
	*/
	isCancelError(error) {
		return super.isCancelError(error);
	}
	/**
	* Cancels an inflight request. Only applicable for graphql queries and mutations
	* @param {any} request - request to cancel
	* @returns A boolean indicating if the request was cancelled
	*/
	cancel(request, message) {
		return super.cancel(request, message);
	}
};
var GraphQLAPI = new GraphQLAPIClass();
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/internals/v6.mjs
/**
* Invokes graphql operations against a graphql service, providing correct input and
* output types if Amplify-generated graphql from a recent version of the CLI/codegen
* are used *or* correct typing is provided via the type argument.
*
* Amplify-generated "branded" graphql queries will look similar to this:
*
* ```ts
*                               //
*                               // |-- branding
*                               // v
* export const getModel = `...` as GeneratedQuery<
* 	GetModelQueryVariables,
* 	GetModelQuery
* >;
* ```
*
* If this branding is not in your generated graphql, update to a newer version of
* CLI/codegen and regenerate your graphql using `amplify codegen`.
*
* ## Using Amplify-generated graphql
*
* ```ts
* import * as queries from './graphql/queries';
*
* //
* //    |-- correctly typed graphql response containing a Widget
* //    v
* const queryResult = await graphql({
* 	query: queries.getWidget,
* 	variables: {
* 		id: "abc", // <-- type hinted/enforced
* 	},
* });
*
* //
* //    |-- a correctly typed Widget
* //    v
* const fetchedWidget = queryResult.data?.getWidget!;
* ```
*
* ## Custom input + result types
*
* To provide input types (`variables`) and result types:
*
* ```ts
* type GetById_NameOnly = {
* 	variables: {
* 		id: string
* 	},
* 	result: Promise<{
* 		data: { getWidget: { name: string } }
* 	}>
* }
*
* //
* //    |-- type is GetById_NameOnly["result"]
* //    v
* const result = graphql<GetById_NameOnly>({
* 	query: "...",
* 	variables: { id: "abc" }  // <-- type of GetById_NameOnly["variables"]
* });
* ```
*
* ## Custom result type only
*
* To specify result types only, use a type that is *not* in the `{variables, result}` shape:
*
* ```ts
* type MyResultType = Promise<{
* 	data: {
* 		getWidget: { name: string }
* 	}
* }>
*
* //
* //    |-- type is MyResultType
* //    v
* const result = graphql<MyResultType>({query: "..."});
* ```
*
* @param options
* @param additionalHeaders
*/
function graphql(options, additionalHeaders) {
	const internals = getInternals(this);
	/**
	* The custom `endpoint` specific to the client
	*/
	const clientEndpoint = internals.endpoint;
	/**
	* The `authMode` specific to the client.
	*/
	const clientAuthMode = internals.authMode;
	/**
	* The `apiKey` specific to the client.
	*/
	const clientApiKey = internals.apiKey;
	/**
	* The most specific `authMode` wins. Setting an `endpoint` value without also
	* setting an `authMode` value is invalid. This helps to prevent customers apps
	* from unexpectedly sending auth details to endpoints the auth details do not
	* belong to.
	*
	* This is especially pronounced for `apiKey`. When both an `endpoint` *and*
	* `authMode: 'apiKey'` are provided, an explicit `apiKey` override is required
	* to prevent inadvertent sending of an API's `apiKey` to an endpoint is does
	* not belong to.
	*/
	options.authMode = options.authMode || clientAuthMode;
	options.apiKey = options.apiKey ?? clientApiKey;
	options.authToken = options.authToken || internals.authToken;
	if (clientEndpoint && options.authMode === "apiKey" && !options.apiKey) throw new Error("graphql() requires an explicit `apiKey` for a custom `endpoint` when `authMode = 'apiKey'`.");
	const headers = additionalHeaders || internals.headers;
	return GraphQLAPI.graphql(internals.amplify, {
		...options,
		endpoint: clientEndpoint
	}, headers);
}
/**
* Cancels an inflight request. Only applicable for graphql queries and mutations
* @param {any} request - request to cancel
* @returns - A boolean indicating if the request was cancelled
*/
function cancel(promise, message) {
	return GraphQLAPI.cancel(promise, message);
}
/**
* Checks to see if an error thrown is from an api request cancellation
* @param {any} error - Any error
* @returns - A boolean indicating if the error was from an api request cancellation
*/
function isCancelError$1(error) {
	return GraphQLAPI.isCancelError(error);
}
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/internals/utils/runtimeTypeGuards/isApiGraphQLProviderConfig.mjs
function isApiGraphQLConfig(apiGraphQLConfig) {
	return apiGraphQLConfig !== void 0;
}
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/internals/utils/runtimeTypeGuards/isConfigureEventWithResourceConfig.mjs
function isConfigureEventWithResourceConfig(payload) {
	return payload.event === "configure";
}
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/internals/generateClient.mjs
/**
* @private
*
* Creates a client that can be used to make GraphQL requests, using a provided `AmplifyClassV6`
* compatible context object for config and auth fetching.
*
* @param params
* @returns
*/
function generateClient$1(params) {
	const client = {
		[__amplify]: params.amplify,
		[__authMode]: params.authMode,
		[__authToken]: params.authToken,
		[__apiKey]: "apiKey" in params ? params.apiKey : void 0,
		[__endpoint]: "endpoint" in params ? params.endpoint : void 0,
		[__headers]: params.headers,
		graphql,
		cancel,
		isCancelError: isCancelError$1,
		models: emptyProperty,
		enums: emptyProperty,
		queries: emptyProperty,
		mutations: emptyProperty,
		subscriptions: emptyProperty
	};
	const apiGraphqlConfig = params.amplify.getConfig().API?.GraphQL;
	if (client[__endpoint]) {
		if (!client[__authMode]) throw new Error("generateClient() requires an explicit `authMode` when `endpoint` is provided.");
		if (client[__authMode] === "apiKey" && !client[__apiKey]) throw new Error("generateClient() requires an explicit `apiKey` when `endpoint` is provided and `authMode = 'apiKey'`.");
	}
	if (!client[__endpoint]) if (isApiGraphQLConfig(apiGraphqlConfig)) addSchemaToClient(client, apiGraphqlConfig, getInternals);
	else generateModelsPropertyOnAmplifyConfigure(client);
	return client;
}
var generateModelsPropertyOnAmplifyConfigure = (clientRef) => {
	Hub.listen("core", (coreEvent) => {
		if (!isConfigureEventWithResourceConfig(coreEvent.payload)) return;
		const apiGraphQLConfig = coreEvent.payload.data.API?.GraphQL;
		if (isApiGraphQLConfig(apiGraphQLConfig)) addSchemaToClient(clientRef, apiGraphQLConfig, getInternals);
	});
};
var emptyProperty = new Proxy({}, { get() {
	throw new Error("Client could not be generated. This is likely due to `Amplify.configure()` not being called prior to `generateClient()` or because the configuration passed to `Amplify.configure()` is missing GraphQL provider configuration.");
} });
//#endregion
//#region node_modules/@aws-amplify/api/dist/esm/API.mjs
/**
* Generates an API client that can work with models or raw GraphQL
*
* @returns {@link V6Client}
* @throws {@link Error} - Throws error when client cannot be generated due to configuration issues.
*/
function generateClient(options) {
	return generateClient$1({
		...options || {},
		amplify: Amplify
	});
}
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/internals/events/utils.mjs
var normalizeAuth = (explicitAuthMode, defaultAuthMode) => {
	if (!explicitAuthMode) return defaultAuthMode;
	if (explicitAuthMode === "identityPool") return "iam";
	return explicitAuthMode;
};
var configure = () => {
	const eventsConfig = Amplify.getConfig().API?.Events;
	if (!eventsConfig) throw new Error("Amplify configuration is missing. Have you called Amplify.configure()?");
	const configAuthMode = normalizeAuth(eventsConfig.defaultAuthMode, "apiKey");
	return {
		appSyncGraphqlEndpoint: eventsConfig.endpoint,
		region: eventsConfig.region,
		authenticationType: configAuthMode,
		apiKey: eventsConfig.apiKey
	};
};
/**
* Event API expects an array of JSON strings
*
* @param events - JSON-serializable value or an array of values
* @returns array of JSON strings
*/
var serializeEvents = (events) => {
	if (Array.isArray(events)) return events.map((ev, idx) => {
		const eventJson = JSON.stringify(ev);
		if (eventJson === void 0) throw new Error(`Event must be a valid JSON value. Received ${ev} at index ${idx}`);
		return eventJson;
	});
	const eventJson = JSON.stringify(events);
	if (eventJson === void 0) throw new Error(`Event must be a valid JSON value. Received ${events}`);
	return [eventJson];
};
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/Providers/AWSAppSyncEventsProvider/index.mjs
var PROVIDER_NAME = "AWSAppSyncEventsProvider";
var WS_PROTOCOL_NAME = "aws-appsync-event-ws";
var CONNECT_URI = "";
var AWSAppSyncEventProvider = class extends AWSWebSocketProvider {
	constructor() {
		super({
			providerName: PROVIDER_NAME,
			wsProtocolName: WS_PROTOCOL_NAME,
			connectUri: CONNECT_URI
		});
		this.allowNoSubscriptions = true;
	}
	getProviderName() {
		return PROVIDER_NAME;
	}
	async connect(options) {
		return super.connect(options);
	}
	subscribe(options, customUserAgentDetails) {
		return super.subscribe(options, customUserAgentDetails).pipe();
	}
	async publish(options, customUserAgentDetails) {
		return super.publish(options, customUserAgentDetails);
	}
	closeIfNoActiveSubscription() {
		this._closeSocketIfRequired();
	}
	async _prepareSubscriptionPayload({ options, subscriptionId, customUserAgentDetails, additionalCustomHeaders, libraryConfigHeaders, publish }) {
		const { appSyncGraphqlEndpoint, authenticationType, query, apiKey, region, variables } = options;
		const data = {
			channel: query,
			events: variables !== void 0 ? serializeEvents(variables) : void 0
		};
		const headers = {
			...await awsRealTimeHeaderBasedAuth({
				apiKey,
				appSyncGraphqlEndpoint,
				authenticationType,
				payload: JSON.stringify(data),
				canonicalUri: "",
				region,
				additionalCustomHeaders
			}),
			...libraryConfigHeaders,
			...additionalCustomHeaders,
			[USER_AGENT_HEADER$2]: getAmplifyUserAgent(customUserAgentDetails)
		};
		const subscriptionMessage = {
			id: subscriptionId,
			channel: query,
			events: variables !== void 0 ? serializeEvents(variables) : void 0,
			authorization: { ...headers },
			payload: {
				events: variables !== void 0 ? serializeEvents(variables) : void 0,
				channel: query,
				extensions: { authorization: { ...headers } }
			},
			type: publish ? MESSAGE_TYPES.EVENT_PUBLISH : MESSAGE_TYPES.EVENT_SUBSCRIBE
		};
		return JSON.stringify(subscriptionMessage);
	}
	_handleSubscriptionData(message) {
		this.logger.debug(`subscription message from AWS AppSync Events: ${message.data}`);
		const { id = "", event: payload, type } = JSON.parse(String(message.data));
		const { observer = null, query = "", variables = {} } = this.subscriptionObserverMap.get(id) || {};
		this.logger.debug({
			id,
			observer,
			query,
			variables
		});
		if (type === MESSAGE_TYPES.DATA && payload) {
			const deserializedEvent = JSON.parse(payload);
			if (observer) observer.next({
				id,
				type,
				event: deserializedEvent
			});
			else this.logger.debug(`observer not found for id: ${id}`);
			return [true, {
				id,
				type,
				payload: deserializedEvent
			}];
		}
		return [false, {
			id,
			type,
			payload
		}];
	}
	_unsubscribeMessage(subscriptionId) {
		return {
			id: subscriptionId,
			type: MESSAGE_TYPES.EVENT_STOP
		};
	}
	_extractConnectionTimeout(data) {
		const { connectionTimeoutMs = DEFAULT_KEEP_ALIVE_TIMEOUT } = data;
		return connectionTimeoutMs;
	}
	_extractErrorCodeAndType(data) {
		const { errors: [{ errorType = "", errorCode = 0 } = {}] = [] } = data;
		return {
			errorCode,
			errorType
		};
	}
};
var AppSyncEventProvider = new AWSAppSyncEventProvider();
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/internals/events/appsyncRequest.mjs
var USER_AGENT_HEADER = "x-amz-user-agent";
async function appsyncRequest(amplify, options, additionalHeaders = {}, abortController, customUserAgentDetails) {
	const { region, appSyncGraphqlEndpoint: endpoint, authenticationType: authMode, query, variables } = options;
	if (!endpoint) throw new Error("No endpoint");
	const { withCredentials } = resolveLibraryOptions(amplify);
	const headers = await requestHeaders(amplify, options, additionalHeaders, customUserAgentDetails);
	const body = {
		channel: query,
		events: variables
	};
	const signingServiceInfo = ["apiKey", "none"].includes(authMode) ? void 0 : {
		service: "appsync",
		region
	};
	const { body: responseBody } = await post$2(amplify, {
		url: new AmplifyUrl(endpoint),
		options: {
			headers,
			body,
			signingServiceInfo,
			withCredentials
		},
		abortController
	});
	const response = await responseBody.json();
	if (isGraphQLResponseWithErrors(response)) throw repackageUnauthorizedError(response);
	return response;
}
/**
* Computes all the necessary HTTP headers for the request based on:
* 1. Operation-level header options
* 2. Amplify.configure custom headers
* 3. AuthZ headers for explicit auth mode specified for operation ?? default auth mode in config
*
* @returns HTTP request headers key/value
*/
async function requestHeaders(amplify, options, additionalHeaders, customUserAgentDetails) {
	const { apiKey, appSyncGraphqlEndpoint: endpoint, authenticationType: authMode, query, variables, authToken } = options;
	const { headers: customHeadersFn } = resolveLibraryOptions(amplify);
	let additionalCustomHeaders;
	if (typeof additionalHeaders === "function") additionalCustomHeaders = await additionalHeaders({
		method: "POST",
		url: new AmplifyUrl(endpoint).toString(),
		queryString: query
	});
	else additionalCustomHeaders = additionalHeaders;
	if (authToken) additionalCustomHeaders = {
		...additionalCustomHeaders,
		Authorization: authToken
	};
	const authHeaders = await headerBasedAuth(amplify, authMode, apiKey, additionalCustomHeaders);
	const customHeaders = customHeadersFn && await customHeadersFn({
		query,
		variables
	});
	return {
		...authHeaders,
		...customHeaders,
		...additionalCustomHeaders,
		[USER_AGENT_HEADER]: getAmplifyUserAgent(customUserAgentDetails)
	};
}
//#endregion
//#region node_modules/@aws-amplify/api-graphql/dist/esm/internals/events/index.mjs
var events_exports = /* @__PURE__ */ __exportAll({
	closeAll: () => closeAll,
	connect: () => connect,
	post: () => post$1
});
var openChannels = /* @__PURE__ */ new Set();
/**
* @experimental API may change in future versions
*
* Establish a WebSocket connection to an Events channel
*
* @example
* const channel = await events.connect("default/channel")
*
* channel.subscribe({
*   next: (data) => { console.log(data) },
*   error: (err) => { console.error(err) },
* })
*
* @example // authMode override
* const channel = await events.connect("default/channel", { authMode: "userPool" })
*
* @param channel - channel path; `<namespace>/<channel>`
* @param options - request overrides: `authMode`, `authToken`
*
*/
async function connect(channel, options) {
	const providerOptions = configure();
	providerOptions.authenticationType = normalizeAuth(options?.authMode, providerOptions.authenticationType);
	providerOptions.apiKey = options?.apiKey || providerOptions.apiKey;
	providerOptions.authToken = options?.authToken || providerOptions.authToken;
	await AppSyncEventProvider.connect(providerOptions);
	const channelId = amplifyUuid();
	openChannels.add(channelId);
	let _subscription;
	const sub = (observer, subOptions) => {
		if (!openChannels.has(channelId)) throw new Error("Channel is closed");
		const subscribeOptions = {
			...providerOptions,
			query: channel
		};
		subscribeOptions.authenticationType = normalizeAuth(subOptions?.authMode, subscribeOptions.authenticationType);
		subscribeOptions.apiKey = subOptions?.apiKey || subscribeOptions.apiKey;
		subscribeOptions.authToken = subOptions?.authToken || subscribeOptions.authToken;
		_subscription = AppSyncEventProvider.subscribe(subscribeOptions).subscribe(observer);
		return _subscription;
	};
	const pub = async (event, pubOptions) => {
		if (!openChannels.has(channelId)) throw new Error("Channel is closed");
		const publishOptions = {
			...providerOptions,
			query: channel,
			variables: event
		};
		publishOptions.authenticationType = normalizeAuth(pubOptions?.authMode, publishOptions.authenticationType);
		publishOptions.apiKey = pubOptions?.apiKey || publishOptions.apiKey;
		publishOptions.authToken = pubOptions?.authToken || publishOptions.authToken;
		return AppSyncEventProvider.publish(publishOptions);
	};
	const close = async () => {
		_subscription && _subscription.unsubscribe();
		openChannels.delete(channelId);
		setTimeout(() => {
			if (openChannels.size === 0) AppSyncEventProvider.closeIfNoActiveSubscription();
		}, 1e3);
	};
	return {
		subscribe: sub,
		close,
		publish: pub
	};
}
/**
* @experimental API may change in future versions
*
* Publish events to a channel via HTTP request
*
* @example
* await events.post("default/channel", { some: "event" })
*
* @example // event batching
* await events.post("default/channel", [{ some: "event" }, { some: "event2" }])
*
* @example // authMode override
* await events.post("default/channel", { some: "event" }, { authMode: "userPool" })
*
* @param channel - channel path; `<namespace>/<channel>`
* @param event - JSON-serializable value or an array of values
* @param options - request overrides: `authMode`, `authToken`
*
* @returns void on success
* @throws on error
*/
async function post$1(channel, event, options) {
	const providerOptions = configure();
	providerOptions.authenticationType = normalizeAuth(options?.authMode, providerOptions.authenticationType);
	providerOptions.apiKey = options?.apiKey || providerOptions.apiKey;
	providerOptions.authToken = options?.authToken || providerOptions.authToken;
	const normalizedChannelName = channel[0] === "/" ? channel : `/${channel}`;
	const res = await appsyncRequest(Amplify, {
		...providerOptions,
		query: normalizedChannelName,
		variables: serializeEvents(event)
	}, {}, new AbortController());
	if (res.failed?.length > 0) return res.failed;
}
/**
* @experimental API may change in future versions
*
* Close WebSocket connection, disconnect listeners and reconnect observers
*
* @example
* await events.closeAll()
*
* @returns void on success
* @throws on error
*/
async function closeAll() {
	await AppSyncEventProvider.close();
}
//#endregion
export { ApiError, CONNECTION_STATE_CHANGE, ConnectionState, GraphQLAuthError, del, events_exports as events, generateClient, get, head, isCancelError, patch, post, put };

//# sourceMappingURL=aws-amplify_api.js.map