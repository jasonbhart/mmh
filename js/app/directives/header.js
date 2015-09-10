;(function () {
    "use strict";

    var app = angular.module('mmh.directives');
    
    app.directive('header', ['util', function(util) {
        return {
            restrict: 'E',
            scope: {
            },
            templateUrl: 'js/app/tmpl/header.html',
            link: function(scope) {
                if (window.location.href.indexOf('create_new_meeting') > -1) {
                    scope.currentPage = 3;              // new meet page
                } else if (window.location.href.indexOf('meeting') > -1) {
                    scope.currentPage = 2;              // meeting page
                } else {
                    scope.currentPage = 1;              // homepage
                }
            }
        };
    }]);
})();
