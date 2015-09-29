;(function () {
    "use strict";

    var app = angular.module('mmh.directives');
    
    app.directive('topnav', [function() {
        return {
            restrict: 'E',
            scope: true,
            templateUrl: 'js/app/tmpl/header.html'
        };
    }]);
})();
