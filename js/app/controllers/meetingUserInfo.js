;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // Location map popup controller
    app.controller(
        'MeetingUserInfoController',
        ['$scope', 'modalInstance', 'userInfo', function ($scope, modalInstance, userInfo) {

        $scope.userInfo = userInfo;

        $scope.close = function() {
            modalInstance.dismiss();
        }
    }]);
})();
