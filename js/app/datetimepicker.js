(function () {
    var app = angular.module('dateTimePicker', []);
    
    app.directive('dateTimePicker', function() {
        
        var format = 'h:mmA';
        
        return {
            require: 'ngModel',
            restrict: 'E',
            templateUrl: 'js/app/tmpl/datetime-picker.html',
            link: function(scope, elem, attrs, ngModelCtrl) {
                var timepicker = jQuery(elem).find('.date').datetimepicker({
                    format: format,
                    stepping: 15,
                    showClose: true,
                }).on('dp.change', function() {
                    var date = timepicker.date().format(format);
                    ngModelCtrl.$setViewValue(date);
                });
                
                timepicker = timepicker.data('DateTimePicker');

                // model -> view
                ngModelCtrl.$formatters.push(function(modelValue) {
                    return modelValue || null;
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