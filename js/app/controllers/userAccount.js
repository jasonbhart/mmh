;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    app.controller('userAccountController', ['$scope', '$log', 'authProviders', 'sessionService', function($scope, $log, authProviders, sessionService) {
        $scope.isAuthenticated = false;
        $scope.user = null;

        $scope.login = function() { 
            sessionService.login(authProviders.FACEBOOK);
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
