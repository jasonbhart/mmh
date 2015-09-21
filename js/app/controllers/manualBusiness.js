;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // Location map popup controller
    app.controller(
        'ManualBusinessController',
        ['$scope', 'modalInstance', 'business', function ($scope, modalInstance, business) {
            $scope.name = business.name;
            $scope.city = business.city;
            $scope.country_code = business.country_code;
            $scope.url= business.url;
            
            var newBusiness = {
                'rating_url' : '',
                'type' : '',
                'location' : ''
            };

            $scope.confirm = function() {
                newBusiness.name = $scope.name ? $scope.name : '';
                newBusiness.city = $scope.city ? $scope.city : '';
                newBusiness.country_code = $scope.country_code ? $scope.country_code : '';
                newBusiness.url = $scope.url ? $scope.url : '';

                modalInstance.close(newBusiness);
            }

            $scope.cancel = function() {
                modalInstance.dismiss();
            }
        }
    ]);
})();
