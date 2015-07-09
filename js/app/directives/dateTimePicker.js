;(function () {
    "use strict";

    var app = angular.module('mmh.directives');
    
    app.directive('dateTimePicker', function() {
        return {
            require: 'ngModel',
            restrict: 'E',
            scope: {
                timeFormat: '@'
            },
            templateUrl: 'js/app/tmpl/dateTimePicker.html',
            link: function(scope, elem, attrs, ngModelCtrl) {
                var timepicker = jQuery(elem).find('.date').datetimepicker({
                    format: scope.timeFormat,
                    stepping: 15,
                    showClose: true,
                }).on('dp.change', function() {
                    var date = timepicker.date().local();
                    ngModelCtrl.$setViewValue(date);
                });
                
                timepicker = timepicker.data('DateTimePicker');

                // model -> view
                ngModelCtrl.$formatters.push(function(modelValue) {
                    return modelValue || moment().local();
                });
                
                // view -> model
                ngModelCtrl.$parsers.push(function(viewValue) {
                    return viewValue;
                });
                
                ngModelCtrl.$render = function() {
                    timepicker.date(ngModelCtrl.$viewValue);
                };
            }
        }
    });
})();
