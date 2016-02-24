/*
Google places angular module by @elkami12 (Mikael Couesnon):
 
Full source at https://github.com/elkami12/mcGooglePlace
 
Apache Licence V2.0, https://github.com/elkami12/mcGooglePlace/blob/master/LICENSE
*/(function() {
    'use strict';

    angular.module('mcGooglePlace', []);
})();

(function() {
    'use strict';

    var googlePlaceModule =
        angular
        .module('mcGooglePlace');


    googlePlaceModule.config(inputProviderFn);

    inputProviderFn.$inject = ['$provide'];
    /* @ngInject */
    function inputProviderFn($provide) {
        $provide.decorator('inputDirective', inputDirectiveDecorator);
    }


    inputDirectiveDecorator.$inject = ['$delegate'];
    /* @ngInject */
    function inputDirectiveDecorator($delegate) {

        var directive = $delegate[0];
        var originalLinkPre = directive.link.pre;

        directive.link.pre = function(scope, element, attr, ctrls) {
            if (!ctrls[0] || angular.isUndefined(attr.mcGoogleAutocomplete)) {
                return originalLinkPre.apply(this, arguments);
            }
        };

        return $delegate;
    }

    googlePlaceModule
        .directive('mcGoogleAutocomplete', mcGoogleAutocomplete);

    mcGoogleAutocomplete.$inject = ['mcGooglePlaceUtils', '$sniffer', '$browser'];

    /* @ngInject */
    function mcGoogleAutocomplete(mcGooglePlaceUtils, $sniffer, $browser) {
        // Usage:
        //
        //  <form>
        //      <input   mc-google-autocomplete
        //               ng-model="address"
        //               name="address"
        //               type="text">
        //  </form>
        //
        // Creates:
        //
        var directive = {
            require: ['?ngModel'],
            link: {
                pre: function(scope, element, attr, ctrls) {
                    if (ctrls[0]) {
                        linkSubInput(scope, element, ctrls[0], mcGooglePlaceUtils, $sniffer, $browser);
                    }
                }
            },
            restrict: 'A',
            scope: {
                gaOptions: '=?'
            }
        };
        return directive;

        function linkSubInput(scope, element, ctrl, mcGooglePlaceUtils, $sniffer, $browser) {

            // ************************************************
            // Init the google autocomplete
            // ************************************************
            // google.maps.places.Autocomplete instance (support google.maps.places.AutocompleteOptions)
            var autocompleteOptions = scope.gaOptions || {};

            mcGooglePlaceUtils.buildAutocomplete(element[0], autocompleteOptions, function(place) {
                if (placeToString(place) !== '') {
                    ctrl.$setViewValue(angular.copy(place));
                } else {
                    ctrl.$setViewValue(undefined);
                }
                scope.$apply(function() {
                    ctrl.$commitViewValue();
                });
            });

            // ************************************************
            // ******** Track any other input change in order to reset to a default viewValue
            // ************************************************
            var timeout;

            // In composition mode, users are still inputing intermediate text buffer,
            // hold the listener until composition is done.
            // More about composition events: https://developer.mozilla.org/en-US/docs/Web/API/CompositionEvent
            if (!$sniffer.android) {
                var composing = false;

                element.on('compositionstart', function(data) {
                    composing = true;
                });

                element.on('compositionend', function() {
                    composing = false;
                    listener();
                });
            }

            function listener(ev) {

                if (timeout) {
                    $browser.defer.cancel(timeout);
                    timeout = null;
                }
                if (composing) {
                    return;
                }
                var rawValue = element.val(),
                    event = ev && ev.type;

                rawValue = rawValue.trim();

                // If a control is suffering from bad input (due to native validators), browsers discard its
                // value, so it may be necessary to revalidate (by calling $setViewValue again) even if the
                // control's value is the same empty value twice in a row.
                if (placeToString(ctrl.$viewValue) !== rawValue || (rawValue === '' && ctrl.$$hasNativeValidators)) {
                    if (rawValue !== '') {
                        ctrl.$setViewValue({ name: rawValue }, event);
                    } else {
                        ctrl.$setViewValue(undefined, event);
                    }
                }
            }

            function deferListener(ev, input, origValue) {
                if (!timeout) {
                    timeout = $browser.defer(function() {
                        timeout = null;
                        if (!input || input.value !== origValue) {
                            listener(ev);
                        }
                    });
                }
            }

            // if the browser does support "input" event, we are fine - except on IE9 which doesn't fire the
            // input event on backspace, delete or cut
            if ($sniffer.hasEvent('input')) {
                element.on('input', listener);
            } else {
                element.on('keydown', function(event) {
                    var key = event.keyCode;

                    // ignore
                    //    command            modifiers                   arrows
                    if (key === 91 || (15 < key && key < 19) || (37 <= key && key <= 40)) {
                        return;
                    }

                    deferListener(event, this, this.value);
                });

                // if user modifies input value using context menu in IE, we need "paste" and "cut" events to catch it
                if ($sniffer.hasEvent('paste')) {
                    element.on('paste cut', deferListener);
                }
            }

            // if user paste into input using mouse on older browser
            // or form autocomplete on newer browser, we need "change" event to catch it
            element.on('change', listener);


            // ************************************************
            // define this input render method
            // ************************************************
            ctrl.$render = function() {
                var value = placeToString(ctrl.$viewValue);
                if (element.val() !== value) {
                    element.val(value);
                }
            };

            function placeToString(place) {
                return angular.isObject(place) ? place.formatted_address || place.name : '';
            }


            // ************************************************
            // redefine this input isEmpty method
            // ************************************************
            ctrl.$isEmpty = function(value) {
                return !mcGooglePlaceUtils.isValidGooglePlace(value);
            };
        }

    }

    // /* @ngInject */
    // function AutoCompleteCtrl() {

    // }
})();

(function() {
    'use strict';

    angular
        .module('mcGooglePlace')
        .provider('mcGooglePlaceApi', McGooglePlaceApiProvider);

    function McGooglePlaceApiProvider() {
        var config = {
            transport: 'https',
            isGoogleMapsForWork: false,
            china: false,
            v: '3',
            libraries: 'places',
            language: 'fr'
        };

        this.configure = function(cfg) {
            angular.extend(config, cfg);
        };

        this.$get = mcGooglePlaceApiFact;

        mcGooglePlaceApiFact.$inject = ['mcGooglePlaceScriptLoader', 'logger'];
        /* @ngInject */
        function mcGooglePlaceApiFact(mcGooglePlaceScriptLoader, logger) {
            return mcGooglePlaceScriptLoader.load(config);
        }

        return this;
    }
})();

