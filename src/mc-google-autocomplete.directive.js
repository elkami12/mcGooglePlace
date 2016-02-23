(function() {
    'use strict';

    angular
        .module('mcGooglePlace')
        .directive('mcGoogleAutocomplete', mcGoogleAutocomplete);

    mcGoogleAutocomplete.$inject = ['google', '$sniffer', '$browser'];

    /* @ngInject */
    function mcGoogleAutocomplete(google, $sniffer, $browser) {
        // Usage:
        //
        //	<form>
        //	 	<input	 mc-google-autocomplete
        //	 	         ng-model="address"
        //	 	         name="address"
        //	 	         type="text">
        // 	</form>
        //
        // Creates:
        //
        var directive = {
            require: ['?ngModel'],
            priority: 0.1,
            terminal: true,
            // bindToController: true,
            // controller: AutoCompleteCtrl,
            // controllerAs: 'vm',
            link: {
                pre: function(scope, element, attr, ctrls) {
                    if (ctrls[0]) {
                        linkPre(scope, element, attr, ctrls[0], google, $sniffer, $browser);
                    }
                }
            }
            restrict: 'A',
            scope: {
                gaOptions: '=?'
            }
        };
        return directive;



        function linkPre(scope, element, attr, ctrl, google, $sniffer, $browser) {

            // ************************************************
            // Init the google autocomplete
            // ************************************************
            // google.maps.places.Autocomplete instance (support google.maps.places.AutocompleteOptions)
            var autocompleteOptions = scope.gaOptions || {},
                autocomplete = new google.maps.places.Autocomplete(element[0], autocompleteOptions);


            // ************************************************
            // updates view value (which is a cop of the google place object) on place_changed google api event
            // ************************************************
            google.maps.event.addListener(autocomplete, 'place_changed', function() {
                ctrl.$setViewValue(angular.copy(autocomplete.getPlace()));
            });

            // ************************************************
            // ******** Track any other input change in order to reset to a default viewValue
            // ************************************************

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

            var listener = function(ev) {
                if (timeout) {
                    $browser.defer.cancel(timeout);
                    timeout = null;
                }
                if (composing) return;
                var rawValue = element.val(),
                    event = ev && ev.type;

                rawValue = trim(value);

                // If a control is suffering from bad input (due to native validators), browsers discard its
                // value, so it may be necessary to revalidate (by calling $setViewValue again) even if the
                // control's value is the same empty value twice in a row.
                if (placeToString(ctrl.$viewValue) !== rawValue || (rawValue === '' && ctrl.$$hasNativeValidators)) {
                    ctrl.$setViewValue({ name: rawValue }, event);
                }
            };

            // if the browser does support "input" event, we are fine - except on IE9 which doesn't fire the
            // input event on backspace, delete or cut
            if ($sniffer.hasEvent('input')) {
                element.on('input', listener);
            } else {
                var timeout;

                var deferListener = function(ev, input, origValue) {
                    if (!timeout) {
                        timeout = $browser.defer(function() {
                            timeout = null;
                            if (!input || input.value !== origValue) {
                                listener(ev);
                            }
                        });
                    }
                };

                element.on('keydown', function(event) {
                    var key = event.keyCode;

                    // ignore
                    //    command            modifiers                   arrows
                    if (key === 91 || (15 < key && key < 19) || (37 <= key && key <= 40)) return;

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
                // Workaround for Firefox validation #12102.
                var value = ctrl.$isEmpty(ctrl.$viewValue) ? '' : placeToString(ctrl.$viewValue);
                if (element.val() !== value) {
                    element.val(value);
                }
            };

            function placeToString(place) {
                return place.formatted_address || place.name;
            }


            // ************************************************
            // redefine this input isEmpty method
            // ************************************************
            ctrl.$isEmpty = function(value) {
                return angular.isUndefined(value) || value === null || (angular.isObject(value) && placeToString(value) === '') || value !== value;
            };
        }

    }

    // /* @ngInject */
    // function AutoCompleteCtrl() {

    // }
})();
