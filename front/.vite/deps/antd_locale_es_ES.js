import { t as __commonJSMin } from "./chunk-BoAXSpZd.js";
//#region node_modules/@babel/runtime/helpers/interopRequireDefault.js
var require_interopRequireDefault = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function _interopRequireDefault(e) {
		return e && e.__esModule ? e : { "default": e };
	}
	module.exports = _interopRequireDefault, module.exports.__esModule = true, module.exports["default"] = module.exports;
}));
//#endregion
//#region node_modules/@rc-component/pagination/lib/locale/es_ES.js
var require_es_ES$6 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		items_per_page: "/ página",
		jump_to: "Ir a",
		jump_to_confirm: "confirmar",
		page: "Página",
		prev_page: "Página anterior",
		next_page: "Página siguiente",
		prev_5: "5 páginas previas",
		next_5: "5 páginas siguientes",
		prev_3: "3 páginas previas",
		next_3: "3 páginas siguientes",
		page_size: "tamaño de página"
	};
}));
//#endregion
//#region node_modules/@rc-component/picker/lib/locale/common.js
var require_common = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.commonLocale = void 0;
	exports.commonLocale = {
		yearFormat: "YYYY",
		dayFormat: "D",
		cellMeridiemFormat: "A",
		monthBeforeYear: true
	};
}));
//#endregion
//#region node_modules/@rc-component/picker/lib/locale/es_ES.js
var require_es_ES$5 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	var _common = require_common();
	function _typeof(o) {
		"@babel/helpers - typeof";
		return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
			return typeof o;
		} : function(o) {
			return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
		}, _typeof(o);
	}
	function ownKeys(e, r) {
		var t = Object.keys(e);
		if (Object.getOwnPropertySymbols) {
			var o = Object.getOwnPropertySymbols(e);
			r && (o = o.filter(function(r) {
				return Object.getOwnPropertyDescriptor(e, r).enumerable;
			})), t.push.apply(t, o);
		}
		return t;
	}
	function _objectSpread(e) {
		for (var r = 1; r < arguments.length; r++) {
			var t = null != arguments[r] ? arguments[r] : {};
			r % 2 ? ownKeys(Object(t), !0).forEach(function(r) {
				_defineProperty(e, r, t[r]);
			}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r) {
				Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
			});
		}
		return e;
	}
	function _defineProperty(obj, key, value) {
		key = _toPropertyKey(key);
		if (key in obj) Object.defineProperty(obj, key, {
			value,
			enumerable: true,
			configurable: true,
			writable: true
		});
		else obj[key] = value;
		return obj;
	}
	function _toPropertyKey(t) {
		var i = _toPrimitive(t, "string");
		return "symbol" == _typeof(i) ? i : String(i);
	}
	function _toPrimitive(t, r) {
		if ("object" != _typeof(t) || !t) return t;
		var e = t[Symbol.toPrimitive];
		if (void 0 !== e) {
			var i = e.call(t, r || "default");
			if ("object" != _typeof(i)) return i;
			throw new TypeError("@@toPrimitive must return a primitive value.");
		}
		return ("string" === r ? String : Number)(t);
	}
	exports.default = _objectSpread(_objectSpread({}, _common.commonLocale), {}, {
		locale: "es_ES",
		today: "Hoy",
		now: "Ahora",
		backToToday: "Volver a hoy",
		ok: "Aceptar",
		clear: "Limpiar",
		week: "Semana",
		month: "Mes",
		year: "Año",
		timeSelect: "Seleccionar hora",
		dateSelect: "Seleccionar fecha",
		monthSelect: "Elegir un mes",
		yearSelect: "Elegir un año",
		decadeSelect: "Elegir una década",
		previousMonth: "Mes anterior (PageUp)",
		nextMonth: "Mes siguiente (PageDown)",
		previousYear: "Año anterior (Control + left)",
		nextYear: "Año siguiente (Control + right)",
		previousDecade: "Década anterior",
		nextDecade: "Década siguiente",
		previousCentury: "Siglo anterior",
		nextCentury: "Siglo siguiente"
	});
}));
//#endregion
//#region node_modules/antd/lib/time-picker/locale/es_ES.js
var require_es_ES$4 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = {
		placeholder: "Seleccionar hora",
		rangePlaceholder: ["Hora de inicio", "Hora de fin"]
	};
}));
//#endregion
//#region node_modules/antd/lib/date-picker/locale/es_ES.js
var require_es_ES$3 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var _interopRequireDefault = require_interopRequireDefault().default;
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	var _es_ES = _interopRequireDefault(require_es_ES$5());
	var _es_ES2 = _interopRequireDefault(require_es_ES$4());
	exports.default = {
		lang: {
			placeholder: "Seleccionar fecha",
			rangePlaceholder: ["Fecha inicial", "Fecha final"],
			shortWeekDays: [
				"Dom",
				"Lun",
				"Mar",
				"Mié",
				"Jue",
				"Vie",
				"Sáb"
			],
			shortMonths: [
				"Ene",
				"Feb",
				"Mar",
				"Abr",
				"May",
				"Jun",
				"Jul",
				"Ago",
				"Sep",
				"Oct",
				"Nov",
				"Dic"
			],
			..._es_ES.default
		},
		timePickerLocale: { ..._es_ES2.default }
	};
}));
//#endregion
//#region node_modules/antd/lib/calendar/locale/es_ES.js
var require_es_ES$2 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var _interopRequireDefault = require_interopRequireDefault().default;
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	exports.default = _interopRequireDefault(require_es_ES$3()).default;
}));
//#endregion
//#region node_modules/antd/lib/locale/es_ES.js
var require_es_ES$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var _interopRequireDefault = require_interopRequireDefault().default;
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = void 0;
	var _es_ES = _interopRequireDefault(require_es_ES$6());
	var _es_ES2 = _interopRequireDefault(require_es_ES$2());
	var _es_ES3 = _interopRequireDefault(require_es_ES$3());
	var _es_ES4 = _interopRequireDefault(require_es_ES$4());
	var typeTemplate = "${label} no es un ${type} válido";
	exports.default = {
		locale: "es",
		Pagination: _es_ES.default,
		DatePicker: _es_ES3.default,
		TimePicker: _es_ES4.default,
		Calendar: _es_ES2.default,
		global: {
			placeholder: "Seleccione",
			close: "Cerrar"
		},
		Table: {
			filterTitle: "Filtrar menú",
			filterConfirm: "Aceptar",
			filterReset: "Reiniciar",
			filterEmptyText: "Sin filtros",
			filterCheckAll: "Seleccionar todo",
			filterSearchPlaceholder: "Buscar en filtros",
			emptyText: "Sin datos",
			selectAll: "Seleccionar todo",
			selectInvert: "Invertir selección",
			selectNone: "Vacíe todo",
			selectionAll: "Seleccionar todos los datos",
			sortTitle: "Ordenar",
			expand: "Expandir fila",
			collapse: "Colapsar fila",
			triggerDesc: "Click para ordenar en orden descendente",
			triggerAsc: "Click para ordenar en orden ascendente",
			cancelSort: "Click para cancelar ordenamiento"
		},
		Tour: {
			Next: "Siguiente",
			Previous: "Anterior",
			Finish: "Finalizar"
		},
		Modal: {
			okText: "Aceptar",
			cancelText: "Cancelar",
			justOkText: "Aceptar"
		},
		Popconfirm: {
			okText: "Aceptar",
			cancelText: "Cancelar"
		},
		Transfer: {
			titles: ["", ""],
			searchPlaceholder: "Buscar aquí",
			itemUnit: "elemento",
			itemsUnit: "elementos",
			remove: "Eliminar",
			selectCurrent: "Seleccionar página actual",
			removeCurrent: "Eliminar página actual",
			selectAll: "Seleccionar todos los datos",
			removeAll: "Eliminar todos los datos",
			selectInvert: "Invertir página actual"
		},
		Upload: {
			uploading: "Subiendo...",
			removeFile: "Eliminar archivo",
			uploadError: "Error al subir el archivo",
			previewFile: "Vista previa",
			downloadFile: "Descargar archivo"
		},
		Empty: { description: "No hay datos" },
		Icon: { icon: "ícono" },
		Text: {
			edit: "Editar",
			copy: "Copiar",
			copied: "Copiado",
			expand: "Expandir"
		},
		Form: {
			optional: "(opcional)",
			defaultValidateMessages: {
				default: "Error de validación del campo ${label}",
				required: "Por favor, rellena ${label}",
				enum: "${label} debe ser uno de [${enum}]",
				whitespace: "${label} no puede ser un carácter en blanco",
				date: {
					format: "El formato de fecha de ${label} es inválido",
					parse: "${label} no se puede convertir a una fecha",
					invalid: "${label} es una fecha inválida"
				},
				types: {
					string: typeTemplate,
					method: typeTemplate,
					array: typeTemplate,
					object: typeTemplate,
					number: typeTemplate,
					date: typeTemplate,
					boolean: typeTemplate,
					integer: typeTemplate,
					float: typeTemplate,
					regexp: typeTemplate,
					email: typeTemplate,
					url: typeTemplate,
					hex: typeTemplate
				},
				string: {
					len: "${label} debe tener ${len} caracteres",
					min: "${label} debe tener al menos ${min} caracteres",
					max: "${label} debe tener hasta ${max} caracteres",
					range: "${label} debe tener entre ${min}-${max} caracteres"
				},
				number: {
					len: "${label} debe ser igual a ${len}",
					min: "${label} valor mínimo es ${min}",
					max: "${label} valor máximo es ${max}",
					range: "${label} debe ser entre ${min}-${max}"
				},
				array: {
					len: "Debe ser ${len} ${label}",
					min: "Al menos ${min} ${label}",
					max: "Como máximo ${max} ${label}",
					range: "El valor de ${label} debe estar entre ${min}-${max}"
				},
				pattern: { mismatch: "${label} no coincide con el patrón ${pattern}" }
			}
		}
	};
}));
//#endregion
//#region node_modules/antd/locale/es_ES.js
var require_es_ES = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_es_ES$1();
}));
//#endregion
export default require_es_ES();

//# sourceMappingURL=antd_locale_es_ES.js.map