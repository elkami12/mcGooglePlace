(function() {
    'use strict';

    angular
        .module('mcGoogleAutocomplete')
        .factory('mcGooglePlaceUtils', factory);

    // factory.$inject = [];

    /* @ngInject */
    function factory() {
        var service = {
            isGooglePlace: isGooglePlace,
            isContainTypes: isContainTypes,
            getPlaceId: getPlaceId,
            getStreetNumber: getStreetNumber,
            getStreet: getStreet,
            getCity: getCity,
            getState: getState,
            getCountryShort: getCountryShort,
            getCountry: getCountry,
            getLatitude: getLatitude,
            getLongitude: getLongitude,
            getPostCode: getPostCode,
            getDistrict: getDistrict
        };
        return service;

        ////////////////

        function isGooglePlace(place) {
            if (!place)
                return false;
            return !!place.place_id;
        }

        function isContainTypes(place, types) {
            var placeTypes,
                placeType,
                type;
            if (!isGooglePlace(place))
                return false;
            placeTypes = place.types;
            for (var i = 0; i < types.length; i++) {
                type = types[i];
                for (var j = 0; j < placeTypes.length; j++) {
                    placeType = placeTypes[j];
                    if (placeType === type) {
                        return true;
                    }
                }
            }
            return false;
        }

        function getAddrComponent(place, componentTemplate) {
            var result;
            if (!isGooglePlace(place))
                return;
            for (var i = 0; i < place.address_components.length; i++) {
                var addressType = place.address_components[i].types[0];
                if (componentTemplate[addressType]) {
                    result = place.address_components[i][componentTemplate[addressType]];
                    return result;
                }
            }
            return;
        }

        function getPlaceId(place) {
            if (!isGooglePlace(place))
                return;
            return place.place_id;
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

        function isGeometryExist(place) {
            return angular.isObject(place) && angular.isObject(place.geometry);
        }

        function getLatitude(place) {
            if (!isGeometryExist(place)) return;
            return place.geometry.location.lat();
        }

        function getLongitude(place) {
            if (!isGeometryExist(place)) return;
            return place.geometry.location.lng();
        }



    }
})();
