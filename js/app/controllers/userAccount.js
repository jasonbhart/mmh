;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    app.controller('userAccountController', ['$scope', '$log', 'sessionService', function($scope, $log, sessionService) {
        $scope.isAuthenticated = false;
        $scope.user = null;

        $scope.login = function() { 
            sessionService.login(sessionService.FACEBOOK);
        }

        $scope.logout = function() {
            sessionService.logout();
        }
        
        $scope.$on('auth.changed', function(evt, user) {
            $log.log('Event: auth.changed', user);
            $scope.user = user;
            $scope.isAuthenticated = !user.isAnonymous();
        });
    }]);
})();
