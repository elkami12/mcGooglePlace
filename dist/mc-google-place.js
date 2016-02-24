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
            getStreetNumber: getStreetNumber,
            getStreet: getStreet,
            getCity: getCity,
            getState: getState,
            getCountryShort: getCountryShort,
            getCountry: getCountry,
            getLatitude: getLatitude,
            getLongitude: getLongitude,
            getPostCode: getPostCode,
            getDistrict: getDistrict,
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1jLWdvb2dsZS1wbGFjZS5tb2R1bGUuanMiLCJtYy1nb29nbGUtYXV0b2NvbXBsZXRlLmRpcmVjdGl2ZS5qcyIsIm1jLWdvb2dsZS1wbGFjZS1hcGkucHJvdmlkZXIuanMiLCJtYy1nb29nbGUtcGxhY2Utc2NyaXB0LWxvYWRlci5qcyIsIm1jLWdvb2dsZS1wbGFjZS11dGlscy5qcyIsIm1jLWdvb2dsZS11dWlkLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Im1jLWdvb2dsZS1wbGFjZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyLm1vZHVsZSgnbWNHb29nbGVQbGFjZScsIFtdKTtcbn0pKCk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGdvb2dsZVBsYWNlTW9kdWxlID1cbiAgICAgICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdtY0dvb2dsZVBsYWNlJyk7XG5cblxuICAgIGdvb2dsZVBsYWNlTW9kdWxlLmNvbmZpZyhpbnB1dFByb3ZpZGVyRm4pO1xuXG4gICAgaW5wdXRQcm92aWRlckZuLiRpbmplY3QgPSBbJyRwcm92aWRlJ107XG4gICAgLyogQG5nSW5qZWN0ICovXG4gICAgZnVuY3Rpb24gaW5wdXRQcm92aWRlckZuKCRwcm92aWRlKSB7XG4gICAgICAgICRwcm92aWRlLmRlY29yYXRvcignaW5wdXREaXJlY3RpdmUnLCBpbnB1dERpcmVjdGl2ZURlY29yYXRvcik7XG4gICAgfVxuXG5cbiAgICBpbnB1dERpcmVjdGl2ZURlY29yYXRvci4kaW5qZWN0ID0gWyckZGVsZWdhdGUnXTtcbiAgICAvKiBAbmdJbmplY3QgKi9cbiAgICBmdW5jdGlvbiBpbnB1dERpcmVjdGl2ZURlY29yYXRvcigkZGVsZWdhdGUpIHtcblxuICAgICAgICB2YXIgZGlyZWN0aXZlID0gJGRlbGVnYXRlWzBdO1xuICAgICAgICB2YXIgb3JpZ2luYWxMaW5rUHJlID0gZGlyZWN0aXZlLmxpbmsucHJlO1xuXG4gICAgICAgIGRpcmVjdGl2ZS5saW5rLnByZSA9IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRyLCBjdHJscykge1xuICAgICAgICAgICAgaWYgKCFjdHJsc1swXSB8fCBhbmd1bGFyLmlzVW5kZWZpbmVkKGF0dHIubWNHb29nbGVBdXRvY29tcGxldGUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9yaWdpbmFsTGlua1ByZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiAkZGVsZWdhdGU7XG4gICAgfVxuXG4gICAgZ29vZ2xlUGxhY2VNb2R1bGVcbiAgICAgICAgLmRpcmVjdGl2ZSgnbWNHb29nbGVBdXRvY29tcGxldGUnLCBtY0dvb2dsZUF1dG9jb21wbGV0ZSk7XG5cbiAgICBtY0dvb2dsZUF1dG9jb21wbGV0ZS4kaW5qZWN0ID0gWydtY0dvb2dsZVBsYWNlVXRpbHMnLCAnJHNuaWZmZXInLCAnJGJyb3dzZXInXTtcblxuICAgIC8qIEBuZ0luamVjdCAqL1xuICAgIGZ1bmN0aW9uIG1jR29vZ2xlQXV0b2NvbXBsZXRlKG1jR29vZ2xlUGxhY2VVdGlscywgJHNuaWZmZXIsICRicm93c2VyKSB7XG4gICAgICAgIC8vIFVzYWdlOlxuICAgICAgICAvL1xuICAgICAgICAvLyAgPGZvcm0+XG4gICAgICAgIC8vICAgICAgPGlucHV0ICAgbWMtZ29vZ2xlLWF1dG9jb21wbGV0ZVxuICAgICAgICAvLyAgICAgICAgICAgICAgIG5nLW1vZGVsPVwiYWRkcmVzc1wiXG4gICAgICAgIC8vICAgICAgICAgICAgICAgbmFtZT1cImFkZHJlc3NcIlxuICAgICAgICAvLyAgICAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCI+XG4gICAgICAgIC8vICA8L2Zvcm0+XG4gICAgICAgIC8vXG4gICAgICAgIC8vIENyZWF0ZXM6XG4gICAgICAgIC8vXG4gICAgICAgIHZhciBkaXJlY3RpdmUgPSB7XG4gICAgICAgICAgICByZXF1aXJlOiBbJz9uZ01vZGVsJ10sXG4gICAgICAgICAgICBsaW5rOiB7XG4gICAgICAgICAgICAgICAgcHJlOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0ciwgY3RybHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGN0cmxzWzBdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5rU3ViSW5wdXQoc2NvcGUsIGVsZW1lbnQsIGN0cmxzWzBdLCBtY0dvb2dsZVBsYWNlVXRpbHMsICRzbmlmZmVyLCAkYnJvd3Nlcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVzdHJpY3Q6ICdBJyxcbiAgICAgICAgICAgIHNjb3BlOiB7XG4gICAgICAgICAgICAgICAgZ2FPcHRpb25zOiAnPT8nXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBkaXJlY3RpdmU7XG5cbiAgICAgICAgZnVuY3Rpb24gbGlua1N1YklucHV0KHNjb3BlLCBlbGVtZW50LCBjdHJsLCBtY0dvb2dsZVBsYWNlVXRpbHMsICRzbmlmZmVyLCAkYnJvd3Nlcikge1xuXG4gICAgICAgICAgICAvLyAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICAgIC8vIEluaXQgdGhlIGdvb2dsZSBhdXRvY29tcGxldGVcbiAgICAgICAgICAgIC8vICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgICAgLy8gZ29vZ2xlLm1hcHMucGxhY2VzLkF1dG9jb21wbGV0ZSBpbnN0YW5jZSAoc3VwcG9ydCBnb29nbGUubWFwcy5wbGFjZXMuQXV0b2NvbXBsZXRlT3B0aW9ucylcbiAgICAgICAgICAgIHZhciBhdXRvY29tcGxldGVPcHRpb25zID0gc2NvcGUuZ2FPcHRpb25zIHx8IHt9O1xuXG4gICAgICAgICAgICBtY0dvb2dsZVBsYWNlVXRpbHMuYnVpbGRBdXRvY29tcGxldGUoZWxlbWVudFswXSwgYXV0b2NvbXBsZXRlT3B0aW9ucywgZnVuY3Rpb24ocGxhY2UpIHtcbiAgICAgICAgICAgICAgICBpZiAocGxhY2VUb1N0cmluZyhwbGFjZSkgIT09ICcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0cmwuJHNldFZpZXdWYWx1ZShhbmd1bGFyLmNvcHkocGxhY2UpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjdHJsLiRzZXRWaWV3VmFsdWUodW5kZWZpbmVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2NvcGUuJGFwcGx5KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBjdHJsLiRjb21taXRWaWV3VmFsdWUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICAgIC8vICoqKioqKioqIFRyYWNrIGFueSBvdGhlciBpbnB1dCBjaGFuZ2UgaW4gb3JkZXIgdG8gcmVzZXQgdG8gYSBkZWZhdWx0IHZpZXdWYWx1ZVxuICAgICAgICAgICAgLy8gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgICB2YXIgdGltZW91dDtcblxuICAgICAgICAgICAgLy8gSW4gY29tcG9zaXRpb24gbW9kZSwgdXNlcnMgYXJlIHN0aWxsIGlucHV0aW5nIGludGVybWVkaWF0ZSB0ZXh0IGJ1ZmZlcixcbiAgICAgICAgICAgIC8vIGhvbGQgdGhlIGxpc3RlbmVyIHVudGlsIGNvbXBvc2l0aW9uIGlzIGRvbmUuXG4gICAgICAgICAgICAvLyBNb3JlIGFib3V0IGNvbXBvc2l0aW9uIGV2ZW50czogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0NvbXBvc2l0aW9uRXZlbnRcbiAgICAgICAgICAgIGlmICghJHNuaWZmZXIuYW5kcm9pZCkge1xuICAgICAgICAgICAgICAgIHZhciBjb21wb3NpbmcgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGVsZW1lbnQub24oJ2NvbXBvc2l0aW9uc3RhcnQnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvc2luZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBlbGVtZW50Lm9uKCdjb21wb3NpdGlvbmVuZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBjb21wb3NpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgbGlzdGVuZXIoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gbGlzdGVuZXIoZXYpIHtcblxuICAgICAgICAgICAgICAgIGlmICh0aW1lb3V0KSB7XG4gICAgICAgICAgICAgICAgICAgICRicm93c2VyLmRlZmVyLmNhbmNlbCh0aW1lb3V0KTtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChjb21wb3NpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgcmF3VmFsdWUgPSBlbGVtZW50LnZhbCgpLFxuICAgICAgICAgICAgICAgICAgICBldmVudCA9IGV2ICYmIGV2LnR5cGU7XG5cbiAgICAgICAgICAgICAgICByYXdWYWx1ZSA9IHJhd1ZhbHVlLnRyaW0oKTtcblxuICAgICAgICAgICAgICAgIC8vIElmIGEgY29udHJvbCBpcyBzdWZmZXJpbmcgZnJvbSBiYWQgaW5wdXQgKGR1ZSB0byBuYXRpdmUgdmFsaWRhdG9ycyksIGJyb3dzZXJzIGRpc2NhcmQgaXRzXG4gICAgICAgICAgICAgICAgLy8gdmFsdWUsIHNvIGl0IG1heSBiZSBuZWNlc3NhcnkgdG8gcmV2YWxpZGF0ZSAoYnkgY2FsbGluZyAkc2V0Vmlld1ZhbHVlIGFnYWluKSBldmVuIGlmIHRoZVxuICAgICAgICAgICAgICAgIC8vIGNvbnRyb2wncyB2YWx1ZSBpcyB0aGUgc2FtZSBlbXB0eSB2YWx1ZSB0d2ljZSBpbiBhIHJvdy5cbiAgICAgICAgICAgICAgICBpZiAocGxhY2VUb1N0cmluZyhjdHJsLiR2aWV3VmFsdWUpICE9PSByYXdWYWx1ZSB8fCAocmF3VmFsdWUgPT09ICcnICYmIGN0cmwuJCRoYXNOYXRpdmVWYWxpZGF0b3JzKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmF3VmFsdWUgIT09ICcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdHJsLiRzZXRWaWV3VmFsdWUoeyBuYW1lOiByYXdWYWx1ZSB9LCBldmVudCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdHJsLiRzZXRWaWV3VmFsdWUodW5kZWZpbmVkLCBldmVudCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGRlZmVyTGlzdGVuZXIoZXYsIGlucHV0LCBvcmlnVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dCA9ICRicm93c2VyLmRlZmVyKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlucHV0IHx8IGlucHV0LnZhbHVlICE9PSBvcmlnVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcihldik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhlIGJyb3dzZXIgZG9lcyBzdXBwb3J0IFwiaW5wdXRcIiBldmVudCwgd2UgYXJlIGZpbmUgLSBleGNlcHQgb24gSUU5IHdoaWNoIGRvZXNuJ3QgZmlyZSB0aGVcbiAgICAgICAgICAgIC8vIGlucHV0IGV2ZW50IG9uIGJhY2tzcGFjZSwgZGVsZXRlIG9yIGN1dFxuICAgICAgICAgICAgaWYgKCRzbmlmZmVyLmhhc0V2ZW50KCdpbnB1dCcpKSB7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5vbignaW5wdXQnLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW1lbnQub24oJ2tleWRvd24nLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gZXZlbnQua2V5Q29kZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBpZ25vcmVcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgY29tbWFuZCAgICAgICAgICAgIG1vZGlmaWVycyAgICAgICAgICAgICAgICAgICBhcnJvd3NcbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleSA9PT0gOTEgfHwgKDE1IDwga2V5ICYmIGtleSA8IDE5KSB8fCAoMzcgPD0ga2V5ICYmIGtleSA8PSA0MCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGRlZmVyTGlzdGVuZXIoZXZlbnQsIHRoaXMsIHRoaXMudmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgdXNlciBtb2RpZmllcyBpbnB1dCB2YWx1ZSB1c2luZyBjb250ZXh0IG1lbnUgaW4gSUUsIHdlIG5lZWQgXCJwYXN0ZVwiIGFuZCBcImN1dFwiIGV2ZW50cyB0byBjYXRjaCBpdFxuICAgICAgICAgICAgICAgIGlmICgkc25pZmZlci5oYXNFdmVudCgncGFzdGUnKSkge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Lm9uKCdwYXN0ZSBjdXQnLCBkZWZlckxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIHVzZXIgcGFzdGUgaW50byBpbnB1dCB1c2luZyBtb3VzZSBvbiBvbGRlciBicm93c2VyXG4gICAgICAgICAgICAvLyBvciBmb3JtIGF1dG9jb21wbGV0ZSBvbiBuZXdlciBicm93c2VyLCB3ZSBuZWVkIFwiY2hhbmdlXCIgZXZlbnQgdG8gY2F0Y2ggaXRcbiAgICAgICAgICAgIGVsZW1lbnQub24oJ2NoYW5nZScsIGxpc3RlbmVyKTtcblxuXG4gICAgICAgICAgICAvLyAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICAgIC8vIGRlZmluZSB0aGlzIGlucHV0IHJlbmRlciBtZXRob2RcbiAgICAgICAgICAgIC8vICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgICAgY3RybC4kcmVuZGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gcGxhY2VUb1N0cmluZyhjdHJsLiR2aWV3VmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtZW50LnZhbCgpICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnZhbCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZnVuY3Rpb24gcGxhY2VUb1N0cmluZyhwbGFjZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhbmd1bGFyLmlzT2JqZWN0KHBsYWNlKSA/IHBsYWNlLmZvcm1hdHRlZF9hZGRyZXNzIHx8IHBsYWNlLm5hbWUgOiAnJztcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAvLyAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICAgIC8vIHJlZGVmaW5lIHRoaXMgaW5wdXQgaXNFbXB0eSBtZXRob2RcbiAgICAgICAgICAgIC8vICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgICAgY3RybC4kaXNFbXB0eSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICFtY0dvb2dsZVBsYWNlVXRpbHMuaXNWYWxpZEdvb2dsZVBsYWNlKHZhbHVlKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8vIC8qIEBuZ0luamVjdCAqL1xuICAgIC8vIGZ1bmN0aW9uIEF1dG9Db21wbGV0ZUN0cmwoKSB7XG5cbiAgICAvLyB9XG59KSgpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnbWNHb29nbGVQbGFjZScpXG4gICAgICAgIC5wcm92aWRlcignbWNHb29nbGVQbGFjZUFwaScsIE1jR29vZ2xlUGxhY2VBcGlQcm92aWRlcik7XG5cbiAgICBmdW5jdGlvbiBNY0dvb2dsZVBsYWNlQXBpUHJvdmlkZXIoKSB7XG4gICAgICAgIHZhciBjb25maWcgPSB7XG4gICAgICAgICAgICB0cmFuc3BvcnQ6ICdodHRwcycsXG4gICAgICAgICAgICBpc0dvb2dsZU1hcHNGb3JXb3JrOiBmYWxzZSxcbiAgICAgICAgICAgIGNoaW5hOiBmYWxzZSxcbiAgICAgICAgICAgIHY6ICczJyxcbiAgICAgICAgICAgIGxpYnJhcmllczogJ3BsYWNlcycsXG4gICAgICAgICAgICBsYW5ndWFnZTogJ2ZyJ1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuY29uZmlndXJlID0gZnVuY3Rpb24oY2ZnKSB7XG4gICAgICAgICAgICBhbmd1bGFyLmV4dGVuZChjb25maWcsIGNmZyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy4kZ2V0ID0gbWNHb29nbGVQbGFjZUFwaUZhY3Q7XG5cbiAgICAgICAgbWNHb29nbGVQbGFjZUFwaUZhY3QuJGluamVjdCA9IFsnbWNHb29nbGVQbGFjZVNjcmlwdExvYWRlcicsICdsb2dnZXInXTtcbiAgICAgICAgLyogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIG1jR29vZ2xlUGxhY2VBcGlGYWN0KG1jR29vZ2xlUGxhY2VTY3JpcHRMb2FkZXIsIGxvZ2dlcikge1xuICAgICAgICAgICAgcmV0dXJuIG1jR29vZ2xlUGxhY2VTY3JpcHRMb2FkZXIubG9hZChjb25maWcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufSkoKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ21jR29vZ2xlUGxhY2UnKVxuICAgICAgICAuZmFjdG9yeSgnbWNHb29nbGVQbGFjZVNjcmlwdExvYWRlcicsIG1jR29vZ2xlUGxhY2VTY3JpcHRMb2FkZXIpO1xuXG4gICAgbWNHb29nbGVQbGFjZVNjcmlwdExvYWRlci4kaW5qZWN0ID0gWyckcScsICd1dWlkR2VuJ107XG5cbiAgICAvKiBAbmdJbmplY3QgKi9cbiAgICBmdW5jdGlvbiBtY0dvb2dsZVBsYWNlU2NyaXB0TG9hZGVyKCRxLCB1dWlkR2VuKSB7XG4gICAgICAgIHZhciBzY3JpcHRJZCA9IHZvaWQgMDtcblxuICAgICAgICB2YXIgc2VydmljZSA9IHtcbiAgICAgICAgICAgIGxvYWQ6IGxvYWRcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHNlcnZpY2U7XG5cbiAgICAgICAgLy8vLy8vLy8vLy8vLy8vL1xuXG4gICAgICAgIGZ1bmN0aW9uIGdldFNjcmlwdFVybChvcHRpb25zKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jaGluYSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnaHR0cDovL21hcHMuZ29vZ2xlLmNuL21hcHMvYXBpL2pzPyc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnRyYW5zcG9ydCA9PT0gJ2F1dG8nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnLy9tYXBzLmdvb2dsZWFwaXMuY29tL21hcHMvYXBpL2pzPyc7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMudHJhbnNwb3J0ICsgJzovL21hcHMuZ29vZ2xlYXBpcy5jb20vbWFwcy9hcGkvanM/JztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG4gICAgICAgIGZ1bmN0aW9uIGluY2x1ZGVTY3JpcHQob3B0aW9ucykge1xuICAgICAgICAgICAgdmFyIHF1ZXJ5ID0gJ3Y9JyArIG9wdGlvbnMudiArICcmbGlicmFyaWVzPScgKyBvcHRpb25zLmxpYnJhcmllcyArICcmbGFuZ3VhZ2U9JyArIG9wdGlvbnMubGFuZ3VhZ2U7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIHF1ZXJ5ICs9ICcmY2FsbGJhY2s9JyArIG9wdGlvbnMuY2FsbGJhY2s7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuaXNHb29nbGVNYXBzRm9yV29yayAmJiBvcHRpb25zLmtleSkge1xuICAgICAgICAgICAgICAgIHF1ZXJ5ICs9ICcma2V5PScgKyBvcHRpb25zLmtleTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHNjcmlwdEVsZW07XG5cbiAgICAgICAgICAgIGlmIChzY3JpcHRJZCkge1xuICAgICAgICAgICAgICAgIHNjcmlwdEVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzY3JpcHRJZCk7XG4gICAgICAgICAgICAgICAgc2NyaXB0RWxlbS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdEVsZW0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgc2NyaXB0LmlkID0gc2NyaXB0SWQgPSAndWlfZ21hcF9tYXBfbG9hZF8nICsgKHV1aWRHZW4uZ2VuZXJhdGUoKSk7XG4gICAgICAgICAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnO1xuICAgICAgICAgICAgc2NyaXB0LnNyYyA9IGdldFNjcmlwdFVybChvcHRpb25zKSArIHF1ZXJ5O1xuICAgICAgICAgICAgcmV0dXJuIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGlzR29vZ2xlTWFwc0xvYWRlZCgpIHtcbiAgICAgICAgICAgIHJldHVybiBhbmd1bGFyLmlzRGVmaW5lZCh3aW5kb3cuZ29vZ2xlKSAmJiBhbmd1bGFyLmlzRGVmaW5lZCh3aW5kb3cuZ29vZ2xlLm1hcHMpO1xuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBsb2FkKG9wdGlvbnMpIHtcblxuICAgICAgICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcbiAgICAgICAgICAgIGlmIChpc0dvb2dsZU1hcHNMb2FkZWQoKSkge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUod2luZG93Lmdvb2dsZS5tYXBzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHJhbmRvbWl6ZWRGdW5jdGlvbk5hbWUgPSBvcHRpb25zLmNhbGxiYWNrID0gJ29uR29vZ2xlTWFwc1JlYWR5JyArIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDEwMDApO1xuICAgICAgICAgICAgd2luZG93W3JhbmRvbWl6ZWRGdW5jdGlvbk5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgd2luZG93W3JhbmRvbWl6ZWRGdW5jdGlvbk5hbWVdID0gbnVsbDtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHdpbmRvdy5nb29nbGUubWFwcyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKHdpbmRvdy5uYXZpZ2F0b3IuY29ubmVjdGlvbiAmJiB3aW5kb3cuQ29ubmVjdGlvbiAmJiB3aW5kb3cubmF2aWdhdG9yLmNvbm5lY3Rpb24udHlwZSA9PT0gd2luZG93LkNvbm5lY3Rpb24uTk9ORSkge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ29ubGluZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzR29vZ2xlTWFwc0xvYWRlZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5jbHVkZVNjcmlwdChvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbmNsdWRlU2NyaXB0KG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfVxuXG4gICAgfVxufSkoKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ21jR29vZ2xlUGxhY2UnKVxuICAgICAgICAuZmFjdG9yeSgnbWNHb29nbGVQbGFjZVV0aWxzJywgZmFjdG9yeSk7XG5cbiAgICBmYWN0b3J5LiRpbmplY3QgPSBbJ21jR29vZ2xlUGxhY2VBcGknXTtcblxuICAgIC8qIEBuZ0luamVjdCAqL1xuICAgIGZ1bmN0aW9uIGZhY3RvcnkobWNHb29nbGVQbGFjZUFwaSkge1xuXG4gICAgICAgIHZhciBzZXJ2aWNlID0ge1xuICAgICAgICAgICAgaXNWYWxpZEdvb2dsZVBsYWNlOiBpc1ZhbGlkR29vZ2xlUGxhY2UsXG4gICAgICAgICAgICBnZXRTdHJlZXROdW1iZXI6IGdldFN0cmVldE51bWJlcixcbiAgICAgICAgICAgIGdldFN0cmVldDogZ2V0U3RyZWV0LFxuICAgICAgICAgICAgZ2V0Q2l0eTogZ2V0Q2l0eSxcbiAgICAgICAgICAgIGdldFN0YXRlOiBnZXRTdGF0ZSxcbiAgICAgICAgICAgIGdldENvdW50cnlTaG9ydDogZ2V0Q291bnRyeVNob3J0LFxuICAgICAgICAgICAgZ2V0Q291bnRyeTogZ2V0Q291bnRyeSxcbiAgICAgICAgICAgIGdldExhdGl0dWRlOiBnZXRMYXRpdHVkZSxcbiAgICAgICAgICAgIGdldExvbmdpdHVkZTogZ2V0TG9uZ2l0dWRlLFxuICAgICAgICAgICAgZ2V0UG9zdENvZGU6IGdldFBvc3RDb2RlLFxuICAgICAgICAgICAgZ2V0RGlzdHJpY3Q6IGdldERpc3RyaWN0LFxuICAgICAgICAgICAgYnVpbGRBdXRvY29tcGxldGU6IGJ1aWxkQXV0b2NvbXBsZXRlXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBzZXJ2aWNlO1xuXG4gICAgICAgIC8vLy8vLy8vLy8vLy8vLy9cblxuICAgICAgICBmdW5jdGlvbiBidWlsZEF1dG9jb21wbGV0ZShpbnB1dEVsZW1lbnQsIGF1dG9jb21wbGV0ZU9wdGlvbnMsIHBsYWNlQ2hhbmdlZENiKSB7XG5cbiAgICAgICAgICAgIHJldHVybiBtY0dvb2dsZVBsYWNlQXBpLnRoZW4oZnVuY3Rpb24obWFwc0FwaSkge1xuICAgICAgICAgICAgICAgIHZhciBhdXRvY29tcGxldGUgPSBuZXcgbWFwc0FwaS5wbGFjZXMuQXV0b2NvbXBsZXRlKGlucHV0RWxlbWVudCwgYXV0b2NvbXBsZXRlT3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgbWFwc0FwaS5ldmVudC5hZGRMaXN0ZW5lcihhdXRvY29tcGxldGUsICdwbGFjZV9jaGFuZ2VkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHBsYWNlQ2hhbmdlZENiKGF1dG9jb21wbGV0ZS5nZXRQbGFjZSgpKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXV0b2NvbXBsZXRlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBpc1ZhbGlkR29vZ2xlUGxhY2UocGxhY2UpIHtcbiAgICAgICAgICAgIHJldHVybiBhbmd1bGFyLmlzT2JqZWN0KHBsYWNlKSAmJiAhIXBsYWNlLnBsYWNlX2lkO1xuICAgICAgICB9XG5cblxuICAgICAgICBmdW5jdGlvbiBnZXRBZGRyQ29tcG9uZW50KHBsYWNlLCBjb21wb25lbnRUZW1wbGF0ZSkge1xuICAgICAgICAgICAgdmFyIHJlc3VsdDtcbiAgICAgICAgICAgIGlmICghaXNWYWxpZEdvb2dsZVBsYWNlKHBsYWNlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGxhY2UuYWRkcmVzc19jb21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFkZHJlc3NUeXBlID0gcGxhY2UuYWRkcmVzc19jb21wb25lbnRzW2ldLnR5cGVzWzBdO1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnRUZW1wbGF0ZVthZGRyZXNzVHlwZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gcGxhY2UuYWRkcmVzc19jb21wb25lbnRzW2ldW2NvbXBvbmVudFRlbXBsYXRlW2FkZHJlc3NUeXBlXV07XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0U3RyZWV0TnVtYmVyKHBsYWNlKSB7XG4gICAgICAgICAgICB2YXIgQ09NUE9ORU5UX1RFTVBMQVRFID0geyBzdHJlZXRfbnVtYmVyOiAnc2hvcnRfbmFtZScgfSxcbiAgICAgICAgICAgICAgICBzdHJlZXROdW1iZXIgPSBnZXRBZGRyQ29tcG9uZW50KHBsYWNlLCBDT01QT05FTlRfVEVNUExBVEUpO1xuICAgICAgICAgICAgcmV0dXJuIHN0cmVldE51bWJlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFN0cmVldChwbGFjZSkge1xuICAgICAgICAgICAgdmFyIENPTVBPTkVOVF9URU1QTEFURSA9IHsgcm91dGU6ICdsb25nX25hbWUnIH0sXG4gICAgICAgICAgICAgICAgc3RyZWV0ID0gZ2V0QWRkckNvbXBvbmVudChwbGFjZSwgQ09NUE9ORU5UX1RFTVBMQVRFKTtcbiAgICAgICAgICAgIHJldHVybiBzdHJlZXQ7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRDaXR5KHBsYWNlKSB7XG4gICAgICAgICAgICB2YXIgQ09NUE9ORU5UX1RFTVBMQVRFID0geyBsb2NhbGl0eTogJ2xvbmdfbmFtZScgfSxcbiAgICAgICAgICAgICAgICBjaXR5ID0gZ2V0QWRkckNvbXBvbmVudChwbGFjZSwgQ09NUE9ORU5UX1RFTVBMQVRFKTtcbiAgICAgICAgICAgIHJldHVybiBjaXR5O1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0U3RhdGUocGxhY2UpIHtcbiAgICAgICAgICAgIHZhciBDT01QT05FTlRfVEVNUExBVEUgPSB7IGFkbWluaXN0cmF0aXZlX2FyZWFfbGV2ZWxfMTogJ3Nob3J0X25hbWUnIH0sXG4gICAgICAgICAgICAgICAgc3RhdGUgPSBnZXRBZGRyQ29tcG9uZW50KHBsYWNlLCBDT01QT05FTlRfVEVNUExBVEUpO1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0RGlzdHJpY3QocGxhY2UpIHtcbiAgICAgICAgICAgIHZhciBDT01QT05FTlRfVEVNUExBVEUgPSB7IGFkbWluaXN0cmF0aXZlX2FyZWFfbGV2ZWxfMjogJ3Nob3J0X25hbWUnIH0sXG4gICAgICAgICAgICAgICAgc3RhdGUgPSBnZXRBZGRyQ29tcG9uZW50KHBsYWNlLCBDT01QT05FTlRfVEVNUExBVEUpO1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0Q291bnRyeVNob3J0KHBsYWNlKSB7XG4gICAgICAgICAgICB2YXIgQ09NUE9ORU5UX1RFTVBMQVRFID0geyBjb3VudHJ5OiAnc2hvcnRfbmFtZScgfSxcbiAgICAgICAgICAgICAgICBjb3VudHJ5U2hvcnQgPSBnZXRBZGRyQ29tcG9uZW50KHBsYWNlLCBDT01QT05FTlRfVEVNUExBVEUpO1xuICAgICAgICAgICAgcmV0dXJuIGNvdW50cnlTaG9ydDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldENvdW50cnkocGxhY2UpIHtcbiAgICAgICAgICAgIHZhciBDT01QT05FTlRfVEVNUExBVEUgPSB7IGNvdW50cnk6ICdsb25nX25hbWUnIH0sXG4gICAgICAgICAgICAgICAgY291bnRyeSA9IGdldEFkZHJDb21wb25lbnQocGxhY2UsIENPTVBPTkVOVF9URU1QTEFURSk7XG4gICAgICAgICAgICByZXR1cm4gY291bnRyeTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFBvc3RDb2RlKHBsYWNlKSB7XG4gICAgICAgICAgICB2YXIgQ09NUE9ORU5UX1RFTVBMQVRFID0geyBwb3N0YWxfY29kZTogJ2xvbmdfbmFtZScgfSxcbiAgICAgICAgICAgICAgICBwb3N0Q29kZSA9IGdldEFkZHJDb21wb25lbnQocGxhY2UsIENPTVBPTkVOVF9URU1QTEFURSk7XG4gICAgICAgICAgICByZXR1cm4gcG9zdENvZGU7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBpc1dpdGhHZW9tZXRyeShwbGFjZSkge1xuICAgICAgICAgICAgcmV0dXJuIGFuZ3VsYXIuaXNPYmplY3QocGxhY2UpICYmIGFuZ3VsYXIuaXNPYmplY3QocGxhY2UuZ2VvbWV0cnkpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0TGF0aXR1ZGUocGxhY2UpIHtcbiAgICAgICAgICAgIGlmICghaXNXaXRoR2VvbWV0cnkocGxhY2UpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcGxhY2UuZ2VvbWV0cnkubG9jYXRpb24ubGF0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRMb25naXR1ZGUocGxhY2UpIHtcbiAgICAgICAgICAgIGlmICghaXNXaXRoR2VvbWV0cnkocGxhY2UpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcGxhY2UuZ2VvbWV0cnkubG9jYXRpb24ubG5nKCk7XG4gICAgICAgIH1cblxuXG5cbiAgICB9XG59KSgpO1xuIiwiLyoganNoaW50IGlnbm9yZTpzdGFydCAqL1xuKGZ1bmN0aW9uKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnbWNHb29nbGVQbGFjZScpXG4gICAgICAgIC5zZXJ2aWNlKCd1dWlkR2VuJywgdXVpZEdlbik7XG5cbiAgICBmdW5jdGlvbiB1dWlkR2VuKCkge1xuXG4gICAgICAgIC8qXG4gICAgICAgICBWZXJzaW9uOiB2My4zLjBcbiAgICAgICAgIFRoZSBNSVQgTGljZW5zZTogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTYgTGlvc0suXG4gICAgICAgICovXG4gICAgICAgIHZhciBVVUlEO1xuICAgICAgICBVVUlEID0gZnVuY3Rpb24oZykge1xuICAgICAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGYoKSB7fVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBiKGMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMCA+IGMgPyBOYU4gOiAzMCA+PSBjID8gMCB8IE1hdGgucmFuZG9tKCkgKiAoMSA8PCBjKSA6IDUzID49IGMgPyAoMCB8IDEwNzM3NDE4MjQgKiBNYXRoLnJhbmRvbSgpKSArIDEwNzM3NDE4MjQgKiAoMCB8IE1hdGgucmFuZG9tKCkgKiAoMSA8PCBjIC0gMzApKSA6IE5hTlxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBhKGMsIGIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBhID0gYy50b1N0cmluZygxNiksIGQgPSBiIC0gYS5sZW5ndGgsIGUgPSBcIjBcIjsgMCA8IGQ7IGQgPj4+PSAxLCBlICs9IGUpIGQgJiAxICYmIChhID0gZSArIGEpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmLmdlbmVyYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGEoYigzMiksIDgpICsgXCItXCIgKyBhKGIoMTYpLCA0KSArIFwiLVwiICsgYSgxNjM4NCB8IGIoMTIpLCA0KSArIFwiLVwiICsgYSgzMjc2OCB8IGIoMTQpLCA0KSArIFwiLVwiICsgYShiKDQ4KSwgMTIpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZi5vdmVyd3JpdHRlblVVSUQgPSBnO1xuICAgICAgICAgICAgcmV0dXJuIGZcbiAgICAgICAgfShVVUlEKTtcblxuICAgICAgICByZXR1cm4gVVVJRDtcbiAgICB9XG59KSgpO1xuLyoganNoaW50IGlnbm9yZTplbmQgKi9cbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
