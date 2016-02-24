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
