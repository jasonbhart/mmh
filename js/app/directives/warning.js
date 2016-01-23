;(function () {
    "use strict";

    var app = angular.module('mmh.directives');
    
    app.directive('warning', [function() {
        return {
            restrict: 'E',
            scope: true,
            templateUrl: 'js/app/tmpl/warning.html',
            link: function(scope, element, attrs) {
                scope.gpsDisabled = false;
                navigator.geolocation.getCurrentPosition(function(){
                }, function(){
                    scope.gpsDisabled = true;
                }, {maximumAge: 60000});
            }
        };
    }]);
})();