(function() {
    'use strict';

    angular
        .module('mcGooglePlace')
        .factory('mcGooglePlaceScriptLoader', mcGooglePlaceScriptLoader);

    mcGooglePlaceScriptLoader.$inject = ['$q', 'uuidGen'];

    /* @ngInject */
    function mcGooglePlaceScriptLoader($q, uuidGen) {
        var scriptId = void 0;

        var service = {
            load: load
        };
        return service;

        ////////////////

        function getScriptUrl(options) {
            if (options.china) {
                return 'http://maps.google.cn/maps/api/js?';
            } else {
                if (options.transport === 'auto') {
                    return '//maps.googleapis.com/maps/api/js?';
                } else {
                    return options.transport + '://maps.googleapis.com/maps/api/js?';
                }
            }
        }


        function includeScript(options) {
            var query = 'v=' + options.v + '&libraries=' + options.libraries + '&language=' + options.language;
            if (options.callback) {
                query += '&callback=' + options.callback;
            }
            if (!options.isGoogleMapsForWork && options.key) {
                query += '&key=' + options.key;
            }

            var scriptElem;

            if (scriptId) {
                scriptElem = document.getElementById(scriptId);
                scriptElem.parentNode.removeChild(scriptElem);
            }
            var script = document.createElement('script');
            script.id = scriptId = 'ui_gmap_map_load_' + (uuidGen.generate());
            script.type = 'text/javascript';
            script.src = getScriptUrl(options) + query;
            return document.body.appendChild(script);
        }

        function isGoogleMapsLoaded() {
            return angular.isDefined(window.google) && angular.isDefined(window.google.maps);
        }


        function load(options) {

            var deferred = $q.defer();
            if (isGoogleMapsLoaded()) {
                deferred.resolve(window.google.maps);
                return deferred.promise;
            }

            var randomizedFunctionName = options.callback = 'onGoogleMapsReady' + Math.round(Math.random() * 1000);
            window[randomizedFunctionName] = function() {
                window[randomizedFunctionName] = null;
                deferred.resolve(window.google.maps);
            };
            if (window.navigator.connection && window.Connection && window.navigator.connection.type === window.Connection.NONE) {
                document.addEventListener('online', function() {
                    if (!isGoogleMapsLoaded()) {
                        return includeScript(options);
                    }
                });
            } else {
                includeScript(options);
            }

            return deferred.promise;
        }

    }
})();

(function() {
    'use strict';

    angular
        .module('mcGooglePlace')
        .factory('mcGooglePlaceUtils', factory);

    factory.$inject = ['mcGooglePlaceApi'];

    /* @ngInject */
    function factory(mcGooglePlaceApi) {

        var service = {
            isValidGooglePlace: isValidGooglePlace,
            containType: containType,
            getStreetNumber: getStreetNumber,
            getStreet: getStreet,
            getCity: getCity,
            getState: getState,
            getCountryShort: getCountryShort,
            getCountry: getCountry,
            getLatitude: getLatitude,
            getLongitude: getLongitude,
            getLatLng: getLatLng,
            getPostCode: getPostCode,
            getDistrict: getDistrict,
            getSublocality: getSublocality,
            buildAutocomplete: buildAutocomplete
        };
        return service;

        ////////////////

        function buildAutocomplete(inputElement, autocompleteOptions, placeChangedCb) {

            return mcGooglePlaceApi.then(function(mapsApi) {
                var autocomplete = new mapsApi.places.Autocomplete(inputElement, autocompleteOptions);
                mapsApi.event.addListener(autocomplete, 'place_changed', function() {
                    placeChangedCb(autocomplete.getPlace());
                });
                return autocomplete;
            });
        }

        function isValidGooglePlace(place) {
            return angular.isObject(place) && !!place.place_id;
        }

        function containType(place, type) {
            if (!isValidGooglePlace(place)) {
                return false;
            }

            var placeTypes = place.types;
            for (var i = placeTypes.length - 1; i >= 0; i--) {
                if (placeTypes[i] === type) {
                    return true;
                }
            }

            return false;
        }

        function getAddrComponent(place, componentTemplate) {
            var result;
            if (!isValidGooglePlace(place)) {
                return;
            }
            for (var i = 0; i < place.address_components.length; i++) {
                var addressType = place.address_components[i].types[0];
                if (componentTemplate[addressType]) {
                    result = place.address_components[i][componentTemplate[addressType]];
                    return result;
                }
            }
            return;
        }

        function getStreetNumber(place) {
            var COMPONENT_TEMPLATE = { street_number: 'short_name' },
                streetNumber = getAddrComponent(place, COMPONENT_TEMPLATE);
            return streetNumber;
        }

        function getStreet(place) {
            var COMPONENT_TEMPLATE = { route: 'long_name' },
                street = getAddrComponent(place, COMPONENT_TEMPLATE);
            return street;
        }

        function getCity(place) {
            var COMPONENT_TEMPLATE = { locality: 'long_name' },
                city = getAddrComponent(place, COMPONENT_TEMPLATE);
            return city;
        }

        function getState(place) {
            var COMPONENT_TEMPLATE = { administrative_area_level_1: 'short_name' },
                state = getAddrComponent(place, COMPONENT_TEMPLATE);
            return state;
        }

        function getDistrict(place) {
            var COMPONENT_TEMPLATE = { administrative_area_level_2: 'short_name' },
                state = getAddrComponent(place, COMPONENT_TEMPLATE);
            return state;
        }

        function getCountryShort(place) {
            var COMPONENT_TEMPLATE = { country: 'short_name' },
                countryShort = getAddrComponent(place, COMPONENT_TEMPLATE);
            return countryShort;
        }

        function getCountry(place) {
            var COMPONENT_TEMPLATE = { country: 'long_name' },
                country = getAddrComponent(place, COMPONENT_TEMPLATE);
            return country;
        }

        function getPostCode(place) {
            var COMPONENT_TEMPLATE = { postal_code: 'long_name' },
                postCode = getAddrComponent(place, COMPONENT_TEMPLATE);
            return postCode;
        }

        function getSublocality(place) {
            var COMPONENT_TEMPLATE = { sublocality: 'long_name' },
                sublocality = getAddrComponent(place, COMPONENT_TEMPLATE);
            return sublocality;
        }

        function isWithGeometry(place) {
            return angular.isObject(place) && angular.isObject(place.geometry);
        }

        function getLatitude(place) {
            if (!isWithGeometry(place)) {
                return null;
            }
            return place.geometry.location.lat();
        }

        function getLongitude(place) {
            if (!isWithGeometry(place)) {
                return null;
            }
            return place.geometry.location.lng();
        }

        function getLatLng(place) {
            if (!isWithGeometry(place)) {
                return null;
            }
            return {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
            };
        }

    }
})();

