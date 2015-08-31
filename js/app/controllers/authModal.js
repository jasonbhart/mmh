;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    app.controller(
        'AuthModalController',
        ['$scope', 'modalInstance', 'authProviders', 'sessionService', function ($scope, modalInstance, authProviders, sessionService) {

        $scope.loginFacebook = function() {
            sessionService.login(authProviders.FACEBOOK);
            modalInstance.dismiss();
        }

    }]);
})();
