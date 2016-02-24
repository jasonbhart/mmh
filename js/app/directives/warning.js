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
                if (!$.cookie('gpsEnabled')) {
                    navigator.geolocation.getCurrentPosition(function(){
                        $.cookie('gpsEnabled', '1', {path: '/', expires: 0.007});
                    }, function(){
                        scope.gpsDisabled = true;
                    }, {maximumAge: 60000});
                }
                
                
                if (Notification && Notification.permission === 'denied') {
                    scope.notificationDisabled = true;
                }
                
            }
        };
    }]);
})();
