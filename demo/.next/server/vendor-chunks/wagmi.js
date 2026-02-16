"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/wagmi";
exports.ids = ["vendor-chunks/wagmi"];
exports.modules = {

/***/ "(ssr)/./node_modules/wagmi/dist/esm/context.js":
/*!************************************************!*\
  !*** ./node_modules/wagmi/dist/esm/context.js ***!
  \************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   WagmiContext: () => (/* binding */ WagmiContext),\n/* harmony export */   WagmiProvider: () => (/* binding */ WagmiProvider)\n/* harmony export */ });\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ \"(ssr)/./node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js\");\n/* harmony import */ var _hydrate_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./hydrate.js */ \"(ssr)/./node_modules/wagmi/dist/esm/hydrate.js\");\n/* __next_internal_client_entry_do_not_use__ WagmiContext,WagmiProvider auto */ \n\nconst WagmiContext = /*#__PURE__*/ (0,react__WEBPACK_IMPORTED_MODULE_0__.createContext)(undefined);\nfunction WagmiProvider(parameters) {\n    const { children, config } = parameters;\n    const props = {\n        value: config\n    };\n    return /*#__PURE__*/ (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_hydrate_js__WEBPACK_IMPORTED_MODULE_1__.Hydrate, parameters, /*#__PURE__*/ (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(WagmiContext.Provider, props, children));\n} //# sourceMappingURL=context.js.map\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvd2FnbWkvZGlzdC9lc20vY29udGV4dC5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7O2dGQUdvRDtBQUNkO0FBRS9CLE1BQU0sWUFBWSxpQkFBRyxvREFBYSxDQUV2QyxTQUFTLENBQUM7QUFRTixTQUFVLGFBQWEsQ0FDM0IsVUFBdUQ7SUFFdkQsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsR0FBRyxVQUFVO0lBRXZDLE1BQU0sS0FBSyxHQUFHO1FBQUUsS0FBSyxFQUFFLE1BQU07SUFBQSxDQUFFO0lBQy9CLHFCQUFPLG9EQUFhLENBQ2xCLGdEQUFPLEVBQ1AsVUFBVSxnQkFDVixvREFBYSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUN0RDtBQUNILENBQUMiLCJzb3VyY2VzIjpbIi9Vc2Vycy9uaWtvbGFqL3dvcmtzcGFjZS9zcmMvY29udGV4dC50cyJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/wagmi/dist/esm/context.js\n");

/***/ }),

/***/ "(ssr)/./node_modules/wagmi/dist/esm/hydrate.js":
/*!************************************************!*\
  !*** ./node_modules/wagmi/dist/esm/hydrate.js ***!
  \************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   Hydrate: () => (/* binding */ Hydrate)\n/* harmony export */ });\n/* harmony import */ var _wagmi_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wagmi/core */ \"(ssr)/./node_modules/@wagmi/core/dist/esm/hydrate.js\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ \"(ssr)/./node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js\");\n/* __next_internal_client_entry_do_not_use__ Hydrate auto */ \n\nfunction Hydrate(parameters) {\n    const { children, config, initialState, reconnectOnMount = true } = parameters;\n    const { onMount } = (0,_wagmi_core__WEBPACK_IMPORTED_MODULE_1__.hydrate)(config, {\n        initialState,\n        reconnectOnMount\n    });\n    // Hydrate for non-SSR\n    if (!config._internal.ssr) onMount();\n    // Hydrate for SSR\n    const active = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(true);\n    // biome-ignore lint/correctness/useExhaustiveDependencies: `queryKey` not required\n    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)({\n        \"Hydrate.useEffect\": ()=>{\n            if (!active.current) return;\n            if (!config._internal.ssr) return;\n            onMount();\n            return ({\n                \"Hydrate.useEffect\": ()=>{\n                    active.current = false;\n                }\n            })[\"Hydrate.useEffect\"];\n        }\n    }[\"Hydrate.useEffect\"], []);\n    return children;\n} //# sourceMappingURL=hydrate.js.map\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvd2FnbWkvZGlzdC9lc20vaHlkcmF0ZS5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7NkRBRXdFO0FBQ1o7QUFRdEQsU0FBVSxPQUFPLENBQUMsVUFBaUQ7SUFDdkUsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLGdCQUFnQixHQUFHLElBQUksRUFBRSxHQUFHLFVBQVU7SUFFOUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxHQUFHLG9EQUFPLENBQUMsTUFBTSxFQUFFO1FBQ2xDLFlBQVk7UUFDWixnQkFBZ0I7S0FDakIsQ0FBQztJQUVGLHNCQUFzQjtJQUN0QixJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFO0lBRXBDLGtCQUFrQjtJQUNsQixNQUFNLE1BQU0sR0FBRyw2Q0FBTSxDQUFDLElBQUksQ0FBQztJQUMzQixtRkFBbUY7SUFDbkYsZ0RBQVM7NkJBQUMsR0FBRyxFQUFFO1lBQ2IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTTtZQUMzQixJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsT0FBTTtZQUNqQyxPQUFPLEVBQUU7WUFDVDtxQ0FBTyxHQUFHLEVBQUU7b0JBQ1YsTUFBTSxDQUFDLE9BQU8sR0FBRyxLQUFLO2dCQUN4QixDQUFDOztRQUNILENBQUM7NEJBQUUsRUFBRSxDQUFDO0lBRU4sT0FBTyxRQUF3QjtBQUNqQyxDQUFDIiwic291cmNlcyI6WyIvVXNlcnMvbmlrb2xhai93b3Jrc3BhY2Uvc3JjL2h5ZHJhdGUudHMiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/wagmi/dist/esm/hydrate.js\n");

/***/ })

};
;