/* jshint ignore:start */
(function() {
    'use strict';

    angular
        .module('mcGooglePlace')
        .service('uuidGen', uuidGen);

    function uuidGen() {

        /*
         Version: v3.3.0
         The MIT License: Copyright (c) 2010-2016 LiosK.
        */
        var UUID;
        UUID = function(g) {
            "use strict";

            function f() {}

            function b(c) {
                return 0 > c ? NaN : 30 >= c ? 0 | Math.random() * (1 << c) : 53 >= c ? (0 | 1073741824 * Math.random()) + 1073741824 * (0 | Math.random() * (1 << c - 30)) : NaN
            }

            function a(c, b) {
                for (var a = c.toString(16), d = b - a.length, e = "0"; 0 < d; d >>>= 1, e += e) d & 1 && (a = e + a);
                return a
            }
            f.generate = function() {
                return a(b(32), 8) + "-" + a(b(16), 4) + "-" + a(16384 | b(12), 4) + "-" + a(32768 | b(14), 4) + "-" + a(b(48), 12)
            };
            f.overwrittenUUID = g;
            return f
        }(UUID);

        return UUID;
    }
})();
/* jshint ignore:end */

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1jLWdvb2dsZS1wbGFjZS5tb2R1bGUuanMiLCJtYy1nb29nbGUtYXV0b2NvbXBsZXRlLmRpcmVjdGl2ZS5qcyIsIm1jLWdvb2dsZS1wbGFjZS1hcGkucHJvdmlkZXIuanMiLCJtYy1nb29nbGUtcGxhY2Utc2NyaXB0LWxvYWRlci5qcyIsIm1jLWdvb2dsZS1wbGFjZS11dGlscy5qcyIsIm1jLWdvb2dsZS11dWlkLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoibWMtZ29vZ2xlLXBsYWNlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXIubW9kdWxlKCdtY0dvb2dsZVBsYWNlJywgW10pO1xufSkoKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgZ29vZ2xlUGxhY2VNb2R1bGUgPVxuICAgICAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ21jR29vZ2xlUGxhY2UnKTtcblxuXG4gICAgZ29vZ2xlUGxhY2VNb2R1bGUuY29uZmlnKGlucHV0UHJvdmlkZXJGbik7XG5cbiAgICBpbnB1dFByb3ZpZGVyRm4uJGluamVjdCA9IFsnJHByb3ZpZGUnXTtcbiAgICAvKiBAbmdJbmplY3QgKi9cbiAgICBmdW5jdGlvbiBpbnB1dFByb3ZpZGVyRm4oJHByb3ZpZGUpIHtcbiAgICAgICAgJHByb3ZpZGUuZGVjb3JhdG9yKCdpbnB1dERpcmVjdGl2ZScsIGlucHV0RGlyZWN0aXZlRGVjb3JhdG9yKTtcbiAgICB9XG5cblxuICAgIGlucHV0RGlyZWN0aXZlRGVjb3JhdG9yLiRpbmplY3QgPSBbJyRkZWxlZ2F0ZSddO1xuICAgIC8qIEBuZ0luamVjdCAqL1xuICAgIGZ1bmN0aW9uIGlucHV0RGlyZWN0aXZlRGVjb3JhdG9yKCRkZWxlZ2F0ZSkge1xuXG4gICAgICAgIHZhciBkaXJlY3RpdmUgPSAkZGVsZWdhdGVbMF07XG4gICAgICAgIHZhciBvcmlnaW5hbExpbmtQcmUgPSBkaXJlY3RpdmUubGluay5wcmU7XG5cbiAgICAgICAgZGlyZWN0aXZlLmxpbmsucHJlID0gZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHIsIGN0cmxzKSB7XG4gICAgICAgICAgICBpZiAoIWN0cmxzWzBdIHx8IGFuZ3VsYXIuaXNVbmRlZmluZWQoYXR0ci5tY0dvb2dsZUF1dG9jb21wbGV0ZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3JpZ2luYWxMaW5rUHJlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuICRkZWxlZ2F0ZTtcbiAgICB9XG5cbiAgICBnb29nbGVQbGFjZU1vZHVsZVxuICAgICAgICAuZGlyZWN0aXZlKCdtY0dvb2dsZUF1dG9jb21wbGV0ZScsIG1jR29vZ2xlQXV0b2NvbXBsZXRlKTtcblxuICAgIG1jR29vZ2xlQXV0b2NvbXBsZXRlLiRpbmplY3QgPSBbJ21jR29vZ2xlUGxhY2VVdGlscycsICckc25pZmZlcicsICckYnJvd3NlciddO1xuXG4gICAgLyogQG5nSW5qZWN0ICovXG4gICAgZnVuY3Rpb24gbWNHb29nbGVBdXRvY29tcGxldGUobWNHb29nbGVQbGFjZVV0aWxzLCAkc25pZmZlciwgJGJyb3dzZXIpIHtcbiAgICAgICAgLy8gVXNhZ2U6XG4gICAgICAgIC8vXG4gICAgICAgIC8vICA8Zm9ybT5cbiAgICAgICAgLy8gICAgICA8aW5wdXQgICBtYy1nb29nbGUtYXV0b2NvbXBsZXRlXG4gICAgICAgIC8vICAgICAgICAgICAgICAgbmctbW9kZWw9XCJhZGRyZXNzXCJcbiAgICAgICAgLy8gICAgICAgICAgICAgICBuYW1lPVwiYWRkcmVzc1wiXG4gICAgICAgIC8vICAgICAgICAgICAgICAgdHlwZT1cInRleHRcIj5cbiAgICAgICAgLy8gIDwvZm9ybT5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gQ3JlYXRlczpcbiAgICAgICAgLy9cbiAgICAgICAgdmFyIGRpcmVjdGl2ZSA9IHtcbiAgICAgICAgICAgIHJlcXVpcmU6IFsnP25nTW9kZWwnXSxcbiAgICAgICAgICAgIGxpbms6IHtcbiAgICAgICAgICAgICAgICBwcmU6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRyLCBjdHJscykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY3RybHNbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmtTdWJJbnB1dChzY29wZSwgZWxlbWVudCwgY3RybHNbMF0sIG1jR29vZ2xlUGxhY2VVdGlscywgJHNuaWZmZXIsICRicm93c2VyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXN0cmljdDogJ0EnLFxuICAgICAgICAgICAgc2NvcGU6IHtcbiAgICAgICAgICAgICAgICBnYU9wdGlvbnM6ICc9PydcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGRpcmVjdGl2ZTtcblxuICAgICAgICBmdW5jdGlvbiBsaW5rU3ViSW5wdXQoc2NvcGUsIGVsZW1lbnQsIGN0cmwsIG1jR29vZ2xlUGxhY2VVdGlscywgJHNuaWZmZXIsICRicm93c2VyKSB7XG5cbiAgICAgICAgICAgIC8vICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgICAgLy8gSW5pdCB0aGUgZ29vZ2xlIGF1dG9jb21wbGV0ZVxuICAgICAgICAgICAgLy8gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgICAvLyBnb29nbGUubWFwcy5wbGFjZXMuQXV0b2NvbXBsZXRlIGluc3RhbmNlIChzdXBwb3J0IGdvb2dsZS5tYXBzLnBsYWNlcy5BdXRvY29tcGxldGVPcHRpb25zKVxuICAgICAgICAgICAgdmFyIGF1dG9jb21wbGV0ZU9wdGlvbnMgPSBzY29wZS5nYU9wdGlvbnMgfHwge307XG5cbiAgICAgICAgICAgIG1jR29vZ2xlUGxhY2VVdGlscy5idWlsZEF1dG9jb21wbGV0ZShlbGVtZW50WzBdLCBhdXRvY29tcGxldGVPcHRpb25zLCBmdW5jdGlvbihwbGFjZSkge1xuICAgICAgICAgICAgICAgIGlmIChwbGFjZVRvU3RyaW5nKHBsYWNlKSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgICAgICAgY3RybC4kc2V0Vmlld1ZhbHVlKGFuZ3VsYXIuY29weShwbGFjZSkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGN0cmwuJHNldFZpZXdWYWx1ZSh1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzY29wZS4kYXBwbHkoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0cmwuJGNvbW1pdFZpZXdWYWx1ZSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgICAgLy8gKioqKioqKiogVHJhY2sgYW55IG90aGVyIGlucHV0IGNoYW5nZSBpbiBvcmRlciB0byByZXNldCB0byBhIGRlZmF1bHQgdmlld1ZhbHVlXG4gICAgICAgICAgICAvLyAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICAgIHZhciB0aW1lb3V0O1xuXG4gICAgICAgICAgICAvLyBJbiBjb21wb3NpdGlvbiBtb2RlLCB1c2VycyBhcmUgc3RpbGwgaW5wdXRpbmcgaW50ZXJtZWRpYXRlIHRleHQgYnVmZmVyLFxuICAgICAgICAgICAgLy8gaG9sZCB0aGUgbGlzdGVuZXIgdW50aWwgY29tcG9zaXRpb24gaXMgZG9uZS5cbiAgICAgICAgICAgIC8vIE1vcmUgYWJvdXQgY29tcG9zaXRpb24gZXZlbnRzOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvQ29tcG9zaXRpb25FdmVudFxuICAgICAgICAgICAgaWYgKCEkc25pZmZlci5hbmRyb2lkKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbXBvc2luZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgZWxlbWVudC5vbignY29tcG9zaXRpb25zdGFydCcsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9zaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGVsZW1lbnQub24oJ2NvbXBvc2l0aW9uZW5kJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvc2luZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcigpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBsaXN0ZW5lcihldikge1xuXG4gICAgICAgICAgICAgICAgaWYgKHRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgJGJyb3dzZXIuZGVmZXIuY2FuY2VsKHRpbWVvdXQpO1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvc2luZykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciByYXdWYWx1ZSA9IGVsZW1lbnQudmFsKCksXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gZXYgJiYgZXYudHlwZTtcblxuICAgICAgICAgICAgICAgIHJhd1ZhbHVlID0gcmF3VmFsdWUudHJpbSgpO1xuXG4gICAgICAgICAgICAgICAgLy8gSWYgYSBjb250cm9sIGlzIHN1ZmZlcmluZyBmcm9tIGJhZCBpbnB1dCAoZHVlIHRvIG5hdGl2ZSB2YWxpZGF0b3JzKSwgYnJvd3NlcnMgZGlzY2FyZCBpdHNcbiAgICAgICAgICAgICAgICAvLyB2YWx1ZSwgc28gaXQgbWF5IGJlIG5lY2Vzc2FyeSB0byByZXZhbGlkYXRlIChieSBjYWxsaW5nICRzZXRWaWV3VmFsdWUgYWdhaW4pIGV2ZW4gaWYgdGhlXG4gICAgICAgICAgICAgICAgLy8gY29udHJvbCdzIHZhbHVlIGlzIHRoZSBzYW1lIGVtcHR5IHZhbHVlIHR3aWNlIGluIGEgcm93LlxuICAgICAgICAgICAgICAgIGlmIChwbGFjZVRvU3RyaW5nKGN0cmwuJHZpZXdWYWx1ZSkgIT09IHJhd1ZhbHVlIHx8IChyYXdWYWx1ZSA9PT0gJycgJiYgY3RybC4kJGhhc05hdGl2ZVZhbGlkYXRvcnMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyYXdWYWx1ZSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0cmwuJHNldFZpZXdWYWx1ZSh7IG5hbWU6IHJhd1ZhbHVlIH0sIGV2ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0cmwuJHNldFZpZXdWYWx1ZSh1bmRlZmluZWQsIGV2ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gZGVmZXJMaXN0ZW5lcihldiwgaW5wdXQsIG9yaWdWYWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICghdGltZW91dCkge1xuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0ID0gJGJyb3dzZXIuZGVmZXIoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaW5wdXQgfHwgaW5wdXQudmFsdWUgIT09IG9yaWdWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpc3RlbmVyKGV2KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGUgYnJvd3NlciBkb2VzIHN1cHBvcnQgXCJpbnB1dFwiIGV2ZW50LCB3ZSBhcmUgZmluZSAtIGV4Y2VwdCBvbiBJRTkgd2hpY2ggZG9lc24ndCBmaXJlIHRoZVxuICAgICAgICAgICAgLy8gaW5wdXQgZXZlbnQgb24gYmFja3NwYWNlLCBkZWxldGUgb3IgY3V0XG4gICAgICAgICAgICBpZiAoJHNuaWZmZXIuaGFzRXZlbnQoJ2lucHV0JykpIHtcbiAgICAgICAgICAgICAgICBlbGVtZW50Lm9uKCdpbnB1dCcsIGxpc3RlbmVyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5vbigna2V5ZG93bicsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBldmVudC5rZXlDb2RlO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGlnbm9yZVxuICAgICAgICAgICAgICAgICAgICAvLyAgICBjb21tYW5kICAgICAgICAgICAgbW9kaWZpZXJzICAgICAgICAgICAgICAgICAgIGFycm93c1xuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5ID09PSA5MSB8fCAoMTUgPCBrZXkgJiYga2V5IDwgMTkpIHx8ICgzNyA8PSBrZXkgJiYga2V5IDw9IDQwKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZGVmZXJMaXN0ZW5lcihldmVudCwgdGhpcywgdGhpcy52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB1c2VyIG1vZGlmaWVzIGlucHV0IHZhbHVlIHVzaW5nIGNvbnRleHQgbWVudSBpbiBJRSwgd2UgbmVlZCBcInBhc3RlXCIgYW5kIFwiY3V0XCIgZXZlbnRzIHRvIGNhdGNoIGl0XG4gICAgICAgICAgICAgICAgaWYgKCRzbmlmZmVyLmhhc0V2ZW50KCdwYXN0ZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQub24oJ3Bhc3RlIGN1dCcsIGRlZmVyTGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdXNlciBwYXN0ZSBpbnRvIGlucHV0IHVzaW5nIG1vdXNlIG9uIG9sZGVyIGJyb3dzZXJcbiAgICAgICAgICAgIC8vIG9yIGZvcm0gYXV0b2NvbXBsZXRlIG9uIG5ld2VyIGJyb3dzZXIsIHdlIG5lZWQgXCJjaGFuZ2VcIiBldmVudCB0byBjYXRjaCBpdFxuICAgICAgICAgICAgZWxlbWVudC5vbignY2hhbmdlJywgbGlzdGVuZXIpO1xuXG5cbiAgICAgICAgICAgIC8vICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgICAgLy8gZGVmaW5lIHRoaXMgaW5wdXQgcmVuZGVyIG1ldGhvZFxuICAgICAgICAgICAgLy8gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgICBjdHJsLiRyZW5kZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBwbGFjZVRvU3RyaW5nKGN0cmwuJHZpZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQudmFsKCkgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQudmFsKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmdW5jdGlvbiBwbGFjZVRvU3RyaW5nKHBsYWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFuZ3VsYXIuaXNPYmplY3QocGxhY2UpID8gcGxhY2UuZm9ybWF0dGVkX2FkZHJlc3MgfHwgcGxhY2UubmFtZSA6ICcnO1xuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIC8vICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgICAgLy8gcmVkZWZpbmUgdGhpcyBpbnB1dCBpc0VtcHR5IG1ldGhvZFxuICAgICAgICAgICAgLy8gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgICBjdHJsLiRpc0VtcHR5ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gIW1jR29vZ2xlUGxhY2VVdGlscy5pc1ZhbGlkR29vZ2xlUGxhY2UodmFsdWUpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLy8gLyogQG5nSW5qZWN0ICovXG4gICAgLy8gZnVuY3Rpb24gQXV0b0NvbXBsZXRlQ3RybCgpIHtcblxuICAgIC8vIH1cbn0pKCk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdtY0dvb2dsZVBsYWNlJylcbiAgICAgICAgLnByb3ZpZGVyKCdtY0dvb2dsZVBsYWNlQXBpJywgTWNHb29nbGVQbGFjZUFwaVByb3ZpZGVyKTtcblxuICAgIGZ1bmN0aW9uIE1jR29vZ2xlUGxhY2VBcGlQcm92aWRlcigpIHtcbiAgICAgICAgdmFyIGNvbmZpZyA9IHtcbiAgICAgICAgICAgIHRyYW5zcG9ydDogJ2h0dHBzJyxcbiAgICAgICAgICAgIGlzR29vZ2xlTWFwc0Zvcldvcms6IGZhbHNlLFxuICAgICAgICAgICAgY2hpbmE6IGZhbHNlLFxuICAgICAgICAgICAgdjogJzMnLFxuICAgICAgICAgICAgbGlicmFyaWVzOiAncGxhY2VzJyxcbiAgICAgICAgICAgIGxhbmd1YWdlOiAnZnInXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5jb25maWd1cmUgPSBmdW5jdGlvbihjZmcpIHtcbiAgICAgICAgICAgIGFuZ3VsYXIuZXh0ZW5kKGNvbmZpZywgY2ZnKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLiRnZXQgPSBtY0dvb2dsZVBsYWNlQXBpRmFjdDtcblxuICAgICAgICBtY0dvb2dsZVBsYWNlQXBpRmFjdC4kaW5qZWN0ID0gWydtY0dvb2dsZVBsYWNlU2NyaXB0TG9hZGVyJywgJ2xvZ2dlciddO1xuICAgICAgICAvKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gbWNHb29nbGVQbGFjZUFwaUZhY3QobWNHb29nbGVQbGFjZVNjcmlwdExvYWRlciwgbG9nZ2VyKSB7XG4gICAgICAgICAgICByZXR1cm4gbWNHb29nbGVQbGFjZVNjcmlwdExvYWRlci5sb2FkKGNvbmZpZyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59KSgpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnbWNHb29nbGVQbGFjZScpXG4gICAgICAgIC5mYWN0b3J5KCdtY0dvb2dsZVBsYWNlU2NyaXB0TG9hZGVyJywgbWNHb29nbGVQbGFjZVNjcmlwdExvYWRlcik7XG5cbiAgICBtY0dvb2dsZVBsYWNlU2NyaXB0TG9hZGVyLiRpbmplY3QgPSBbJyRxJywgJ3V1aWRHZW4nXTtcblxuICAgIC8qIEBuZ0luamVjdCAqL1xuICAgIGZ1bmN0aW9uIG1jR29vZ2xlUGxhY2VTY3JpcHRMb2FkZXIoJHEsIHV1aWRHZW4pIHtcbiAgICAgICAgdmFyIHNjcmlwdElkID0gdm9pZCAwO1xuXG4gICAgICAgIHZhciBzZXJ2aWNlID0ge1xuICAgICAgICAgICAgbG9hZDogbG9hZFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gc2VydmljZTtcblxuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0U2NyaXB0VXJsKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNoaW5hKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdodHRwOi8vbWFwcy5nb29nbGUuY24vbWFwcy9hcGkvanM/JztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudHJhbnNwb3J0ID09PSAnYXV0bycpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcvL21hcHMuZ29vZ2xlYXBpcy5jb20vbWFwcy9hcGkvanM/JztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucy50cmFuc3BvcnQgKyAnOi8vbWFwcy5nb29nbGVhcGlzLmNvbS9tYXBzL2FwaS9qcz8nO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gaW5jbHVkZVNjcmlwdChvcHRpb25zKSB7XG4gICAgICAgICAgICB2YXIgcXVlcnkgPSAndj0nICsgb3B0aW9ucy52ICsgJyZsaWJyYXJpZXM9JyArIG9wdGlvbnMubGlicmFyaWVzICsgJyZsYW5ndWFnZT0nICsgb3B0aW9ucy5sYW5ndWFnZTtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgcXVlcnkgKz0gJyZjYWxsYmFjaz0nICsgb3B0aW9ucy5jYWxsYmFjaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghb3B0aW9ucy5pc0dvb2dsZU1hcHNGb3JXb3JrICYmIG9wdGlvbnMua2V5KSB7XG4gICAgICAgICAgICAgICAgcXVlcnkgKz0gJyZrZXk9JyArIG9wdGlvbnMua2V5O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc2NyaXB0RWxlbTtcblxuICAgICAgICAgICAgaWYgKHNjcmlwdElkKSB7XG4gICAgICAgICAgICAgICAgc2NyaXB0RWxlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHNjcmlwdElkKTtcbiAgICAgICAgICAgICAgICBzY3JpcHRFbGVtLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0RWxlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgICAgICBzY3JpcHQuaWQgPSBzY3JpcHRJZCA9ICd1aV9nbWFwX21hcF9sb2FkXycgKyAodXVpZEdlbi5nZW5lcmF0ZSgpKTtcbiAgICAgICAgICAgIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XG4gICAgICAgICAgICBzY3JpcHQuc3JjID0gZ2V0U2NyaXB0VXJsKG9wdGlvbnMpICsgcXVlcnk7XG4gICAgICAgICAgICByZXR1cm4gZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaXNHb29nbGVNYXBzTG9hZGVkKCkge1xuICAgICAgICAgICAgcmV0dXJuIGFuZ3VsYXIuaXNEZWZpbmVkKHdpbmRvdy5nb29nbGUpICYmIGFuZ3VsYXIuaXNEZWZpbmVkKHdpbmRvdy5nb29nbGUubWFwcyk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIGxvYWQob3B0aW9ucykge1xuXG4gICAgICAgICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuICAgICAgICAgICAgaWYgKGlzR29vZ2xlTWFwc0xvYWRlZCgpKSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh3aW5kb3cuZ29vZ2xlLm1hcHMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcmFuZG9taXplZEZ1bmN0aW9uTmFtZSA9IG9wdGlvbnMuY2FsbGJhY2sgPSAnb25Hb29nbGVNYXBzUmVhZHknICsgTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogMTAwMCk7XG4gICAgICAgICAgICB3aW5kb3dbcmFuZG9taXplZEZ1bmN0aW9uTmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB3aW5kb3dbcmFuZG9taXplZEZ1bmN0aW9uTmFtZV0gPSBudWxsO1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUod2luZG93Lmdvb2dsZS5tYXBzKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAod2luZG93Lm5hdmlnYXRvci5jb25uZWN0aW9uICYmIHdpbmRvdy5Db25uZWN0aW9uICYmIHdpbmRvdy5uYXZpZ2F0b3IuY29ubmVjdGlvbi50eXBlID09PSB3aW5kb3cuQ29ubmVjdGlvbi5OT05FKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignb25saW5lJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNHb29nbGVNYXBzTG9hZGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBpbmNsdWRlU2NyaXB0KG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVTY3JpcHQob3B0aW9ucyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9XG5cbiAgICB9XG59KSgpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnbWNHb29nbGVQbGFjZScpXG4gICAgICAgIC5mYWN0b3J5KCdtY0dvb2dsZVBsYWNlVXRpbHMnLCBmYWN0b3J5KTtcblxuICAgIGZhY3RvcnkuJGluamVjdCA9IFsnbWNHb29nbGVQbGFjZUFwaSddO1xuXG4gICAgLyogQG5nSW5qZWN0ICovXG4gICAgZnVuY3Rpb24gZmFjdG9yeShtY0dvb2dsZVBsYWNlQXBpKSB7XG5cbiAgICAgICAgdmFyIHNlcnZpY2UgPSB7XG4gICAgICAgICAgICBpc1ZhbGlkR29vZ2xlUGxhY2U6IGlzVmFsaWRHb29nbGVQbGFjZSxcbiAgICAgICAgICAgIGNvbnRhaW5UeXBlOiBjb250YWluVHlwZSxcbiAgICAgICAgICAgIGdldFN0cmVldE51bWJlcjogZ2V0U3RyZWV0TnVtYmVyLFxuICAgICAgICAgICAgZ2V0U3RyZWV0OiBnZXRTdHJlZXQsXG4gICAgICAgICAgICBnZXRDaXR5OiBnZXRDaXR5LFxuICAgICAgICAgICAgZ2V0U3RhdGU6IGdldFN0YXRlLFxuICAgICAgICAgICAgZ2V0Q291bnRyeVNob3J0OiBnZXRDb3VudHJ5U2hvcnQsXG4gICAgICAgICAgICBnZXRDb3VudHJ5OiBnZXRDb3VudHJ5LFxuICAgICAgICAgICAgZ2V0TGF0aXR1ZGU6IGdldExhdGl0dWRlLFxuICAgICAgICAgICAgZ2V0TG9uZ2l0dWRlOiBnZXRMb25naXR1ZGUsXG4gICAgICAgICAgICBnZXRMYXRMbmc6IGdldExhdExuZyxcbiAgICAgICAgICAgIGdldFBvc3RDb2RlOiBnZXRQb3N0Q29kZSxcbiAgICAgICAgICAgIGdldERpc3RyaWN0OiBnZXREaXN0cmljdCxcbiAgICAgICAgICAgIGdldFN1YmxvY2FsaXR5OiBnZXRTdWJsb2NhbGl0eSxcbiAgICAgICAgICAgIGJ1aWxkQXV0b2NvbXBsZXRlOiBidWlsZEF1dG9jb21wbGV0ZVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gc2VydmljZTtcblxuICAgICAgICAvLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAgICAgZnVuY3Rpb24gYnVpbGRBdXRvY29tcGxldGUoaW5wdXRFbGVtZW50LCBhdXRvY29tcGxldGVPcHRpb25zLCBwbGFjZUNoYW5nZWRDYikge1xuXG4gICAgICAgICAgICByZXR1cm4gbWNHb29nbGVQbGFjZUFwaS50aGVuKGZ1bmN0aW9uKG1hcHNBcGkpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXV0b2NvbXBsZXRlID0gbmV3IG1hcHNBcGkucGxhY2VzLkF1dG9jb21wbGV0ZShpbnB1dEVsZW1lbnQsIGF1dG9jb21wbGV0ZU9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIG1hcHNBcGkuZXZlbnQuYWRkTGlzdGVuZXIoYXV0b2NvbXBsZXRlLCAncGxhY2VfY2hhbmdlZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBwbGFjZUNoYW5nZWRDYihhdXRvY29tcGxldGUuZ2V0UGxhY2UoKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF1dG9jb21wbGV0ZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaXNWYWxpZEdvb2dsZVBsYWNlKHBsYWNlKSB7XG4gICAgICAgICAgICByZXR1cm4gYW5ndWxhci5pc09iamVjdChwbGFjZSkgJiYgISFwbGFjZS5wbGFjZV9pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGNvbnRhaW5UeXBlKHBsYWNlLCB0eXBlKSB7XG4gICAgICAgICAgICBpZiAoIWlzVmFsaWRHb29nbGVQbGFjZShwbGFjZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBwbGFjZVR5cGVzID0gcGxhY2UudHlwZXM7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gcGxhY2VUeXBlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgICAgIGlmIChwbGFjZVR5cGVzW2ldID09PSB0eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0QWRkckNvbXBvbmVudChwbGFjZSwgY29tcG9uZW50VGVtcGxhdGUpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHQ7XG4gICAgICAgICAgICBpZiAoIWlzVmFsaWRHb29nbGVQbGFjZShwbGFjZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBsYWNlLmFkZHJlc3NfY29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBhZGRyZXNzVHlwZSA9IHBsYWNlLmFkZHJlc3NfY29tcG9uZW50c1tpXS50eXBlc1swXTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50VGVtcGxhdGVbYWRkcmVzc1R5cGVdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHBsYWNlLmFkZHJlc3NfY29tcG9uZW50c1tpXVtjb21wb25lbnRUZW1wbGF0ZVthZGRyZXNzVHlwZV1dO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFN0cmVldE51bWJlcihwbGFjZSkge1xuICAgICAgICAgICAgdmFyIENPTVBPTkVOVF9URU1QTEFURSA9IHsgc3RyZWV0X251bWJlcjogJ3Nob3J0X25hbWUnIH0sXG4gICAgICAgICAgICAgICAgc3RyZWV0TnVtYmVyID0gZ2V0QWRkckNvbXBvbmVudChwbGFjZSwgQ09NUE9ORU5UX1RFTVBMQVRFKTtcbiAgICAgICAgICAgIHJldHVybiBzdHJlZXROdW1iZXI7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRTdHJlZXQocGxhY2UpIHtcbiAgICAgICAgICAgIHZhciBDT01QT05FTlRfVEVNUExBVEUgPSB7IHJvdXRlOiAnbG9uZ19uYW1lJyB9LFxuICAgICAgICAgICAgICAgIHN0cmVldCA9IGdldEFkZHJDb21wb25lbnQocGxhY2UsIENPTVBPTkVOVF9URU1QTEFURSk7XG4gICAgICAgICAgICByZXR1cm4gc3RyZWV0O1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0Q2l0eShwbGFjZSkge1xuICAgICAgICAgICAgdmFyIENPTVBPTkVOVF9URU1QTEFURSA9IHsgbG9jYWxpdHk6ICdsb25nX25hbWUnIH0sXG4gICAgICAgICAgICAgICAgY2l0eSA9IGdldEFkZHJDb21wb25lbnQocGxhY2UsIENPTVBPTkVOVF9URU1QTEFURSk7XG4gICAgICAgICAgICByZXR1cm4gY2l0eTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFN0YXRlKHBsYWNlKSB7XG4gICAgICAgICAgICB2YXIgQ09NUE9ORU5UX1RFTVBMQVRFID0geyBhZG1pbmlzdHJhdGl2ZV9hcmVhX2xldmVsXzE6ICdzaG9ydF9uYW1lJyB9LFxuICAgICAgICAgICAgICAgIHN0YXRlID0gZ2V0QWRkckNvbXBvbmVudChwbGFjZSwgQ09NUE9ORU5UX1RFTVBMQVRFKTtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldERpc3RyaWN0KHBsYWNlKSB7XG4gICAgICAgICAgICB2YXIgQ09NUE9ORU5UX1RFTVBMQVRFID0geyBhZG1pbmlzdHJhdGl2ZV9hcmVhX2xldmVsXzI6ICdzaG9ydF9uYW1lJyB9LFxuICAgICAgICAgICAgICAgIHN0YXRlID0gZ2V0QWRkckNvbXBvbmVudChwbGFjZSwgQ09NUE9ORU5UX1RFTVBMQVRFKTtcbiAgICAgICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldENvdW50cnlTaG9ydChwbGFjZSkge1xuICAgICAgICAgICAgdmFyIENPTVBPTkVOVF9URU1QTEFURSA9IHsgY291bnRyeTogJ3Nob3J0X25hbWUnIH0sXG4gICAgICAgICAgICAgICAgY291bnRyeVNob3J0ID0gZ2V0QWRkckNvbXBvbmVudChwbGFjZSwgQ09NUE9ORU5UX1RFTVBMQVRFKTtcbiAgICAgICAgICAgIHJldHVybiBjb3VudHJ5U2hvcnQ7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRDb3VudHJ5KHBsYWNlKSB7XG4gICAgICAgICAgICB2YXIgQ09NUE9ORU5UX1RFTVBMQVRFID0geyBjb3VudHJ5OiAnbG9uZ19uYW1lJyB9LFxuICAgICAgICAgICAgICAgIGNvdW50cnkgPSBnZXRBZGRyQ29tcG9uZW50KHBsYWNlLCBDT01QT05FTlRfVEVNUExBVEUpO1xuICAgICAgICAgICAgcmV0dXJuIGNvdW50cnk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRQb3N0Q29kZShwbGFjZSkge1xuICAgICAgICAgICAgdmFyIENPTVBPTkVOVF9URU1QTEFURSA9IHsgcG9zdGFsX2NvZGU6ICdsb25nX25hbWUnIH0sXG4gICAgICAgICAgICAgICAgcG9zdENvZGUgPSBnZXRBZGRyQ29tcG9uZW50KHBsYWNlLCBDT01QT05FTlRfVEVNUExBVEUpO1xuICAgICAgICAgICAgcmV0dXJuIHBvc3RDb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0U3VibG9jYWxpdHkocGxhY2UpIHtcbiAgICAgICAgICAgIHZhciBDT01QT05FTlRfVEVNUExBVEUgPSB7IHN1YmxvY2FsaXR5OiAnbG9uZ19uYW1lJyB9LFxuICAgICAgICAgICAgICAgIHN1YmxvY2FsaXR5ID0gZ2V0QWRkckNvbXBvbmVudChwbGFjZSwgQ09NUE9ORU5UX1RFTVBMQVRFKTtcbiAgICAgICAgICAgIHJldHVybiBzdWJsb2NhbGl0eTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGlzV2l0aEdlb21ldHJ5KHBsYWNlKSB7XG4gICAgICAgICAgICByZXR1cm4gYW5ndWxhci5pc09iamVjdChwbGFjZSkgJiYgYW5ndWxhci5pc09iamVjdChwbGFjZS5nZW9tZXRyeSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRMYXRpdHVkZShwbGFjZSkge1xuICAgICAgICAgICAgaWYgKCFpc1dpdGhHZW9tZXRyeShwbGFjZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwbGFjZS5nZW9tZXRyeS5sb2NhdGlvbi5sYXQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldExvbmdpdHVkZShwbGFjZSkge1xuICAgICAgICAgICAgaWYgKCFpc1dpdGhHZW9tZXRyeShwbGFjZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwbGFjZS5nZW9tZXRyeS5sb2NhdGlvbi5sbmcoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldExhdExuZyhwbGFjZSkge1xuICAgICAgICAgICAgaWYgKCFpc1dpdGhHZW9tZXRyeShwbGFjZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbGF0OiBwbGFjZS5nZW9tZXRyeS5sb2NhdGlvbi5sYXQoKSxcbiAgICAgICAgICAgICAgICBsbmc6IHBsYWNlLmdlb21ldHJ5LmxvY2F0aW9uLmxuZygpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICB9XG59KSgpO1xuIiwiLyoganNoaW50IGlnbm9yZTpzdGFydCAqL1xuKGZ1bmN0aW9uKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnbWNHb29nbGVQbGFjZScpXG4gICAgICAgIC5zZXJ2aWNlKCd1dWlkR2VuJywgdXVpZEdlbik7XG5cbiAgICBmdW5jdGlvbiB1dWlkR2VuKCkge1xuXG4gICAgICAgIC8qXG4gICAgICAgICBWZXJzaW9uOiB2My4zLjBcbiAgICAgICAgIFRoZSBNSVQgTGljZW5zZTogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTYgTGlvc0suXG4gICAgICAgICovXG4gICAgICAgIHZhciBVVUlEO1xuICAgICAgICBVVUlEID0gZnVuY3Rpb24oZykge1xuICAgICAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGYoKSB7fVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBiKGMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMCA+IGMgPyBOYU4gOiAzMCA+PSBjID8gMCB8IE1hdGgucmFuZG9tKCkgKiAoMSA8PCBjKSA6IDUzID49IGMgPyAoMCB8IDEwNzM3NDE4MjQgKiBNYXRoLnJhbmRvbSgpKSArIDEwNzM3NDE4MjQgKiAoMCB8IE1hdGgucmFuZG9tKCkgKiAoMSA8PCBjIC0gMzApKSA6IE5hTlxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBhKGMsIGIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBhID0gYy50b1N0cmluZygxNiksIGQgPSBiIC0gYS5sZW5ndGgsIGUgPSBcIjBcIjsgMCA8IGQ7IGQgPj4+PSAxLCBlICs9IGUpIGQgJiAxICYmIChhID0gZSArIGEpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmLmdlbmVyYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGEoYigzMiksIDgpICsgXCItXCIgKyBhKGIoMTYpLCA0KSArIFwiLVwiICsgYSgxNjM4NCB8IGIoMTIpLCA0KSArIFwiLVwiICsgYSgzMjc2OCB8IGIoMTQpLCA0KSArIFwiLVwiICsgYShiKDQ4KSwgMTIpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZi5vdmVyd3JpdHRlblVVSUQgPSBnO1xuICAgICAgICAgICAgcmV0dXJuIGZcbiAgICAgICAgfShVVUlEKTtcblxuICAgICAgICByZXR1cm4gVVVJRDtcbiAgICB9XG59KSgpO1xuLyoganNoaW50IGlnbm9yZTplbmQgKi9cbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
