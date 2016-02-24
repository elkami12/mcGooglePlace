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
