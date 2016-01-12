;(function () {
    "use strict";

    var app = angular.module('mmh.directives');
    
    app.directive('dateTimePicker', function() {
        return {
            require: 'ngModel',
            restrict: 'E',
            scope: {
                format: '@'
            },
            template: '<div class="box-inner"><div class="datetimepicker"></div><div class="clear"></div></div>',
            link: function(scope, elem, attrs, ngModelCtrl) {
                var dateTimePicker;

                // one time watch
                var unwatchFormat = scope.$watch('format', function(value) {
                    if (!value)
                        return;
                    dateTimePicker = elem.find('.datetimepicker').datetimepicker({
                        defaultDate: roundTime(moment().add(15, 'minutes')),
                        format: value,
                        inline: true,
                        sideBySide: true,
                        stepping: 15
                    }).on('dp.change', function() {
                        var date = dateTimePicker.date().local();
                        ngModelCtrl.$setViewValue(date);
                    });

                    dateTimePicker = dateTimePicker.data('DateTimePicker');
                    
                    // initial set model value (date) (apply stepping and update model)
                    ngModelCtrl.$viewValue = roundTime(ngModelCtrl.$viewValue.add(15, 'minutes'));
                    dateTimePicker.date(ngModelCtrl.$viewValue);
                    
                    ngModelCtrl.$render = function() {
                        console.log('render', ngModelCtrl.$viewValue);
                        dateTimePicker.date(ngModelCtrl.$viewValue);
                    };

                    unwatchFormat();
                });

                // model -> view
                ngModelCtrl.$formatters.push(function(modelValue) {
                    return modelValue || moment().local();
                });
                
                // view -> model
                ngModelCtrl.$parsers.push(function(viewValue) {
                    return viewValue;
                });
                
                function roundTime(moment) {
                    return moment.subtract(moment.minute()%15, 'minutes').seconds(0).millisecond(0);
                }
            }
        }
    });
})();
