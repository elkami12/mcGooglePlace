(function() {
    'use strict';

    angular
        .module('mcGooglePlace')
        .provider('mcGooglePlaceApi', mcGooglePlaceApiProvider);

    function mcGooglePlaceApiProvider() {

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
