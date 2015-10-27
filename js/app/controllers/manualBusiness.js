;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // Location map popup controller
    app.controller(
        'ManualBusinessController',
        ['$scope', 'modalInstance', 'dataProvider', 'options', function ($scope, modalInstance, dataProvider, options) {
            $scope.business_name = '';
            $scope.business = {};
            $scope.places = [];

            $scope.showPlaceSuggestion = function() {
                options.term = encodeURIComponent($scope.business_name);
                options.limit = 5;
                dataProvider.getSuggestions(options).then(function(suggestions) {
                    $scope.places = suggestions;
                });
            };
            
            $scope.showPlaceSuggestion();
            
            $scope.confirm = function() {
                modalInstance.close($scope.business);
            }

            $scope.cancel = function() {
                modalInstance.dismiss();
            }
        }
    ]);
})();
