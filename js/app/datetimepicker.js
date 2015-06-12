(function () {
    var app = angular.module('dateTimePicker', []);
    
    app.directive('dateTimePicker', function() {
        return {
            require: 'ngModel',
            restrict: 'E',
            scope: {
                timeFormat: '@'
            },
            templateUrl: 'js/app/tmpl/datetime-picker.html',
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
                    return modelValue || new moment().local();
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