(function() {
    'use strict';

    angular
        .module('mcGooglePlace')
        .factory('mcGooglePlaceScriptLoader', mcGooglePlaceScriptLoader);

    mcGooglePlaceScriptLoader.$inject = ['$q', 'uuidGen'];

    /* @ngInject */
    function mcGooglePlaceScriptLoader($q, uuidGen) {
        var service = {
            load: load
        };
        return service;

        ////////////////

        var scriptId = void 0;


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
            script.id = scriptId = "ui_gmap_map_load_" + (uuidGen.generate());
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
