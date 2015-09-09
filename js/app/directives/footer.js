;(function () {
    "use strict";

    var app = angular.module('mmh.directives');
    
    app.directive('footer', [function() {
        return {
            restrict: 'E',
            scope: {
            },
            templateUrl: 'js/app/tmpl/footer.html',
            link: function() {
            }
        };
    }]);
})();
